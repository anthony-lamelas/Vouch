"""Fold the retired 'contacted' status into 'employee_accepted'.

Saying yes now means the employee will reach out, so existing rows in the old state map onto
the accepted state without losing history.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-13
"""

from collections.abc import Sequence

from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE referral_request SET status = 'employee_accepted' WHERE status = 'contacted'"
    )
    op.execute(
        "UPDATE referral_event SET to_status = 'employee_accepted' WHERE to_status = 'contacted'"
    )
    op.execute(
        "UPDATE referral_event SET from_status = 'employee_accepted' "
        "WHERE from_status = 'contacted'"
    )


def downgrade() -> None:
    # Irreversible by design: the distinction between 'accepted' and 'contacted' is gone.
    pass
