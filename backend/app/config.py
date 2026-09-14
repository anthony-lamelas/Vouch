"""Application settings, loaded from environment variables or a .env file."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["local", "test", "production"] = "local"
    app_base_url: str = "http://localhost:8000"
    database_url: str = "postgresql+psycopg://vouch:vouch@localhost:5432/vouch"

    # Auth. Supabase Auth issues the JWTs; the API verifies them via JWKS.
    auth_disabled: bool = False
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = Field(default="", description="HS256 fallback for legacy projects")

    # Slack
    slack_bot_token: str = ""
    slack_signing_secret: str = ""
    slack_demo_user_id: str = Field(
        default="", description="Fallback Slack user for demo routing when no email match is found"
    )
    slack_route_to_requester: bool = Field(
        default=True,
        description=(
            "Demo routing: DM the recruiter who made the request, found in Slack by their login "
            "email, instead of the employee. Falls back to SLACK_DEMO_USER_ID."
        ),
    )

    # LLM
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"
    outreach_mode: Literal["template", "claude"] = "template"
    reply_classifier_mode: Literal["keyword", "claude"] = "keyword"

    # Admin / seed
    admin_token: str = ""
    seed_on_start: bool = Field(
        default=False, description="Seed an empty database at startup (docker compose convenience)"
    )
    seed_random_seed: int = 42
    seed_contact_count: int = 3000
    seed_employee_count: int = 40
    demo_recruiter_email: str = Field(
        default="", description="Login email that owns the R&D and Customer Engineering roles"
    )
    demo_recruiter_name: str = ""
    demo_employee_email: str = Field(
        default="", description="Email for the seeded 'Bob' employee; defaults to a synthetic one"
    )

    @property
    def slack_enabled(self) -> bool:
        return bool(self.slack_bot_token and self.slack_signing_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
