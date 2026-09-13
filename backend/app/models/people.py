import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, created_at_col, uuid_pk


class Employee(Base):
    """A Cognition employee whose network has been ingested."""

    __tablename__ = "employee"

    id: Mapped[uuid.UUID] = uuid_pk()
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    department: Mapped[str] = mapped_column(String(120), nullable=False)
    team: Mapped[str | None] = mapped_column(String(120))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    slack_user_id: Mapped[str | None] = mapped_column(String(32))
    # [{company, title, team, start, end}] — dates as ISO strings, end null = current
    experiences: Mapped[list[dict[str, Any]]] = mapped_column(nullable=False, default=list)
    # [{school, degree, field, start_year, end_year}]
    education: Mapped[list[dict[str, Any]]] = mapped_column(nullable=False, default=list)
    created_at: Mapped[datetime] = created_at_col()

    connections: Mapped[list["Connection"]] = relationship(back_populates="employee")


class Contact(Base):
    """A canonical person in some employee's network. One row per human."""

    __tablename__ = "contact"
    __table_args__ = (
        Index("ix_contact_experiences_gin", "experiences", postgresql_using="gin"),
        Index("ix_contact_education_gin", "education", postgresql_using="gin"),
        Index("ix_contact_skills_gin", "skills", postgresql_using="gin"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    linkedin_url: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    headline: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    current_company: Mapped[str] = mapped_column(String(120), nullable=False)
    current_title: Mapped[str] = mapped_column(String(160), nullable=False)
    job_family: Mapped[str] = mapped_column(String(40), nullable=False)
    seniority: Mapped[str] = mapped_column(String(20), nullable=False)
    experiences: Mapped[list[dict[str, Any]]] = mapped_column(nullable=False, default=list)
    education: Mapped[list[dict[str, Any]]] = mapped_column(nullable=False, default=list)
    skills: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    enrichment_source: Mapped[str] = mapped_column(String(40), nullable=False, default="synthetic")
    created_at: Mapped[datetime] = created_at_col()

    connections: Mapped[list["Connection"]] = relationship(back_populates="contact")


class Connection(Base):
    """The edge: this employee knows this contact."""

    __tablename__ = "connection"
    __table_args__ = (Index("ix_connection_contact_strength", "contact_id", "strength"),)

    employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employee.id", ondelete="CASCADE"), primary_key=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contact.id", ondelete="CASCADE"), primary_key=True
    )
    connected_on: Mapped[date] = mapped_column(Date, nullable=False)
    strength: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    # {overlap, school, recency, overlap_detail, school_detail}
    strength_breakdown: Mapped[dict[str, Any]] = mapped_column(nullable=False, default=dict)

    employee: Mapped[Employee] = relationship(back_populates="connections")
    contact: Mapped[Contact] = relationship(back_populates="connections")
