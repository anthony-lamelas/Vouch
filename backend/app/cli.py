"""Operational commands: `uv run python -m app.cli --help`."""

from __future__ import annotations

import typer

from app.config import get_settings
from app.db import SessionLocal

cli = typer.Typer(no_args_is_help=True, add_completion=False)


@cli.command()
def seed(
    live_roles: bool = typer.Option(True, help="Fetch roles from Ashby (fallback: snapshot)"),
) -> None:
    """Wipe the database and load the synthetic dataset, roles, scores and demo requests."""
    from app.seed.loader import seed_database

    with SessionLocal() as db:
        report = seed_database(db, get_settings(), prefer_live_roles=live_roles)
    typer.echo(report)


@cli.command("sync-roles")
def sync_roles_cmd(live: bool = True) -> None:
    """Upsert roles from Ashby and recompute their match scores."""
    from app.services.ashby import fetch_or_snapshot, sync_roles
    from app.services.matching import recompute_match_scores

    with SessionLocal() as db:
        postings, source = fetch_or_snapshot(prefer_live=live)
        result = sync_roles(db, postings, source=source)
        scores = recompute_match_scores(db)
        db.commit()
    typer.echo(f"{result} match_scores={scores}")


@cli.command("recompute-scores")
def recompute_scores_cmd() -> None:
    from app.services.matching import recompute_match_scores

    with SessionLocal() as db:
        n = recompute_match_scores(db)
        db.commit()
    typer.echo(f"match_scores={n}")


if __name__ == "__main__":
    cli()
