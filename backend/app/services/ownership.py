"""Who owns a role. Ashby's public board doesn't expose recruiters, so ownership is assigned by
department: the demo recruiter owns engineering-adjacent reqs, synthetic recruiters own the rest."""

from __future__ import annotations

import re
from typing import Final

from app.config import Settings

SYNTHETIC_RECRUITERS: Final[dict[str, tuple[str, str]]] = {
    "Research & Development": ("Sam Okafor", "sam.okafor@cognition.ai"),
    "Customer Engineering": ("Sam Okafor", "sam.okafor@cognition.ai"),
    "Sales": ("Dana Whitfield", "dana.whitfield@cognition.ai"),
    "Marketing": ("Chris Nakamura", "chris.nakamura@cognition.ai"),
    "General & Administrative": ("Priyanka Shah", "priyanka.shah@cognition.ai"),
}
FALLBACK_RECRUITER: Final[tuple[str, str]] = ("Sam Okafor", "sam.okafor@cognition.ai")
DEMO_DEPARTMENTS: Final[frozenset[str]] = frozenset(
    {"Research & Development", "Customer Engineering"}
)


def name_from_email(email: str) -> str:
    """'anthony.lamelas23@example.com' -> 'Anthony Lamelas'."""
    local = email.split("@", 1)[0]
    parts = [re.sub(r"\d+", "", p) for p in re.split(r"[._-]+", local)]
    words = [p.capitalize() for p in parts if p]
    return " ".join(words) or email


def default_owner(department: str, settings: Settings) -> tuple[str, str]:
    """Returns (owner_name, owner_email) for a role in this department."""
    if department in DEMO_DEPARTMENTS and settings.demo_recruiter_email:
        email = settings.demo_recruiter_email
        return settings.demo_recruiter_name or name_from_email(email), email
    return SYNTHETIC_RECRUITERS.get(department, FALLBACK_RECRUITER)
