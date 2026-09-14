"""Fold the retired 'no_response' status into 'employee_accepted'.

Silence is now shown as a derived stale flag instead of a state the employee reports.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-13
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE referral_request SET status = 'employee_accepted' WHERE status = 'no_response'"
    )
    op.execute(
        "UPDATE referral_event SET to_status = 'employee_accepted' WHERE to_status = 'no_response'"
    )
    op.execute(
        "UPDATE referral_event SET from_status = 'employee_accepted' "
        "WHERE from_status = 'no_response'"
    )


def downgrade() -> None:
    pass
