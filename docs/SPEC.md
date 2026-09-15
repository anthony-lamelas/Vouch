# VOUCH Specification

---

## Part 1 — How it works (non-technical)

### Who uses it

- **Recruiter** (or hiring manager): signs in, browses their roles, picks candidates, sends asks, watches the pipeline. The only person who uses the web app.
- **Employee**: never opens VOUCH. They get a Slack DM asking whether they would refer someone they know, and answer with buttons.
- **Candidate**: never touches VOUCH. They hear from the employee, and if interested, book a screen with the recruiter through a scheduling link.

### The user flow

1. **Roles.** The recruiter lands on *My roles*: they open postings they own, grouped by department, with counts of strong matches and open requests. *All roles* shows the whole board. Filters: department, team, location, search.

2. **Candidates for a role.** Opening a role lists people in employees' networks ranked by fit, defaulting to the role's region. Each row shows who they are, why they match, and which employee knows them best with the shared history. Filters: company, school, same region, search. People with an open request are hidden.

3. **Ask for a referral.** Clicking a candidate opens a drawer with their profile and a pre-written note to the closest-connected employee. The recruiter can edit it and sends.

4. **The employee answers in Slack.** They receive a DM with the role linked, the note, and two buttons: *Yes, I'll reach out* or *No, not this one*. 

5. **Yes.** The card thanks them and gives a copyable message to send the candidate, with the posting link. Two buttons follow: *Kelly's interested* / *Kelly passed*.

6. **Interested.** The card gives the employee a second message to pass on containing the recruiter's booking link, so the candidate can schedule a screen. In VOUCH the recruiter sees "Kelly is interested" and can click **Interview scheduled** once the Kelly books a time, which closes the request with that outcome.

7. **Candidate passed.** Slack asks the employee why (happy where they are, not this role, bad timing, never heard back, other) with an optional note. The request closes automatically; the reason is added
to the timeline.

8. **No.** Slack asks the employee why (doesn't know them well, not a fit, they wouldn't be looking, other) with an optional note. The request parks as *Employee passed*. The recruiter reads the reason and either clicks **Ask someone else**, choosing among the other employees who know the candidate, or closes it. If nobody else knows the candidate, it closes automatically.

9. **Pipeline.** Every request in one sortable table: candidate, employee asked, status, requester, last activity. Closed ones are hidden unless *Show closed* is ticked. *My requests* is the default; *All requests* shows everyone's.

10. **Needs you.** The sidebar lists what wants a decision: a candidate who said yes to close out, an employee who passed, an ask that has gone quiet for seven days (with a **Nudge** button on the request page).

11. **Request page.** A stepper (Asked Frank → Frank reached out → Kelly answered → Closed), an attribute panel, a collapsible "Why this candidate", and a timeline of every event with the messages that went out.

### Request states

A request moves through six states.

**Requested**, shown as "Waiting on employee". The recruiter sends the ask and a Slack DM goes out to the employee. Nothing else happens until the employee answers.

**Employee accepted**, shown as "Employee reached out". The employee tapped Yes. The Slack card now carries a suggested message they can send the candidate and two buttons for the outcome. If seven days pass with no outcome, the request is flagged as stale and the recruiter gets a Nudge button.

**Employee declined**, shown as "Employee passed". The employee tapped No and gave a reason. The request waits for the recruiter, who can read the reason and either ask another employee who knows the candidate, using "Ask someone else", or close it. If nobody else is connected to the candidate, it closes automatically.

**Candidate interested**, shown as "Candidate interested". The employee reported that the candidate said yes. The employee receives a message to pass on with the recruiter's booking link. The recruiter marks "Interview scheduled", which closes the request.

**Candidate declined**, shown as "Candidate passed". The employee reported that the candidate said no and gave a reason. The request closes automatically.

**Closed**. The end state, reached either by the recruiter or automatically. The outcome note stays on the timeline.

Transitions: `requested → employee_accepted | employee_declined | closed`; `employee_declined → requested (re-route) | closed`; `employee_accepted → candidate_interested | candidate_declined | closed`; `candidate_* → closed`. Everything else is rejected.

### Ownership and who sees what

Roles are owned by a recruiter. The demo login and their teammates form a team that shares *My roles* and *My requests*; synthetic recruiters own the rest by department. Anyone signed in can see everything under *All*, but only their own under *My*.

### Where the loop ends in production

The prototype ends with the candidate booking a recruiter screen. In production the "interested" moment would instead hand the referral into ATS: create the candidate credited to the referring employee, open an application against the job, and let the ATS' scheduling and interview plan take over.
---

## Part 2 — How it works (technical)

### Stack

**API.** Python 3.12 with FastAPI. Request and response shapes are validated with Pydantic v2. Database access goes through SQLAlchemy 2.0 with full type annotations, schema changes are Alembic migrations, and the Postgres driver is psycopg 3.

**Database.** Postgres hosted on Supabase, reached through its transaction pooler. Migrations run automatically when the container starts, so a deploy always brings the schema up to date. Row-level security is switched on for every table. Permissions logic lives in the API, not in database policies.

**Auth.** Supabase Auth with email and password. The browser gets a JWT from Supabase and sends it with each request; 

**Web.** React 18 in strict TypeScript, built with Vite 6, styled with Tailwind v4. Server data is fetched and cached with TanStack Query, and routing is React Router. Filters, tabs, sort order, and the mine/all scope are all kept in the URL, so any view is a shareable link.

**Slack.** The official Slack SDK client sends DMs, updates cards in place, and opens the reason forms. 

**Deploy.** One Docker image: the frontend is built and served from the API's static directory. It runs on Render. GitHub Actions runs lint, type checks, tests, and a Docker build on every pull request, and only a green main triggers the Render deploy hook. The health endpoint reports which commit is live so a deploy can be confirmed.

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

Regions: North America, Europe, Asia-Pacific, Middle East, Latin America. 

### Request lifecycle (service layer)

`ReferralService` owns every state change:

- `preview` / `create` — pick the strongest connection, build the drafts, insert the request and its first event, send the Slack DM, record the message.
- `transition` — validate against the transition table, append the event, update the Slack card in place, then apply side effects: booking-link event on `candidate_interested`; auto-close on `candidate_declined`; auto-close on `employee_declined` when no other employee is connected.
- `reroute` — after a decline, move the request to another connected employee (strongest remaining by default), regenerate the ask, send a new DM. Employees who already passed are excluded, tracked via the employee recorded on each event.
- `nudge` — re-DM the employee about a request they accepted; resets the stale clock.
- Free-text replies go through the classifier, which maps text to a target status and, if the reply implies skipped steps ("she's keen" while still `requested`), walks the legal path (`employee_accepted → candidate_interested`).

**Stale** is derived at read time: `employee_accepted` for more than 7 days with no later event. Nothing is stored.

### Seed

Deterministic (seeded RNG). 40 employees, 3,000 contacts, about 4,660 connections, skills drawn per job family, careers clustered within a company tier band, geography spread across 22 cities. Nine demo requests: five for the demo team on the R&D roles (two waiting, two employees reaching out with one gone quiet, one employee who passed with colleagues left to ask) and four for synthetic recruiters. A reseed (`POST /api/admin/reset-demo`) wipes and rebuilds everything except auth.

### Quality gates

Backend: ruff (lint + format), mypy `--strict`, pytest against a real Postgres migrated with Alembic and seeded (tests cover scoring, geography, drafts, lifecycle, re-routing, Slack signatures, buttons, modals, free-text replies, filters, ownership, the stale flag). Frontend: eslint (type-checked), prettier, tsc, vitest with Testing Library (filter state, sorting, needs-you logic, pipeline rendering), production build. All of it runs in CI on every PR; `main` only receives merges that passed.
