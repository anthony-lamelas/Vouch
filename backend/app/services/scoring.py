"""Connection-strength and match-score heuristics.

Both functions work on plain dicts/dataclasses so they can be unit tested without a database
and reused by the seed generator.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app.services.taxonomy import (
    ADJACENT_FAMILIES,
    SENIORITY_LABELS,
    family_label,
    seniority_distance,
)

# ---- Connection strength -------------------------------------------------------------------

W_OVERLAP = 0.45
W_SCHOOL = 0.25
W_RECENCY = 0.30


@dataclass(frozen=True)
class StrengthResult:
    strength: float
    breakdown: dict[str, Any] = field(default_factory=dict)


def _parse(d: str | None) -> date | None:
    return date.fromisoformat(d) if d else None


def _ranges_overlap(a_start: date, a_end: date, b_start: date, b_end: date) -> bool:
    return a_start <= b_end and b_start <= a_end


def _experience_overlap(
    emp_exp: list[dict[str, Any]], con_exp: list[dict[str, Any]], today: date
) -> tuple[float, str | None]:
    best = 0.0
    detail: str | None = None
    for e in emp_exp:
        for c in con_exp:
            if e["company"] != c["company"]:
                continue
            e_start, e_end = _parse(e.get("start")) or today, _parse(e.get("end")) or today
            c_start, c_end = _parse(c.get("start")) or today, _parse(c.get("end")) or today
            if _ranges_overlap(e_start, e_end, c_start, c_end):
                same_team = bool(e.get("team")) and e.get("team") == c.get("team")
                score = 1.0 if same_team else 0.8
                years = (min(e_end, c_end).year, max(e_start, c_start).year)
                text = f"Overlapped at {e['company']} ({years[1]}-{years[0]})"
                if same_team:
                    text += f" on {e['team']}"
            else:
                score = 0.4
                text = f"Overlapped at {e['company']}, different years"
            if score > best:
                best, detail = score, text
    return best, detail


def _school_overlap(
    emp_edu: list[dict[str, Any]], con_edu: list[dict[str, Any]]
) -> tuple[float, str | None]:
    best = 0.0
    detail: str | None = None
    for e in emp_edu:
        for c in con_edu:
            if e["school"] != c["school"]:
                continue
            overlap = _ranges_overlap(
                date(int(e["start_year"]), 1, 1),
                date(int(e["end_year"]), 12, 31),
                date(int(c["start_year"]), 1, 1),
                date(int(c["end_year"]), 12, 31),
            )
            score = 1.0 if overlap else 0.6
            text = (
                f"Overlapped at {e['school']}"
                if overlap
                else f"Overlapped at {e['school']}, different years"
            )
            if score > best:
                best, detail = score, text
    return best, detail


def recency_score(connected_on: date, today: date) -> float:
    days = (today - connected_on).days
    if days <= 365:
        return 1.0
    five_years = 365 * 5
    if days >= five_years:
        return 0.2
    # Linear from 1.0 at 1 year to 0.2 at 5 years.
    return 1.0 - 0.8 * (days - 365) / (five_years - 365)


def connection_strength(
    *,
    employee_experiences: list[dict[str, Any]],
    employee_education: list[dict[str, Any]],
    contact_experiences: list[dict[str, Any]],
    contact_education: list[dict[str, Any]],
    connected_on: date,
    today: date,
) -> StrengthResult:
    overlap, overlap_detail = _experience_overlap(employee_experiences, contact_experiences, today)
    school, school_detail = _school_overlap(employee_education, contact_education)
    recency = recency_score(connected_on, today)
    strength = round(W_OVERLAP * overlap + W_SCHOOL * school + W_RECENCY * recency, 3)
    return StrengthResult(
        strength=strength,
        breakdown={
            "overlap": overlap,
            "overlap_detail": overlap_detail,
            "school": school,
            "school_detail": school_detail,
            "recency": round(recency, 3),
            "connected_on": connected_on.isoformat(),
        },
    )


# ---- Match score -----------------------------------------------------------------------------

W_SKILLS = 0.35
W_FIT = 0.25
W_COMPANY = 0.20
W_SCHOOL_TIER = 0.10
W_STRENGTH = 0.10
MIN_STORED_SCORE = 0.30


@dataclass(frozen=True)
class MatchResult:
    score: float
    reasons: list[dict[str, Any]]


def tier_value(tier: int | None) -> float:
    if tier == 1:
        return 1.0
    if tier == 2:
        return 0.6
    return 0.0


def fit_score(
    contact_family: str, contact_seniority: str, role_family: str, role_seniority: str
) -> float:
    if contact_family == role_family:
        family = 1.0
    elif role_family in ADJACENT_FAMILIES.get(contact_family, frozenset()):
        family = 0.4
    else:
        family = 0.0
    distance = seniority_distance(contact_seniority, role_seniority)
    seniority = {0: 1.0, 1: 0.8, 2: 0.4}.get(distance, 0.1)
    return round(0.7 * family + 0.3 * seniority, 3)


def match_score(
    *,
    contact_skills: list[str],
    contact_family: str,
    contact_seniority: str,
    contact_companies: list[str],
    contact_schools: list[str],
    role_skills: list[str],
    role_family: str,
    role_seniority: str,
    company_tiers: dict[str, int],
    school_tiers: dict[str, int],
    best_strength: float,
    best_strength_detail: str | None = None,
) -> MatchResult:
    reasons: list[dict[str, Any]] = []

    overlap = [s for s in role_skills if s in set(contact_skills)]
    skills = len(overlap) / len(role_skills) if role_skills else 0.0
    if overlap:
        reasons.append(
            {
                "signal": "skills",
                "label": f"{len(overlap)} of {len(role_skills)} required skills",
                "detail": ", ".join(overlap),
                "value": round(skills, 3),
            }
        )

    fit = fit_score(contact_family, contact_seniority, role_family, role_seniority)
    if fit >= 0.5:
        reasons.append(
            {
                "signal": "fit",
                "label": "Same job family" if contact_family == role_family else "Adjacent role",
                "detail": (
                    f"{SENIORITY_LABELS.get(contact_seniority, contact_seniority)} · "
                    f"{family_label(contact_family)}"
                ),
                "value": fit,
            }
        )

    best_company_tier: int | None = None
    best_company: str | None = None
    for company in contact_companies:
        tier = company_tiers.get(company)
        if tier is not None and (best_company_tier is None or tier < best_company_tier):
            best_company_tier, best_company = tier, company
    company_score = tier_value(best_company_tier)
    if best_company and best_company_tier is not None and best_company_tier <= 2:
        reasons.append(
            {
                "signal": "company",
                "label": f"Tier {best_company_tier} company",
                "detail": best_company,
                "value": company_score,
            }
        )

    best_school_tier: int | None = None
    best_school: str | None = None
    for school in contact_schools:
        tier = school_tiers.get(school)
        if tier is not None and (best_school_tier is None or tier < best_school_tier):
            best_school_tier, best_school = tier, school
    school_score = tier_value(best_school_tier)
    if best_school and best_school_tier is not None and best_school_tier <= 2:
        reasons.append(
            {
                "signal": "school",
                "label": f"Tier {best_school_tier} school",
                "detail": best_school,
                "value": school_score,
            }
        )

    if best_strength >= 0.5:
        reasons.append(
            {
                "signal": "intro",
                "label": "Warm intro available",
                "detail": best_strength_detail or "Strong connection to an employee",
                "value": round(best_strength, 3),
            }
        )

    score = round(
        W_SKILLS * skills
        + W_FIT * fit
        + W_COMPANY * company_score
        + W_SCHOOL_TIER * school_score
        + W_STRENGTH * best_strength,
        3,
    )
    return MatchResult(score=score, reasons=reasons)
