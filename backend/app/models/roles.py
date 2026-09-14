import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, created_at_col, uuid_pk
from app.models.people import Contact


class Role(Base):
    """An open position, synced from Cognition's Ashby job board."""

    __tablename__ = "role"

    id: Mapped[uuid.UUID] = uuid_pk()
    ashby_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    department: Mapped[str] = mapped_column(String(120), nullable=False)
    team: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    is_remote: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    employment_type: Mapped[str] = mapped_column(String(40), nullable=False, default="FullTime")
    description_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_plain: Mapped[str] = mapped_column(Text, nullable=False, default="")
    job_url: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    apply_url: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    required_skills: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    job_family: Mapped[str] = mapped_column(String(40), nullable=False)
    seniority: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    owner_email: Mapped[str | None] = mapped_column(String(255), index=True)
    owner_name: Mapped[str | None] = mapped_column(String(160))
    synced_at: Mapped[datetime] = created_at_col()

    match_scores: Mapped[list["MatchScore"]] = relationship(back_populates="role")


class MatchScore(Base):
    """Precomputed relevance of a contact for a role, with explainable reasons."""

    __tablename__ = "match_score"
    __table_args__ = (Index("ix_match_score_role_score", "role_id", "score"),)

    role_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("role.id", ondelete="CASCADE"), primary_key=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contact.id", ondelete="CASCADE"), primary_key=True
    )
    score: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    # [{"signal": "skills", "label": "4 of 6 required skills", "value": 0.67}]
    reasons: Mapped[list[dict[str, Any]]] = mapped_column(nullable=False, default=list)
    computed_at: Mapped[datetime] = created_at_col()

    role: Mapped[Role] = relationship(back_populates="match_scores")
    contact: Mapped[Contact] = relationship()
