"""Who owns a role. Ashby's public board doesn't expose recruiters, so ownership is assigned by
department: the demo team owns Research & Development, synthetic recruiters own the rest. Roles
and requests are shared across the demo team, so every teammate sees the same 'mine'."""

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
# The demo team owns every role in this department; everyone else is synthetic.
DEMO_DEPARTMENT: Final[str] = "Research & Development"


def name_from_email(email: str) -> str:
    """'anthony.lamelas23@example.com' -> 'Anthony Lamelas'."""
    local = email.split("@", 1)[0]
    parts = [re.sub(r"\d+", "", p) for p in re.split(r"[._-]+", local)]
    words = [p.capitalize() for p in parts if p]
    return " ".join(words) or email


def demo_team(settings: Settings) -> dict[str, str]:
    """email -> display name for the demo login and their teammates, demo login first."""
    team: dict[str, str] = {}
    if settings.demo_recruiter_email:
        email = settings.demo_recruiter_email
        team[email] = settings.demo_recruiter_name or name_from_email(email)
    for entry in settings.demo_recruiter_teammates.split(","):
        entry = entry.strip()
        if not entry:
            continue
        email, _, name = entry.partition(":")
        email = email.strip()
        if email and email not in team:
            team[email] = name.strip() or name_from_email(email)
    return team


def owning_emails(user_email: str, settings: Settings) -> set[str]:
    """Whose roles and requests count as this user's: the whole demo team for a teammate,
    otherwise just themselves."""
    team = demo_team(settings)
    return set(team) if user_email in team else {user_email}


def default_owner(department: str, settings: Settings, title: str = "") -> tuple[str, str]:
    """Returns (owner_name, owner_email) for a role."""
    if settings.demo_recruiter_email and department == DEMO_DEPARTMENT:
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
    for email, name in demo_team(settings).items():
        first, last = split_name(name)
        out.append((first, last, email))
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
