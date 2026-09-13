# VOUCH — Product & Technical Specification

Internal referral-sourcing platform for Cognition (~500 employees). Surfaces warm candidates from employees' networks, lets a recruiter or hiring manager request a referral from the employee who knows the candidate best, and tracks the outcome. Built as a 48-hour prototype that runs live against a real database.

Locked on 2026-09-12 after a spec review. Decisions here are final for the prototype unless the assigner changes scope.

## 1. Personas

| Persona | Uses the app? | How they participate |
|---|---|---|
| Recruiter / hiring manager | Yes, authenticated | Searches candidates per role, requests referrals, tracks the pipeline |
| Employee ("Bob") | No | Receives a Slack DM from the VOUCH app, clicks buttons or replies in plain text |
| Candidate | No | Contacted by Bob outside the system |

One authenticated persona for the prototype. Real auth via Supabase Auth (email + password).

## 2. Data

### 2.1 Open roles — real
Pulled from Cognition's public Ashby job board (`api.ashbyhq.com/posting-api/job-board/cognition`). 93 postings across Sales, Customer Engineering, G&A, R&D, Marketing as of 2026-09-12. Fields used: id, title, department, team, location, isRemote, employmentType, descriptionHtml, descriptionPlain, jobUrl, publishedAt. Required skills per role are extracted from the description (keyword taxonomy by default; Claude-assisted extraction available behind a flag). A committed snapshot of the board is used by tests and as an offline fallback.

### 2.2 Employees and contacts — synthetic
The LinkedIn `Connections.csv` export only carries name, profile URL, company, position and connected-on date. Profile detail (work history, education, skills) is not obtainable legally from LinkedIn; in production it comes from an enrichment vendor keyed on the profile URL. For the prototype all people data is synthetic, generated deterministically (seeded RNG) so tests and the demo agree. Every contact carries `enrichment_source = "synthetic"`.

Seed scale: 40 employees, ~3,000 contacts, ~35 companies with tiers, 50 schools with tiers, a handful of referral requests pre-seeded in mixed states.

### 2.3 Identity resolution
One canonical `contact` row per human, keyed on LinkedIn profile URL. One `connection` edge per employee who knows them. Profile detail stored as JSONB on the contact (schema option B), with GIN indexes and Pydantic-validated shapes.

## 3. Scoring

### 3.1 Connection strength (per edge, picks which employee to ask)
```
strength = 0.45 * overlap + 0.25 * school + 0.30 * recency
overlap  = 1.00 same company, overlapping dates, same team
         = 0.80 same company, overlapping dates
         = 0.40 same company, no date overlap
         = 0.00 otherwise
school   = 1.00 same school, overlapping years | 0.60 same school | 0.00
recency  = 1.00 connected within 12 months, linear decay to 0.20 at 5 years
```
The breakdown is stored on the edge so the UI can explain the pick.

### 3.2 Match score (per contact × role, precomputed)
```
score = 0.35 * skills + 0.25 * fit + 0.20 * company_tier + 0.10 * school_tier + 0.10 * best_strength
skills       = |contact.skills ∩ role.required_skills| / |role.required_skills|
fit          = job-family and seniority proximity between contact's current title and the role
company_tier = 1.0 if any tier-1 employer, 0.6 tier-2, else 0
school_tier  = 1.0 tier-1 school, 0.6 tier-2, else 0
best_strength = max connection strength across employees who know the contact
```
Stored in `match_score` with a `reasons` JSON list of human-readable signals. Pairs under 0.15 are not stored. Recruiters see results ordered by score and can apply hard filters on company, school and skills.

## 4. Referral lifecycle

A referral request is a ticket with a status. Every change appends a `referral_event`. One active (non-closed) request per contact across all roles, enforced by a partial unique index.

| Status | Set by | Meaning |
|---|---|---|
| requested | recruiter (system sends DM) | Employee asked, no answer yet |
| employee_accepted | Bob | Bob will reach out |
| employee_declined | Bob (reason: dont_know_well, not_a_fit) | System re-routes to next-strongest employee if one exists |
| contacted | Bob | Bob has messaged the candidate |
| candidate_interested | Bob | Candidate wants to talk |
| candidate_declined | Bob | Candidate said no |
| no_response | Bob | No answer after a nudge |
| closed | recruiter | Terminal, with an outcome note |

Transitions: requested → {employee_accepted, employee_declined, closed}; employee_declined → {requested (re-route), closed}; employee_accepted → {contacted, closed}; contacted → {candidate_interested, candidate_declined, no_response, closed}; no_response → {candidate_interested, candidate_declined, closed}; candidate_* → {closed}.

## 5. Employee channel: Slack

Workspace: vouchdemo.slack.com. A Slack app ("VOUCH") DMs the employee a card with the candidate, the role, a drafted outreach message, and action buttons. Button clicks hit `/api/slack/interactions`; free-text replies in the DM arrive via `/api/slack/events` and are classified into a status plus a note (keyword classifier by default, Claude behind a flag). In the demo every DM is routed to one Slack user (the person playing Bob) with a line naming the employee it would have gone to. The app keeps an Outreach panel listing every message sent and its current status so a reviewer without Slack access can follow along.

## 6. Outreach drafting

Deterministic templates first: a casual DM and a professional email snippet, personalised from the contact, the role and the shared history between Bob and the contact. A Claude-backed generator is wired behind `OUTREACH_MODE=claude`.

## 7. Architecture

- Backend: Python 3.12, FastAPI, SQLAlchemy 2.0 (typed), Alembic, Pydantic v2, slack_sdk, httpx, anthropic. Managed with uv.
- Frontend: React 18, TypeScript strict, Vite, TanStack Query, React Router, Tailwind. Managed with pnpm.
- Database: Supabase Postgres (prod), Postgres 17 in Docker (local and CI).
- Auth: Supabase Auth; FastAPI verifies the JWT via the project's JWKS. `AUTH_DISABLED=true` for local runs without accounts.
- Hosting: one Render web service (paid plan) built from a multi-stage Dockerfile; FastAPI serves the built React bundle. URL: `*.onrender.com`. No custom domain.
- CI: GitHub Actions. Backend: ruff, mypy --strict, pytest against a Postgres service container. Frontend: eslint, tsc, vitest, build. Docker image build check. Deploy to Render only from green `main` via a deploy hook.
- Local: `docker compose up` runs Postgres, API and web on Linux, macOS and Windows.

## 8. Out of scope for the prototype
Consent and network-visibility controls, CSV upload, ATS integration, bonus payout, an in-app employee inbox, email or Google Chat channels, inbound email parsing.

## 9. Demo script (3 minutes)
1. Log in as the recruiter. Roles list shows Cognition's live postings with candidate counts.
2. Open "Software Engineer, Infrastructure". Top candidates ranked by score with reasons. Filter to company "Stripe" and skill "Kubernetes": Priya Natarajan ranks near the top.
3. Open a candidate. Two employees know them; the strongest edge is Bob (worked together at Stripe, 2019–2021). Click Request Referral.
4. Switch to Slack. Bob's DM arrives with the drafted message and buttons. Click "I'll reach out", then "Contacted", then type "she's interested, wants to chat next week".
5. Back in the app: pipeline shows Candidate interested, the timeline shows every step with actor and time, the Outreach panel shows the message that went out.
6. Decline one on purpose to show automatic re-routing to the next-strongest employee.
