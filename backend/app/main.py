"""FastAPI application. Serves the API under /api and the built frontend at /."""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import admin, contacts, meta, requests, roles, slack
from app.config import get_settings

settings = get_settings()
log = logging.getLogger("vouch")


def _seed_if_empty() -> None:
    from sqlalchemy import func, select

    from app.db import SessionLocal
    from app.models import Employee
    from app.seed.loader import seed_database

    with SessionLocal() as db:
        if (db.scalar(select(func.count()).select_from(Employee)) or 0) > 0:
            return
        log.info("empty database: seeding demo data")
        report = seed_database(db, settings, prefer_live_roles=True)
        log.info("seeded: %s", report)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.seed_on_start:
        _seed_if_empty()
    yield


app = FastAPI(
    title="VOUCH API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", settings.app_base_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (meta.router, roles.router, contacts.router, requests.router, slack.router, admin.router):
    app.include_router(r, prefix="/api")


INDEX_HEADERS = {"Cache-Control": "no-cache"}


def _looks_like_file(path: str) -> bool:
    """/assets/app-abc123.js or /favicon.svg, as opposed to a client route like /roles/123."""
    last = path.rsplit("/", 1)[-1]
    return path.startswith("/assets/") or ("." in last)


@app.exception_handler(404)
async def not_found(request: Request, exc: Exception) -> JSONResponse | FileResponse:
    """SPA fallback: unknown client routes serve index.html so client routing works.

    Missing files (a hashed asset from a previous build, a typo'd image) must stay real 404s,
    otherwise a browser holding a stale index.html gets HTML back for a <script> request.
    """
    path = request.url.path
    index = _static_dir() / "index.html"
    if not path.startswith("/api") and not _looks_like_file(path) and index.exists():
        return FileResponse(index, headers=INDEX_HEADERS)
    detail = getattr(exc, "detail", "Not found")
    return JSONResponse({"detail": detail}, status_code=404)


@app.middleware("http")
async def cache_headers(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Hashed assets are immutable; index.html must always be revalidated."""
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/assets/") and response.status_code == 200:
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif not path.startswith("/api") and response.headers.get("content-type", "").startswith(
        "text/html"
    ):
        response.headers["Cache-Control"] = "no-cache"
    return response


def _static_dir() -> Path:
    configured = os.environ.get("STATIC_DIR")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


_static = _static_dir()
if _static.exists():
    app.mount("/", StaticFiles(directory=_static, html=True), name="static")
