"""Turn an employee's free-text Slack reply into a status transition."""

from __future__ import annotations

import json
import re
from collections import deque
from dataclasses import dataclass
from typing import Final

from app.config import Settings
from app.services.lifecycle import EMPLOYEE_SETTABLE, TRANSITIONS, DeclineReason, Status


@dataclass(frozen=True)
class Classification:
    target: Status | None
    reason: DeclineReason | None = None
    confidence: float = 0.0
    classifier: str = "keyword"


# Ordered: candidate outcomes are checked before the weaker 'contacted' and 'accepted' signals,
# because "I messaged her and she's interested" should land on candidate_interested.
_RULES: Final[tuple[tuple[Status, DeclineReason | None, tuple[str, ...]], ...]] = (
    (
        Status.NO_RESPONSE,
        None,
        (
            r"no (reply|response|answer)",
            r"hasn'?t (replied|responded|answered|gotten back)",
            r"ghost",
            r"radio silence",
            r"never (heard|got) back",
            r"crickets",
        ),
    ),
    (
        Status.CANDIDATE_DECLINED,
        None,
        (
            r"not interested",
            r"isn'?t interested",
            r"passed",
            r"pass on",
            r"declined",
            r"happy where",
            r"not looking",
            r"no thanks",
            r"turned (it|us) down",
            r"said no",
            r"not right now",
            r"not open",
        ),
    ),
    (
        Status.CANDIDATE_INTERESTED,
        None,
        (
            r"interested",
            r"keen",
            r"wants? to (chat|talk|learn|hear)",
            r"open to",
            r"said yes",
            r"down to (chat|talk)",
            r"excited",
            r"curious",
            r"intro",
            r"would love to",
            r"happy to (chat|talk)",
        ),
    ),
    (
        Status.EMPLOYEE_DECLINED,
        DeclineReason.DONT_KNOW_WELL,
        (
            r"don'?t (really )?know (them|him|her)",
            r"barely know",
            r"not (that )?close",
            r"met (once|briefly)",
            r"don'?t know (them|him|her) well",
            r"lost touch",
        ),
    ),
    (
        Status.EMPLOYEE_DECLINED,
        DeclineReason.NOT_A_FIT,
        (
            r"not a (good )?fit",
            r"wrong fit",
            r"wouldn'?t (be|fit)",
            r"not the right",
            r"not suited",
            r"wrong role",
            r"wrong level",
        ),
    ),
    (
        Status.CONTACTED,
        None,
        (
            r"(reached|reaching) out",
            r"messaged",
            r"pinged",
            r"sent (them|him|her|it|a)",
            r"contacted",
            r"dm'?d",
            r"emailed",
            r"texted",
            r"just (asked|wrote)",
        ),
    ),
    (
        Status.EMPLOYEE_ACCEPTED,
        None,
        (
            r"\bwill do\b",
            r"\bon it\b",
            r"\bsure\b",
            r"i'?ll (reach|ping|message|ask|do)",
            r"happy to",
            r"\byes\b",
            r"\bok\b",
            r"\bokay\b",
            r"sounds good",
            r"\byep\b",
            r"\byup\b",
            r"count me in",
        ),
    ),
)


def path_to(current: Status, target: Status) -> list[Status] | None:
    """Shortest legal path of employee-settable transitions from current to target."""
    if current == target:
        return []
    queue: deque[tuple[Status, list[Status]]] = deque([(current, [])])
    seen = {current}
    while queue:
        node, path = queue.popleft()
        for nxt in TRANSITIONS[node]:
            if nxt in seen or nxt not in EMPLOYEE_SETTABLE:
                continue
            new_path = [*path, nxt]
            if nxt == target:
                return new_path
            seen.add(nxt)
            queue.append((nxt, new_path))
    return None


class KeywordClassifier:
    name = "keyword"

    def classify(self, text: str, current: Status) -> Classification:
        lowered = text.lower()
        for status, reason, patterns in _RULES:
            if any(re.search(p, lowered) for p in patterns):
                if path_to(current, status) is None:
                    continue
                return Classification(status, reason, confidence=0.7, classifier=self.name)
        return Classification(None, None, 0.0, self.name)


class ClaudeClassifier:
    name = "claude"

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model
        self._fallback = KeywordClassifier()

    def classify(self, text: str, current: Status) -> Classification:
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=self._api_key, timeout=6.0, max_retries=0)
            options = [s.value for s in EMPLOYEE_SETTABLE if path_to(current, s) is not None]
            prompt = (
                "An employee replied to a referral request in Slack. Classify the reply into "
                f"one of these statuses: {options}, or null if none applies. If the status is "
                "employee_declined also return reason: 'dont_know_well' or 'not_a_fit'. "
                'Reply with JSON only: {"status": ..., "reason": ..., "confidence": 0-1}.\n\n'
                f"Current status: {current.value}\nReply: {text!r}"
            )
            message = client.messages.create(
                model=self._model,
                max_tokens=100,
                messages=[{"role": "user", "content": prompt}],
            )
            block = message.content[0]
            raw = block.text if block.type == "text" else ""
            data = json.loads(raw[raw.find("{") : raw.rfind("}") + 1])
            status = Status(data["status"]) if data.get("status") else None
            reason = DeclineReason(data["reason"]) if data.get("reason") else None
            return Classification(status, reason, float(data.get("confidence", 0.5)), self.name)
        except Exception:
            return self._fallback.classify(text, current)


def get_classifier(settings: Settings) -> KeywordClassifier | ClaudeClassifier:
    if settings.reply_classifier_mode == "claude" and settings.anthropic_api_key:
        return ClaudeClassifier(settings.anthropic_api_key, settings.anthropic_model)
    return KeywordClassifier()
