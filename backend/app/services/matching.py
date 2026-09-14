"""Recompute the precomputed match_score table for every active role."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, insert, select, text
from sqlalchemy.orm import Session

from app.models import CompanyTier, Contact, MatchScore, Role, SchoolTier
from app.services.scoring import MIN_STORED_SCORE, match_score

CHUNK = 5000
TOP_PER_ROLE = 500


@dataclass(frozen=True)
class ContactFeatures:
    id: Any
    skills: list[str]
    family: str
    seniority: str
    companies: list[str]
    schools: list[str]
    best_strength: float
    best_detail: str | None
    location: str


def _best_connections(db: Session) -> dict[Any, tuple[float, str | None]]:
    rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (c.contact_id)
                   c.contact_id, c.strength, c.strength_breakdown, e.full_name
            FROM connection c JOIN employee e ON e.id = c.employee_id
            ORDER BY c.contact_id, c.strength DESC
            """
        )
    ).all()
    out: dict[Any, tuple[float, str | None]] = {}
    for contact_id, strength, breakdown, employee_name in rows:
        detail = breakdown.get("overlap_detail") or breakdown.get("school_detail")
        text_detail = f"{detail} via {employee_name}" if detail else f"Connected to {employee_name}"
        out[contact_id] = (float(strength), text_detail)
    return out


def load_contact_features(db: Session) -> list[ContactFeatures]:
    best = _best_connections(db)
    features: list[ContactFeatures] = []
    for c in db.scalars(select(Contact)).all():
        strength, detail = best.get(c.id, (0.0, None))
        features.append(
            ContactFeatures(
                id=c.id,
                skills=list(c.skills),
                family=c.job_family,
                seniority=c.seniority,
                companies=[e["company"] for e in c.experiences],
                schools=[e["school"] for e in c.education],
                best_strength=strength,
                best_detail=detail,
                location=c.location,
            )
        )
    return features


def recompute_match_scores(db: Session, *, role_ids: list[Any] | None = None) -> int:
    company_tiers = {r.name: r.tier for r in db.scalars(select(CompanyTier))}
    school_tiers = {r.name: r.tier for r in db.scalars(select(SchoolTier))}
    stmt = select(Role).where(Role.is_active.is_(True))
    if role_ids:
        stmt = stmt.where(Role.id.in_(role_ids))
    roles = db.scalars(stmt).all()
    contacts = load_contact_features(db)

    if role_ids:
        db.execute(delete(MatchScore).where(MatchScore.role_id.in_(role_ids)))
    else:
        db.execute(delete(MatchScore))

    rows: list[dict[str, Any]] = []
    written = 0
    for role in roles:
        role_rows: list[dict[str, Any]] = []
        for c in contacts:
            result = match_score(
                contact_skills=c.skills,
                contact_family=c.family,
                contact_seniority=c.seniority,
                contact_companies=c.companies,
                contact_schools=c.schools,
                role_skills=list(role.required_skills),
                role_family=role.job_family,
                role_seniority=role.seniority,
                company_tiers=company_tiers,
                school_tiers=school_tiers,
                best_strength=c.best_strength,
                best_strength_detail=c.best_detail,
                contact_location=c.location,
                role_location=role.location,
                role_is_remote=role.is_remote,
            )
            if result.score < MIN_STORED_SCORE:
                continue
            role_rows.append(
                {
                    "role_id": role.id,
                    "contact_id": c.id,
                    "score": result.score,
                    "reasons": result.reasons,
                }
            )
        role_rows.sort(key=lambda r: float(r["score"]), reverse=True)
        rows.extend(role_rows[:TOP_PER_ROLE])
        if len(rows) >= CHUNK:
            db.execute(insert(MatchScore), rows)
            written += len(rows)
            rows = []
    if rows:
        db.execute(insert(MatchScore), rows)
        written += len(rows)
    db.flush()
    return written
