from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import DB, User
from app.api.serializers import (
    REQUEST_LOAD_OPTIONS,
    connection_out,
    connections_by_contact,
    request_summary,
)
from app.models import Contact, MatchScore, ReferralRequest, Role
from app.schemas import ContactDetail, RoleScoreBrief
from app.services.ownership import recruiter_names

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("/{contact_id}", response_model=ContactDetail)
def get_contact(contact_id: uuid.UUID, db: DB, _: User) -> ContactDetail:
    contact = db.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    conns = connections_by_contact(db, [contact_id]).get(contact_id, [])
    requests = db.scalars(
        select(ReferralRequest)
        .options(*REQUEST_LOAD_OPTIONS)
        .where(ReferralRequest.contact_id == contact_id)
        .order_by(ReferralRequest.created_at.desc())
    ).all()
    names = recruiter_names(db)
    top_roles = db.execute(
        select(MatchScore.role_id, Role.title, Role.team, MatchScore.score)
        .join(Role, Role.id == MatchScore.role_id)
        .where(MatchScore.contact_id == contact_id, Role.is_active.is_(True))
        .order_by(MatchScore.score.desc())
        .limit(5)
    ).all()
    return ContactDetail(
        id=contact.id,
        full_name=contact.full_name,
        headline=contact.headline,
        location=contact.location,
        current_company=contact.current_company,
        current_title=contact.current_title,
        job_family=contact.job_family,
        seniority=contact.seniority,
        skills=list(contact.skills),
        linkedin_url=contact.linkedin_url,
        experiences=contact.experiences,
        education=contact.education,
        enrichment_source=contact.enrichment_source,
        connections=[connection_out(c) for c in conns],
        requests=[request_summary(r, names) for r in requests],
        top_roles=[
            RoleScoreBrief(role_id=rid, title=title, team=team, score=float(score))
            for rid, title, team, score in top_roles
        ],
    )
