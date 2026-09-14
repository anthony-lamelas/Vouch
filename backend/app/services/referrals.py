"""Referral request orchestration: create, transition, re-route, notify."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import Settings
from app.models import (
    Connection,
    Contact,
    Employee,
    MatchScore,
    OutreachMessage,
    ReferralEvent,
    ReferralRequest,
    Role,
)
from app.services.lifecycle import (
    ACTIVE_STATUSES,
    DeclineReason,
    IllegalTransitionError,
    Status,
    assert_transition,
)
from app.services.outreach import Drafts, OutreachContext, OutreachGenerator
from app.services.ownership import display_name, recruiter_names
from app.services.slack import (
    Notifier,
    action_buttons,
    build_request_blocks,
    resolve_recipient,
    routing_reason,
    status_blocks,
)


class ActiveRequestExistsError(Exception):
    def __init__(self, contact_id: uuid.UUID) -> None:
        super().__init__(f"Contact {contact_id} already has an active referral request")


class NoConnectionError(Exception):
    pass


class NotFoundError(Exception):
    pass


def employee_actor(employee: Employee) -> str:
    return f"employee:{employee.id}"


def strongest_connection(
    db: Session, contact_id: uuid.UUID, *, exclude: set[uuid.UUID] | None = None
) -> Connection | None:
    stmt = (
        select(Connection)
        .options(selectinload(Connection.employee))
        .where(Connection.contact_id == contact_id)
        .order_by(Connection.strength.desc())
    )
    if exclude:
        stmt = stmt.where(Connection.employee_id.not_in(exclude))
    return db.scalars(stmt).first()


def connection_for(db: Session, contact_id: uuid.UUID, employee_id: uuid.UUID) -> Connection | None:
    return db.get(Connection, {"employee_id": employee_id, "contact_id": contact_id})


def shared_history(connection: Connection | None) -> str | None:
    if connection is None:
        return None
    b = connection.strength_breakdown
    detail = b.get("overlap_detail") or b.get("school_detail")
    return str(detail) if detail else None


def fit_reasons(db: Session, contact_id: uuid.UUID, role_id: uuid.UUID) -> list[str]:
    ms = db.get(MatchScore, {"role_id": role_id, "contact_id": contact_id})
    if ms is None:
        return []
    out: list[str] = []
    for r in ms.reasons:
        label = str(r.get("label", ""))
        detail = r.get("detail")
        out.append(f"{label}: {detail}" if detail else label)
    return out


def build_context(
    *,
    contact: Contact,
    role: Role,
    employee: Employee,
    connection: Connection | None,
    reasons: list[str],
    recruiter_name: str = "",
) -> OutreachContext:
    return OutreachContext(
        contact_full_name=contact.full_name,
        contact_title=contact.current_title,
        contact_company=contact.current_company,
        role_title=role.title,
        role_team=role.team,
        role_location=role.location,
        role_url=role.job_url,
        employee_first_name=employee.full_name.split(" ")[0],
        shared_history=shared_history(connection),
        fit_reasons=reasons,
        recruiter_first_name=recruiter_name.split(" ")[0] if recruiter_name else "",
    )


@dataclass
class ReferralService:
    db: Session
    settings: Settings
    notifier: Notifier
    generator: OutreachGenerator

    # ---- reads -------------------------------------------------------------------------------

    def get(self, request_id: uuid.UUID) -> ReferralRequest:
        req = self.db.get(
            ReferralRequest,
            request_id,
            options=[
                selectinload(ReferralRequest.contact),
                selectinload(ReferralRequest.role),
                selectinload(ReferralRequest.employee),
                selectinload(ReferralRequest.events),
                selectinload(ReferralRequest.messages).selectinload(OutreachMessage.employee),
            ],
            populate_existing=True,
        )
        if req is None:
            raise NotFoundError(str(request_id))
        return req

    # ---- create ------------------------------------------------------------------------------

    def preview(
        self,
        *,
        contact_id: uuid.UUID,
        role_id: uuid.UUID,
        employee_id: uuid.UUID | None,
        recruiter_name: str = "",
    ) -> tuple[Connection, OutreachContext, Drafts]:
        """What an ask would send, without sending it."""
        contact = self.db.get(Contact, contact_id)
        role = self.db.get(Role, role_id)
        if contact is None or role is None:
            raise NotFoundError("contact or role")
        connection = (
            connection_for(self.db, contact_id, employee_id)
            if employee_id
            else strongest_connection(self.db, contact_id)
        )
        if connection is None:
            raise NoConnectionError("No employee is connected to this contact")
        employee = connection.employee or self.db.get(Employee, connection.employee_id)
        assert employee is not None
        ctx = build_context(
            contact=contact,
            role=role,
            employee=employee,
            connection=connection,
            reasons=fit_reasons(self.db, contact_id, role_id),
            recruiter_name=recruiter_name,
        )
        return connection, ctx, self.generator.generate(ctx)

    def create(
        self,
        *,
        contact_id: uuid.UUID,
        role_id: uuid.UUID,
        employee_id: uuid.UUID | None,
        requested_by: str,
        message: str | None = None,
        recruiter_name: str = "",
    ) -> ReferralRequest:
        contact = self.db.get(Contact, contact_id)
        role = self.db.get(Role, role_id)
        if contact is None or role is None:
            raise NotFoundError("contact or role")
        active = self.db.scalars(
            select(ReferralRequest).where(
                ReferralRequest.contact_id == contact_id,
                ReferralRequest.status.in_([s.value for s in ACTIVE_STATUSES]),
            )
        ).first()
        if active is not None:
            raise ActiveRequestExistsError(contact_id)

        connection = (
            connection_for(self.db, contact_id, employee_id)
            if employee_id
            else strongest_connection(self.db, contact_id)
        )
        if connection is None:
            raise NoConnectionError("No employee is connected to this contact")
        employee = (
            connection.employee
            if connection.employee
            else self.db.get(Employee, connection.employee_id)
        )
        assert employee is not None

        ctx = build_context(
            contact=contact,
            role=role,
            employee=employee,
            connection=connection,
            reasons=fit_reasons(self.db, contact_id, role_id),
            recruiter_name=recruiter_name,
        )
        drafts = self.generator.generate(ctx)
        if message and message.strip():
            drafts = Drafts(
                ask=message.strip(),
                casual=drafts.casual,
                formal=drafts.formal,
                generator="recruiter",
            )
        req = ReferralRequest(
            contact_id=contact_id,
            role_id=role_id,
            employee_id=employee.id,
            status=Status.REQUESTED.value,
            requested_by=requested_by,
            outreach_casual=drafts.ask,  # what the employee received
            outreach_formal=drafts.formal,
        )
        self.db.add(req)
        try:
            self.db.flush()
        except IntegrityError as exc:
            self.db.rollback()
            raise ActiveRequestExistsError(contact_id) from exc
        self._event(req, None, Status.REQUESTED, requested_by, f"Asked {employee.full_name}")
        self._notify(req, ctx, drafts, employee)
        self.db.commit()
        return self.get(req.id)

    # ---- transitions -------------------------------------------------------------------------

    def transition(
        self,
        request_id: uuid.UUID,
        *,
        to_status: Status,
        actor: str,
        note: str | None = None,
        reason: DeclineReason | None = None,
    ) -> ReferralRequest:
        req = self.get(request_id)
        current = Status(req.status)
        assert_transition(current, to_status)
        if to_status == Status.EMPLOYEE_DECLINED and not note:
            note = {
                DeclineReason.DONT_KNOW_WELL: "Doesn't know them well",
                DeclineReason.NOT_A_FIT: "Not a fit for this role",
                None: "Declined to refer",
            }[reason]
        req.status = to_status.value
        if to_status == Status.CLOSED:
            req.closed_outcome = note
        self._event(req, current, to_status, actor, note)
        self._update_slack(req, to_status)
        if to_status == Status.EMPLOYEE_DECLINED:
            self._reroute(req)
        elif to_status == Status.CANDIDATE_DECLINED:
            self._auto_close(req, "Closed automatically: candidate passed")
        self.db.commit()
        return self.get(req.id)

    def _auto_close(self, req: ReferralRequest, note: str) -> None:
        current = Status(req.status)
        req.status = Status.CLOSED.value
        req.closed_outcome = note
        self._event(req, current, Status.CLOSED, "system", note)
        self._update_slack(req, Status.CLOSED)

    def nudge(self, request_id: uuid.UUID, *, actor_email: str, actor_name: str) -> ReferralRequest:
        """Ping the employee again about a request they agreed to act on."""
        req = self.get(request_id)
        current = Status(req.status)
        if current != Status.EMPLOYEE_ACCEPTED:
            raise IllegalTransitionError(current, current)
        employee = req.employee
        contact_first = req.contact.full_name.split(" ")[0]
        text = (
            f"Quick nudge from {actor_name}: any word from {contact_first} about "
            f"*<{req.role.job_url}|{req.role.title}>*? Tap a button below when you know, "
            f"or just reply here."
        )
        blocks: list[dict[str, Any]] = [
            {"type": "section", "text": {"type": "mrkdwn", "text": text}},
            {
                "type": "actions",
                "block_id": "vouch_actions",
                "elements": action_buttons(current, str(req.id), contact_first),
            },
        ]
        recipient, _ = resolve_recipient(
            self.settings, employee, requester_email=req.requested_by, notifier=self.notifier
        )
        result = (
            self.notifier.send(
                recipient=recipient,
                text=f"Nudge: any word from {contact_first} about {req.role.title}?",
                blocks=blocks,
            )
            if recipient
            else None
        )
        message = OutreachMessage(
            request_id=req.id,
            employee_id=employee.id,
            channel="slack",
            recipient=recipient or "(no slack user)",
            body=f"Quick nudge from {actor_name}: any word from {contact_first} about "
            f"{req.role.title}?",
            blocks=blocks,
            external_channel_id=result.channel_id if result else None,
            external_ts=result.ts if result else None,
            delivered=bool(result and result.delivered),
            error=(result.error if result else "no_recipient"),
        )
        message.employee = employee
        req.messages.append(message)
        # Same-state event: resets the stale clock and shows in the timeline.
        self._event(req, current, current, actor_email, f"Nudged {employee.full_name}")
        self.db.commit()
        return self.get(req.id)

    def transition_path(
        self,
        request_id: uuid.UUID,
        *,
        path: list[Status],
        actor: str,
        note: str | None,
        reason: DeclineReason | None,
    ) -> ReferralRequest:
        """Apply several legal steps at once (a free-text reply may imply intermediate states)."""
        req = self.get(request_id)
        for i, step in enumerate(path):
            is_last = i == len(path) - 1
            req = self.transition(
                req.id,
                to_status=step,
                actor=actor,
                note=note if is_last else None,
                reason=reason if is_last else None,
            )
        return req

    def _reroute(self, req: ReferralRequest) -> None:
        """After an employee declines, ask the next-strongest connection if there is one."""
        declined = {
            uuid.UUID(e.actor.split(":", 1)[1])
            for e in req.events
            if e.to_status == Status.EMPLOYEE_DECLINED.value and e.actor.startswith("employee:")
        }
        declined.add(req.employee_id)
        nxt = strongest_connection(self.db, req.contact_id, exclude=declined)
        if nxt is None:
            self._auto_close(
                req, "Closed automatically: no other colleague is connected to this person"
            )
            return
        previous = req.employee
        employee = nxt.employee
        req.employee_id = employee.id
        req.status = Status.REQUESTED.value
        self.db.flush()
        self.db.refresh(req)
        self._event(
            req,
            Status.EMPLOYEE_DECLINED,
            Status.REQUESTED,
            "system",
            f"Re-routed from {previous.full_name} to {employee.full_name} "
            f"(next-strongest connection, {float(nxt.strength):.2f})",
        )
        ctx = build_context(
            contact=req.contact,
            role=req.role,
            employee=employee,
            connection=nxt,
            reasons=fit_reasons(self.db, req.contact_id, req.role_id),
        )
        drafts = self.generator.generate(ctx)
        req.outreach_casual, req.outreach_formal = drafts.ask, drafts.formal
        self._notify(req, ctx, drafts, employee)

    # ---- internals ---------------------------------------------------------------------------

    def _event(
        self,
        req: ReferralRequest,
        from_status: Status | None,
        to_status: Status,
        actor: str,
        note: str | None,
        at: datetime | None = None,
    ) -> ReferralEvent:
        event = ReferralEvent(
            request_id=req.id,
            from_status=from_status.value if from_status else None,
            to_status=to_status.value,
            actor=actor,
            note=note,
        )
        if at is not None:
            event.created_at = at
        req.events.append(event)
        self.db.flush()
        return event

    def _notify(
        self, req: ReferralRequest, ctx: OutreachContext, drafts: Drafts, employee: Employee
    ) -> OutreachMessage:
        recipient, demo_routed = resolve_recipient(
            self.settings, employee, requester_email=req.requested_by, notifier=self.notifier
        )
        blocks = build_request_blocks(
            request=req,
            ctx=ctx,
            drafts=drafts,
            employee=employee,
            demo_routed=demo_routed,
            app_url=self.settings.app_base_url,
            requested_by_name=display_name(req.requested_by, recruiter_names(self.db)),
            routing_note=routing_reason(
                self.settings, employee, recipient, requester_email=req.requested_by
            ),
        )
        text = (
            f"Referral request: could you reach out to {ctx.contact_full_name} "
            f"about {ctx.role_title}?"
        )
        result = (
            self.notifier.send(recipient=recipient, text=text, blocks=blocks) if recipient else None
        )
        message = OutreachMessage(
            request_id=req.id,
            employee_id=employee.id,
            channel="slack",
            recipient=recipient or "(no slack user)",
            body=drafts.ask,
            blocks=blocks,
            external_channel_id=result.channel_id if result else None,
            external_ts=result.ts if result else None,
            delivered=bool(result and result.delivered),
            error=(result.error if result else "no_recipient"),
        )
        message.employee = employee
        req.messages.append(message)
        self.db.flush()
        return message

    def _update_slack(self, req: ReferralRequest, status: Status) -> None:
        latest = next(
            (m for m in reversed(req.messages) if m.external_channel_id and m.external_ts), None
        )
        if latest is None:
            return
        blocks = status_blocks(
            list(latest.blocks),
            status,
            str(req.id),
            contact_first=req.contact.full_name.split(" ")[0],
            employee_first=req.employee.full_name.split(" ")[0],
        )
        self.notifier.update(
            channel_id=str(latest.external_channel_id),
            ts=str(latest.external_ts),
            text=f"Referral request update: {status.value}",
            blocks=blocks,
        )


def latest_open_request_for_slack_user(
    db: Session, *, channel_id: str, thread_ts: str | None
) -> ReferralRequest | None:
    """Which request a free-text DM refers to: the thread's message, else the newest open one."""
    if thread_ts:
        msg = db.scalars(
            select(OutreachMessage).where(OutreachMessage.external_ts == thread_ts)
        ).first()
        if msg is not None:
            return db.get(ReferralRequest, msg.request_id)
    row = db.execute(
        select(OutreachMessage.request_id)
        .join(ReferralRequest, ReferralRequest.id == OutreachMessage.request_id)
        .where(
            OutreachMessage.external_channel_id == channel_id,
            ReferralRequest.status.in_([s.value for s in ACTIVE_STATUSES]),
        )
        .order_by(OutreachMessage.created_at.desc())
    ).first()
    return db.get(ReferralRequest, row[0]) if row else None


def serialize_breakdown(connection: Connection) -> dict[str, Any]:
    return {"strength": float(connection.strength), **connection.strength_breakdown}
