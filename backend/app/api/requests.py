from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, select

from app.api.deps import DB, Referrals, User
from app.api.serializers import REQUEST_LOAD_OPTIONS, request_detail, request_summary
from app.models import ReferralRequest, Role
from app.schemas import CreateRequestIn, RequestDetail, RequestPage, TransitionIn
from app.services.lifecycle import RECRUITER_SETTABLE, IllegalTransitionError, Status
from app.services.ownership import recruiter_names
from app.services.referrals import ActiveRequestExistsError, NoConnectionError, NotFoundError

router = APIRouter(prefix="/requests", tags=["requests"])


@router.get("", response_model=RequestPage)
def list_requests(
    db: DB,
    user: User,
    status: Annotated[list[Status] | None, Query()] = None,
    role_id: uuid.UUID | None = None,
    active_only: bool = False,
    mine: bool = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> RequestPage:
    stmt = select(ReferralRequest).options(*REQUEST_LOAD_OPTIONS)
    if mine:
        stmt = stmt.join(Role, Role.id == ReferralRequest.role_id).where(
            or_(ReferralRequest.requested_by == user.email, Role.owner_email == user.email)
        )
    if status:
        stmt = stmt.where(ReferralRequest.status.in_([s.value for s in status]))
    if active_only:
        stmt = stmt.where(ReferralRequest.status != Status.CLOSED.value)
    if role_id:
        stmt = stmt.where(ReferralRequest.role_id == role_id)
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.order_by(ReferralRequest.updated_at.desc()).limit(limit)).all()
    names = recruiter_names(db)
    items = []
    for r in rows:
        summary = request_summary(r, names)
        summary.is_mine = r.requested_by == user.email or r.role.owner_email == user.email
        items.append(summary)
    return RequestPage(items=items, total=total)


@router.post("", response_model=RequestDetail, status_code=201)
def create_request(body: CreateRequestIn, service: Referrals, user: User) -> RequestDetail:
    try:
        req = service.create(
            contact_id=body.contact_id,
            role_id=body.role_id,
            employee_id=body.employee_id,
            requested_by=user.email,
        )
    except ActiveRequestExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except NoConnectionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"Not found: {exc}") from exc
    return request_detail(service.db, req)


@router.get("/{request_id}", response_model=RequestDetail)
def get_request(request_id: uuid.UUID, service: Referrals, _: User) -> RequestDetail:
    try:
        req = service.get(request_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail="Request not found") from exc
    return request_detail(service.db, req)


@router.post("/{request_id}/transition", response_model=RequestDetail)
def transition_request(
    request_id: uuid.UUID, body: TransitionIn, service: Referrals, user: User
) -> RequestDetail:
    """Recruiter-side transitions. Closing is the recruiter's; the rest are allowed so a
    recruiter can record what an employee told them outside Slack."""
    actor = user.email if body.to_status in RECRUITER_SETTABLE else f"recruiter:{user.email}"
    try:
        req = service.transition(
            request_id, to_status=body.to_status, actor=actor, note=body.note, reason=body.reason
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail="Request not found") from exc
    except IllegalTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return request_detail(service.db, req)
