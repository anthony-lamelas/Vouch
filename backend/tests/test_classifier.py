import pytest

from app.services.classifier import KeywordClassifier
from app.services.lifecycle import DeclineReason, Status


@pytest.mark.parametrize(
    ("text", "current", "target", "reason"),
    [
        ("sure, I'll reach out today", Status.REQUESTED, Status.EMPLOYEE_ACCEPTED, None),
        ("just messaged her on LinkedIn", Status.REQUESTED, Status.EMPLOYEE_ACCEPTED, None),
        (
            "she's interested, wants to chat next week",
            Status.EMPLOYEE_ACCEPTED,
            Status.CANDIDATE_INTERESTED,
            None,
        ),
        ("he passed, happy where he is", Status.EMPLOYEE_ACCEPTED, Status.CANDIDATE_DECLINED, None),
        ("no reply yet, I'll nudge again", Status.EMPLOYEE_ACCEPTED, Status.NO_RESPONSE, None),
        (
            "honestly I barely know him",
            Status.REQUESTED,
            Status.EMPLOYEE_DECLINED,
            DeclineReason.DONT_KNOW_WELL,
        ),
        (
            "not a fit for this role imo",
            Status.REQUESTED,
            Status.EMPLOYEE_DECLINED,
            DeclineReason.NOT_A_FIT,
        ),
        # A reply implying skipped states is still classified; the service chains the path.
        ("pinged her and she's keen", Status.REQUESTED, Status.CANDIDATE_INTERESTED, None),
    ],
)
def test_keyword_classifier(
    text: str, current: Status, target: Status, reason: DeclineReason | None
) -> None:
    result = KeywordClassifier().classify(text, current)
    assert result.target == target
    assert result.reason == reason


def test_unclassifiable_reply() -> None:
    assert KeywordClassifier().classify("what's the comp band?", Status.REQUESTED).target is None


def test_illegal_target_is_skipped() -> None:
    # "interested" cannot apply once the request is closed.
    assert KeywordClassifier().classify("she's interested", Status.CLOSED).target is None
