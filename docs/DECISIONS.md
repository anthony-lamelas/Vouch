# VOUCH — Decisions

Short record of the calls that shaped the prototype, with the reasoning and what would change in production. Companion to [SPEC.md](SPEC.md).

## Product

**One persona, one loop.** Recruiters use the app; employees only ever see Slack; candidates only hear from the employee. Every screen serves the loop "find → ask → employee answers → outcome". Nothing was built for admins, hiring committees or candidates.

**The employee is asked to refer, not to vouch in the abstract.** The Slack ask is concrete ("would you reach out to Kelly and refer her for X?") with a yes/no. Earlier drafts asked "do you know them well?"; that produced information, not action.

**Saying yes means "I'll reach out".** There is no separate "contacted" step. The employee's next signal is the candidate's answer. A `contacted` status and a `no_response` status existed in the first schema and were dropped (migrations `b2c3…`, `c3d4…`): they doubled the number of buttons without changing what the recruiter does.

**A "no" is a decision point, not an automation.** The first version re-routed to the next-strongest employee the moment someone declined. It was replaced: Slack asks *why*, the request parks with the reason, and the recruiter chooses who to ask next (or closes). The reason is the information the recruiter needs to decide whether it's worth another ask; a system that silently asks three people in a row burns goodwill. The one automatic case is when nobody else is connected: the request closes itself.

**Stale is a derived flag, not a status.** A request that has been in "employee reached out" for 7+ days with no outcome is flagged and gets a Nudge. It is computed at read time from the last event, never stored, so there is no job to run, nothing to get out of sync, and a reply or a close clears it by definition. Seven days is a guess; it is one constant.

**The happy path ends with a booked screen.** When the candidate is interested, the employee gets a message to pass on with the recruiter's booking link, and the recruiter marks "Interview scheduled". In production this moment hands off into Ashby (candidate + application credited to the referrer, stage webhooks back to Slack). The public job-board feed is read-only, so the ATS step is described rather than stubbed: a fake button would have been the one dishonest moment in the demo.

**One open request per candidate.** Enforced by a partial unique index. Two recruiters chasing the same person through two employees is exactly the mess a referral tool should prevent. Closing frees the person.

**Recruiters see their own by default, everything on demand.** "My roles" / "My requests" first, with an "All" toggle. Ownership is per role; the demo team shares one pipeline so a reviewer signing in with their own email sees the same thing as the author.

## Matching

**Heuristic scoring, not embeddings.** Match and strength scores are weighted sums of explicit signals (skills overlap, job family and seniority proximity, employer and school tier, location, best connection). Three reasons: every score comes with human-readable reasons that appear in the UI, which is what a recruiter needs to trust a ranking; the data is synthetic, so an embedding model would be learning the generator's regularities; and it runs in seconds over 3,000 × 94 pairs with nothing to host. Embeddings, or an LLM re-rank of the top 50, are the obvious next step once there is real profile text and outcome data to evaluate against, and they slot in as one more term without changing the UI.

**Scores are precomputed.** `match_score` is a table, filled on seed and on role sync, top 500 per role above 0.30. Candidate lists are then a filtered, ordered read, which keeps the role page instant and lets filters (company, school, tier, region) compose in SQL. The cost is that scoring changes need a recompute; the weights are constants and the recompute is one admin call.

**Location is a first-class term.** A Tokyo role ranked San Francisco people exactly like Tokyo people until location was added as a 0.20 term (same city / same region / elsewhere) and candidate lists were defaulted to the role's region with a toggle to widen. Relocation is real, and a warm intro to someone willing to move is valuable, so out-of-region people are down-ranked and labelled, not hidden. Current city only: office history isn't in the data.

**Pedigree counts wherever it sits in the résumé.** A tier-1 employer three jobs ago is still a signal. The wording says "Previously at DeepMind" vs "Currently at DeepMind" so it never implies something false.

**Connection strength is dates and places, not a social graph.** Shared employer with overlapping dates (more if same team), shared school with overlapping years, and recency of the connection. A LinkedIn-style "connected on" date stands in for interaction data we don't have.

## Data

**Real roles, synthetic people.** Roles come from Cognition's public Ashby board (live sync, committed snapshot as fallback and for tests), so the demo is about their actual reqs. People are generated: no scraping, no consent problem, and the generator can guarantee the shapes the demo needs (a candidate several employees know, an employee who passed with colleagues left). The seed is deterministic.

**Canonical contacts keyed on LinkedIn URL.** One `contact` row per person, many `connection` edges to employees. The alternative, one row per employee-contact pair, made "who else knows this person?" a join on names.

**Skills are extracted by keyword taxonomy, per job family.** Good enough on real Ashby descriptions, deterministic, and testable. Claude-assisted extraction sits behind a flag.

**Tiers are curated lists.** About 40 companies and 50 schools in three tiers, seeded as tables so they can be filtered on and edited without a deploy.

## Platform

**FastAPI + SQLAlchemy 2.0 + Alembic on Supabase Postgres.** A typed ORM and migrations in the repo, mypy strict across the service layer, tests against a real Postgres. Supabase supplies Postgres and Auth; the API is the only writer. RLS is enabled on every table as a guard against the anon key ever reaching the tables directly, but authorisation lives in the API, not in SQL: ownership and team sharing are easier to read and test in Python. Supabase's client-side data access was considered and rejected for the same reason: one place for business rules.

**Supabase Auth, recruiter only.** Email + password JWTs verified against the project's JWKS. No sign-up flow in the app; accounts are created in the dashboard. Employees are identified by Slack, not by login.

**Slack over email for the employee side.** Buttons, in-place card updates and modals make the employee's part two taps; email would need a reply parser and a link out. Free-text replies are classified anyway (keyword rules, Claude optional) because people ignore buttons.

**Demo routing.** Reviewers aren't Cognition employees, so every DM goes to the requesting recruiter (matched by login email), then a configured fallback user, then the employee's Slack id. The card names who would have received it in production. Same code path either way.

**Deterministic drafts by default, Claude behind a flag.** Template drafts and a keyword classifier are exact, free, instant and testable; both fall back to templates if Claude fails. The message as sent is stored with the request so it is never lost.

**One Docker service on Render.** Frontend built into the API's static directory; migrations run at container start. Auto-deploy is off; GitHub Actions deploys only from a green `main` via a deploy hook. CI runs lint, strict typecheck, tests against Postgres, and the Docker build on every PR. Nothing merges red.

**Requests poll.** Lists refetch every 15s and the request page every 10s, plus on window focus, because state changes from Slack outside the browser. Websockets would be the production answer; polling is one option flag.

## UI

**Linear's system, Attio's styling.** Dense 36px rows, a 232px sidebar, filter pills with applied chips, tabs with counts; white canvas, one accent, soft semantic tags for status. Dark mode via tokens. No progress bars, dots or rank numbers: reasons in words instead of scores.

**Reasons, never scores.** The recruiter sees "5 of 8 skills · same job family · Same city", not 0.74. The number is in the API for anyone who wants it.

**Filters, sort and scope live in the URL.** Every list is a shareable link and the back button works.

## Deliberately not built

- Candidate consent and privacy flows (synthetic data; a real deployment needs them first).
- Ashby write-back (needs credentials).
- Employee-facing web UI (Slack is enough).
- Multi-tenant or org admin (one company, one team).
- Learned ranking (needs outcomes to learn from).
