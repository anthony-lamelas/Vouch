"""Job families, seniority levels and the skill taxonomy used by scoring and seeding.

Everything here is deterministic and dependency-free so it can be unit tested in isolation.
"""

from __future__ import annotations

import re
from typing import Final

# Job families. Adjacent families get partial credit in the fit score.
FAMILIES: Final[tuple[str, ...]] = (
    "engineering",
    "ml_research",
    "infrastructure",
    "security",
    "data",
    "product",
    "design",
    "customer_engineering",
    "sales",
    "marketing",
    "recruiting",
    "people_ops",
    "finance_legal",
    "operations",
)

ADJACENT_FAMILIES: Final[dict[str, frozenset[str]]] = {
    "engineering": frozenset({"infrastructure", "ml_research", "customer_engineering", "data"}),
    "ml_research": frozenset({"engineering", "data", "infrastructure"}),
    "infrastructure": frozenset({"engineering", "security", "data"}),
    "security": frozenset({"infrastructure", "engineering"}),
    "data": frozenset({"engineering", "ml_research", "infrastructure"}),
    "product": frozenset({"design", "engineering", "marketing"}),
    "design": frozenset({"product", "marketing"}),
    "customer_engineering": frozenset({"engineering", "sales"}),
    "sales": frozenset({"customer_engineering", "marketing"}),
    "marketing": frozenset({"sales", "product"}),
    "recruiting": frozenset({"people_ops", "operations"}),
    "people_ops": frozenset({"recruiting", "operations"}),
    "finance_legal": frozenset({"operations"}),
    "operations": frozenset({"finance_legal", "people_ops", "recruiting"}),
}

SENIORITY_ORDER: Final[tuple[str, ...]] = (
    "junior",
    "mid",
    "senior",
    "staff",
    "lead",
    "director",
    "vp",
)

# Ordered: first matching pattern wins. Patterns are matched against a lowercased title.
_FAMILY_PATTERNS: Final[tuple[tuple[str, str], ...]] = (
    (r"\b(security|appsec|infosec|facility security)\b", "security"),
    (
        r"\b(research (engineer|scientist)|ml|machine learning|post-training|mid-training|llm)\b",
        "ml_research",
    ),
    (
        r"\b(site reliability|sre|devops|infrastructure|platform|cloud|kubernetes)\b",
        "infrastructure",
    ),
    (r"\b(data engineer|analytics|data scientist|data)\b", "data"),
    (
        r"\b(deployed|forward deployed|solutions|applied ai|support engineer|customer engineer|"
        r"qa engineer|sales engineer|implementation)\b",
        "customer_engineering",
    ),
    (r"\b(recruit\w*|talent|sourcer)\b", "recruiting"),
    (r"\b(people|hr|workplace|payroll|engagement coordinator)\b", "people_ops"),
    (r"\b(counsel|legal|finance|accountant|controller|payroll)\b", "finance_legal"),
    (r"\b(marketer|marketing|brand|community|growth|content|paid media)\b", "marketing"),
    (
        r"\b(account (director|executive|manager)|sales|partnerships?|partner|revenue|"
        r"business development|sdr|capture lead|country leader|transformation manager)\b",
        "sales",
    ),
    (r"\b(product manager|product lead|head of product)\b", "product"),
    (r"\b(designer|design|ux|ui)\b", "design"),
    (
        r"\b(operations|ops|chief of staff|executive assistant|business operations|it engineer|"
        r"event producer)\b",
        "operations",
    ),
    (r"\b(engineer|developer|swe|software|programmer|architect)\b", "engineering"),
)

_SENIORITY_PATTERNS: Final[tuple[tuple[str, str], ...]] = (
    (r"\b(vp|vice president|svp|evp|chief|cto|ceo|cfo|coo)\b", "vp"),
    (r"\b(director|head of)\b", "director"),
    (r"\b(lead|manager|principal)\b", "lead"),
    (r"\b(staff|distinguished)\b", "staff"),
    (r"\b(senior|sr\.?)\b", "senior"),
    (
        r"\b(junior|jr\.?|associate|intern|new grad|coordinator|representative|specialist)\b",
        "junior",
    ),
)

# Canonical skill -> aliases found in job descriptions or titles. Matching is case-insensitive.
SKILL_ALIASES: Final[dict[str, tuple[str, ...]]] = {
    "Python": ("python",),
    "TypeScript": ("typescript",),
    "JavaScript": ("javascript", "node.js", "nodejs"),
    "Go": ("golang", " go "),
    "Rust": ("rust",),
    "Java": (" java ", "java,"),
    "C++": ("c++",),
    "React": ("react",),
    "Kubernetes": ("kubernetes", "k8s"),
    "Docker": ("docker", "containers"),
    "AWS": ("aws", "amazon web services"),
    "GCP": ("gcp", "google cloud"),
    "Terraform": ("terraform",),
    "PostgreSQL": ("postgres", "postgresql"),
    "Distributed Systems": ("distributed systems", "distributed system"),
    "PyTorch": ("pytorch", "torch"),
    "LLMs": ("llm", "large language model", "foundation model"),
    "RL": ("reinforcement learning", " rl ", "rlhf"),
    "Model Training": (
        "training run",
        "pre-training",
        "post-training",
        "mid-training",
        "fine-tuning",
        "finetuning",
    ),
    "Inference": ("inference",),
    "CUDA": ("cuda", "gpu kernels"),
    "GPUs": ("gpu", "gpus", "h100", "nvidia"),
    "Data Pipelines": ("data pipeline", "etl", "airflow", "dbt", "spark"),
    "SQL": ("sql",),
    "Observability": ("observability", "monitoring", "datadog", "prometheus", "grafana"),
    "Linux": ("linux",),
    "Networking": ("networking", "tcp", "vpc"),
    "CI/CD": ("ci/cd", "continuous integration", "github actions"),
    "Security Engineering": (
        "security engineering",
        "threat model",
        "vulnerabilit",
        "penetration",
        "soc 2",
        "soc2",
        "fedramp",
    ),
    "IAM": ("iam", "identity and access", "okta", "sso"),
    "Compliance": ("compliance", "soc 2", "soc2", "iso 27001"),
    "Developer Tools": (
        "developer tools",
        "devtools",
        "coding agent",
        "developer experience",
        "developer productivity",
    ),
    "APIs": ("api design", "rest api", "graphql", "apis"),
    "Frontend": ("frontend", "front-end", "web applications"),
    "System Design": ("system design", "architecture"),
    "Solutions Engineering": (
        "solutions engineer",
        "pre-sales",
        "presales",
        "proof of concept",
        "pocs",
        "technical demo",
    ),
    "Customer Success": ("customer success", "customer onboarding", "adoption", "renewal"),
    "Enterprise Sales": (
        "enterprise sales",
        "enterprise accounts",
        "quota",
        "sales pipeline",
        "closing deals",
        "close deals",
    ),
    "Account Management": ("account management", "account director", "book of business"),
    "Partnerships": (
        "partnerships",
        "channel partners",
        "alliances",
        "reseller",
        "system integrator",
    ),
    "Federal": ("federal", "public sector", "government", "dod", "clearance"),
    "Sales Development": ("sales development", "outbound", "prospecting", "cold outreach"),
    "Product Marketing": ("product marketing", "positioning", "messaging", "product launch"),
    "Demand Generation": (
        "demand gen",
        "demand generation",
        "paid media",
        "performance marketing",
        "campaigns",
    ),
    "Events": ("event marketing", "conferences", "field marketing", "event production"),
    "Brand": ("brand marketing", "brand strategy", "brand identity"),
    "Content": ("content marketing", "editorial", "copywriting"),
    "Community": ("developer community", "developer relations", "devrel", "advocacy"),
    "Recruiting": (
        "recruiting",
        "recruiter",
        "sourcing candidates",
        "talent acquisition",
        "hiring pipeline",
    ),
    "HR Operations": ("hris", "people operations", "employee onboarding", "benefits"),
    "Payroll": ("payroll",),
    "Legal": ("legal team", "contract negotiation", "counsel", "commercial agreements"),
    "Finance": ("finance team", "fp&a", "accounting", "budgeting", "financial planning"),
    "Operations": (
        "business operations",
        "operational excellence",
        "logistics",
        "vendor management",
        "process improvement",
    ),
    "Executive Support": ("executive assistant", "calendar management", "executive support"),
    "IT": ("it support", "helpdesk", "mdm", "endpoint", "it engineer"),
    "Policy": ("public policy", "regulatory", "government affairs", "policymakers"),
    "Product Management": ("product manager", "product roadmap", "product management", "prd"),
    "UX Design": ("ux", "figma", "user research", "design system"),
    "Japanese": ("japanese", "japan"),
    "Korean": ("korean", "korea"),
    "Spanish": ("spanish", "latam"),
    "Arabic": ("arabic", "ksa", "saudi"),
}

SKILLS_BY_FAMILY: Final[dict[str, tuple[str, ...]]] = {
    "engineering": (
        "Python",
        "TypeScript",
        "Go",
        "Rust",
        "React",
        "PostgreSQL",
        "Distributed Systems",
        "APIs",
        "System Design",
        "Developer Tools",
        "Docker",
        "AWS",
        "Frontend",
        "CI/CD",
        "Java",
        "C++",
    ),
    "ml_research": (
        "Python",
        "PyTorch",
        "LLMs",
        "RL",
        "Model Training",
        "Inference",
        "CUDA",
        "GPUs",
        "Distributed Systems",
        "Data Pipelines",
    ),
    "infrastructure": (
        "Kubernetes",
        "Docker",
        "AWS",
        "GCP",
        "Terraform",
        "Go",
        "Python",
        "Observability",
        "Linux",
        "Networking",
        "CI/CD",
        "Distributed Systems",
        "GPUs",
    ),
    "security": (
        "Security Engineering",
        "IAM",
        "Compliance",
        "AWS",
        "Python",
        "Linux",
        "Networking",
        "Kubernetes",
        "Federal",
    ),
    "data": (
        "Python",
        "SQL",
        "Data Pipelines",
        "PostgreSQL",
        "AWS",
        "Observability",
        "Distributed Systems",
    ),
    "product": (
        "Product Management",
        "APIs",
        "Developer Tools",
        "UX Design",
        "SQL",
        "Product Marketing",
    ),
    "design": ("UX Design", "Frontend", "Product Management", "Brand"),
    "customer_engineering": (
        "Solutions Engineering",
        "Python",
        "TypeScript",
        "APIs",
        "Customer Success",
        "Developer Tools",
        "Kubernetes",
        "AWS",
        "Enterprise Sales",
        "Federal",
    ),
    "sales": (
        "Enterprise Sales",
        "Account Management",
        "Partnerships",
        "Sales Development",
        "Customer Success",
        "Federal",
        "Developer Tools",
    ),
    "marketing": (
        "Product Marketing",
        "Demand Generation",
        "Events",
        "Brand",
        "Content",
        "Community",
        "Developer Tools",
    ),
    "recruiting": ("Recruiting", "HR Operations", "Operations", "Events"),
    "people_ops": ("HR Operations", "Payroll", "Recruiting", "Operations", "Compliance"),
    "finance_legal": ("Finance", "Legal", "Compliance", "Payroll", "Operations"),
    "operations": ("Operations", "Executive Support", "IT", "Finance", "Events", "Policy"),
}

LANGUAGE_SKILLS: Final[frozenset[str]] = frozenset({"Japanese", "Korean", "Spanish", "Arabic"})

_WORD_BOUNDARY_SAFE = re.compile(r"[a-z0-9]")


def classify_family(title: str) -> str:
    """Map a job or contact title to one of FAMILIES."""
    lowered = f" {title.lower()} "
    for pattern, family in _FAMILY_PATTERNS:
        if re.search(pattern, lowered):
            return family
    return "engineering"


def classify_seniority(title: str) -> str:
    lowered = f" {title.lower()} "
    for pattern, level in _SENIORITY_PATTERNS:
        if re.search(pattern, lowered):
            return level
    return "mid"


def seniority_distance(a: str, b: str) -> int:
    try:
        return abs(SENIORITY_ORDER.index(a) - SENIORITY_ORDER.index(b))
    except ValueError:
        return len(SENIORITY_ORDER)


def extract_skills(text: str, *, family: str | None = None, limit: int = 8) -> list[str]:
    """Deterministic keyword extraction of canonical skills from a job description.

    Skills are ranked by number of alias hits, with the role's family skills winning ties.
    """
    lowered = f" {text.lower()} "
    allowed: set[str] | None = None
    if family:
        allowed = set(SKILLS_BY_FAMILY.get(family, ()))
        for adjacent in ADJACENT_FAMILIES.get(family, frozenset()):
            allowed.update(SKILLS_BY_FAMILY.get(adjacent, ()))
        allowed.update(LANGUAGE_SKILLS)
    hits: dict[str, int] = {}
    for skill, aliases in SKILL_ALIASES.items():
        if allowed is not None and skill not in allowed:
            continue
        count = 0
        for alias in aliases:
            needle = alias.lower()
            if _WORD_BOUNDARY_SAFE.match(needle[:1]) and _WORD_BOUNDARY_SAFE.match(needle[-1:]):
                count += len(re.findall(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", lowered))
            else:
                count += lowered.count(needle)
        if count:
            hits[skill] = count
    family_skills = set(SKILLS_BY_FAMILY.get(family or "", ()))
    ranked = sorted(hits.items(), key=lambda kv: (-kv[1], kv[0] not in family_skills, kv[0]))
    picked = [skill for skill, _ in ranked[:limit]]
    # Guarantee a floor of family-typical skills so every role has something to match on.
    for skill in SKILLS_BY_FAMILY.get(family or "", ()):
        if len(picked) >= max(4, min(limit, 6)):
            break
        if skill not in picked:
            picked.append(skill)
    return picked
