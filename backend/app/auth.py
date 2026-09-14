"""Supabase Auth JWT verification for the recruiter persona."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient

from app.config import Settings, get_settings


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    name: str


def _name_from_claims(claims: dict[str, Any], email: str) -> str:
    meta = claims.get("user_metadata") or {}
    for key in ("full_name", "name"):
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    from app.services.ownership import name_from_email

    return name_from_email(email)


@lru_cache
def _jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True, lifespan=3600)


def verify_token(token: str, settings: Settings) -> CurrentUser:
    errors: list[str] = []
    if settings.supabase_url:
        try:
            jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
            signing_key = _jwks_client(jwks_url).get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token, signing_key.key, algorithms=["ES256", "RS256"], audience="authenticated"
            )
            email = str(claims.get("email", ""))
            return CurrentUser(
                id=str(claims["sub"]), email=email, name=_name_from_claims(claims, email)
            )
        except jwt.PyJWTError as exc:
            errors.append(f"jwks: {exc}")
    if settings.supabase_jwt_secret:
        try:
            claims = jwt.decode(
                token, settings.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated"
            )
            email = str(claims.get("email", ""))
            return CurrentUser(
                id=str(claims["sub"]), email=email, name=_name_from_claims(claims, email)
            )
        except jwt.PyJWTError as exc:
            errors.append(f"hs256: {exc}")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session" if errors else "Auth is not configured",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    request: Request, settings: Annotated[Settings, Depends(get_settings)]
) -> CurrentUser:
    if settings.auth_disabled:
        return CurrentUser(id="local-dev", email="recruiter@vouch.local", name="Local Recruiter")
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_token(header.removeprefix("Bearer ").strip(), settings)
