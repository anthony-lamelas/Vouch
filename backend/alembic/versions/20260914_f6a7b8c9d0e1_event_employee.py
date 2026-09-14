"""Record which employee a referral event concerned, so declines are tracked across re-routes.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-14
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "referral_event",
        sa.Column(
            "employee_id",
            sa.Uuid(),
            sa.ForeignKey("employee.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    # Backfill: Slack-driven events carry the employee in the actor string.
    op.execute(
        "UPDATE referral_event SET employee_id = CAST(substr(actor, 10) AS uuid) "
        "WHERE actor LIKE 'employee:%%' AND employee_id IS NULL"
    )
    # Anything else happened to whoever the request was assigned to at the time; the best
    # remaining approximation is the request's current employee.
    op.execute(
        "UPDATE referral_event e SET employee_id = r.employee_id "
        "FROM referral_request r WHERE r.id = e.request_id AND e.employee_id IS NULL"
    )


def downgrade() -> None:
    op.drop_column("referral_event", "employee_id")
