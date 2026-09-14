from datetime import date

from app.services.scoring import connection_strength, fit_score, match_score, recency_score

TODAY = date(2026, 9, 12)


def test_recency_decay() -> None:
    assert recency_score(date(2026, 1, 1), TODAY) == 1.0
    assert recency_score(date(2019, 1, 1), TODAY) == 0.2
    mid = recency_score(date(2023, 9, 12), TODAY)
    assert 0.2 < mid < 1.0


def test_strength_rewards_same_team_overlap() -> None:
    emp = [{"company": "Stripe", "team": "Payments", "start": "2019-06-01", "end": "2024-02-28"}]
    con_same_team = [{"company": "Stripe", "team": "Payments", "start": "2018-10-01", "end": None}]
    con_other_team = [{"company": "Stripe", "team": "Ads", "start": "2018-10-01", "end": None}]
    con_no_overlap = [
        {"company": "Stripe", "team": "Ads", "start": "2010-01-01", "end": "2012-01-01"}
    ]
    kwargs = {
        "employee_education": [],
        "contact_education": [],
        "connected_on": date(2026, 6, 1),
        "today": TODAY,
    }
    a = connection_strength(employee_experiences=emp, contact_experiences=con_same_team, **kwargs)
    b = connection_strength(employee_experiences=emp, contact_experiences=con_other_team, **kwargs)
    c = connection_strength(employee_experiences=emp, contact_experiences=con_no_overlap, **kwargs)
    assert a.strength > b.strength > c.strength
    assert a.breakdown["overlap_detail"].startswith("Overlapped at Stripe")
    assert "on Payments" in a.breakdown["overlap_detail"]


def test_school_overlap_detail() -> None:
    edu_a = [{"school": "MIT", "start_year": 2012, "end_year": 2016}]
    edu_b = [{"school": "MIT", "start_year": 2014, "end_year": 2018}]
    r = connection_strength(
        employee_experiences=[],
        contact_experiences=[],
        employee_education=edu_a,
        contact_education=edu_b,
        connected_on=date(2020, 1, 1),
        today=TODAY,
    )
    assert r.breakdown["school"] == 1.0
    assert r.breakdown["school_detail"] == "Overlapped at MIT"


def test_fit_prefers_same_family_and_level() -> None:
    assert fit_score("infrastructure", "senior", "infrastructure", "senior") == 1.0
    assert fit_score("engineering", "senior", "infrastructure", "senior") < 1.0
    assert fit_score("sales", "senior", "infrastructure", "senior") < fit_score(
        "engineering", "senior", "infrastructure", "senior"
    )


def test_match_score_reasons_are_explainable() -> None:
    result = match_score(
        contact_skills=["Kubernetes", "Go", "AWS"],
        contact_family="infrastructure",
        contact_seniority="staff",
        contact_companies=["Google", "Stripe"],
        contact_schools=["UC Berkeley"],
        role_skills=["Kubernetes", "AWS", "Terraform", "Python"],
        role_family="infrastructure",
        role_seniority="mid",
        company_tiers={"Google": 1, "Stripe": 1},
        school_tiers={"UC Berkeley": 1},
        best_strength=0.8,
        best_strength_detail="Worked together at Stripe via Bob",
    )
    signals = {r["signal"]: r for r in result.reasons}
    assert signals["skills"]["label"] == "2 of 4 required skills"
    assert signals["company"]["detail"] in {"Google", "Stripe"}
    assert signals["intro"]["detail"] == "Worked together at Stripe via Bob"
    assert 0.6 < result.score <= 1.0


def test_casual_draft_reads_naturally() -> None:
    from app.services.outreach import OutreachContext, draft_casual

    ctx = OutreachContext(
        contact_full_name="Priya Natarajan",
        contact_title="Staff Infrastructure Engineer",
        contact_company="Stripe",
        role_title="Software Engineer, Infrastructure",
        role_team="Core Engineering",
        role_location="San Francisco",
        role_url="https://x",
        employee_first_name="Bob",
        shared_history="Overlapped at Stripe (2019-2024) on Payments",
        fit_reasons=["4 of 8 required skills"],
    )
    text = draft_casual(ctx)
    assert text.startswith("Hey Priya! I hope you are doing well. We're hiring a Software Engineer")
    assert "we can get the interview process going!" in text
    assert text.endswith("Here's the role: https://x")


def test_article_before_a_job_title() -> None:
    from app.services.outreach import article

    assert article("AI Support Engineer") == "an"
    assert article("Applied AI Engineer") == "an"
    assert article("Engineering Manager") == "an"
    assert article("Software Engineer") == "a"
    assert article("SRE") == "an"
    assert article("ML Engineer") == "an"
    assert article("FDE") == "an"
    assert article("UX Researcher") == "a"
    assert article("University Recruiter") == "a"
    assert article("Head of Sales") == "a"


def test_ask_draft_is_concise_and_signed() -> None:
    from app.services.outreach import OutreachContext, draft_ask

    ctx = OutreachContext(
        contact_full_name="Kelly Brooks",
        contact_title="Forward Deployed Engineer",
        contact_company="Notion",
        role_title="AI Support Engineer",
        role_team="Support Engineering",
        role_location="San Francisco",
        role_url="https://x",
        employee_first_name="Frank",
        shared_history="Overlapped at DoorDash (2020-2022)",
        shared_company="DoorDash",
        recruiter_first_name="Anthony",
    )
    text = draft_ask(ctx)
    assert text.startswith("Hi Frank, would you be willing to reach out to Kelly Brooks")
    assert "AI Support Engineer" in text and " You both worked at DoorDash. " in text
    assert text.endswith("Thanks,\nAnthony")
    assert len(text) < 360

    from dataclasses import replace

    school = draft_ask(replace(ctx, shared_company=None, shared_school="NYU"))
    assert " You both went to NYU. " in school
    plain = draft_ask(replace(ctx, shared_history=None, shared_company=None))
    assert "You both" not in plain and "right person" not in plain
    assert "role? If you're up for it" in plain


def test_shared_places_come_from_the_breakdown() -> None:
    from types import SimpleNamespace

    from app.services.referrals import shared_places

    conn = SimpleNamespace(
        strength_breakdown={
            "overlap_detail": "Overlapped at Stripe (2019-2024) on Payments",
            "school_detail": "Overlapped at NYU, different years",
        }
    )
    assert shared_places(conn) == ("Stripe", "NYU")  # type: ignore[arg-type]
    assert shared_places(None) == (None, None)


def test_location_match_same_city_region_and_elsewhere() -> None:
    from app.services.geo import location_match, places, regions_of

    assert [p.city for p in places("San Francisco, Austin, New York City")] == [
        "San Francisco",
        "Austin",
        "New York City",
    ]
    assert regions_of("Austin, Texas") == {"north_america"}
    assert regions_of("Southern Europe") == {"europe"}
    assert regions_of("Somewhere unrecognised") == frozenset()

    same = location_match(role_location="Tokyo", role_is_remote=False, contact_location="Tokyo")
    region = location_match(
        role_location="Tokyo", role_is_remote=False, contact_location="Singapore"
    )
    far = location_match(
        role_location="Tokyo", role_is_remote=False, contact_location="San Francisco"
    )
    assert (same.value, same.label) == (1.0, "Same city")
    assert (region.value, region.label) == (0.5, "Same region")
    assert (far.value, far.label) == (0.0, "Different region")
    assert "relocate" in far.detail

    remote = location_match(
        role_location="Sydney", role_is_remote=True, contact_location="San Francisco"
    )
    assert remote.value == 0.6
    unknown = location_match(role_location="Tokyo", role_is_remote=False, contact_location="Remote")
    assert unknown.label == "Location unknown"


def test_match_score_prefers_the_role_city() -> None:
    def score(location: str, family: str = "customer_engineering") -> float:
        return match_score(
            contact_skills=["Python", "APIs"],
            contact_family=family,
            contact_seniority="mid",
            contact_companies=["Stripe"],
            contact_schools=[],
            role_skills=["Python", "APIs", "Kubernetes"],
            role_family="customer_engineering",
            role_seniority="mid",
            company_tiers={"Stripe": 1},
            school_tiers={},
            best_strength=0.3,
            contact_location=location,
            role_location="Tokyo",
            role_is_remote=False,
        ).score

    assert score("Tokyo") > score("Singapore") > score("San Francisco")
    # A same-city candidate with an adjacent-family fit beats an exact-fit candidate abroad.
    assert score("Tokyo", family="engineering") > score("San Francisco")
    result = match_score(
        contact_skills=[],
        contact_family="sales",
        contact_seniority="mid",
        contact_companies=[],
        contact_schools=[],
        role_skills=["Python"],
        role_family="sales",
        role_seniority="mid",
        company_tiers={},
        school_tiers={},
        best_strength=0.0,
        contact_location="San Francisco",
        role_location="Tokyo",
    )
    assert {r["signal"]: r["label"] for r in result.reasons}["location"] == "Different region"


def test_booking_draft_names_the_recruiter_and_link() -> None:
    from app.services.outreach import OutreachContext, draft_booking

    ctx = OutreachContext(
        contact_full_name="Mark Martinez",
        contact_title="Solutions Engineer",
        contact_company="DeepMind",
        role_title="AI Support Engineer",
        role_team="Support",
        role_location="Tokyo",
        role_url="https://x",
        employee_first_name="Frank",
        recruiter_first_name="Anthony",
    )
    text = draft_booking(ctx, "https://cal.example/anthony")
    assert text.startswith("Hey Mark! Great to hear you're interested. Anthony from our recruiting")
    assert text.endswith("https://cal.example/anthony")


def test_booking_link_falls_back_to_the_demo_wide_one() -> None:
    from unittest.mock import MagicMock

    from app.config import Settings
    from app.services.ownership import booking_url_for

    settings = Settings(demo_booking_url="https://cal.example/shared")
    db = MagicMock()
    db.get.return_value = None
    assert booking_url_for(db, settings, "anyone@cognition.ai") == "https://cal.example/shared"
    own = MagicMock()
    own.booking_url = "https://cal.example/mine"
    db.get.return_value = own
    assert booking_url_for(db, settings, "me@cognition.ai") == "https://cal.example/mine"
