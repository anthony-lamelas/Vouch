"""FastAPI dependencies shared by routers."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.services.outreach import get_generator
from app.services.referrals import ReferralService
from app.services.slack import get_notifier

DB = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]
User = Annotated[CurrentUser, Depends(get_current_user)]


def get_referral_service(db: DB, settings: AppSettings) -> ReferralService:
    return ReferralService(
        db=db, settings=settings, notifier=get_notifier(settings), generator=get_generator(settings)
    )


Referrals = Annotated[ReferralService, Depends(get_referral_service)]


def require_admin(
    settings: AppSettings, x_admin_token: Annotated[str | None, Header()] = None
) -> None:
    if not settings.admin_token or x_admin_token != settings.admin_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin token required")
