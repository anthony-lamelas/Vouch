"""Deterministic synthetic people graph: employees, contacts and the edges between them.

Everything is driven by one `random.Random(seed)` so the same seed yields the same graph on
every machine. No database access here; `loader.py` persists the result.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from faker import Faker

from app.seed import pools
from app.services.scoring import connection_strength
from app.services.taxonomy import SKILLS_BY_FAMILY

SEED_TODAY = date(2026, 9, 12)

CAREER_YEARS: dict[str, tuple[int, int]] = {
    "junior": (0, 2),
    "mid": (2, 6),
    "senior": (6, 11),
    "staff": (9, 15),
    "lead": (8, 16),
    "director": (12, 20),
    "vp": (15, 25),
}
SENIORITY_RANK = {
    s: i for i, s in enumerate(("junior", "mid", "senior", "staff", "lead", "director", "vp"))
}


@dataclass
class EmployeeSeed:
    full_name: str
    email: str
    title: str
    department: str
    team: str
    start_date: date
    experiences: list[dict[str, Any]]
    education: list[dict[str, Any]]
    is_demo: bool = False


@dataclass
class ContactSeed:
    linkedin_url: str
    full_name: str
    headline: str
    location: str
    current_company: str
    current_title: str
    job_family: str
    seniority: str
    experiences: list[dict[str, Any]]
    education: list[dict[str, Any]]
    skills: list[str]


@dataclass
class ConnectionSeed:
    employee_idx: int
    contact_idx: int
    connected_on: date
    strength: float
    breakdown: dict[str, Any]


@dataclass
class SeedGraph:
    employees: list[EmployeeSeed] = field(default_factory=list)
    contacts: list[ContactSeed] = field(default_factory=list)
    connections: list[ConnectionSeed] = field(default_factory=list)


def _weighted(rng: random.Random, weights: dict[str, int]) -> str:
    keys = list(weights)
    return rng.choices(keys, weights=[weights[k] for k in keys], k=1)[0]


def _company(rng: random.Random, exclude: set[str] | None = None) -> str:
    exclude = exclude or set()
    tier = rng.choices([1, 2, 3], weights=[35, 40, 25], k=1)[0]
    options = [c for c, t in pools.COMPANY_TIERS.items() if t == tier and c not in exclude]
    return rng.choice(options)


def _school(rng: random.Random) -> str:
    tier = rng.choices([1, 2, 3], weights=[30, 40, 30], k=1)[0]
    return rng.choice([s for s, t in pools.SCHOOL_TIERS.items() if t == tier])


def _title_for(rng: random.Random, family: str, max_seniority: str) -> tuple[str, str]:
    ladder = pools.TITLE_LADDERS[family]
    cap = SENIORITY_RANK[max_seniority]
    options = [(t, s) for t, s in ladder if SENIORITY_RANK[s] <= cap] or list(ladder)
    return rng.choice(options)


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _career(
    rng: random.Random,
    family: str,
    seniority: str,
    *,
    end: date | None,
    current_company: str | None,
) -> list[dict[str, Any]]:
    """Build a list of experiences ending at `end` (None = still employed at the last one)."""
    lo, hi = CAREER_YEARS[seniority]
    total_years = rng.uniform(max(lo, 1), max(hi, lo + 1))
    n_jobs = max(1, min(4, int(total_years // rng.uniform(2.0, 3.5)) + 1))
    finish = end or SEED_TODAY
    start_career = finish - timedelta(days=int(total_years * 365))
    cuts = sorted(rng.uniform(0.15, 0.85) for _ in range(n_jobs - 1))
    bounds = [0.0, *cuts, 1.0]
    experiences: list[dict[str, Any]] = []
    used: set[str] = set()
    span = (finish - start_career).days
    for i in range(n_jobs):
        s = start_career + timedelta(days=int(bounds[i] * span))
        e = start_career + timedelta(days=int(bounds[i + 1] * span))
        is_last = i == n_jobs - 1
        company = current_company if is_last and current_company else _company(rng, used)
        used.add(company)
        # Seniority rises through the career.
        level_cap = (
            seniority
            if is_last
            else list(SENIORITY_RANK)[max(0, SENIORITY_RANK[seniority] - (n_jobs - 1 - i))]
        )
        title, _ = _title_for(rng, family, level_cap)
        experiences.append(
            {
                "company": company,
                "title": title,
                "team": rng.choice(pools.TEAMS),
                "start": s.isoformat(),
                "end": None if (is_last and end is None) else e.isoformat(),
            }
        )
    return experiences


def _education(rng: random.Random, career_start_year: int) -> list[dict[str, Any]]:
    degree, fld, _ = rng.choices(pools.DEGREES, weights=[d[2] for d in pools.DEGREES], k=1)[0]
    grad_year = career_start_year
    edu = [
        {
            "school": _school(rng),
            "degree": degree,
            "field": fld,
            "start_year": grad_year - 4,
            "end_year": grad_year,
        }
    ]
    if rng.random() < 0.3:
        g_degree, g_field, _ = rng.choices(
            pools.GRAD_DEGREES, weights=[d[2] for d in pools.GRAD_DEGREES], k=1
        )[0]
        years = 5 if g_degree == "PhD" else 2
        edu.append(
            {
                "school": _school(rng) if rng.random() < 0.7 else edu[0]["school"],
                "degree": g_degree,
                "field": g_field,
                "start_year": grad_year,
                "end_year": grad_year + years,
            }
        )
    return edu


def _skills(rng: random.Random, family: str) -> list[str]:
    core = list(SKILLS_BY_FAMILY[family])
    k = min(len(core), rng.randint(4, 8))
    picked = rng.sample(core, k)
    other_family = rng.choice([f for f in SKILLS_BY_FAMILY if f != family])
    extra = rng.choice(list(SKILLS_BY_FAMILY[other_family]))
    if extra not in picked:
        picked.append(extra)
    return picked


def _location(rng: random.Random) -> str:
    return rng.choices(
        [loc for loc, _ in pools.LOCATIONS], weights=[w for _, w in pools.LOCATIONS], k=1
    )[0]


def _random_date(rng: random.Random, start: date, end: date) -> date:
    if end <= start:
        return start
    return start + timedelta(days=rng.randint(0, (end - start).days))


# ---- Employees --------------------------------------------------------------------------------


def _bob(demo_email: str) -> EmployeeSeed:
    return EmployeeSeed(
        full_name="Bob Rivera",
        email=demo_email or "bob.rivera@cognition.ai",
        title="Senior Infrastructure Engineer",
        department="Research & Development",
        team="Infrastructure",
        start_date=date(2024, 3, 1),
        experiences=[
            {
                "company": "Google",
                "title": "Software Engineer",
                "team": "Search",
                "start": "2016-07-01",
                "end": "2019-05-31",
            },
            {
                "company": "Stripe",
                "title": "Senior Software Engineer",
                "team": "Payments",
                "start": "2019-06-01",
                "end": "2024-02-28",
            },
            {
                "company": pools.EMPLOYER,
                "title": "Senior Infrastructure Engineer",
                "team": "Infrastructure",
                "start": "2024-03-01",
                "end": None,
            },
        ],
        education=[
            {
                "school": "UC Berkeley",
                "degree": "BS",
                "field": "Computer Science",
                "start_year": 2012,
                "end_year": 2016,
            }
        ],
        is_demo=True,
    )


def generate_employees(
    rng: random.Random, fake: Faker, count: int, demo_email: str
) -> list[EmployeeSeed]:
    employees = [_bob(demo_email)]
    mix = dict(pools.EMPLOYEE_FAMILY_MIX)
    mix["infrastructure"] -= 1  # Bob is one of them
    families: list[str] = []
    for family, n in mix.items():
        families.extend([family] * n)
    while len(families) < count - 1:
        families.append(_weighted(rng, pools.CONTACT_FAMILY_WEIGHTS))
    families = families[: count - 1]
    rng.shuffle(families)
    used_emails = {employees[0].email}
    for family in families:
        seniority = rng.choices(["mid", "senior", "staff", "lead"], weights=[35, 40, 15, 10])[0]
        title, seniority = _title_for(rng, family, seniority)
        start = _random_date(rng, date(2023, 1, 9), date(2026, 6, 1))
        past = _career(rng, family, seniority, end=start - timedelta(days=14), current_company=None)
        experiences = [
            *past,
            {
                "company": pools.EMPLOYER,
                "title": title,
                "team": rng.choice(pools.TEAMS),
                "start": start.isoformat(),
                "end": None,
            },
        ]
        name = fake.name()
        email = f"{_slug(name)}@cognition.ai"
        while email in used_emails:
            name = fake.name()
            email = f"{_slug(name)}@cognition.ai"
        used_emails.add(email)
        employees.append(
            EmployeeSeed(
                full_name=name,
                email=email,
                title=title,
                department=pools.DEPARTMENT_BY_FAMILY[family],
                team=experiences[-1]["team"],
                start_date=start,
                experiences=experiences,
                education=_education(rng, date.fromisoformat(past[0]["start"]).year),
            )
        )
    return employees


# ---- Contacts ---------------------------------------------------------------------------------


def _curated_contacts() -> list[tuple[ContactSeed, list[tuple[int, date]]]]:
    """Hand-written contacts that anchor the demo narrative. Each is connected to Bob (0)."""
    priya = ContactSeed(
        linkedin_url="https://www.linkedin.com/in/priya-natarajan-demo",
        full_name="Priya Natarajan",
        headline="Staff Infrastructure Engineer at Stripe",
        location="San Francisco",
        current_company="Stripe",
        current_title="Staff Infrastructure Engineer",
        job_family="infrastructure",
        seniority="staff",
        experiences=[
            {
                "company": "Google",
                "title": "Software Engineer",
                "team": "Ads",
                "start": "2015-08-01",
                "end": "2018-09-30",
            },
            {
                "company": "Stripe",
                "title": "Staff Infrastructure Engineer",
                "team": "Payments",
                "start": "2018-10-01",
                "end": None,
            },
        ],
        education=[
            {
                "school": "UC Berkeley",
                "degree": "BS",
                "field": "Computer Science",
                "start_year": 2011,
                "end_year": 2015,
            }
        ],
        skills=[
            "Kubernetes",
            "Go",
            "Distributed Systems",
            "AWS",
            "Terraform",
            "Observability",
            "Python",
            "Linux",
        ],
    )
    marcus = ContactSeed(
        linkedin_url="https://www.linkedin.com/in/marcus-oyelaran-demo",
        full_name="Marcus Oyelaran",
        headline="Senior Research Engineer at DeepMind",
        location="London",
        current_company="DeepMind",
        current_title="Senior Research Engineer",
        job_family="ml_research",
        seniority="senior",
        experiences=[
            {
                "company": "Nvidia",
                "title": "Machine Learning Engineer",
                "team": "Core ML",
                "start": "2017-06-01",
                "end": "2020-12-31",
            },
            {
                "company": "DeepMind",
                "title": "Senior Research Engineer",
                "team": "Core ML",
                "start": "2021-01-04",
                "end": None,
            },
        ],
        education=[
            {
                "school": "UC Berkeley",
                "degree": "BS",
                "field": "Electrical Engineering",
                "start_year": 2011,
                "end_year": 2015,
            },
            {
                "school": "MIT",
                "degree": "MS",
                "field": "Computer Science",
                "start_year": 2015,
                "end_year": 2017,
            },
        ],
        skills=[
            "PyTorch",
            "LLMs",
            "RL",
            "Model Training",
            "CUDA",
            "GPUs",
            "Python",
            "Distributed Systems",
        ],
    )
    elena = ContactSeed(
        linkedin_url="https://www.linkedin.com/in/elena-vasquez-demo",
        full_name="Elena Vasquez",
        headline="Enterprise Account Executive at Datadog",
        location="New York City",
        current_company="Datadog",
        current_title="Enterprise Account Executive",
        job_family="sales",
        seniority="senior",
        experiences=[
            {
                "company": "Salesforce",
                "title": "Account Executive",
                "team": "Enterprise",
                "start": "2016-02-01",
                "end": "2020-06-30",
            },
            {
                "company": "Datadog",
                "title": "Enterprise Account Executive",
                "team": "Enterprise",
                "start": "2020-07-06",
                "end": None,
            },
        ],
        education=[
            {
                "school": "NYU",
                "degree": "BA",
                "field": "Economics",
                "start_year": 2011,
                "end_year": 2015,
            }
        ],
        skills=[
            "Enterprise Sales",
            "Account Management",
            "Developer Tools",
            "Partnerships",
            "Customer Success",
        ],
    )
    return [
        (priya, [(0, date(2021, 3, 14))]),
        (marcus, [(0, date(2016, 5, 2))]),
        (elena, [(0, date(2024, 11, 20))]),
    ]


def generate_contacts(
    rng: random.Random, fake: Faker, employees: list[EmployeeSeed], count: int
) -> tuple[list[ContactSeed], list[tuple[int, int, date]]]:
    """Returns contacts and raw edges (employee_idx, contact_idx, connected_on)."""
    contacts: list[ContactSeed] = []
    edges: list[tuple[int, int, date]] = []
    used_urls: set[str] = set()

    for contact, links in _curated_contacts():
        idx = len(contacts)
        contacts.append(contact)
        used_urls.add(contact.linkedin_url)
        for emp_idx, on in links:
            edges.append((emp_idx, idx, on))
        # Also connect curated contacts to one other random employee for re-routing demos.
        other = rng.randrange(1, len(employees))
        edges.append((other, idx, _random_date(rng, date(2022, 1, 1), SEED_TODAY)))

    while len(contacts) < count:
        family = _weighted(rng, pools.CONTACT_FAMILY_WEIGHTS)
        seniority = rng.choices(
            ["junior", "mid", "senior", "staff", "lead", "director", "vp"],
            weights=[8, 32, 32, 10, 10, 6, 2],
        )[0]
        title, seniority = _title_for(rng, family, seniority)
        experiences = _career(rng, family, seniority, end=None, current_company=None)
        experiences[-1]["title"] = title
        education = _education(rng, date.fromisoformat(experiences[0]["start"]).year)

        anchor = rng.randrange(len(employees))
        anchored = rng.random() < 0.6
        connected_on: date | None = None
        if anchored:
            emp = employees[anchor]
            past = [e for e in emp.experiences if e["company"] != pools.EMPLOYER]
            r = rng.random()
            if r < 0.45 and past:
                x = rng.choice(past)
                x_start, x_end = date.fromisoformat(x["start"]), date.fromisoformat(x["end"])
                s = x_start + timedelta(days=rng.randint(-365, 365))
                e = max(s + timedelta(days=rng.randint(365, 365 * 3)), x_start + timedelta(90))
                injected = {
                    "company": x["company"],
                    "title": _title_for(rng, family, seniority)[0],
                    "team": x["team"] if rng.random() < 0.4 else rng.choice(pools.TEAMS),
                    "start": s.isoformat(),
                    "end": e.isoformat(),
                }
                experiences = sorted(
                    [*experiences[:-1], injected, experiences[-1]], key=lambda ex: ex["start"]
                )
                # Keep the last one current.
                experiences[-1]["end"] = None
                connected_on = _random_date(rng, min(x_end, e), SEED_TODAY)
            elif r < 0.75:
                school = emp.education[0]
                education[0] = {
                    **education[0],
                    "school": school["school"],
                    "start_year": int(school["start_year"]) + rng.randint(-2, 2),
                    "end_year": int(school["end_year"]) + rng.randint(-2, 2),
                }
                connected_on = _random_date(
                    rng, date(int(education[0]["end_year"]), 6, 1), SEED_TODAY
                )
        if connected_on is None:
            connected_on = _random_date(rng, SEED_TODAY - timedelta(days=365 * 6), SEED_TODAY)

        name = fake.name()
        url = f"https://www.linkedin.com/in/{_slug(name)}"
        n = 1
        while url in used_urls:
            n += 1
            url = f"https://www.linkedin.com/in/{_slug(name)}-{n}"
        used_urls.add(url)
        current = experiences[-1]
        idx = len(contacts)
        contacts.append(
            ContactSeed(
                linkedin_url=url,
                full_name=name,
                headline=f"{current['title']} at {current['company']}",
                location=_location(rng),
                current_company=current["company"],
                current_title=current["title"],
                job_family=family,
                seniority=seniority,
                experiences=experiences,
                education=education,
                skills=_skills(rng, family),
            )
        )
        edges.append((anchor, idx, connected_on))
        extra = rng.choices([0, 1, 2], weights=[55, 35, 10])[0]
        others = [i for i in range(len(employees)) if i != anchor]
        for other in rng.sample(others, extra):
            edges.append(
                (other, idx, _random_date(rng, SEED_TODAY - timedelta(days=365 * 6), SEED_TODAY))
            )
    return contacts, edges


def generate_graph(
    *, seed: int, employee_count: int, contact_count: int, demo_email: str = ""
) -> SeedGraph:
    rng = random.Random(seed)
    fake = Faker("en_US")
    fake.seed_instance(seed)
    employees = generate_employees(rng, fake, employee_count, demo_email)
    contacts, edges = generate_contacts(rng, fake, employees, contact_count)
    connections: list[ConnectionSeed] = []
    seen: set[tuple[int, int]] = set()
    for emp_idx, con_idx, on in edges:
        if (emp_idx, con_idx) in seen:
            continue
        seen.add((emp_idx, con_idx))
        emp, con = employees[emp_idx], contacts[con_idx]
        result = connection_strength(
            employee_experiences=emp.experiences,
            employee_education=emp.education,
            contact_experiences=con.experiences,
            contact_education=con.education,
            connected_on=on,
            today=SEED_TODAY,
        )
        connections.append(ConnectionSeed(emp_idx, con_idx, on, result.strength, result.breakdown))
    return SeedGraph(employees=employees, contacts=contacts, connections=connections)
