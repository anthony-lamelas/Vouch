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
    # Where the employee and the contact actually overlapped, if anywhere: one or the other.
    shared_company: str | None = None
    shared_school: str | None = None
    fit_reasons: list[str] = field(default_factory=list)
    recruiter_first_name: str = ""

    @property
    def contact_first_name(self) -> str:
        return self.contact_full_name.split(" ")[0]


@dataclass(frozen=True)
class Drafts:
    ask: str  # the recruiter's note to the employee: "would you refer X for Y?"
    casual: str  # a suggested DM the employee could send the candidate
    formal: str  # email version of the same
    generator: str


class OutreachGenerator(Protocol):
    name: str

    def generate(self, ctx: OutreachContext) -> Drafts: ...


def _because(ctx: OutreachContext) -> str:
    if not ctx.fit_reasons:
        return ""
    return f" ({ctx.fit_reasons[0].lower()})"


def article(noun: str) -> str:
    """'a' or 'an' for a job title: 'an AI Support Engineer', 'an SRE', 'a Software Engineer'."""
    word = noun.strip().split(" ")[0] if noun.strip() else ""
    if not word:
        return "a"
    lower = word.lower()
    if word.isupper() and len(word) <= 4:
        # Acronyms are read letter by letter; these letters start with a vowel sound.
        return "an" if word[0] in "AEFHILMNORSX" else "a"
    if lower.startswith(("uni", "use", "usa", "eu", "one", "ux", "ui")):
        return "a"
    if lower.startswith(("hour", "honest", "heir", "honor")):
        return "an"
    return "an" if lower[0] in "aeiou" else "a"


def _shared_sentence(ctx: OutreachContext) -> str:
    if ctx.shared_company:
        return f" You both worked at {ctx.shared_company}, so you seemed like the right person to ask."
    if ctx.shared_school:
        return f" You both went to {ctx.shared_school}, so you seemed like the right person to ask."
    return ""


def draft_ask(ctx: OutreachContext) -> str:
    """Concise note from the recruiter to the employee asking for the referral."""
    history = _shared_sentence(ctx)
    signoff = f"\n\nThanks,\n{ctx.recruiter_first_name}" if ctx.recruiter_first_name else ""
    return (
        f"Hi {ctx.employee_first_name}, would you be willing to reach out to "
        f"{ctx.contact_full_name} ({ctx.contact_title} at {ctx.contact_company}) and refer "
        f"them for the {ctx.role_title} role?{history} If you're up for it, tap Yes below, ping "
        f"{ctx.contact_first_name}, and let me know here what they say.{signoff}"
    )


def draft_casual(ctx: OutreachContext) -> str:
    """The suggested DM from the employee to the candidate."""
    return (
        f"Hey {ctx.contact_first_name}! I hope you are doing well. We're hiring "
        f"{article(ctx.role_title)} {ctx.role_title} here at Cognition, and you seem like a "
        f"great fit. Zero pressure, but if you're interested, please let me know, and we can "
        f"get the interview process going!\n\nHere's the role: {ctx.role_url}"
    )


def draft_booking(ctx: OutreachContext, booking_url: str) -> str:
    """What the employee passes on once the candidate says yes: how to book a recruiter screen."""
    who = (
        f"{ctx.recruiter_first_name} from our recruiting team"
        if ctx.recruiter_first_name
        else "our recruiting team"
    )
    return (
        f"Hey {ctx.contact_first_name}! Great to hear you're interested. {who} would love to "
        f"chat. Grab a time that works for you here and they'll take it from there: "
        f"{booking_url}"
    )


def draft_formal(ctx: OutreachContext) -> str:
    shared = (
        f"{ctx.shared_history}, and I've followed your work since. " if ctx.shared_history else ""
    )
    return (
        f"Subject: {ctx.role_title} at Cognition\n\n"
        f"Hi {ctx.contact_first_name},\n\n"
        f"I hope you're doing well. {shared}I'm reaching out because Cognition is hiring "
        f"{article(ctx.role_title)} {ctx.role_title} ({ctx.role_location}), and given your work as "
        f"{ctx.contact_title} at {ctx.contact_company}, I think you'd be a strong "
        f"fit{_because(ctx)}.\n\n"
        f"I'd be glad to share more about the team and the role, or introduce you to the hiring "
        f"manager directly. Would you be open to a short conversation next week?\n\n"
        f"Best,\n{ctx.employee_first_name}\n{ctx.role_url}"
    )


class TemplateGenerator:
    name = "template"

    def generate(self, ctx: OutreachContext) -> Drafts:
        return Drafts(
            ask=draft_ask(ctx),
            casual=draft_casual(ctx),
            formal=draft_formal(ctx),
            generator=self.name,
        )


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
            return Drafts(ask=draft_ask(ctx), casual=casual, formal=formal, generator=self.name)
        except Exception:
            return self._fallback.generate(ctx)


def get_generator(settings: Settings) -> OutreachGenerator:
    if settings.outreach_mode == "claude" and settings.anthropic_api_key:
        return ClaudeGenerator(settings.anthropic_api_key, settings.anthropic_model)
    return TemplateGenerator()
