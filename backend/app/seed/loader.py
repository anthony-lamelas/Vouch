"""Persist the synthetic graph, sync roles, precompute scores and pre-seed demo requests."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, insert, select, text
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import (
    CompanyTier,
    Connection,
    Contact,
    Employee,
    MatchScore,
    OutreachMessage,
    ReferralEvent,
    ReferralRequest,
    Role,
    SchoolTier,
)
from app.seed import pools
from app.seed.generate import generate_graph
from app.services.ashby import fetch_or_snapshot, sync_roles
from app.services.lifecycle import Status
from app.services.matching import recompute_match_scores
from app.services.outreach import TemplateGenerator
from app.services.referrals import (
    build_context,
    employee_actor,
    fit_reasons,
    strongest_connection,
)

RECRUITER = "demo-recruiter@cognition.ai"

TABLES_IN_DELETE_ORDER = (
    "referral_event",
    "outreach_message",
    "referral_request",
    "match_score",
    "connection",
    "contact",
    "employee",
    "role",
    "company_tier",
    "school_tier",
    "slack_event",
)


@dataclass(frozen=True)
class SeedReport:
    employees: int
    contacts: int
    connections: int
    roles: int
    roles_source: str
    match_scores: int
    requests: int


def truncate_all(db: Session) -> None:
    db.execute(text(f"TRUNCATE {', '.join(TABLES_IN_DELETE_ORDER)} RESTART IDENTITY CASCADE"))


def seed_database(db: Session, settings: Settings, *, prefer_live_roles: bool = True) -> SeedReport:
    truncate_all(db)
    db.add_all([CompanyTier(name=n, tier=t) for n, t in pools.COMPANY_TIERS.items()])
    db.add_all([SchoolTier(name=n, tier=t) for n, t in pools.SCHOOL_TIERS.items()])
    db.flush()

    graph = generate_graph(
        seed=settings.seed_random_seed,
        employee_count=settings.seed_employee_count,
        contact_count=settings.seed_contact_count,
        demo_email=settings.demo_employee_email,
    )

    employee_ids = [uuid.uuid4() for _ in graph.employees]
    db.execute(
        insert(Employee),
        [
            {
                "id": employee_ids[i],
                "full_name": e.full_name,
                "email": e.email,
                "title": e.title,
                "department": e.department,
                "team": e.team,
                "start_date": e.start_date,
                "slack_user_id": settings.slack_demo_user_id if e.is_demo else None,
                "experiences": e.experiences,
                "education": e.education,
            }
            for i, e in enumerate(graph.employees)
        ],
    )
    contact_ids = [uuid.uuid4() for _ in graph.contacts]
    contact_rows: list[dict[str, Any]] = [
        {
            "id": contact_ids[i],
            "linkedin_url": c.linkedin_url,
            "full_name": c.full_name,
            "headline": c.headline,
            "location": c.location,
            "current_company": c.current_company,
            "current_title": c.current_title,
            "job_family": c.job_family,
            "seniority": c.seniority,
            "experiences": c.experiences,
            "education": c.education,
            "skills": c.skills,
            "enrichment_source": "synthetic",
        }
        for i, c in enumerate(graph.contacts)
    ]
    for start in range(0, len(contact_rows), 1000):
        db.execute(insert(Contact), contact_rows[start : start + 1000])
    connection_rows = [
        {
            "employee_id": employee_ids[cn.employee_idx],
            "contact_id": contact_ids[cn.contact_idx],
            "connected_on": cn.connected_on,
            "strength": cn.strength,
            "strength_breakdown": cn.breakdown,
        }
        for cn in graph.connections
    ]
    for start in range(0, len(connection_rows), 2000):
        db.execute(insert(Connection), connection_rows[start : start + 2000])
    db.flush()

    postings, source = fetch_or_snapshot(prefer_live=prefer_live_roles)
    sync_roles(db, postings, source=source)
    scores = recompute_match_scores(db)
    requests = seed_demo_requests(db)
    db.commit()
    return SeedReport(
        employees=len(graph.employees),
        contacts=len(graph.contacts),
        connections=len(graph.connections),
        roles=db.scalar(select(func.count()).select_from(Role)) or 0,
        roles_source=source,
        match_scores=scores,
        requests=requests,
    )


# ---- Demo requests -----------------------------------------------------------------------------

_SCENARIOS: tuple[tuple[str, list[tuple[Status, int, str | None]]], ...] = (
    ("engineering", [(Status.REQUESTED, 3, None), (Status.EMPLOYEE_ACCEPTED, 2, None)]),
    (
        "customer_engineering",
        [
            (Status.REQUESTED, 6, None),
            (Status.EMPLOYEE_ACCEPTED, 5, "Sent her a LinkedIn DM"),
            (Status.NO_RESPONSE, 2, "No reply yet, will nudge next week"),
        ],
    ),
    (
        "ml_research",
        [
            (Status.REQUESTED, 9, None),
            (Status.EMPLOYEE_ACCEPTED, 8, None),
            (Status.CANDIDATE_INTERESTED, 3, "Interested, wants to chat next week"),
        ],
    ),
    (
        "sales",
        [
            (Status.REQUESTED, 12, None),
            (Status.EMPLOYEE_ACCEPTED, 11, None),
            (Status.CANDIDATE_DECLINED, 6, "Happy where she is; revisit in six months"),
        ],
    ),
    (
        "marketing",
        [
            (Status.REQUESTED, 20, None),
            (Status.EMPLOYEE_ACCEPTED, 19, None),
            (Status.CANDIDATE_INTERESTED, 15, None),
            (Status.CLOSED, 10, "Intro made to hiring manager; in process"),
        ],
    ),
    (
        "infrastructure",
        [
            (Status.REQUESTED, 5, None),
            (Status.EMPLOYEE_DECLINED, 4, "Declined to refer"),
            (Status.REQUESTED, 4, None),
        ],
    ),
)


def _pick_role(db: Session, family: str, used: set[uuid.UUID]) -> Role | None:
    stmt = (
        select(Role)
        .where(Role.is_active.is_(True), Role.job_family == family, Role.id.not_in(used))
        .order_by(Role.title)
    )
    return db.scalars(stmt).first()


def _pick_contact(
    db: Session, role: Role, used: set[uuid.UUID], *, min_connections: int
) -> Contact | None:
    conn_count = (
        select(Connection.contact_id, func.count().label("n"))
        .group_by(Connection.contact_id)
        .subquery()
    )
    stmt = (
        select(Contact)
        .join(MatchScore, MatchScore.contact_id == Contact.id)
        .join(conn_count, conn_count.c.contact_id == Contact.id)
        .where(
            MatchScore.role_id == role.id,
            Contact.id.not_in(used),
            Contact.linkedin_url.not_like("%-demo"),
            conn_count.c.n >= min_connections,
        )
        .order_by(MatchScore.score.desc())
    )
    return db.scalars(stmt).first()


def seed_demo_requests(db: Session) -> int:
    now = datetime.now(UTC)
    generator = TemplateGenerator()
    used_roles: set[uuid.UUID] = set()
    used_contacts: set[uuid.UUID] = set()
    created = 0
    for family, steps in _SCENARIOS:
        role = _pick_role(db, family, used_roles)
        if role is None:
            continue
        rerouted = any(s == Status.EMPLOYEE_DECLINED for s, _, _ in steps)
        contact = _pick_contact(db, role, used_contacts, min_connections=2 if rerouted else 1)
        if contact is None:
            continue
        used_roles.add(role.id)
        used_contacts.add(contact.id)
        first = strongest_connection(db, contact.id)
        assert first is not None
        employee = first.employee
        ctx = build_context(
            contact=contact,
            role=role,
            employee=employee,
            connection=first,
            reasons=fit_reasons(db, contact.id, role.id),
        )
        drafts = generator.generate(ctx)
        req = ReferralRequest(
            contact_id=contact.id,
            role_id=role.id,
            employee_id=employee.id,
            status=steps[-1][0].value,
            requested_by=RECRUITER,
            outreach_casual=drafts.casual,
            outreach_formal=drafts.formal,
        )
        req.created_at = now - timedelta(days=steps[0][1])
        db.add(req)
        db.flush()
        previous: Status | None = None
        for status, days_ago, note in steps:
            at = now - timedelta(days=days_ago, hours=1)
            if status == Status.REQUESTED and previous == Status.EMPLOYEE_DECLINED:
                nxt = strongest_connection(db, contact.id, exclude={employee.id})
                assert nxt is not None
                actor = "system"
                note = (
                    f"Re-routed from {employee.full_name} to {nxt.employee.full_name} "
                    f"(next-strongest connection, {float(nxt.strength):.2f})"
                )
                employee = nxt.employee
                req.employee_id = employee.id
            elif status == Status.REQUESTED:
                actor, note = RECRUITER, f"Asked {employee.full_name}"
            elif status == Status.CLOSED:
                actor = RECRUITER
                req.closed_outcome = note
            else:
                actor = employee_actor(employee)
            event = ReferralEvent(
                request_id=req.id,
                from_status=previous.value if previous else None,
                to_status=status.value,
                actor=actor,
                note=note,
            )
            event.created_at = at
            db.add(event)
            if status == Status.REQUESTED:
                message = OutreachMessage(
                    request_id=req.id,
                    employee_id=employee.id,
                    channel="slack",
                    recipient="seed",
                    body=drafts.casual,
                    blocks=[],
                    delivered=True,
                )
                message.created_at = at
                db.add(message)
            previous = status
        db.flush()
        created += 1
    return created
