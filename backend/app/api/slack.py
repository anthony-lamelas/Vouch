"""Slack callbacks: button clicks (interactions) and free-text DM replies (events)."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from sqlalchemy.exc import IntegrityError

from app.config import Settings, get_settings
from app.db import SessionLocal
from app.models import SlackEvent
from app.services.classifier import get_classifier, path_to
from app.services.lifecycle import LABELS, IllegalTransitionError, Status
from app.services.outreach import get_generator
from app.services.referrals import (
    ReferralService,
    employee_actor,
    latest_open_request_for_slack_user,
)
from app.services.slack import BUTTONS, get_notifier, verify_signature

router = APIRouter(prefix="/slack", tags=["slack"])
log = logging.getLogger("vouch.slack")


async def _verified_body(request: Request, settings: Settings) -> bytes:
    body = await request.body()
    ok = verify_signature(
        settings,
        body=body,
        timestamp=request.headers.get("X-Slack-Request-Timestamp", ""),
        signature=request.headers.get("X-Slack-Signature", ""),
    )
    if not ok:
        raise HTTPException(status_code=401, detail="Bad Slack signature")
    return body


def _service(settings: Settings) -> ReferralService:
    return ReferralService(
        db=SessionLocal(),
        settings=settings,
        notifier=get_notifier(settings),
        generator=get_generator(settings),
    )


@router.post("/interactions", include_in_schema=False)
async def interactions(request: Request) -> Response:
    settings = get_settings()
    body = await _verified_body(request, settings)
    form = dict(item.split("=", 1) for item in body.decode().split("&") if "=" in item)
    from urllib.parse import unquote_plus

    payload: dict[str, Any] = json.loads(unquote_plus(form.get("payload", "{}")))
    if payload.get("type") != "block_actions":
        return Response(status_code=200)
    service = _service(settings)
    try:
        for action in payload.get("actions", []):
            mapping = BUTTONS.get(str(action.get("action_id")))
            if mapping is None:
                continue
            target, reason, _ = mapping
            request_id = uuid.UUID(str(action.get("value")))
            req = service.get(request_id)
            try:
                service.transition(
                    request_id, to_status=target, actor=employee_actor(req.employee), reason=reason
                )
            except IllegalTransitionError as exc:
                log.info("ignored stale button: %s", exc)
    finally:
        service.db.close()
    return Response(status_code=200)


def _handle_message_event(event: dict[str, Any], settings: Settings) -> None:
    service = _service(settings)
    db = service.db
    try:
        channel_id = str(event.get("channel", ""))
        thread_ts = event.get("thread_ts")
        text = str(event.get("text", "")).strip()
        req = latest_open_request_for_slack_user(
            db, channel_id=channel_id, thread_ts=str(thread_ts) if thread_ts else None
        )
        if req is None or not text:
            return
        current = Status(req.status)
        result = get_classifier(settings).classify(text, current)
        if result.target is None:
            service.notifier.reply(
                channel_id=channel_id,
                thread_ts=str(thread_ts) if thread_ts else None,
                text=(
                    "I couldn't tell what you meant. Tap a button above, or say something like "
                    '"sent it", "they\'re interested", "they passed" or "not a fit".'
                ),
            )
            return
        path = path_to(current, result.target) or []
        if not path:
            service.notifier.reply(
                channel_id=channel_id,
                thread_ts=str(thread_ts) if thread_ts else None,
                text=f"Already marked as {LABELS[current]}.",
            )
            return
        updated = service.transition_path(
            req.id,
            path=path,
            actor=employee_actor(req.employee),
            note=f"Reply: {text[:500]}",
            reason=result.reason,
        )
        final = Status(updated.status)
        suffix = (
            " I've asked the next-closest colleague."
            if (result.target == Status.EMPLOYEE_DECLINED and final == Status.REQUESTED)
            else ""
        )
        service.notifier.reply(
            channel_id=channel_id,
            thread_ts=str(thread_ts) if thread_ts else None,
            text=f"Got it, marked as *{LABELS[result.target]}*.{suffix}",
        )
    except Exception:
        log.exception("slack event handling failed")
    finally:
        db.close()


@router.post("/events", include_in_schema=False)
async def events(request: Request, background: BackgroundTasks) -> Response:
    settings = get_settings()
    body = await _verified_body(request, settings)
    payload: dict[str, Any] = json.loads(body or b"{}")
    if payload.get("type") == "url_verification":
        return Response(content=str(payload.get("challenge", "")), media_type="text/plain")
    if payload.get("type") != "event_callback":
        return Response(status_code=200)
    event: dict[str, Any] = payload.get("event", {})
    if (
        event.get("type") != "message"
        or event.get("channel_type") != "im"
        or event.get("bot_id")
        or event.get("subtype")
    ):
        return Response(status_code=200)
    event_id = str(payload.get("event_id", ""))
    with SessionLocal() as db:
        db.add(SlackEvent(event_id=event_id))
        try:
            db.commit()
        except IntegrityError:
            return Response(status_code=200)  # Slack retry; already handled
    background.add_task(_handle_message_event, event, settings)
    return Response(status_code=200)
