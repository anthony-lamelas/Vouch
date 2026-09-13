from itertools import pairwise

import pytest

from app.services.classifier import path_to
from app.services.lifecycle import (
    IllegalTransitionError,
    Status,
    assert_transition,
    can_transition,
    next_employee_actions,
)


def test_happy_path_is_legal() -> None:
    path = [
        Status.REQUESTED,
        Status.EMPLOYEE_ACCEPTED,
        Status.CANDIDATE_INTERESTED,
        Status.CLOSED,
    ]
    for a, b in pairwise(path):
        assert can_transition(a, b)


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (Status.CLOSED, Status.REQUESTED),
        (Status.REQUESTED, Status.CANDIDATE_INTERESTED),
        (Status.CANDIDATE_INTERESTED, Status.EMPLOYEE_ACCEPTED),
        (Status.EMPLOYEE_ACCEPTED, Status.REQUESTED),
    ],
)
def test_illegal_transitions_raise(current: Status, target: Status) -> None:
    with pytest.raises(IllegalTransitionError):
        assert_transition(current, target)


def test_closed_is_terminal() -> None:
    assert next_employee_actions(Status.CLOSED) == []


def test_employee_actions_from_requested() -> None:
    assert set(next_employee_actions(Status.REQUESTED)) == {
        Status.EMPLOYEE_ACCEPTED,
        Status.EMPLOYEE_DECLINED,
    }


def test_path_to_chains_intermediate_states() -> None:
    assert path_to(Status.REQUESTED, Status.CANDIDATE_INTERESTED) == [
        Status.EMPLOYEE_ACCEPTED,
        Status.CANDIDATE_INTERESTED,
    ]
    assert path_to(Status.CANDIDATE_INTERESTED, Status.EMPLOYEE_ACCEPTED) is None
    assert path_to(Status.REQUESTED, Status.CLOSED) is None  # closing is the recruiter's
