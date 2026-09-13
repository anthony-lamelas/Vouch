"""Referral request state machine. Pure functions; persistence lives in the referral service."""

from __future__ import annotations

from enum import StrEnum
from typing import Final


class Status(StrEnum):
    REQUESTED = "requested"
    EMPLOYEE_ACCEPTED = "employee_accepted"
    EMPLOYEE_DECLINED = "employee_declined"
    CANDIDATE_INTERESTED = "candidate_interested"
    CANDIDATE_DECLINED = "candidate_declined"
    NO_RESPONSE = "no_response"
    CLOSED = "closed"


class DeclineReason(StrEnum):
    DONT_KNOW_WELL = "dont_know_well"
    NOT_A_FIT = "not_a_fit"


# Saying yes means the employee will reach out; the outcome states record what happened next.
TRANSITIONS: Final[dict[Status, frozenset[Status]]] = {
    Status.REQUESTED: frozenset(
        {Status.EMPLOYEE_ACCEPTED, Status.EMPLOYEE_DECLINED, Status.CLOSED}
    ),
    Status.EMPLOYEE_DECLINED: frozenset({Status.REQUESTED, Status.CLOSED}),
    Status.EMPLOYEE_ACCEPTED: frozenset(
        {
            Status.CANDIDATE_INTERESTED,
            Status.CANDIDATE_DECLINED,
            Status.NO_RESPONSE,
            Status.CLOSED,
        }
    ),
    Status.NO_RESPONSE: frozenset(
        {Status.CANDIDATE_INTERESTED, Status.CANDIDATE_DECLINED, Status.CLOSED}
    ),
    Status.CANDIDATE_INTERESTED: frozenset({Status.CLOSED}),
    Status.CANDIDATE_DECLINED: frozenset({Status.CLOSED}),
    Status.CLOSED: frozenset(),
}

# Which statuses the employee (via Slack) may set, versus the recruiter (via the app).
EMPLOYEE_SETTABLE: Final[frozenset[Status]] = frozenset(
    {
        Status.EMPLOYEE_ACCEPTED,
        Status.EMPLOYEE_DECLINED,
        Status.CANDIDATE_INTERESTED,
        Status.CANDIDATE_DECLINED,
        Status.NO_RESPONSE,
    }
)
RECRUITER_SETTABLE: Final[frozenset[Status]] = frozenset({Status.CLOSED})

ACTIVE_STATUSES: Final[frozenset[Status]] = frozenset(s for s in Status if s != Status.CLOSED)

# Labels are written from the recruiter's point of view.
LABELS: Final[dict[Status, str]] = {
    Status.REQUESTED: "Waiting on employee",
    Status.EMPLOYEE_ACCEPTED: "Employee reaching out",
    Status.EMPLOYEE_DECLINED: "Employee passed",
    Status.CANDIDATE_INTERESTED: "Candidate interested",
    Status.CANDIDATE_DECLINED: "Candidate passed",
    Status.NO_RESPONSE: "No reply yet",
    Status.CLOSED: "Closed",
}


class IllegalTransitionError(ValueError):
    def __init__(self, current: Status, target: Status) -> None:
        super().__init__(f"Cannot move a request from {current} to {target}")
        self.current = current
        self.target = target


def can_transition(current: Status, target: Status) -> bool:
    return target in TRANSITIONS[current]


def assert_transition(current: Status, target: Status) -> None:
    if not can_transition(current, target):
        raise IllegalTransitionError(current, target)


def next_employee_actions(current: Status) -> list[Status]:
    """Buttons to show the employee in Slack for a request in this state."""
    return [s for s in TRANSITIONS[current] if s in EMPLOYEE_SETTABLE]
