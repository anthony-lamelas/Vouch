"""Admin operations, protected by X-Admin-Token. Used to reset the demo dataset."""

from __future__ import annotations

import dataclasses
import logging
import threading
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import DB, AppSettings, require_admin
from app.db import SessionLocal
from app.schemas import ResetJobOut
from app.services.ashby import fetch_or_snapshot, sync_roles
from app.services.matching import recompute_match_scores

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])
log = logging.getLogger("vouch.admin")

_job: dict[str, Any] = {
    "state": "idle",
    "started_at": None,
    "finished_at": None,
    "report": None,
    "error": None,
}
_lock = threading.Lock()


def _run_reset(prefer_live: bool) -> None:
    from app.config import get_settings
    from app.seed.loader import seed_database

    try:
        with SessionLocal() as db:
            report = seed_database(db, get_settings(), prefer_live_roles=prefer_live)
        _job.update(state="done", report=dataclasses.asdict(report))
    except Exception as exc:
        log.exception("demo reset failed")
        _job.update(state="failed", error=str(exc))
    finally:
        _job["finished_at"] = datetime.now(UTC)


@router.post("/reset-demo", response_model=ResetJobOut, status_code=202)
def reset_demo(_: AppSettings, live_roles: bool = True) -> ResetJobOut:
    with _lock:
        if _job["state"] == "running":
            return ResetJobOut(**_job)
        _job.update(
            state="running", started_at=datetime.now(UTC), finished_at=None, report=None, error=None
        )
    threading.Thread(target=_run_reset, args=(live_roles,), daemon=True).start()
    return ResetJobOut(**_job)


@router.get("/reset-demo", response_model=ResetJobOut)
def reset_status() -> ResetJobOut:
    return ResetJobOut(**_job)


@router.post("/sync-roles")
def sync_roles_now(db: DB, live: bool = True) -> dict[str, Any]:
    postings, source = fetch_or_snapshot(prefer_live=live)
    result = sync_roles(db, postings, source=source)
    scores = recompute_match_scores(db)
    db.commit()
    return {**dataclasses.asdict(result), "match_scores": scores}
