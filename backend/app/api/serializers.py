"""Turn ORM rows into API models. Kept in one place so every router agrees on shapes."""

from __future__ import annotations

import contextlib
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Connection, Employee, MatchScore, OutreachMessage, ReferralRequest
from app.schemas import (
    ConnectionOut,
    EmployeeBrief,
    EventOut,
    LastMessageBrief,
    MessageOut,
    RequestDetail,
    RequestSummary,
)
from app.services.lifecycle import LABELS, STALE_AFTER_DAYS, TRANSITIONS, Status
from app.services.referrals import shared_history


def connection_out(c: Connection) -> ConnectionOut:
    return ConnectionOut(
        employee=EmployeeBrief.model_validate(c.employee),
        strength=float(c.strength),
        shared_history=shared_history(c),
        connected_on=c.connected_on,
        breakdown=c.strength_breakdown,
    )


def connections_by_contact(
    db: Session, contact_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, list[Connection]]:
    ids = list(contact_ids)
    if not ids:
        return {}
    rows = db.scalars(
        select(Connection)
        .options(selectinload(Connection.employee))
        .where(Connection.contact_id.in_(ids))
        .order_by(Connection.strength.desc())
    ).all()
    out: dict[uuid.UUID, list[Connection]] = {}
    for c in rows:
        out.setdefault(c.contact_id, []).append(c)
    return out


def actor_label(actor: str, employees: dict[uuid.UUID, str]) -> str:
    if actor.startswith("employee:"):
        try:
            return employees.get(uuid.UUID(actor.split(":", 1)[1]), "Employee")
        except ValueError:
            return "Employee"
    if actor == "system":
        return "VOUCH"
    return actor


def waiting_days(r: ReferralRequest, now: datetime | None = None) -> int | None:
    """Days the candidate has been waited on since the employee agreed to reach out."""
    if r.status != Status.EMPLOYEE_ACCEPTED.value:
        return None
    since = next(
        (e.created_at for e in reversed(r.events) if e.to_status == r.status), r.updated_at
    )
    return ((now or datetime.now(UTC)) - since).days


def _last_message(r: ReferralRequest) -> LastMessageBrief | None:
    if not r.messages:
        return None
    m = r.messages[-1]
    body = " ".join(m.body.split())
    return LastMessageBrief(
        excerpt=body[:180] + ("…" if len(body) > 180 else ""),
        delivered=m.delivered,
        error=m.error,
        created_at=m.created_at,
        employee_name=m.employee.full_name,
    )


def request_summary(r: ReferralRequest) -> RequestSummary:
    days = waiting_days(r)
    return RequestSummary(
        id=r.id,
        status=Status(r.status),
        status_label=LABELS[Status(r.status)],
        contact=r.contact,
        role=r.role,
        employee=r.employee,
        requested_by=r.requested_by,
        created_at=r.created_at,
        updated_at=r.updated_at,
        last_event_at=r.events[-1].created_at if r.events else None,
        days_waiting=days,
        stale=days is not None and days >= STALE_AFTER_DAYS,
        last_message=_last_message(r),
    )


def request_detail(db: Session, r: ReferralRequest) -> RequestDetail:
    actor_ids: set[uuid.UUID] = set()
    for e in r.events:
        if e.actor.startswith("employee:"):
            with contextlib.suppress(ValueError):
                actor_ids.add(uuid.UUID(e.actor.split(":", 1)[1]))
    names = (
        {
            e.id: e.full_name
            for e in db.scalars(select(Employee).where(Employee.id.in_(actor_ids))).all()
        }
        if actor_ids
        else {}
    )
    connection = db.get(Connection, {"employee_id": r.employee_id, "contact_id": r.contact_id})
    ms = db.get(MatchScore, {"role_id": r.role_id, "contact_id": r.contact_id})
    summary = request_summary(r)
    return RequestDetail(
        **summary.model_dump(),
        outreach_casual=r.outreach_casual,
        outreach_formal=r.outreach_formal,
        closed_outcome=r.closed_outcome,
        allowed_transitions=sorted(TRANSITIONS[Status(r.status)], key=lambda s: s.value),
        connection=connection_out(connection) if connection else None,
        reasons=ms.reasons if ms else [],
        events=[
            EventOut(
                id=e.id,
                from_status=Status(e.from_status) if e.from_status else None,
                to_status=Status(e.to_status),
                actor=e.actor,
                actor_label=actor_label(e.actor, names),
                note=e.note,
                created_at=e.created_at,
            )
            for e in r.events
        ],
        messages=[
            MessageOut(
                id=m.id,
                channel=m.channel,
                recipient=m.recipient,
                body=m.body,
                delivered=m.delivered,
                error=m.error,
                created_at=m.created_at,
                employee=EmployeeBrief.model_validate(m.employee),
            )
            for m in r.messages
        ],
    )


REQUEST_LOAD_OPTIONS = (
    selectinload(ReferralRequest.contact),
    selectinload(ReferralRequest.role),
    selectinload(ReferralRequest.employee),
    selectinload(ReferralRequest.events),
    selectinload(ReferralRequest.messages).selectinload(OutreachMessage.employee),
)
