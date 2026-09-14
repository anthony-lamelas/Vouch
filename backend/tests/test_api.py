import hashlib
import hmac
import json
import time
import uuid
from urllib.parse import quote

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Connection, Contact, MatchScore, ReferralRequest, Role


def _first_role(client: TestClient, family: str = "infrastructure") -> dict:
    roles = client.get("/api/roles").json()
    return next(r for r in roles if r["job_family"] == family)


def _slack_headers(body: str, secret: str = "test-signing-secret") -> dict[str, str]:
    ts = str(int(time.time()))
    digest = hmac.new(secret.encode(), f"v0:{ts}:{body}".encode(), hashlib.sha256).hexdigest()
    return {
        "X-Slack-Request-Timestamp": ts,
        "X-Slack-Signature": f"v0={digest}",
        "Content-Type": "application/x-www-form-urlencoded",
    }


def test_config_is_public(client: TestClient) -> None:
    r = client.get("/api/config")
    assert r.status_code == 200
    assert r.json()["auth_disabled"] is True


def test_roles_come_from_snapshot(client: TestClient) -> None:
    roles = client.get("/api/roles").json()
    assert len(roles) == 93
    assert all(r["required_skills"] for r in roles)
    titles = {r["title"] for r in roles}
    assert "Software Engineer, Infrastructure" in titles


def test_recruiter_display_names(client: TestClient) -> None:
    me = client.get("/api/me").json()
    assert me["name"] == "Local Recruiter"
    page = client.get("/api/requests").json()
    names = {i["requested_by_name"] for i in page["items"]}
    assert "Dana Whitfield" in names or "Chris Nakamura" in names
    assert not any("@" in n for n in names)
    detail = client.get(f"/api/requests/{page['items'][0]['id']}").json()
    assert "@" not in detail["events"][0]["actor_label"]


def test_role_ownership_and_mine_filters(client: TestClient) -> None:
    all_roles = client.get("/api/roles").json()
    assert all(r["owner_email"] and r["owner_name"] for r in all_roles)
    mine = client.get("/api/roles", params={"mine": True}).json()
    assert mine and all(r["is_mine"] for r in mine)
    assert all(r["title"].startswith(("AI Support Engineer", "Applied AI Engineer")) for r in mine)
    assert len(mine) < len(all_roles)
    others = [r for r in all_roles if not r["is_mine"]]
    assert {r["owner_name"] for r in others} >= {"Dana Whitfield", "Chris Nakamura"}

    my_requests = client.get("/api/requests", params={"mine": True}).json()
    assert my_requests["total"] >= 1
    assert all(item["is_mine"] for item in my_requests["items"])
    everything = client.get("/api/requests").json()
    assert everything["total"] > my_requests["total"]


def test_candidates_ranked_with_reasons(client: TestClient) -> None:
    role = _first_role(client)
    page = client.get(f"/api/roles/{role['id']}/candidates", params={"limit": 10}).json()
    assert page["total"] > 0
    scores = [c["score"] for c in page["items"]]
    assert scores == sorted(scores, reverse=True)
    top = page["items"][0]
    assert top["reasons"]
    assert top["top_connection"]["employee"]["full_name"]


def test_priya_is_a_top_infrastructure_candidate(client: TestClient) -> None:
    roles = client.get("/api/roles").json()
    role = next(r for r in roles if r["title"] == "Software Engineer, Infrastructure")
    page = client.get(f"/api/roles/{role['id']}/candidates", params={"limit": 10}).json()
    names = [c["contact"]["full_name"] for c in page["items"]]
    assert "Priya Natarajan" in names
    priya = next(c for c in page["items"] if c["contact"]["full_name"] == "Priya Natarajan")
    assert priya["top_connection"]["employee"]["full_name"] == "Bob Rivera"
    assert "Stripe" in priya["top_connection"]["shared_history"]


def test_company_and_skill_filters(client: TestClient) -> None:
    role = _first_role(client)
    page = client.get(
        f"/api/roles/{role['id']}/candidates",
        params={"companies": ["Stripe"], "skills": ["Kubernetes"], "limit": 50},
    ).json()
    assert page["total"] >= 1
    for c in page["items"]:
        assert "Kubernetes" in c["contact"]["skills"]
    detail = client.get(f"/api/contacts/{page['items'][0]['contact']['id']}").json()
    assert any(e["company"] == "Stripe" for e in detail["experiences"])


def test_multi_company_filter_is_an_or(client: TestClient) -> None:
    """Regression: the tier filter used coalesce() and only ever matched the first company."""
    roles = client.get("/api/roles").json()
    role = next(r for r in roles if r["title"] == "Software Engineer, Infrastructure")
    page = client.get(
        f"/api/roles/{role['id']}/candidates",
        params={"company_tier": 1, "skills": ["Kubernetes"], "limit": 100},
    ).json()
    names = [c["contact"]["full_name"] for c in page["items"]]
    assert "Priya Natarajan" in names  # Stripe + Google alum, not an Airbnb one
    both = client.get(
        f"/api/roles/{role['id']}/candidates",
        params={"companies": ["Stripe", "Google"], "limit": 100},
    ).json()["total"]
    stripe = client.get(
        f"/api/roles/{role['id']}/candidates", params={"companies": ["Stripe"], "limit": 100}
    ).json()["total"]
    google = client.get(
        f"/api/roles/{role['id']}/candidates", params={"companies": ["Google"], "limit": 100}
    ).json()["total"]
    assert both >= max(stripe, google) and both > 0


def test_tier_lists_and_exclude_requested(client: TestClient, db: Session) -> None:
    role = _first_role(client)
    page = client.get(
        f"/api/roles/{role['id']}/candidates", params={"school_tiers": [1], "limit": 30}
    ).json()
    tier1 = {s["name"] for s in client.get("/api/filters").json()["schools"] if s["tier"] == 1}
    assert "NYU" in tier1
    for item in page["items"][:5]:
        detail = client.get(f"/api/contacts/{item['contact']['id']}").json()
        assert any(e["school"] in tier1 for e in detail["education"])

    open_ids = {
        str(x)
        for x in db.scalars(
            select(ReferralRequest.contact_id).where(ReferralRequest.status != "closed")
        )
    }
    everything = client.get(f"/api/roles/{role['id']}/candidates", params={"limit": 100}).json()
    hidden = client.get(
        f"/api/roles/{role['id']}/candidates", params={"limit": 100, "exclude_requested": True}
    ).json()
    assert hidden["total"] <= everything["total"]
    assert not any(i["contact"]["id"] in open_ids for i in hidden["items"])


def test_tier_filter_only_returns_tier_one_alumni(client: TestClient) -> None:
    role = _first_role(client)
    page = client.get(
        f"/api/roles/{role['id']}/candidates", params={"company_tier": 1, "limit": 20}
    ).json()
    tier1 = {c["name"] for c in client.get("/api/filters").json()["companies"] if c["tier"] == 1}
    for item in page["items"]:
        detail = client.get(f"/api/contacts/{item['contact']['id']}").json()
        assert any(e["company"] in tier1 for e in detail["experiences"])


def test_request_lifecycle_end_to_end(client: TestClient, db: Session) -> None:
    role = _first_role(client, "engineering")
    # Pick a candidate with no open request.
    page = client.get(f"/api/roles/{role['id']}/candidates", params={"limit": 30}).json()
    cand = next(c for c in page["items"] if c["active_request"] is None)

    created = client.post(
        "/api/requests", json={"contact_id": cand["contact"]["id"], "role_id": role["id"]}
    )
    assert created.status_code == 201, created.text
    req = created.json()
    assert req["status"] == "requested"
    assert req["employee"]["id"] == cand["top_connection"]["employee"]["id"]
    assert req["outreach_casual"] and req["outreach_formal"]
    assert req["outreach_casual"].startswith("Hi ")
    assert cand["contact"]["full_name"] in req["outreach_casual"]
    assert len(req["messages"]) == 1
    assert req["messages"][0]["delivered"] is False  # Slack is disabled in tests
    assert req["events"][0]["to_status"] == "requested"

    dup = client.post(
        "/api/requests", json={"contact_id": cand["contact"]["id"], "role_id": role["id"]}
    )
    assert dup.status_code == 409

    # Candidate list now shows the active request.
    page2 = client.get(f"/api/roles/{role['id']}/candidates", params={"limit": 30}).json()
    same = next(c for c in page2["items"] if c["contact"]["id"] == cand["contact"]["id"])
    assert same["active_request"]["status"] == "requested"

    rid = req["id"]
    for target in ("employee_accepted", "candidate_interested"):
        r = client.post(f"/api/requests/{rid}/transition", json={"to_status": target})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == target

    illegal = client.post(
        f"/api/requests/{rid}/transition", json={"to_status": "employee_accepted"}
    )
    assert illegal.status_code == 409

    closed = client.post(
        f"/api/requests/{rid}/transition", json={"to_status": "closed", "note": "Intro made"}
    )
    assert closed.status_code == 200
    assert closed.json()["closed_outcome"] == "Intro made"
    assert [e["to_status"] for e in closed.json()["events"]] == [
        "requested",
        "employee_accepted",
        "candidate_interested",
        "closed",
    ]

    # Closing frees the contact for a new request.
    again = client.post(
        "/api/requests", json={"contact_id": cand["contact"]["id"], "role_id": role["id"]}
    )
    assert again.status_code == 201


def test_decline_reroutes_to_next_strongest_employee(client: TestClient, db: Session) -> None:
    role = _first_role(client, "engineering")
    multi = (
        select(Connection.contact_id)
        .group_by(Connection.contact_id)
        .having(func.count() >= 2)
        .subquery()
    )
    open_ids = select(ReferralRequest.contact_id).where(ReferralRequest.status != "closed")
    contact_id = db.scalar(
        select(Contact.id)
        .join(MatchScore, MatchScore.contact_id == Contact.id)
        .join(multi, multi.c.contact_id == Contact.id)
        .where(MatchScore.role_id == uuid.UUID(role["id"]), Contact.id.not_in(open_ids))
        .order_by(MatchScore.score.desc())
    )
    assert contact_id is not None
    created = client.post(
        "/api/requests", json={"contact_id": str(contact_id), "role_id": role["id"]}
    ).json()
    first_employee = created["employee"]["id"]

    r = client.post(
        f"/api/requests/{created['id']}/transition",
        json={"to_status": "employee_declined"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "requested"
    assert body["employee"]["id"] != first_employee
    kinds = [e["to_status"] for e in body["events"]]
    assert kinds == ["requested", "employee_declined", "requested"]
    assert body["events"][-1]["actor_label"] == "VOUCH"
    assert "Re-routed" in body["events"][-1]["note"]
    assert len(body["messages"]) == 2


def test_candidate_pass_auto_closes(client: TestClient) -> None:
    role = _first_role(client, "data")
    page = client.get(f"/api/roles/{role['id']}/candidates", params={"limit": 40}).json()
    cand = next(c for c in page["items"] if c["active_request"] is None)
    req = client.post(
        "/api/requests", json={"contact_id": cand["contact"]["id"], "role_id": role["id"]}
    ).json()
    client.post(f"/api/requests/{req['id']}/transition", json={"to_status": "employee_accepted"})
    r = client.post(
        f"/api/requests/{req['id']}/transition", json={"to_status": "candidate_declined"}
    ).json()
    assert r["status"] == "closed"
    assert r["closed_outcome"].startswith("Closed automatically")
    assert [e["to_status"] for e in r["events"]][-2:] == ["candidate_declined", "closed"]
    assert r["events"][-1]["actor_label"] == "VOUCH"


def test_nudge_resets_stale_clock_and_messages_employee(client: TestClient, db: Session) -> None:
    from datetime import UTC, datetime, timedelta

    req = db.scalars(
        select(ReferralRequest).where(ReferralRequest.status == "employee_accepted")
    ).first()
    assert req is not None
    accepted = next(e for e in req.events if e.to_status == "employee_accepted")
    accepted.created_at = datetime.now(UTC) - timedelta(days=10)
    db.commit()
    before = client.get(f"/api/requests/{req.id}").json()
    assert before["stale"] is True
    r = client.post(f"/api/requests/{req.id}/nudge")
    assert r.status_code == 200, r.text
    after = r.json()
    assert after["status"] == "employee_accepted"
    assert after["stale"] is False and after["days_waiting"] == 0
    assert len(after["messages"]) == len(before["messages"]) + 1
    assert after["messages"][-1]["body"].startswith("Quick nudge from Local Recruiter")
    assert after["events"][-1]["note"].startswith("Nudged")

    waiting = db.scalars(
        select(ReferralRequest).where(ReferralRequest.status == "requested")
    ).first()
    assert waiting is not None
    assert client.post(f"/api/requests/{waiting.id}/nudge").status_code == 409


def test_slack_button_click_transitions_request(client: TestClient, db: Session) -> None:
    req = db.scalars(select(ReferralRequest).where(ReferralRequest.status == "requested")).first()
    assert req is not None
    payload = {
        "type": "block_actions",
        "user": {"id": "U123"},
        "actions": [{"action_id": "vouch_accept", "value": str(req.id)}],
    }
    body = "payload=" + quote(json.dumps(payload))
    r = client.post("/api/slack/interactions", content=body, headers=_slack_headers(body))
    assert r.status_code == 200
    db.refresh(req)
    assert req.status == "employee_accepted"


def test_slack_rejects_bad_signature(client: TestClient) -> None:
    body = json.dumps({"type": "url_verification", "challenge": "abc"})
    r = client.post(
        "/api/slack/events",
        content=body,
        headers={"X-Slack-Request-Timestamp": "1", "X-Slack-Signature": "v0=bad"},
    )
    assert r.status_code == 401


def test_slack_url_verification(client: TestClient) -> None:
    body = json.dumps({"type": "url_verification", "challenge": "abc123"})
    r = client.post("/api/slack/events", content=body, headers=_slack_headers(body))
    assert r.status_code == 200
    assert r.text == "abc123"


def test_slack_free_text_reply_updates_status(client: TestClient, db: Session) -> None:
    # Give a seeded 'requested' request a fake Slack delivery so the DM can be resolved.
    req = db.scalars(select(ReferralRequest).where(ReferralRequest.status == "requested")).first()
    assert req is not None
    msg = req.messages[-1]
    msg.external_channel_id, msg.external_ts = "D999", "1700000000.000100"
    db.commit()
    event = {
        "type": "event_callback",
        "event_id": f"Ev{uuid.uuid4().hex[:10]}",
        "event": {
            "type": "message",
            "channel_type": "im",
            "channel": "D999",
            "user": "U123",
            "text": "pinged her and she's keen to chat",
        },
    }
    body = json.dumps(event)
    r = client.post("/api/slack/events", content=body, headers=_slack_headers(body))
    assert r.status_code == 200
    db.expire_all()
    db.refresh(req)
    assert req.status == "candidate_interested"
    assert [e.to_status for e in req.events][-2:] == [
        "employee_accepted",
        "candidate_interested",
    ]


def test_stale_flag_after_seven_days(client: TestClient, db: Session) -> None:
    from datetime import UTC, datetime, timedelta

    from app.models import ReferralEvent

    req = db.scalars(
        select(ReferralRequest).where(ReferralRequest.status == "employee_accepted")
    ).first()
    assert req is not None
    # Every accepted-state event (including nudges) must be old for the request to read stale.
    accepted_events = [e for e in req.events if e.to_status == "employee_accepted"]
    for e in accepted_events:
        e.created_at = datetime.now(UTC) - timedelta(days=9)
    db.commit()
    body = client.get(f"/api/requests/{req.id}").json()
    assert body["stale"] is True and body["days_waiting"] == 9
    accepted = accepted_events[0]
    fresh = db.scalars(select(ReferralRequest).where(ReferralRequest.status == "requested")).first()
    assert fresh is not None
    assert client.get(f"/api/requests/{fresh.id}").json()["stale"] is False
    assert isinstance(accepted, ReferralEvent)


def test_pipeline_rows_carry_last_message(client: TestClient) -> None:
    page = client.get("/api/requests").json()
    assert page["items"]
    first = page["items"][0]
    assert first["last_message"]["excerpt"]
    assert first["last_message"]["employee_name"] == first["employee"]["full_name"]
    assert client.get("/api/outreach").status_code == 404


def test_stats(client: TestClient) -> None:
    stats = client.get("/api/stats").json()
    assert stats["contacts"] == 300
    assert stats["requests_total"] >= 6


def test_admin_requires_token(client: TestClient) -> None:
    assert client.get("/api/admin/reset-demo").status_code == 403
    ok = client.get("/api/admin/reset-demo", headers={"X-Admin-Token": "test-admin-token"})
    assert ok.status_code == 200
    assert ok.json()["state"] == "idle"


def test_role_counts(client: TestClient, db: Session) -> None:
    role = _first_role(client)
    active = db.scalar(
        select(func.count())
        .select_from(ReferralRequest)
        .where(ReferralRequest.role_id == uuid.UUID(role["id"]), ReferralRequest.status != "closed")
    )
    assert role["active_request_count"] == active
    assert db.get(Role, uuid.UUID(role["id"])) is not None


def test_missing_asset_is_a_real_404_not_the_spa_shell(client: TestClient) -> None:
    r = client.get("/assets/index-stale123.js")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")
    r = client.get("/favicon-missing.svg")
    assert r.status_code == 404


def test_ask_preview_and_edited_message(client: TestClient) -> None:
    role = _first_role(client, "marketing")
    page = client.get(f"/api/roles/{role['id']}/candidates", params={"limit": 40}).json()
    cand = next(c for c in page["items"] if c["active_request"] is None)
    preview = client.post(
        "/api/requests/preview", json={"contact_id": cand["contact"]["id"], "role_id": role["id"]}
    )
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["employee"]["id"] == cand["top_connection"]["employee"]["id"]
    assert body["ask"].startswith("Hi ") and cand["contact"]["full_name"] in body["ask"]
    assert body["ask"].rstrip().endswith("Local")  # signed with the recruiter's first name
    created = client.post(
        "/api/requests",
        json={
            "contact_id": cand["contact"]["id"],
            "role_id": role["id"],
            "message": "Hey, quick one: would you be up for a chat about a marketing role here?",
        },
    ).json()
    assert created["outreach_casual"].startswith("Hey, quick one")
    assert created["messages"][0]["body"].startswith("Hey, quick one")


def test_demo_routing_prefers_the_requesting_recruiter() -> None:
    from types import SimpleNamespace

    from app.config import Settings
    from app.services.slack import NullNotifier, resolve_recipient

    class EmailNotifier(NullNotifier):
        def lookup_user_by_email(self, email: str) -> str | None:
            return "U_REVIEWER" if email == "reviewer@example.com" else None

    settings = Settings(slack_demo_user_id="U_FALLBACK", slack_route_to_requester=True)
    employee = SimpleNamespace(slack_user_id=None)
    matched, redirected = resolve_recipient(
        settings, employee, requester_email="reviewer@example.com", notifier=EmailNotifier()
    )
    assert (matched, redirected) == ("U_REVIEWER", True)
    fallback, _ = resolve_recipient(
        settings, employee, requester_email="nobody@example.com", notifier=EmailNotifier()
    )
    assert fallback == "U_FALLBACK"
    off = Settings(slack_demo_user_id="U_FALLBACK", slack_route_to_requester=False)
    assert (
        resolve_recipient(
            off, employee, requester_email="reviewer@example.com", notifier=EmailNotifier()
        )[0]
        == "U_FALLBACK"
    )
