from sqlalchemy import SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CompanyTier(Base):
    """Predefined company tiers. Tier 1 = target companies (Google, Stripe, ...)."""

    __tablename__ = "company_tier"

    name: Mapped[str] = mapped_column(String(120), primary_key=True)
    tier: Mapped[int] = mapped_column(SmallInteger, nullable=False)


class SchoolTier(Base):
    """Predefined school tiers."""

    __tablename__ = "school_tier"

    name: Mapped[str] = mapped_column(String(160), primary_key=True)
    tier: Mapped[int] = mapped_column(SmallInteger, nullable=False)
