"""Who owns a role. Ashby's public board doesn't expose recruiters, so ownership is assigned by
department: the demo recruiter owns engineering-adjacent reqs, synthetic recruiters own the rest."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Final

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Recruiter

SYNTHETIC_RECRUITERS: Final[dict[str, tuple[str, str]]] = {
    "Research & Development": ("Sam Okafor", "sam.okafor@cognition.ai"),
    "Customer Engineering": ("Sam Okafor", "sam.okafor@cognition.ai"),
    "Sales": ("Dana Whitfield", "dana.whitfield@cognition.ai"),
    "Marketing": ("Chris Nakamura", "chris.nakamura@cognition.ai"),
    "General & Administrative": ("Priyanka Shah", "priyanka.shah@cognition.ai"),
}
FALLBACK_RECRUITER: Final[tuple[str, str]] = ("Sam Okafor", "sam.okafor@cognition.ai")
# The demo login owns these reqs (all regional variants); everyone else is synthetic.
DEMO_TITLE_PREFIXES: Final[tuple[str, ...]] = ("AI Support Engineer", "Applied AI Engineer")


def name_from_email(email: str) -> str:
    """'anthony.lamelas23@example.com' -> 'Anthony Lamelas'."""
    local = email.split("@", 1)[0]
    parts = [re.sub(r"\d+", "", p) for p in re.split(r"[._-]+", local)]
    words = [p.capitalize() for p in parts if p]
    return " ".join(words) or email


def default_owner(department: str, settings: Settings, title: str = "") -> tuple[str, str]:
    """Returns (owner_name, owner_email) for a role."""
    if settings.demo_recruiter_email and title.strip().startswith(DEMO_TITLE_PREFIXES):
        email = settings.demo_recruiter_email
        return settings.demo_recruiter_name or name_from_email(email), email
    return SYNTHETIC_RECRUITERS.get(department, FALLBACK_RECRUITER)


def split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split()
    if not parts:
        return "", ""
    return parts[0], " ".join(parts[1:])


def predefined_recruiters(settings: Settings) -> list[tuple[str, str, str]]:
    """(first_name, last_name, email) for every predefined recruiter, demo login first."""
    out: list[tuple[str, str, str]] = []
    if settings.demo_recruiter_email:
        name = settings.demo_recruiter_name or name_from_email(settings.demo_recruiter_email)
        first, last = split_name(name)
        out.append((first, last, settings.demo_recruiter_email))
    seen = {e for _, _, e in out}
    for full, email in SYNTHETIC_RECRUITERS.values():
        if email in seen:
            continue
        seen.add(email)
        first, last = split_name(full)
        out.append((first, last, email))
    return out


def recruiter_names(db: Session) -> dict[str, str]:
    return {r.email: r.full_name for r in db.scalars(select(Recruiter)).all()}


def display_name(email: str, names: Mapping[str, str]) -> str:
    return names.get(email) or name_from_email(email)


def booking_url_for(db: Session, settings: Settings, email: str) -> str:
    """The recruiter's own scheduling link if set, else the demo-wide one: in the demo every
    request, whoever made it, ends at the same booking page."""
    recruiter = db.get(Recruiter, email)
    if recruiter is not None and recruiter.booking_url:
        return recruiter.booking_url
    return settings.demo_booking_url
