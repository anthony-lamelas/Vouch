# CLAUDE.md

Guidance for working on VOUCH with Claude Code. Read `docs/SPEC.md` for how the product works and `docs/DECISIONS.md` for why it is built this way before changing behaviour.

## What this is

Referral-sourcing prototype for Cognition: FastAPI + SQLAlchemy 2.0 + Alembic on Postgres (Supabase), React 18 + TypeScript + Vite frontend, Slack Block Kit for the employee side, one Docker service on Render. Roles are real (Cognition's Ashby board); people are synthetic.

## Layout

```
backend/app/api/        FastAPI routers (roles, requests, contacts, slack, admin, meta) + serializers
backend/app/services/   business logic: lifecycle (state machine), referrals (ReferralService),
                        scoring, matching (precompute), geo, outreach (drafts), classifier,
                        slack (cards, modals, notifier), ownership, ashby (role sync), taxonomy
backend/app/models/     SQLAlchemy models        backend/alembic/versions/  migrations
backend/app/seed/       generator, pools (tiers, cities, skills), loader (scenarios)
backend/tests/          pytest against a real Postgres (vouch_test), seeded once per session
frontend/src/pages/     Roles, RoleDetail (+ CandidateDrawer), Pipeline, Request, Login
frontend/src/lib/       pure helpers with tests (filters, sort, needsYou, status, reasons)
frontend/src/api/       typed client, TanStack Query hooks, types mirroring the API schemas
frontend/src/index.css  Tailwind v4 tokens (light + dark), table and field utilities
docs/                   SPEC.md, DECISIONS.md
```

## Rules

- **Never commit to `main`.** Branch, open a PR, merge only when CI is green. CI = ruff, ruff format, mypy strict, pytest, eslint, prettier, tsc, vitest, Docker build. Deploy to Render happens automatically from a green `main`.
- **No AI attribution in git.** No `Co-Authored-By`, session links, or "generated with" lines in commits or PR bodies.
- **State changes go through `ReferralService`.** Never set `referral_request.status` directly; `transition`, `reroute`, `nudge` validate against `lifecycle.TRANSITIONS`, append the event, and update the Slack card.
- **Labels are written from the recruiter's point of view** and kept in sync between `lifecycle.LABELS` and `frontend/src/lib/status.ts`.
- **Scoring changes need a recompute.** `match_score` is precomputed; after touching `scoring.py`, `geo.py` or `taxonomy.py`, reseed locally and note that production needs `POST /api/admin/reset-demo` (which also wipes requests).
- **Schema changes need an Alembic migration** in `backend/alembic/versions/`, named `YYYYMMDD_<rev>_<slug>.py`. Migrations run at container start. Escape `%` in URLs passed to Alembic config.
- **Tests run against Postgres.** `docker compose up -d db` first. Backend tests share one seeded database per session, so create fresh requests in a test rather than consuming seeded ones.
- **Keep the UI dense and explanatory.** Reasons in words, no scores, ranks, dots or bars. Filters, sort and scope in the URL. Semantic tag colours are tokens in `index.css` (light and dark blocks).
- **Secrets never go in the repo or in command text.** Database password and admin token live outside the tree.

## Commands

```bash
# backend
docker compose up -d db
cd backend && uv sync --all-groups
uv run alembic upgrade head
uv run python -m app.cli seed
AUTH_DISABLED=true DEMO_RECRUITER_EMAIL=recruiter@vouch.local DEMO_RECRUITER_NAME="Local Recruiter" \
  uv run uvicorn app.main:app --port 8000
uv run ruff format app tests && uv run ruff check app tests && uv run mypy app && uv run pytest -q

# frontend
cd frontend && pnpm install
pnpm dev --port 5173          # proxies /api to :8000
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

With `AUTH_DISABLED=true` the API acts as `recruiter@vouch.local`; send `X-Demo-User: <email>` to act as someone else (used by tests for teammate sharing).

## Conventions

- Python: typed everywhere, `from __future__ import annotations`, dataclasses for value objects, no business logic in routers. Line length 100.
- TypeScript: strict, no `any`, hooks in `api/queries.ts`, pure logic in `lib/` with a vitest file beside it.
- Commit messages: imperative summary line, then what and why. PR bodies: what changed, tests, anything to do after merge.
- Docs: update `docs/SPEC.md` when behaviour changes and `docs/DECISIONS.md` when a trade-off is made or reversed.
