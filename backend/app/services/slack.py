"""Slack delivery: Block Kit message construction, sending, updating, signature checks."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from slack_sdk.signature import SignatureVerifier

from app.config import Settings
from app.models import Employee, ReferralRequest
from app.services.lifecycle import LABELS, DeclineReason, Status, next_employee_actions
from app.services.outreach import Drafts, OutreachContext

BUTTONS: dict[str, tuple[Status, DeclineReason | None, str | None]] = {
    "vouch_accept": (Status.EMPLOYEE_ACCEPTED, None, "primary"),
    "vouch_decline": (Status.EMPLOYEE_DECLINED, None, None),
    "vouch_interested": (Status.CANDIDATE_INTERESTED, None, "primary"),
    "vouch_candidate_declined": (Status.CANDIDATE_DECLINED, None, None),
}
BUTTON_TEXT: dict[str, str] = {
    "vouch_accept": "Yes, I'll refer them",
    "vouch_decline": "No, not this one",
    "vouch_interested": "They're interested",
    "vouch_candidate_declined": "They passed",
}
_STATUS_TO_BUTTONS: dict[Status, list[str]] = {
    Status.EMPLOYEE_ACCEPTED: ["vouch_accept"],
    Status.EMPLOYEE_DECLINED: ["vouch_decline"],
    Status.CANDIDATE_INTERESTED: ["vouch_interested"],
    Status.CANDIDATE_DECLINED: ["vouch_candidate_declined"],
}


@dataclass(frozen=True)
class SendResult:
    delivered: bool
    recipient: str
    channel_id: str | None = None
    ts: str | None = None
    error: str | None = None


def action_buttons(status: Status, request_id: str) -> list[dict[str, Any]]:
    elements: list[dict[str, Any]] = []
    order = list(_STATUS_TO_BUTTONS)
    for target in sorted(next_employee_actions(status), key=order.index):
        for action_id in _STATUS_TO_BUTTONS.get(target, []):
            _, _, style = BUTTONS[action_id]
            button: dict[str, Any] = {
                "type": "button",
                "action_id": action_id,
                "text": {"type": "plain_text", "text": BUTTON_TEXT[action_id]},
                "value": request_id,
            }
            if style:
                button["style"] = style
            elements.append(button)
    return elements


def build_request_blocks(
    *,
    request: ReferralRequest,
    ctx: OutreachContext,
    drafts: Drafts,
    employee: Employee,
    demo_routed: bool,
    app_url: str,
    requested_by_name: str | None = None,
) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"Referral ask: {ctx.role_title}"},
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f"*{requested_by_name or request.requested_by}* · "
                    f"*<{ctx.role_url}|{ctx.role_title}>*\n\n{drafts.ask}"
                ),
            },
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": (
                        f"Tap a button, or just reply here in plain English. "
                        f"<{app_url}/requests/{request.id}|View in VOUCH>"
                    ),
                }
            ],
        },
    ]
    if demo_routed:
        blocks.append(
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": (
                            f"_Demo routing: this would go to {employee.full_name} "
                            f"({employee.email})._"
                        ),
                    }
                ],
            }
        )
    blocks.append(
        {
            "type": "actions",
            "block_id": "vouch_actions",
            "elements": action_buttons(Status(request.status), str(request.id)),
        }
    )
    return blocks


def status_blocks(
    blocks: list[dict[str, Any]], status: Status, request_id: str
) -> list[dict[str, Any]]:
    """Return a copy of the message blocks reflecting the new status and next buttons."""
    kept = [b for b in blocks if b.get("block_id") not in {"vouch_actions", "vouch_status"}]
    kept.append(
        {
            "type": "context",
            "block_id": "vouch_status",
            "elements": [{"type": "mrkdwn", "text": f"*Status:* {LABELS[status]}"}],
        }
    )
    buttons = action_buttons(status, request_id)
    if buttons:
        kept.append({"type": "actions", "block_id": "vouch_actions", "elements": buttons})
    return kept


class Notifier(Protocol):
    def send(self, *, recipient: str, text: str, blocks: list[dict[str, Any]]) -> SendResult: ...

    def update(
        self, *, channel_id: str, ts: str, text: str, blocks: list[dict[str, Any]]
    ) -> bool: ...

    def reply(self, *, channel_id: str, thread_ts: str | None, text: str) -> None: ...


class NullNotifier:
    """Records that a message would have been sent. Used locally and in tests."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def send(self, *, recipient: str, text: str, blocks: list[dict[str, Any]]) -> SendResult:
        self.sent.append({"recipient": recipient, "text": text, "blocks": blocks})
        return SendResult(delivered=False, recipient=recipient, error="slack_disabled")

    def update(self, *, channel_id: str, ts: str, text: str, blocks: list[dict[str, Any]]) -> bool:
        return False

    def reply(self, *, channel_id: str, thread_ts: str | None, text: str) -> None:
        return None


class SlackNotifier:
    def __init__(self, token: str) -> None:
        self._client = WebClient(token=token)

    def send(self, *, recipient: str, text: str, blocks: list[dict[str, Any]]) -> SendResult:
        try:
            opened = self._client.conversations_open(users=[recipient])
            channel_id = str(opened["channel"]["id"])
            posted = self._client.chat_postMessage(channel=channel_id, text=text, blocks=blocks)
            return SendResult(True, recipient, channel_id, str(posted["ts"]))
        except SlackApiError as exc:
            return SendResult(False, recipient, error=str(exc.response.get("error", exc)))

    def update(self, *, channel_id: str, ts: str, text: str, blocks: list[dict[str, Any]]) -> bool:
        try:
            self._client.chat_update(channel=channel_id, ts=ts, text=text, blocks=blocks)
            return True
        except SlackApiError:
            return False

    def reply(self, *, channel_id: str, thread_ts: str | None, text: str) -> None:
        try:
            self._client.chat_postMessage(channel=channel_id, text=text, thread_ts=thread_ts)
        except SlackApiError:
            return None


def get_notifier(settings: Settings) -> Notifier:
    if settings.slack_enabled:
        return SlackNotifier(settings.slack_bot_token)
    return NullNotifier()


def verify_signature(settings: Settings, *, body: bytes, timestamp: str, signature: str) -> bool:
    if not settings.slack_signing_secret:
        return False
    verifier = SignatureVerifier(settings.slack_signing_secret)
    return bool(verifier.is_valid(body=body, timestamp=timestamp, signature=signature))


def resolve_recipient(settings: Settings, employee: Employee) -> tuple[str, bool]:
    """Who actually receives the DM. In the demo everything routes to one Slack user."""
    if settings.slack_demo_user_id:
        return settings.slack_demo_user_id, employee.slack_user_id != settings.slack_demo_user_id
    return employee.slack_user_id or "", False
