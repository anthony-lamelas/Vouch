"""Slack delivery: Block Kit message construction, sending, updating, signature checks."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from slack_sdk.signature import SignatureVerifier

from app.config import Settings
from app.models import Employee, ReferralRequest
from app.services.lifecycle import DECLINE_LABELS, DeclineReason, Status, next_employee_actions
from app.services.outreach import Drafts, OutreachContext

BUTTONS: dict[str, tuple[Status, DeclineReason | None, str | None]] = {
    "vouch_accept": (Status.EMPLOYEE_ACCEPTED, None, "primary"),
    "vouch_decline": (Status.EMPLOYEE_DECLINED, None, None),
    "vouch_interested": (Status.CANDIDATE_INTERESTED, None, "primary"),
    "vouch_candidate_declined": (Status.CANDIDATE_DECLINED, None, None),
}
BUTTON_TEXT: dict[str, str] = {
    "vouch_accept": "Yes, I'll reach out",
    "vouch_decline": "No, not this one",
    "vouch_interested": "{name}'s interested",
    "vouch_candidate_declined": "{name} passed",
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


def action_buttons(
    status: Status, request_id: str, contact_first: str = "They"
) -> list[dict[str, Any]]:
    elements: list[dict[str, Any]] = []
    order = list(_STATUS_TO_BUTTONS)
    for target in sorted(next_employee_actions(status), key=order.index):
        for action_id in _STATUS_TO_BUTTONS.get(target, []):
            _, _, style = BUTTONS[action_id]
            label = BUTTON_TEXT[action_id].format(name=contact_first)
            button: dict[str, Any] = {
                "type": "button",
                "action_id": action_id,
                "text": {"type": "plain_text", "text": label},
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
    routing_note: str = "",
) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (f"*Referral Request: <{ctx.role_url}|{ctx.role_title}>*\n\n{drafts.ask}"),
            },
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
                            f"_Demo routing: this would go to {employee.full_name} in production._"
                        ),
                    }
                ],
            }
        )
    blocks.append(
        {
            "type": "actions",
            "block_id": "vouch_actions",
            "elements": action_buttons(
                Status(request.status), str(request.id), ctx.contact_first_name
            ),
        }
    )
    return blocks


def status_blocks(
    blocks: list[dict[str, Any]],
    status: Status,
    request_id: str,
    *,
    contact_first: str = "them",
    employee_first: str = "",
    suggested_message: str = "",
    note: str = "",
    booking_message: str = "",
    recruiter_first: str = "",
) -> list[dict[str, Any]]:
    """Return a copy of the message blocks reflecting the new status and next buttons."""
    kept = [
        b
        for b in blocks
        if b.get("block_id") not in {"vouch_actions", "vouch_status", "vouch_suggested"}
    ]
    if status == Status.EMPLOYEE_ACCEPTED:
        thanks = f"Thanks{', ' + employee_first if employee_first else ''}!"
        kept.append(
            {
                "type": "section",
                "block_id": "vouch_status",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"{thanks} Once you've reached out to {contact_first}, "
                        "let me know what they said."
                    ),
                },
            }
        )
        if suggested_message:
            kept.append(
                {
                    "type": "section",
                    "block_id": "vouch_suggested",
                    "text": {
                        "type": "mrkdwn",
                        "text": (
                            f"*Suggested message to {contact_first}* (copy, tweak, send)\n"
                            f"```{suggested_message}```"
                        ),
                    },
                }
            )
    if status == Status.CANDIDATE_INTERESTED:
        thanks = f"Great news, thanks{' ' + employee_first if employee_first else ''}!"
        recruiter = recruiter_first or "the recruiter"
        text = (
            f"{thanks} Pass {contact_first} the message below so they can book a screen "
            f"with {recruiter}."
            if booking_message
            else f"{thanks} {recruiter} will take it from here."
        )
        kept.append(
            {
                "type": "section",
                "block_id": "vouch_status",
                "text": {"type": "mrkdwn", "text": text},
            }
        )
        if booking_message:
            kept.append(
                {
                    "type": "section",
                    "block_id": "vouch_suggested",
                    "text": {
                        "type": "mrkdwn",
                        "text": (
                            f"*Message to pass on to {contact_first}* (copy, tweak, send)\n"
                            f"```{booking_message}```"
                        ),
                    },
                }
            )
    if status == Status.CANDIDATE_DECLINED:
        who = f" {employee_first}" if employee_first else ""
        kept.append(
            {
                "type": "section",
                "block_id": "vouch_status",
                "text": {"type": "mrkdwn", "text": f"No worries, thanks for reaching out{who}."},
            }
        )
    if status == Status.EMPLOYEE_DECLINED:
        thanks = f"Thanks{', ' + employee_first if employee_first else ''}, no problem."
        why = f" Noted: _{note}_." if note else ""
        kept.append(
            {
                "type": "section",
                "block_id": "vouch_status",
                "text": {"type": "mrkdwn", "text": f"{thanks}{why}"},
            }
        )
    buttons = action_buttons(status, request_id, contact_first)
    if buttons:
        kept.append({"type": "actions", "block_id": "vouch_actions", "elements": buttons})
    return kept


DECLINE_MODAL_CALLBACK = "vouch_decline_reason"


def decline_modal(request_id: str, *, contact_first: str) -> dict[str, Any]:
    """The 'why not?' form Slack opens when an employee taps No. Reason feeds the timeline."""
    options = [
        {
            "text": {"type": "plain_text", "text": DECLINE_LABELS[reason]},
            "value": reason.value,
        }
        for reason in DeclineReason
    ]
    return {
        "type": "modal",
        "callback_id": DECLINE_MODAL_CALLBACK,
        "private_metadata": request_id,
        "title": {"type": "plain_text", "text": "No problem"},
        "submit": {"type": "plain_text", "text": "Send"},
        "close": {"type": "plain_text", "text": "Cancel"},
        "blocks": [
            {
                "type": "input",
                "block_id": "reason",
                "label": {"type": "plain_text", "text": f"Why not {contact_first}?"},
                "element": {
                    "type": "static_select",
                    "action_id": "reason",
                    "placeholder": {"type": "plain_text", "text": "Pick one"},
                    "options": options,
                },
            },
            {
                "type": "input",
                "block_id": "detail",
                "optional": True,
                "label": {"type": "plain_text", "text": "Anything the recruiter should know?"},
                "element": {
                    "type": "plain_text_input",
                    "action_id": "detail",
                    "multiline": True,
                    "max_length": 500,
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Helps them decide whether to ask someone else",
                    },
                },
            },
        ],
    }


def decline_note(reason: str, detail: str) -> str:
    """One line for the timeline: the picked reason, then the employee's own words if any."""
    try:
        label = DECLINE_LABELS[DeclineReason(reason)]
    except ValueError:
        label = DECLINE_LABELS[None]
    detail = detail.strip()
    if not detail:
        return label
    return detail if label == DECLINE_LABELS[DeclineReason.OTHER] else f"{label}: {detail}"


class Notifier(Protocol):
    def send(self, *, recipient: str, text: str, blocks: list[dict[str, Any]]) -> SendResult: ...

    def lookup_user_by_email(self, email: str) -> str | None: ...

    def update(
        self, *, channel_id: str, ts: str, text: str, blocks: list[dict[str, Any]]
    ) -> bool: ...

    def reply(self, *, channel_id: str, thread_ts: str | None, text: str) -> None: ...

    def open_view(self, *, trigger_id: str, view: dict[str, Any]) -> bool: ...


class NullNotifier:
    """Records that a message would have been sent. Used locally and in tests."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def send(self, *, recipient: str, text: str, blocks: list[dict[str, Any]]) -> SendResult:
        self.sent.append({"recipient": recipient, "text": text, "blocks": blocks})
        return SendResult(delivered=False, recipient=recipient, error="slack_disabled")

    def lookup_user_by_email(self, email: str) -> str | None:
        return None

    def update(self, *, channel_id: str, ts: str, text: str, blocks: list[dict[str, Any]]) -> bool:
        return False

    def reply(self, *, channel_id: str, thread_ts: str | None, text: str) -> None:
        return None

    def open_view(self, *, trigger_id: str, view: dict[str, Any]) -> bool:
        return False


class SlackNotifier:
    def __init__(self, token: str) -> None:
        self._client = WebClient(token=token)
        self._email_cache: dict[str, str | None] = {}

    def lookup_user_by_email(self, email: str) -> str | None:
        """Slack user id for a workspace member with this email, cached per process."""
        key = email.strip().lower()
        if not key:
            return None
        if key not in self._email_cache:
            try:
                found = self._client.users_lookupByEmail(email=key)
                self._email_cache[key] = str(found["user"]["id"])
            except SlackApiError:
                self._email_cache[key] = None
        return self._email_cache[key]

    def send(self, *, recipient: str, text: str, blocks: list[dict[str, Any]]) -> SendResult:
        try:
            opened = self._client.conversations_open(users=[recipient])
            channel_id = str(opened["channel"]["id"])
            posted = self._client.chat_postMessage(
                channel=channel_id,
                text=text,
                blocks=blocks,
                unfurl_links=False,
                unfurl_media=False,
            )
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
            self._client.chat_postMessage(
                channel=channel_id,
                text=text,
                thread_ts=thread_ts,
                unfurl_links=False,
                unfurl_media=False,
            )
        except SlackApiError:
            return None

    def open_view(self, *, trigger_id: str, view: dict[str, Any]) -> bool:
        if not trigger_id:
            return False
        try:
            self._client.views_open(trigger_id=trigger_id, view=view)
        except SlackApiError:
            return False
        return True


def get_notifier(settings: Settings) -> Notifier:
    if settings.slack_enabled:
        return SlackNotifier(settings.slack_bot_token)
    return NullNotifier()


def verify_signature(settings: Settings, *, body: bytes, timestamp: str, signature: str) -> bool:
    if not settings.slack_signing_secret:
        return False
    verifier = SignatureVerifier(settings.slack_signing_secret)
    return bool(verifier.is_valid(body=body, timestamp=timestamp, signature=signature))


def resolve_recipient(
    settings: Settings,
    employee: Employee,
    *,
    requester_email: str = "",
    notifier: Notifier | None = None,
) -> tuple[str, bool]:
    """Who actually receives the DM.

    Demo routing, in order: the requesting recruiter if their login email matches a Slack
    member (so each reviewer plays the employee in their own DMs), then SLACK_DEMO_USER_ID,
    then the employee's own Slack id. The bool says whether the DM was redirected.
    """
    if settings.slack_route_to_requester and requester_email and notifier is not None:
        matched = notifier.lookup_user_by_email(requester_email)
        if matched:
            return matched, employee.slack_user_id != matched
    if settings.slack_demo_user_id:
        return settings.slack_demo_user_id, employee.slack_user_id != settings.slack_demo_user_id
    return employee.slack_user_id or "", False


def routing_reason(
    settings: Settings, employee: Employee, recipient: str, *, requester_email: str = ""
) -> str:
    """Short explanation for the demo-routing line on the card."""
    if not recipient or recipient == (employee.slack_user_id or ""):
        return ""
    if (
        settings.slack_demo_user_id
        and recipient == settings.slack_demo_user_id
        and (not requester_email or recipient != requester_email)
    ):
        if settings.slack_route_to_requester:
            return "fallback demo user; no Slack member matched the requester's email"
        return "fallback demo user"
    return "matched the requester's Slack email"
