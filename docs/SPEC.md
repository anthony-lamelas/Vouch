# VOUCH — Specification

Warm referral sourcing for Cognition. VOUCH turns employees' networks into a ranked candidate pool for every open role, lets a recruiter ask the best-connected employee for a referral in one click, and tracks what happens as the employee answers in Slack.

Live: https://vouch-9pfl.onrender.com · Decisions and trade-offs: [DECISIONS.md](DECISIONS.md)

---

## Part 1 — How it works (non-technical)

### Who uses it

- **Recruiter** (or hiring manager): signs in, browses their roles, picks candidates, sends asks, watches the pipeline. The only person who uses the web app.
- **Employee**: never opens VOUCH. They get a Slack DM asking whether they would refer someone they know, and answer with buttons or a plain reply.
- **Candidate**: never touches VOUCH. They hear from the employee, and if interested, book a screen with the recruiter through a scheduling link.

### The user flow

1. **Roles.** The recruiter lands on *My roles*: the open postings they own, grouped by department, with counts of strong matches and open requests. *All roles* shows the whole board. Filters: department, team, location, search.
2. **Candidates for a role.** Opening a role lists people in employees' networks ranked by fit, defaulting to the role's region. Each row shows who they are, why they match (skills, job family, employer and school pedigree, location), and which employee knows them best with the shared history ("Overlapped at Stripe 2019–2021 on Payments"). Filters: company, school (each with tier shortcuts), same region, search. People with an open request are hidden.
3. **Ask for a referral.** Clicking a candidate opens a drawer with their profile and a pre-written note to the closest-connected employee: *"Hi Frank, would you be willing to reach out to Kelly Brooks (Forward Deployed Engineer at Notion) and refer them for the AI Support Engineer role? You both worked at DoorDash, so you seemed like the right person to ask…"*. The recruiter can edit it and sends. Only one open request per candidate at a time.
4. **The employee answers in Slack.** They receive a DM with the role linked, the note, and two buttons: *Yes, I'll reach out* or *No, not this one*. Plain replies ("sent it", "she's keen", "not a fit") work too.
5. **Yes.** The card thanks them and gives a copyable message to send the candidate, with the posting link. Two buttons follow: *Kelly's interested* / *Kelly passed*.
6. **Interested.** The card gives the employee a second message to pass on containing the recruiter's booking link, so the candidate can schedule a screen. In VOUCH the recruiter sees "Kelly is interested" and can click **Interview scheduled**, which closes the request with that outcome.
7. **Candidate passed.** Slack asks the employee why (happy where they are, not this role, bad timing, never heard back, other) with an optional note. The request closes automatically; the reason is on the timeline.
8. **No.** Slack asks the employee why (doesn't know them well, not a fit, they wouldn't be looking, other) with an optional note. The request parks as *Employee passed*. The recruiter reads the reason and either clicks **Ask someone else**, choosing among the other employees who know the candidate, or closes it. If nobody else knows the candidate, it closes automatically.
9. **Pipeline.** Every request in one sortable table: candidate, employee asked, status, requester, last activity. Closed ones are hidden unless *Show closed* is ticked. *My requests* is the default; *All requests* shows everyone's.
10. **Needs you.** The sidebar lists what wants a decision: a candidate who said yes to close out, an employee who passed, an ask that has gone quiet for seven days (with a **Nudge** button on the request page).
11. **Request page.** A stepper (Asked Frank → Frank reached out → Kelly answered → Closed), an attribute panel, a collapsible "Why this candidate", and a timeline of every event with the messages that went out.

### Request states

| State | Shown as | Set by | What happens next |
|---|---|---|---|
| `requested` | Waiting on employee | Recruiter sends the ask | Slack DM goes out |
| `employee_accepted` | Employee reached out | Employee taps Yes | Suggested message to the candidate; buttons for the outcome. After 7 days with no outcome the request is flagged **stale** and can be nudged |
| `employee_declined` | Employee passed | Employee taps No and gives a reason | Recruiter picks another connected employee (**Ask someone else**) or closes. Auto-closes if nobody else is connected |
| `candidate_interested` | Candidate interested | Employee reports it | Booking link sent via the employee; recruiter marks **Interview scheduled** (closes) |
| `candidate_declined` | Candidate passed | Employee reports it with a reason | Closes automatically |
| `closed` | Closed | Recruiter, or automatic | Terminal. The outcome note is on the timeline |

Transitions: `requested → employee_accepted | employee_declined | closed`; `employee_declined → requested (re-route) | closed`; `employee_accepted → candidate_interested | candidate_declined | closed`; `candidate_* → closed`. Everything else is rejected.

Every change appends an immutable event (who, from, to, when, note, which employee it concerned). The timeline is that event log.

### Ownership and who sees what

Roles are owned by a recruiter. The demo login and their teammates form a team that shares *My roles* and *My requests* (they own the Research & Development postings); synthetic recruiters own the rest by department. Anyone signed in can see everything under *All*, but only their own under *My*.

### Where the loop ends in production

The prototype ends with the candidate booking a recruiter screen. In production the "interested" moment would instead hand the referral into Ashby: create the candidate credited to the referring employee, open an application against the job (we already store each posting's Ashby id), and let Ashby's scheduling and interview plan take over, with stage webhooks reporting milestones back into the employee's Slack thread. That needs an Ashby API key with write scope, which the public job-board feed does not carry, so the prototype stops at the booking link rather than stubbing the ATS step.

---

## Part 2 — How it works (technical)

### Stack

| Layer | Choice |
|---|---|
| API | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (typed), Alembic migrations, psycopg 3 |
| Database | Postgres on Supabase (transaction pooler). Migrations run at container start. Row-level security is enabled on every table; the API connects as the table owner, so RLS is a guard against direct client access, not an app-level policy layer |
| Auth | Supabase Auth (email + password). The API verifies the JWT against the project's JWKS (ES256). `AUTH_DISABLED=true` for local development, with an `X-Demo-User` header to act as a given recruiter |
| Web | React 18, TypeScript strict, Vite 6, Tailwind v4, TanStack Query, React Router. Filters, tabs, sort and scope live in the URL |
| Slack | `slack_sdk` WebClient for DMs and modals, signed request verification, Block Kit cards, interactions and events endpoints |
| Drafting / classification | Deterministic templates and a keyword classifier by default; Claude behind flags (`OUTREACH_MODE`, `REPLY_CLASSIFIER_MODE`) with template/keyword fallback on any failure |
| Deploy | One Docker image (frontend built into the API's static dir) on Render. GitHub Actions runs lint, typecheck, tests, and a Docker build on every PR, and fires the Render deploy hook only from a green `main`. `/api/healthz` reports the deployed commit |

### Data model

- `employee` — Cognition staff (synthetic, 40): name, title, team, email, Slack user id, experiences, education.
- `contact` — a person in someone's network (synthetic, 3,000), keyed on LinkedIn URL: headline, location, current company/title, job family, seniority, JSONB experiences and education, skills.
- `connection (employee_id, contact_id)` — an edge with a **strength** score and a breakdown (shared employer detail, shared school detail, recency).
- `role` — synced from Cognition's public Ashby job board (94 postings): title, department, team, location, remote flag, family, seniority, extracted required skills, posting URL, owner.
- `match_score (role_id, contact_id)` — precomputed score plus a list of human-readable reasons.
- `referral_request` — one row per ask: contact, role, current employee, status, requester, the ask text as sent, closed outcome. Partial unique index: one non-closed request per contact.
- `referral_event` — append-only history: from/to status, actor (`recruiter:<email>`, `employee:<id>`, `system`), note, the employee concerned.
- `outreach_message` — every Slack delivery with the blocks sent, channel and timestamp (so the card can be updated in place).
- `recruiter` — display names and booking links for the demo team and synthetic recruiters.
- `company_tier`, `school_tier` — curated tiers (1–3) used by scoring and filters.
- `slack_event` — event ids already handled, so Slack retries are idempotent.

### Scoring

**Connection strength** (employee ↔ contact), 0–1:

```
strength = 0.45 · overlap + 0.25 · school + 0.30 · recency
overlap  = 1.0 same employer, same team, overlapping dates; 0.8 same employer overlapping dates; 0.4 same employer, different years
school   = 1.0 same school overlapping years; 0.6 same school different years
recency  = 1.0 if connected within a year, linear down to 0.2 at five years
```

**Match score** (contact × role), 0–1, precomputed:

```
score = 0.30 · skills + 0.20 · fit + 0.15 · company_tier + 0.05 · school_tier + 0.10 · best_strength + 0.20 · location
skills        = |contact.skills ∩ role.required_skills| / |role.required_skills|
fit           = 0.7 · family (same 1.0, adjacent 0.4) + 0.3 · seniority proximity
company_tier  = 1.0 tier-1 employer anywhere in the résumé, 0.6 tier-2, else 0
school_tier   = same, for schools
best_strength = the strongest connection any employee has to the contact
location      = 1.0 same city as the role, 0.5 same region, 0 elsewhere (remote roles: 1.0 own region, 0.6 elsewhere)
```

Every term that fires emits a reason (`signal`, `label`, `detail`, `value`); location always does, so a mismatch is visible. Scores are recomputed for all roles on seed and on role sync; only pairs scoring ≥ 0.30 are stored, capped at the top 500 per role. "Strong match" in the UI means ≥ 0.70.

Regions: North America, Europe, Asia-Pacific, Middle East, Latin America. Ashby's free-text locations ("Austin, Texas", "San Francisco, Austin, New York City", "Southern Europe") are parsed city by city.

### Request lifecycle (service layer)

`ReferralService` owns every state change:

- `preview` / `create` — pick the strongest connection (or a chosen employee), build the drafts, insert the request and its first event, send the Slack DM, record the message.
- `transition` — validate against the transition table, append the event, update the Slack card in place, then apply side effects: booking-link event on `candidate_interested`; auto-close on `candidate_declined`; auto-close on `employee_declined` when no other employee is connected.
- `reroute` — after a decline, move the request to another connected employee (strongest remaining by default), regenerate the ask, send a new DM. Employees who already passed are excluded, tracked via the employee recorded on each event.
- `nudge` — re-DM the employee about a request they accepted; resets the stale clock.
- Free-text replies go through the classifier, which maps text to a target status and, if the reply implies skipped steps ("she's keen" while still `requested`), walks the legal path (`employee_accepted → candidate_interested`).

**Stale** is derived at read time: `employee_accepted` for more than 7 days with no later event. Nothing is stored.

### Slack integration

- One DM per ask, updated in place as the request moves. Blocks are stored with the message so updates start from what was actually sent.
- Buttons: `vouch_accept`, `vouch_decline`, `vouch_interested`, `vouch_candidate_declined`. The two "no" buttons open a modal (reason select + optional note) and the transition is recorded on submit; if the modal cannot open, a plain transition is recorded.
- Events endpoint handles DM messages; interactions endpoint handles buttons and modal submissions. Both verify Slack's signature. Event ids are de-duplicated.
- **Demo routing:** because reviewers are not Cognition employees, DMs go to the requesting recruiter, matched to a Slack member by their login email, then to `SLACK_DEMO_USER_ID`, then to the employee's own Slack id. The card says who would have received it in production.

### API

`GET /api/roles?mine=`, `GET /api/roles/{id}`, `GET /api/roles/{id}/candidates` (companies, schools, tiers, same_region, exclude_requested, q, paging), `GET /api/contacts/{id}`, `POST /api/requests/preview`, `POST /api/requests`, `GET /api/requests?mine=&status=&active_only=&role_id=`, `GET /api/requests/{id}`, `POST /api/requests/{id}/transition`, `POST /api/requests/{id}/reroute`, `POST /api/requests/{id}/nudge`, `GET /api/filters`, `GET /api/stats`, `GET /api/me`, `POST /api/slack/interactions`, `POST /api/slack/events`, `POST /api/admin/reset-demo`, `POST /api/admin/sync-roles` (admin token).

### Seed

Deterministic (seeded RNG). 40 employees, 3,000 contacts, about 4,660 connections, skills drawn per job family, careers clustered within a company tier band, geography spread across 22 cities. Nine demo requests: five for the demo team on the R&D roles (two waiting, two employees reaching out with one gone quiet, one employee who passed with colleagues left to ask) and four for synthetic recruiters. A reseed (`POST /api/admin/reset-demo`) wipes and rebuilds everything except auth.

### Quality gates

Backend: ruff (lint + format), mypy `--strict`, pytest against a real Postgres migrated with Alembic and seeded (tests cover scoring, geography, drafts, lifecycle, re-routing, Slack signatures, buttons, modals, free-text replies, filters, ownership, the stale flag). Frontend: eslint (type-checked), prettier, tsc, vitest with Testing Library (filter state, sorting, needs-you logic, pipeline rendering), production build. All of it runs in CI on every PR; `main` only receives merges that passed.
