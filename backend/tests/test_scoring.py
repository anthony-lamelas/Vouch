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
    assert a.breakdown["overlap_detail"].startswith("Worked together at Stripe")
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
        shared_history="Worked together at Stripe (2019-2024) on Payments",
        fit_reasons=["4 of 8 required skills"],
    )
    text = draft_casual(ctx)
    assert text.startswith(
        "Hey Priya! Feels like ages since we worked together at Stripe (2019-2024)"
    )
    assert "Software Engineer, Infrastructure" in text
