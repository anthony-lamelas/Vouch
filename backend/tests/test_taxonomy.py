import pytest

from app.services.taxonomy import classify_family, classify_seniority, extract_skills


@pytest.mark.parametrize(
    ("title", "family"),
    [
        ("Software Engineer, Infrastructure", "infrastructure"),
        ("Research Engineer, Post-Training", "ml_research"),
        ("Deployed Engineer - EMEA", "customer_engineering"),
        ("Account Director", "sales"),
        ("Founding GTM Recruiter - Japan", "recruiting"),
        ("Commercial Counsel", "finance_legal"),
        ("Product Marketer", "marketing"),
        ("Senior Software Engineer", "engineering"),
    ],
)
def test_family_classification(title: str, family: str) -> None:
    assert classify_family(title) == family


def test_seniority_classification() -> None:
    assert classify_seniority("Staff Software Engineer") == "staff"
    assert classify_seniority("VP of Sales") == "vp"
    assert classify_seniority("Head of Partnerships") == "director"
    assert classify_seniority("Software Engineer") == "mid"


def test_extract_skills_stays_within_family() -> None:
    text = (
        "We run Kubernetes on AWS with Terraform. You will improve observability and work with "
        "our recruiting team on hiring pipeline. Operations matter."
    )
    skills = extract_skills(text, family="infrastructure")
    assert "Kubernetes" in skills and "AWS" in skills and "Terraform" in skills
    assert "Recruiting" not in skills
    assert "Operations" not in skills
