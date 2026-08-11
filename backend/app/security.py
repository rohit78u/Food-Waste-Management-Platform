"""Supabase-backed authentication and role checks for protected API routes."""

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


def _supabase_request(path: str, token: str) -> object:
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise HTTPException(status_code=500, detail="Supabase authentication is not configured")

    request = Request(
        f"{settings.supabase_url.rstrip('/')}{path}",
        headers={
            "apikey": settings.supabase_publishable_key,
            "Authorization": f"Bearer {token}",
        },
    )
    try:
        with urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user = _supabase_request("/auth/v1/user", credentials.credentials)
    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")
    return user


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    user: dict = Depends(get_current_user),
) -> dict:
    assert credentials is not None
    roles = _supabase_request(
        f"/rest/v1/user_roles?select=role&user_id=eq.{user['id']}&role=eq.admin",
        credentials.credentials,
    )
    if not isinstance(roles, list) or not roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return user
