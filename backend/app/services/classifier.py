"""Turn an employee's free-text Slack reply into a status transition."""

from __future__ import annotations

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


# Ordered: candidate outcomes are checked before the weaker 'accepted' signals,
# because "I messaged her and she's interested" should land on candidate_interested.
_RULES: Final[tuple[tuple[Status, DeclineReason | None, tuple[str, ...]], ...]] = (
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
        Status.EMPLOYEE_ACCEPTED,
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


def get_classifier(settings: Settings) -> KeywordClassifier:
    return KeywordClassifier()
