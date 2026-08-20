"""JWT bearer authentication and role-based authorization.

Supabase issues the JWTs used by the frontend. The API validates each bearer
access token through Supabase's /auth/v1/user endpoint and mirrors the user
identity into the local SQLAlchemy database for relational ownership checks.
"""

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

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
    db: Session = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    auth_user = _supabase_request("/auth/v1/user", credentials.credentials)
    if not isinstance(auth_user, dict) or not auth_user.get("id"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    user_id = str(auth_user["id"])
    email = str(auth_user.get("email") or f"{user_id}@unknown.local")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id, email=email, role="user")
        db.add(user)
        db.commit()
        db.refresh(user)
    elif user.email != email:
        user.email = email
        db.commit()

    return user


def require_roles(*allowed_roles: str):
    allowed = {role.lower() for role in allowed_roles}

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role.lower() not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(sorted(allowed))}",
            )
        return user

    return dependency


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role.lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return user


def require_collector(user: User = Depends(get_current_user)) -> User:
    if user.role.lower() not in {"collector", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Collector access required")
    return user
