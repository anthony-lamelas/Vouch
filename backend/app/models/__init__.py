"""ORM models. Import everything here so Alembic sees the full metadata."""

from app.models.base import Base
from app.models.people import Connection, Contact, Employee
from app.models.reference import CompanyTier, SchoolTier
from app.models.referrals import OutreachMessage, ReferralEvent, ReferralRequest, SlackEvent
from app.models.roles import MatchScore, Role

__all__ = [
    "Base",
    "CompanyTier",
    "Connection",
    "Contact",
    "Employee",
    "MatchScore",
    "OutreachMessage",
    "ReferralEvent",
    "ReferralRequest",
    "Role",
    "SchoolTier",
    "SlackEvent",
]
