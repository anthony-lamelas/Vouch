# VOUCH

Warm referral sourcing for Cognition. VOUCH turns employees' networks into a searchable candidate pool for every open role, lets a recruiter ask the best-connected employee for an intro in one click, and tracks the outcome as the employee replies in Slack.

- **Live demo:** https://vouch-9pfl.onrender.com
- **Spec and decisions:** [`docs/SPEC.md`](docs/SPEC.md)
- **Stack:** FastAPI + SQLAlchemy 2.0 + Alembic on Postgres (Supabase), React 18 + TypeScript + Vite, Slack Block Kit, deployed as one Docker service on Render. Roles are real (Cognition's public Ashby board); people are synthetic.

## How it works

1. **Roles** are synced from Cognition's Ashby job board (93 postings). Required skills are extracted from each description.
2. **Contacts** are canonical people in employees' networks with work history, education and skills. Every contact has one or more **connections** to employees, each with a strength score (shared employer and dates, shared school, recency).
3. **Match scores** are precomputed per role and contact with human-readable reasons. Recruiters see the ranked list and filter by company, school and skills.
4. **Request referral** picks the strongest-connected employee, drafts a message, and DMs them in Slack with buttons. Button clicks and plain-English replies update the request. If the employee declines, VOUCH re-routes to the next-strongest connection.
5. **Pipeline** shows every request with its status, the last message the employee received, and a full event history on the request page. Roles open on **My roles**; the pipeline opens on **My requests**, each with an All toggle.

## Run it locally

Requires Docker Desktop (macOS, Windows) or Docker Engine (Linux). Nothing else.

```bash
docker compose up --build
# then open http://localhost:8000  (auth is disabled in this mode; the DB seeds itself)
```

### Without Docker (development)

Backend (Python 3.12 via [uv](https://docs.astral.sh/uv/)):

```bash
docker compose up -d db                     # just Postgres
cd backend
cp ../.env.example .env                     # AUTH_DISABLED=true is the default
uv sync --all-groups
uv run alembic upgrade head
uv run python -m app.cli seed               # ~20s: 40 employees, 3,000 contacts, roles, scores
uv run uvicorn app.main:app --reload --port 8000
```

Frontend (Node 22, [pnpm](https://pnpm.io/) 9):

```bash
cd frontend
pnpm install
pnpm dev                                    # http://localhost:5173, proxies /api to :8000
```

### Quality gates

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest
cd frontend && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

CI runs the same commands on every push, builds the Docker image, and deploys to Render only from a green `main`.

## Configuration

All settings are environment variables (see [`.env.example`](.env.example)). The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres DSN (`postgresql+psycopg://...`) |
| `AUTH_DISABLED` | `true` skips login (local only). Otherwise Supabase Auth JWTs are verified via the project's JWKS. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Served to the browser by `GET /api/config` so the same image works everywhere |
| `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | Enable real Slack delivery. Blank = messages recorded but not sent. |
| `SLACK_DEMO_USER_ID` | Route every employee DM to one Slack user (the person playing "Bob") |
| `ANTHROPIC_API_KEY`, `OUTREACH_MODE=claude` | Optional Claude-tailored drafts (template fallback) |
| `ADMIN_TOKEN` | Protects `POST /api/admin/reset-demo` and `POST /api/admin/sync-roles` |
| `DEMO_RECRUITER_EMAIL`, `DEMO_RECRUITER_NAME` | The demo login: owns the R&D and Customer Engineering roles in the seed and is shown by name (derived from the email unless set) |

## Slack setup

1. Create a Slack app from [`slack/manifest.yaml`](slack/manifest.yaml) (replace `REPLACE_WITH_APP_URL` with the deployed origin).
2. Install it to the workspace, copy the **Bot User OAuth Token** and **Signing Secret** into the service's environment.
3. Set `SLACK_DEMO_USER_ID` to the Slack member ID of the person who plays the employee.

## Operations

```bash
uv run python -m app.cli seed             # wipe and reseed everything
uv run python -m app.cli sync-roles       # pull the latest Ashby postings, recompute scores
curl -X POST -H "X-Admin-Token: $ADMIN_TOKEN" https://<host>/api/admin/reset-demo
```

API docs are served at `/api/docs`.

## Repository layout

```
backend/    FastAPI app, SQLAlchemy models, Alembic migrations, seed generator, tests
frontend/   React + TypeScript app (Vite), built into the Docker image
docs/       Product and technical spec
slack/      Slack app manifest
Dockerfile  Multi-stage build: frontend bundle + API in one image
render.yaml Render blueprint for the web service
```
