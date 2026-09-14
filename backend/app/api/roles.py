from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import Text, cast, func, literal, or_, select
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

from app.api.deps import DB, User
from app.api.serializers import connection_out, connections_by_contact
from app.models import CompanyTier, Contact, MatchScore, ReferralRequest, Role, SchoolTier
from app.schemas import (
    ActiveRequestBrief,
    CandidateOut,
    CandidatePage,
    ContactBrief,
    RoleDetail,
    RoleSummary,
)
from app.services.geo import cities_in_regions, regions_of
from app.services.lifecycle import ACTIVE_STATUSES, Status

router = APIRouter(prefix="/roles", tags=["roles"])

STRONG_MATCH = 0.7


def _counts(db: DB) -> tuple[dict[uuid.UUID, int], dict[uuid.UUID, int]]:
    strong = {
        role_id: n
        for role_id, n in db.execute(
            select(MatchScore.role_id, func.count())
            .where(MatchScore.score >= STRONG_MATCH)
            .group_by(MatchScore.role_id)
        ).tuples()
    }
    active = {
        role_id: n
        for role_id, n in db.execute(
            select(ReferralRequest.role_id, func.count())
            .where(ReferralRequest.status.in_([s.value for s in ACTIVE_STATUSES]))
            .group_by(ReferralRequest.role_id)
        ).tuples()
    }
    return strong, active


@router.get("", response_model=list[RoleSummary])
def list_roles(
    db: DB,
    user: User,
    department: str | None = None,
    q: str | None = None,
    mine: bool = False,
) -> list[RoleSummary]:
    stmt = select(Role).where(Role.is_active.is_(True)).order_by(Role.department, Role.title)
    if department:
        stmt = stmt.where(Role.department == department)
    if q:
        stmt = stmt.where(Role.title.ilike(f"%{q}%"))
    if mine:
        stmt = stmt.where(Role.owner_email == user.email)
    strong, active = _counts(db)
    out: list[RoleSummary] = []
    for role in db.scalars(stmt).all():
        summary = RoleSummary.model_validate(role)
        summary.is_mine = role.owner_email == user.email
        summary.strong_match_count = strong.get(role.id, 0)
        summary.active_request_count = active.get(role.id, 0)
        out.append(summary)
    return out


@router.get("/{role_id}", response_model=RoleDetail)
def get_role(role_id: uuid.UUID, db: DB, user: User) -> RoleDetail:
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    strong, active = _counts(db)
    detail = RoleDetail.model_validate(role)
    detail.is_mine = role.owner_email == user.email
    detail.strong_match_count = strong.get(role.id, 0)
    detail.active_request_count = active.get(role.id, 0)
    return detail


@router.get("/{role_id}/candidates", response_model=CandidatePage)
def list_candidates(
    role_id: uuid.UUID,
    db: DB,
    _: User,
    companies: Annotated[list[str] | None, Query()] = None,
    schools: Annotated[list[str] | None, Query()] = None,
    skills: Annotated[list[str] | None, Query()] = None,
    company_tier: Annotated[int | None, Query(ge=1, le=3)] = None,
    company_tiers: Annotated[list[int] | None, Query()] = None,
    school_tiers: Annotated[list[int] | None, Query()] = None,
    exclude_requested: bool = False,
    same_region: bool = False,
    q: str | None = None,
    min_score: Annotated[float, Query(ge=0, le=1)] = 0.0,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CandidatePage:
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")

    stmt = (
        select(MatchScore, Contact)
        .join(Contact, Contact.id == MatchScore.contact_id)
        .where(MatchScore.role_id == role_id, MatchScore.score >= min_score)
    )
    company_set = set(companies or [])
    if company_tier:
        tier_names = db.scalars(select(CompanyTier.name).where(CompanyTier.tier <= company_tier))
        company_set.update(tier_names)
    if company_tiers:
        company_set.update(
            db.scalars(select(CompanyTier.name).where(CompanyTier.tier.in_(company_tiers)))
        )
    school_set = set(schools or [])
    if school_tiers:
        school_set.update(
            db.scalars(select(SchoolTier.name).where(SchoolTier.tier.in_(school_tiers)))
        )
    if same_region:
        # Only people currently in the role's region(s). A role with no recognisable location
        # (or a remote-anywhere posting) keeps everyone.
        regions = regions_of(role.location)
        if regions:
            stmt = stmt.where(Contact.location.in_(cities_in_regions(regions)))
    if exclude_requested:
        open_contacts = select(ReferralRequest.contact_id).where(
            ReferralRequest.status.in_([st.value for st in ACTIVE_STATUSES])
        )
        stmt = stmt.where(Contact.id.not_in(open_contacts))
    if company_set:
        stmt = stmt.where(
            or_(
                *[
                    Contact.experiences.op("@>")(literal([{"company": c}], type_=JSONB))
                    for c in sorted(company_set)
                ]
            )
        )
    if school_set:
        stmt = stmt.where(
            or_(
                *[
                    Contact.education.op("@>")(literal([{"school": sc}], type_=JSONB))
                    for sc in sorted(school_set)
                ]
            )
        )
    if skills:
        stmt = stmt.where(Contact.skills.op("&&")(cast(skills, ARRAY(Text))))
    if q:
        stmt = stmt.where(
            Contact.full_name.ilike(f"%{q}%")
            | Contact.current_company.ilike(f"%{q}%")
            | Contact.current_title.ilike(f"%{q}%")
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(
        stmt.order_by(MatchScore.score.desc(), Contact.full_name).limit(limit).offset(offset)
    ).all()
    contact_ids = [c.id for _, c in rows]
    connections = connections_by_contact(db, contact_ids)
    active_requests = (
        {
            r.contact_id: r
            for r in db.scalars(
                select(ReferralRequest).where(
                    ReferralRequest.contact_id.in_(contact_ids),
                    ReferralRequest.status.in_([s.value for s in ACTIVE_STATUSES]),
                )
            ).all()
        }
        if contact_ids
        else {}
    )

    items: list[CandidateOut] = []
    for ms, contact in rows:
        conns = connections.get(contact.id, [])
        active = active_requests.get(contact.id)
        items.append(
            CandidateOut(
                contact=ContactBrief.model_validate(contact),
                score=float(ms.score),
                reasons=ms.reasons,
                top_connection=connection_out(conns[0]) if conns else None,
                connection_count=len(conns),
                active_request=ActiveRequestBrief(
                    id=active.id,
                    status=Status(active.status),
                    role_id=active.role_id,
                    role_title=active.role.title,
                    employee_name=active.employee.full_name,
                )
                if active
                else None,
            )
        )
    return CandidatePage(items=items, total=total, limit=limit, offset=offset)
