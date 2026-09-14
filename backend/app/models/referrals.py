import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, created_at_col, uuid_pk
from app.models.people import Contact, Employee
from app.models.roles import Role


class ReferralRequest(Base):
    """A recruiter's ask: 'employee, please reach out to contact about role'."""

    __tablename__ = "referral_request"
    __table_args__ = (
        Index(
            "uq_active_request_per_contact",
            "contact_id",
            unique=True,
            postgresql_where=text("status <> 'closed'"),
        ),
        Index("ix_referral_request_status", "status"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    contact_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contact.id"), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("role.id"), nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employee.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="requested")
    requested_by: Mapped[str] = mapped_column(String(255), nullable=False)
    outreach_casual: Mapped[str] = mapped_column(Text, nullable=False, default="")
    outreach_formal: Mapped[str] = mapped_column(Text, nullable=False, default="")
    closed_outcome: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_col()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    contact: Mapped[Contact] = relationship()
    role: Mapped[Role] = relationship()
    employee: Mapped[Employee] = relationship()
    events: Mapped[list["ReferralEvent"]] = relationship(
        back_populates="request", order_by="ReferralEvent.created_at"
    )
    messages: Mapped[list["OutreachMessage"]] = relationship(
        back_populates="request", order_by="OutreachMessage.created_at"
    )


class ReferralEvent(Base):
    """Append-only history of status transitions."""

    __tablename__ = "referral_event"

    id: Mapped[uuid.UUID] = uuid_pk()
    request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("referral_request.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(32))
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    # The employee the request was with when this happened (the decliner, or the new assignee).
    employee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("employee.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = created_at_col()

    request: Mapped[ReferralRequest] = relationship(back_populates="events")


class OutreachMessage(Base):
    """A message VOUCH sent to an employee (backs the Outreach panel)."""

    __tablename__ = "outreach_message"

    id: Mapped[uuid.UUID] = uuid_pk()
    request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("referral_request.id", ondelete="CASCADE"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employee.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="slack")
    recipient: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False)
    blocks: Mapped[list[dict[str, Any]]] = mapped_column(nullable=False, default=list)
    external_channel_id: Mapped[str | None] = mapped_column(String(32))
    external_ts: Mapped[str | None] = mapped_column(String(32))
    delivered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_col()

    request: Mapped[ReferralRequest] = relationship(back_populates="messages")
    employee: Mapped[Employee] = relationship()


class SlackEvent(Base):
    """Slack event ids we've already processed, so retries are idempotent."""

    __tablename__ = "slack_event"

    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    received_at: Mapped[datetime] = created_at_col()
