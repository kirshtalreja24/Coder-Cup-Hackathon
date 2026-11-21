"""Auth: JWT + RBAC + API keys. All checks are SERVER-SIDE (the brief tests with raw curl)."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import ApiKey, User

settings = get_settings()
oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
_ITER = 120_000


def hash_password(pw: str) -> str:
    salt = secrets.token_hex(8)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), _ITER).hex()
    return f"pbkdf2${_ITER}${salt}${dk}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, iters, salt, dk = stored.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), int(iters)).hex()
        return hmac.compare_digest(calc, dk)
    except Exception:
        return False


def create_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    payload = {"sub": user.id, "role": user.role, "tid": user.tenant_id, "exp": exp}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")


def current_user(token: str | None = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    data = _decode(token)
    user = db.get(User, data["sub"])
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User inactive or missing")
    return user


def require_roles(*roles: str):
    """Dependency factory: server-side RBAC. Usage: Depends(require_roles('officer','admin'))."""
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Role '{user.role}' is not allowed here (needs one of {list(roles)})")
        return user
    return dep


# ---- API keys (public REST API) -------------------------------------------------
def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_api_key() -> tuple[str, str, str]:
    raw = "bh_" + secrets.token_urlsafe(24)
    return raw, raw[:10], hash_key(raw)


_buckets: dict[str, list[float]] = {}


def rate_limited(key: str, limit: int, window: float = 60.0) -> bool:
    import time
    t = time.time()
    arr = [x for x in _buckets.get(key, []) if t - x < window]
    if len(arr) >= limit:
        _buckets[key] = arr
        return True
    arr.append(t)
    _buckets[key] = arr
    return False


def api_key_auth(scope: str | None = None):
    def dep(x_api_key: str | None = Header(default=None), db: Session = Depends(get_db)) -> ApiKey:
        if not x_api_key:
            raise HTTPException(401, "Missing X-API-Key header")
        k = db.query(ApiKey).filter(ApiKey.prefix == x_api_key[:10], ApiKey.active == True).first()  # noqa: E712
        if not k or not hmac.compare_digest(k.key_hash, hash_key(x_api_key)):
            raise HTTPException(401, "Invalid API key")
        if scope and scope not in (k.scopes or []):
            raise HTTPException(403, f"API key lacks scope '{scope}'")
        if rate_limited(f"key:{k.id}", k.rate_limit_per_min):
            raise HTTPException(429, "API key rate limit exceeded", headers={"Retry-After": "30"})
        k.usage_count += 1
        db.commit()
        return k
    return dep


def client_ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
