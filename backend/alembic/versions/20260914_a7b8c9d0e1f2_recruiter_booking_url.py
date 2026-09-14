"""Per-recruiter booking link, passed to interested candidates to schedule a screen.

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-09-14
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: str | None = "f6a7b8c9d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("recruiter", sa.Column("booking_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("recruiter", "booking_url")
