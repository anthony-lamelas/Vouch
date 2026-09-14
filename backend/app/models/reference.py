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


class Recruiter(Base):
    """Predefined recruiter / hiring-manager identities: the demo login plus synthetic teammates.
    Auth itself is Supabase; this table only supplies display names and role ownership."""

    __tablename__ = "recruiter"

    email: Mapped[str] = mapped_column(String(255), primary_key=True)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    # Where a candidate books a recruiter screen. Per recruiter; the demo login's comes from env.
    booking_url: Mapped[str | None] = mapped_column(String(500))

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
