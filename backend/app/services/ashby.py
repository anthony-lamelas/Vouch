"""Sync open roles from Cognition's public Ashby job board."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Role
from app.services.taxonomy import classify_family, classify_seniority, extract_skills

BOARD_URL = "https://api.ashbyhq.com/posting-api/job-board/{board}"
SNAPSHOT_PATH = Path(__file__).resolve().parent.parent / "seed" / "data" / "ashby_snapshot.json"


class AshbyPosting(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    department: str = ""
    team: str = ""
    location: str = ""
    is_remote: bool = Field(default=False, alias="isRemote")
    employment_type: str = Field(default="FullTime", alias="employmentType")
    description_html: str = Field(default="", alias="descriptionHtml")
    description_plain: str = Field(default="", alias="descriptionPlain")
    job_url: str = Field(default="", alias="jobUrl")
    apply_url: str = Field(default="", alias="applyUrl")
    published_at: datetime | None = Field(default=None, alias="publishedAt")
    is_listed: bool = Field(default=True, alias="isListed")

    @model_validator(mode="before")
    @classmethod
    def _drop_nulls(cls, data: Any) -> Any:
        """Ashby sends explicit nulls for optional fields; fall back to defaults instead."""
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if v is not None}
        return data


class AshbyBoard(BaseModel):
    jobs: list[AshbyPosting]


@dataclass(frozen=True)
class SyncResult:
    source: str
    created: int
    updated: int
    deactivated: int


def load_snapshot() -> list[AshbyPosting]:
    with SNAPSHOT_PATH.open(encoding="utf-8") as fh:
        return AshbyBoard.model_validate(json.load(fh)).jobs


def fetch_board(board: str = "cognition", timeout: float = 15.0) -> list[AshbyPosting]:
    response = httpx.get(BOARD_URL.format(board=board), timeout=timeout)
    response.raise_for_status()
    return AshbyBoard.model_validate(response.json()).jobs


def fetch_or_snapshot(*, prefer_live: bool) -> tuple[list[AshbyPosting], str]:
    if prefer_live:
        try:
            return fetch_board(), "ashby-live"
        except (httpx.HTTPError, ValueError):
            pass
    return load_snapshot(), "snapshot"


def sync_roles(db: Session, postings: list[AshbyPosting], *, source: str) -> SyncResult:
    """Upsert roles by Ashby id and deactivate anything no longer on the board."""
    existing = {r.ashby_id: r for r in db.scalars(select(Role)).all()}
    seen: set[str] = set()
    created = updated = 0
    for p in postings:
        if not p.is_listed:
            continue
        seen.add(p.id)
        family = classify_family(f"{p.title.strip()} {p.team}")
        seniority = classify_seniority(p.title)
        role = existing.get(p.id)
        if role is None:
            role = Role(ashby_id=p.id, job_family=family, seniority=seniority)
            db.add(role)
            created += 1
        else:
            updated += 1
        role.title = p.title.strip()
        role.department = p.department
        role.team = p.team
        role.location = p.location
        role.is_remote = p.is_remote
        role.employment_type = p.employment_type
        role.description_html = p.description_html
        role.description_plain = p.description_plain
        role.job_url = p.job_url
        role.apply_url = p.apply_url
        role.published_at = p.published_at
        role.job_family = family
        role.seniority = seniority
        role.is_active = True
        if not role.required_skills:
            role.required_skills = extract_skills(
                f"{p.title}. {p.description_plain}", family=family
            )
    deactivated = 0
    for ashby_id, role in existing.items():
        if ashby_id not in seen and role.is_active:
            role.is_active = False
            deactivated += 1
    db.flush()
    return SyncResult(source=source, created=created, updated=updated, deactivated=deactivated)
