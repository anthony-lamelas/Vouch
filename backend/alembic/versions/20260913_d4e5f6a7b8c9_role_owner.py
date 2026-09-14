"""Add role ownership (owner_email, owner_name).

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-13
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("role", sa.Column("owner_email", sa.String(length=255), nullable=True))
    op.add_column("role", sa.Column("owner_name", sa.String(length=160), nullable=True))
    op.create_index("ix_role_owner_email", "role", ["owner_email"])


def downgrade() -> None:
    op.drop_index("ix_role_owner_email", table_name="role")
    op.drop_column("role", "owner_name")
    op.drop_column("role", "owner_email")
