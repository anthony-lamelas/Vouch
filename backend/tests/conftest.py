"""Test fixtures. Uses a real Postgres database (vouch_test) migrated with Alembic and seeded
with a small deterministic dataset from the committed Ashby snapshot."""

from __future__ import annotations

import os
from collections.abc import Generator, Iterator

TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://vouch:vouch@localhost:5432/vouch_test"
)
os.environ.update(
    {
        "APP_ENV": "test",
        "AUTH_DISABLED": "true",
        "DATABASE_URL": TEST_DB_URL,
        "SEED_CONTACT_COUNT": "300",
        "SEED_EMPLOYEE_COUNT": "12",
        "SLACK_SIGNING_SECRET": "test-signing-secret",
        "SLACK_BOT_TOKEN": "",
        "ADMIN_TOKEN": "test-admin-token",
        "APP_BASE_URL": "http://testserver",
    }
)

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from alembic import command  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402


def _ensure_database() -> None:
    admin_url = TEST_DB_URL.rsplit("/", 1)[0] + "/postgres"
    engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    name = TEST_DB_URL.rsplit("/", 1)[1]
    with engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": name}
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{name}"'))
    engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def database() -> Iterator[None]:
    _ensure_database()
    cfg = Config("alembic.ini")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    from app.seed.loader import seed_database

    with SessionLocal() as db:
        seed_database(db, get_settings(), prefer_live_roles=False)
    yield


@pytest.fixture
def db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as c:
        yield c
