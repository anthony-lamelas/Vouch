"""Referral request state machine. Pure functions; persistence lives in the referral service."""

from __future__ import annotations

from enum import StrEnum
from typing import Final

STALE_AFTER_DAYS: Final[int] = 7


class Status(StrEnum):
    REQUESTED = "requested"
    EMPLOYEE_ACCEPTED = "employee_accepted"
    EMPLOYEE_DECLINED = "employee_declined"
    CANDIDATE_INTERESTED = "candidate_interested"
    CANDIDATE_DECLINED = "candidate_declined"
    CLOSED = "closed"


class DeclineReason(StrEnum):
    DONT_KNOW_WELL = "dont_know_well"
    NOT_A_FIT = "not_a_fit"
    NOT_LOOKING = "not_looking"
    OTHER = "other"


# Why an employee passed, in the recruiter's words. Shown on the timeline and in Slack.
DECLINE_LABELS: Final[dict[DeclineReason | None, str]] = {
    DeclineReason.DONT_KNOW_WELL: "Doesn't know them well enough",
    DeclineReason.NOT_A_FIT: "Not a fit for this role",
    DeclineReason.NOT_LOOKING: "They wouldn't be looking",
    DeclineReason.OTHER: "Other",
    None: "Declined to refer",
}


# Saying yes means the employee will reach out; the outcome states record what happened next.
# A decline parks the request in EMPLOYEE_DECLINED with the employee's reason; the recruiter then
# decides whether to ask another connected colleague (back to REQUESTED) or close it.
# A request that sits in EMPLOYEE_ACCEPTED longer than STALE_AFTER_DAYS is flagged stale in the
# UI (derived at read time, nothing stored) so the recruiter can nudge or close.
TRANSITIONS: Final[dict[Status, frozenset[Status]]] = {
    Status.REQUESTED: frozenset(
        {Status.EMPLOYEE_ACCEPTED, Status.EMPLOYEE_DECLINED, Status.CLOSED}
    ),
    Status.EMPLOYEE_DECLINED: frozenset({Status.REQUESTED, Status.CLOSED}),
    Status.EMPLOYEE_ACCEPTED: frozenset(
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
    }
)
RECRUITER_SETTABLE: Final[frozenset[Status]] = frozenset({Status.CLOSED})

ACTIVE_STATUSES: Final[frozenset[Status]] = frozenset(s for s in Status if s != Status.CLOSED)

# Labels are written from the recruiter's point of view.
LABELS: Final[dict[Status, str]] = {
    Status.REQUESTED: "Waiting on employee",
    Status.EMPLOYEE_ACCEPTED: "Employee reached out",
    Status.EMPLOYEE_DECLINED: "Employee passed",
    Status.CANDIDATE_INTERESTED: "Candidate interested",
    Status.CANDIDATE_DECLINED: "Candidate passed",
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
