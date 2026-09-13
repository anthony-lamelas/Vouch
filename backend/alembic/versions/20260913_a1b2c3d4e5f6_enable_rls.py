"""Enable row-level security on every application table.

On Supabase the `public` schema is reachable through PostgREST with the publishable key. The
API connects as the table owner, which bypasses RLS, so enabling it with no policies simply
closes the REST door to anyone else. On plain Postgres this is a harmless no-op.

Revision ID: a1b2c3d4e5f6
Revises: 9df52d75134b
Create Date: 2026-09-13
"""

from collections.abc import Sequence

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "9df52d75134b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = (
    "company_tier",
    "school_tier",
    "employee",
    "contact",
    "connection",
    "role",
    "match_score",
    "referral_request",
    "referral_event",
    "outreach_message",
    "slack_event",
)


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
