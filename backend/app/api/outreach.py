from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, User
from app.models import OutreachMessage, ReferralRequest
from app.schemas import EmployeeBrief, MessageOut, OutreachItem
from app.services.lifecycle import Status

router = APIRouter(prefix="/outreach", tags=["outreach"])


@router.get("", response_model=list[OutreachItem])
def list_outreach(
    db: DB, _: User, limit: Annotated[int, Query(ge=1, le=200)] = 50
) -> list[OutreachItem]:
    rows = db.scalars(
        select(OutreachMessage)
        .options(
            selectinload(OutreachMessage.employee),
            selectinload(OutreachMessage.request).selectinload(ReferralRequest.contact),
            selectinload(OutreachMessage.request).selectinload(ReferralRequest.role),
        )
        .order_by(OutreachMessage.created_at.desc())
        .limit(limit)
    ).all()
    return [
        OutreachItem(
            message=MessageOut(
                id=m.id,
                channel=m.channel,
                recipient=m.recipient,
                body=m.body,
                delivered=m.delivered,
                error=m.error,
                created_at=m.created_at,
                employee=EmployeeBrief.model_validate(m.employee),
            ),
            request_id=m.request_id,
            request_status=Status(m.request.status),
            contact=m.request.contact,
            role=m.request.role,
        )
        for m in rows
    ]
