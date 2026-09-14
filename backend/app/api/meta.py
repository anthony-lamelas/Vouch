from __future__ import annotations

import os

from fastapi import APIRouter
from sqlalchemy import func, select, text

from app.api.deps import DB, AppSettings, User
from app.models import CompanyTier, Connection, Contact, Employee, ReferralRequest, Role, SchoolTier
from app.schemas import FilterOptions, MeOut, PublicConfig, Stats, StatusCount, TieredName
from app.services.lifecycle import LABELS, Status
from app.services.taxonomy import FAMILIES, SKILL_ALIASES

router = APIRouter(tags=["meta"])


@router.get("/healthz", include_in_schema=False)
def healthz(db: DB) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    # Render exposes the deployed commit; handy for confirming which build is live.
    return {"status": "ok", "commit": os.environ.get("RENDER_GIT_COMMIT", "")[:7]}


@router.get("/config", response_model=PublicConfig)
def public_config(settings: AppSettings) -> PublicConfig:
    """Public, non-secret runtime configuration the browser needs before login."""
    return PublicConfig(
        supabase_url=settings.supabase_url,
        supabase_anon_key=settings.supabase_anon_key,
        auth_disabled=settings.auth_disabled,
        slack_enabled=settings.slack_enabled,
    )


@router.get("/me", response_model=MeOut)
def me(user: User, settings: AppSettings) -> MeOut:
    return MeOut(id=user.id, email=user.email, name=user.name, auth_disabled=settings.auth_disabled)


@router.get("/filters", response_model=FilterOptions)
def filters(db: DB, _: User) -> FilterOptions:
    companies = db.execute(
        select(CompanyTier.name, CompanyTier.tier).order_by(CompanyTier.tier, CompanyTier.name)
    ).all()
    schools = db.execute(
        select(SchoolTier.name, SchoolTier.tier).order_by(SchoolTier.tier, SchoolTier.name)
    ).all()
    departments = db.scalars(
        select(Role.department).where(Role.is_active.is_(True)).distinct().order_by(Role.department)
    ).all()
    return FilterOptions(
        companies=[TieredName(name=n, tier=t) for n, t in companies],
        schools=[TieredName(name=n, tier=t) for n, t in schools],
        skills=sorted(SKILL_ALIASES),
        departments=list(departments),
        families=list(FAMILIES),
    )


@router.get("/stats", response_model=Stats)
def stats(db: DB, _: User, settings: AppSettings) -> Stats:
    def count(
        model: type[Employee]
        | type[Contact]
        | type[Connection]
        | type[Role]
        | type[ReferralRequest],
    ) -> int:
        return db.scalar(select(func.count()).select_from(model)) or 0

    by_status = {
        status_value: n
        for status_value, n in db.execute(
            select(ReferralRequest.status, func.count()).group_by(ReferralRequest.status)
        ).tuples()
    }
    total = sum(by_status.values())
    return Stats(
        employees=count(Employee),
        contacts=count(Contact),
        connections=count(Connection),
        roles=db.scalar(select(func.count()).select_from(Role).where(Role.is_active.is_(True)))
        or 0,
        requests_total=total,
        requests_active=total - by_status.get(Status.CLOSED.value, 0),
        by_status=[
            StatusCount(status=s, label=LABELS[s], count=by_status.get(s.value, 0)) for s in Status
        ],
        slack_enabled=settings.slack_enabled,
        auth_disabled=settings.auth_disabled,
    )
