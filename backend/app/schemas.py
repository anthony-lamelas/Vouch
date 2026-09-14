"""API response and request models."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.services.lifecycle import DeclineReason, Status


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- People ----------------------------------------------------------------------------------


class EmployeeBrief(ORMModel):
    id: uuid.UUID
    full_name: str
    title: str
    team: str | None
    department: str


class ConnectionOut(BaseModel):
    employee: EmployeeBrief
    strength: float
    shared_history: str | None
    connected_on: date
    breakdown: dict[str, Any]


class ContactBrief(ORMModel):
    id: uuid.UUID
    full_name: str
    headline: str
    location: str
    current_company: str
    current_title: str
    job_family: str
    seniority: str
    skills: list[str]


class ActiveRequestBrief(BaseModel):
    id: uuid.UUID
    status: Status
    role_id: uuid.UUID
    role_title: str
    employee_name: str


class CandidateOut(BaseModel):
    contact: ContactBrief
    score: float
    reasons: list[dict[str, Any]]
    top_connection: ConnectionOut | None
    connection_count: int
    active_request: ActiveRequestBrief | None


class CandidatePage(BaseModel):
    items: list[CandidateOut]
    total: int
    limit: int
    offset: int


class RoleScoreBrief(BaseModel):
    role_id: uuid.UUID
    title: str
    team: str
    score: float


class ContactDetail(ContactBrief):
    linkedin_url: str
    experiences: list[dict[str, Any]]
    education: list[dict[str, Any]]
    enrichment_source: str
    connections: list[ConnectionOut]
    requests: list[RequestSummary]
    top_roles: list[RoleScoreBrief]


# ---- Roles -----------------------------------------------------------------------------------


class RoleSummary(ORMModel):
    id: uuid.UUID
    ashby_id: str
    title: str
    department: str
    team: str
    location: str
    is_remote: bool
    job_family: str
    seniority: str
    required_skills: list[str]
    published_at: datetime | None
    job_url: str
    owner_email: str | None = None
    owner_name: str | None = None
    is_mine: bool = False
    strong_match_count: int = 0
    active_request_count: int = 0


class RoleDetail(RoleSummary):
    description_html: str
    employment_type: str


# ---- Requests --------------------------------------------------------------------------------


class RoleBrief(ORMModel):
    id: uuid.UUID
    title: str
    team: str
    department: str
    location: str
    owner_email: str | None = None
    owner_name: str | None = None


class EventOut(BaseModel):
    id: uuid.UUID
    from_status: Status | None
    to_status: Status
    actor: str
    actor_label: str
    note: str | None
    created_at: datetime


class MessageOut(BaseModel):
    id: uuid.UUID
    channel: str
    recipient: str
    body: str
    delivered: bool
    error: str | None
    created_at: datetime
    employee: EmployeeBrief


class LastMessageBrief(BaseModel):
    excerpt: str
    delivered: bool
    error: str | None
    created_at: datetime
    employee_name: str


class RequestSummary(BaseModel):
    id: uuid.UUID
    status: Status
    status_label: str
    contact: ContactBrief
    role: RoleBrief
    employee: EmployeeBrief
    requested_by: str
    requested_by_name: str
    created_at: datetime
    updated_at: datetime
    last_event_at: datetime | None = None
    # Days since the employee agreed to reach out with no outcome yet; stale past STALE_AFTER_DAYS.
    days_waiting: int | None = None
    stale: bool = False
    is_mine: bool = False
    # What the employee last received from VOUCH, so the pipeline can show it inline.
    last_message: LastMessageBrief | None = None


class RequestDetail(RequestSummary):
    outreach_casual: str
    outreach_formal: str
    closed_outcome: str | None
    allowed_transitions: list[Status]
    connection: ConnectionOut | None
    reasons: list[dict[str, Any]]
    events: list[EventOut]
    messages: list[MessageOut]


class RequestPage(BaseModel):
    items: list[RequestSummary]
    total: int


class CreateRequestIn(BaseModel):
    contact_id: uuid.UUID
    role_id: uuid.UUID
    employee_id: uuid.UUID | None = None
    # Recruiter-edited version of the suggested message; falls back to the generated draft.
    message: str | None = Field(default=None, max_length=2000)


class AskPreviewIn(BaseModel):
    contact_id: uuid.UUID
    role_id: uuid.UUID
    employee_id: uuid.UUID | None = None


class AskPreviewOut(BaseModel):
    employee: EmployeeBrief
    connection: ConnectionOut
    ask: str
    casual: str
    formal: str
    reasons: list[dict[str, Any]]


class TransitionIn(BaseModel):
    to_status: Status
    note: str | None = Field(default=None, max_length=2000)
    reason: DeclineReason | None = None


# ---- Meta ------------------------------------------------------------------------------------


class TieredName(BaseModel):
    name: str
    tier: int


class FilterOptions(BaseModel):
    companies: list[TieredName]
    schools: list[TieredName]
    skills: list[str]
    departments: list[str]
    families: list[str]


class StatusCount(BaseModel):
    status: Status
    label: str
    count: int


class Stats(BaseModel):
    employees: int
    contacts: int
    connections: int
    roles: int
    requests_total: int
    requests_active: int
    by_status: list[StatusCount]
    slack_enabled: bool
    auth_disabled: bool


class PublicConfig(BaseModel):
    supabase_url: str
    supabase_anon_key: str
    auth_disabled: bool
    slack_enabled: bool
    app_name: str = "VOUCH"


class MeOut(BaseModel):
    id: str
    email: str
    name: str
    auth_disabled: bool


class ResetJobOut(BaseModel):
    state: str
    started_at: datetime | None
    finished_at: datetime | None
    report: dict[str, Any] | None
    error: str | None


ContactDetail.model_rebuild()
