"""Outreach drafting: deterministic templates by default, Claude behind a flag."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Protocol

from app.config import Settings


@dataclass(frozen=True)
class OutreachContext:
    contact_full_name: str
    contact_title: str
    contact_company: str
    role_title: str
    role_team: str
    role_location: str
    role_url: str
    employee_first_name: str
    shared_history: str | None = None
    fit_reasons: list[str] = field(default_factory=list)

    @property
    def contact_first_name(self) -> str:
        return self.contact_full_name.split(" ")[0]


@dataclass(frozen=True)
class Drafts:
    casual: str
    formal: str
    generator: str


class OutreachGenerator(Protocol):
    name: str

    def generate(self, ctx: OutreachContext) -> Drafts: ...


def _because(ctx: OutreachContext) -> str:
    if not ctx.fit_reasons:
        return ""
    return f" ({ctx.fit_reasons[0].lower()})"


_HISTORY_REWRITES = (
    ("Worked together at", "we worked together at"),
    ("Both worked at", "we both worked at"),
    ("Overlapped at", "we overlapped at"),
    ("Both attended", "we both went to"),
)


def _casual_history(history: str) -> str:
    """'Worked together at Stripe (2019-2024) on Payments' -> 'we worked together at Stripe ...'."""
    for prefix, replacement in _HISTORY_REWRITES:
        if history.startswith(prefix):
            return replacement + history[len(prefix) :]
    return history[:1].lower() + history[1:]


def draft_casual(ctx: OutreachContext) -> str:
    history = _casual_history(ctx.shared_history) if ctx.shared_history else ""
    opener = (
        f"Hey {ctx.contact_first_name}! Feels like ages since {history}."
        if history
        else f"Hey {ctx.contact_first_name}! Hope things are good at {ctx.contact_company}."
    )
    return (
        f"{opener} Quick one: we're hiring a {ctx.role_title} on the {ctx.role_team} team here "
        f"at Cognition and you were honestly the first person I thought of{_because(ctx)}. "
        f"Zero pressure, but if you're even a little curious I'd love to tell you what we're "
        f"building. 15 min call sometime next week?"
    )


def draft_formal(ctx: OutreachContext) -> str:
    shared = (
        f"{ctx.shared_history}, and I've followed your work since. " if ctx.shared_history else ""
    )
    return (
        f"Subject: {ctx.role_title} at Cognition\n\n"
        f"Hi {ctx.contact_first_name},\n\n"
        f"I hope you're doing well. {shared}I'm reaching out because Cognition is hiring a "
        f"{ctx.role_title} ({ctx.role_location}), and given your work as "
        f"{ctx.contact_title} at {ctx.contact_company}, I think you'd be a strong "
        f"fit{_because(ctx)}.\n\n"
        f"I'd be glad to share more about the team and the role, or introduce you to the hiring "
        f"manager directly. Would you be open to a short conversation next week?\n\n"
        f"Best,\n{ctx.employee_first_name}\n{ctx.role_url}"
    )


class TemplateGenerator:
    name = "template"

    def generate(self, ctx: OutreachContext) -> Drafts:
        return Drafts(casual=draft_casual(ctx), formal=draft_formal(ctx), generator=self.name)


class ClaudeGenerator:
    """Uses Claude to tailor both drafts; falls back to templates on any failure."""

    name = "claude"

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model
        self._fallback = TemplateGenerator()

    def generate(self, ctx: OutreachContext) -> Drafts:
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=self._api_key, timeout=8.0, max_retries=1)
            prompt = (
                "You write referral outreach for an employee at Cognition (maker of Devin). "
                "Return JSON with keys 'casual' (a short DM, 2-4 sentences, warm, no emoji) "
                "and 'formal' (an email with a Subject line, under 140 words). Mention the "
                "shared history if given. Do not invent facts.\n\n"
                + json.dumps(
                    {
                        "contact": {
                            "name": ctx.contact_full_name,
                            "title": ctx.contact_title,
                            "company": ctx.contact_company,
                        },
                        "role": {
                            "title": ctx.role_title,
                            "team": ctx.role_team,
                            "location": ctx.role_location,
                            "url": ctx.role_url,
                        },
                        "employee_first_name": ctx.employee_first_name,
                        "shared_history": ctx.shared_history,
                        "fit_reasons": ctx.fit_reasons,
                    }
                )
            )
            message = client.messages.create(
                model=self._model,
                max_tokens=600,
                messages=[{"role": "user", "content": prompt}],
            )
            block = message.content[0]
            raw = block.text if block.type == "text" else ""
            start, end = raw.find("{"), raw.rfind("}")
            data = json.loads(raw[start : end + 1])
            casual, formal = str(data["casual"]).strip(), str(data["formal"]).strip()
            if not casual or not formal:
                raise ValueError("empty draft")
            return Drafts(casual=casual, formal=formal, generator=self.name)
        except Exception:
            return self._fallback.generate(ctx)


def get_generator(settings: Settings) -> OutreachGenerator:
    if settings.outreach_mode == "claude" and settings.anthropic_api_key:
        return ClaudeGenerator(settings.anthropic_api_key, settings.anthropic_model)
    return TemplateGenerator()
