from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import audit
from ..db import get_db
from ..models import Tenant, User
from ..security import (clear_failures, client_ip, create_token, current_user, hash_password, rate_limited, record_failure,
                        too_many_failures, verify_password)
from ..views import mask_cnic

router = APIRouter(tags=["auth"])


def user_out(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "role": u.role, "tenant_id": u.tenant_id, "locale": u.locale,
            "cnic_masked": mask_cnic(u.cnic), "phone": u.phone}


@router.post("/auth/login", summary="Login (OAuth2 password form) -> JWT")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Only FAILED attempts are limited (a shared network of judges or a busy helper phone must not lock each other out),
    # per address (guessing across accounts) and per account (guessing one password).
    ip_key, acct_key = f"loginfail:ip:{client_ip(request)}", f"loginfail:acct:{form.username.strip().lower()[:100]}"
    if too_many_failures(ip_key, 60) or too_many_failures(acct_key, 8):
        raise HTTPException(429, "Too many failed login attempts. Wait a few minutes.", headers={"Retry-After": "120"})
    u = db.query(User).filter(User.email == form.username.strip().lower()).first()
    if not u or not u.is_active or not verify_password(form.password, u.password_hash):
        record_failure(ip_key)
        record_failure(acct_key)
        audit.log(db, action="auth.login_failed", actor_type="system", details={"email": form.username[:60]}, outcome="denied")
        raise HTTPException(401, "Wrong email or password")
    clear_failures(acct_key)
    audit.log(db, action="auth.login", actor=u)
    return {"access_token": create_token(u), "token_type": "bearer", "user": user_out(u)}


class RegisterIn(BaseModel):
    tenant_slug: str = "relief"
    email: str = Field(min_length=5, max_length=160)
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=100)
    cnic: str | None = None
    phone: str | None = None
    locale: str = "ur"


@router.post("/auth/register", status_code=201, summary="Citizen self-registration (role is always 'citizen')")
def register(body: RegisterIn, db: Session = Depends(get_db)):
    t = db.query(Tenant).filter_by(slug=body.tenant_slug).first()
    if not t:
        raise HTTPException(404, "Unknown department")
    if db.query(User).filter_by(email=body.email.strip().lower()).first():
        raise HTTPException(409, "Email already registered")
    u = User(tenant_id=t.id, email=body.email.strip().lower(), name=body.name.strip(), role="citizen",
             password_hash=hash_password(body.password), cnic=body.cnic, phone=body.phone, locale=body.locale)
    db.add(u); db.commit()
    audit.log(db, action="auth.register", actor=u)
    return {"access_token": create_token(u), "token_type": "bearer", "user": user_out(u)}


@router.get("/auth/me")
def me(u: User = Depends(current_user)):
    return user_out(u)


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    phone: str | None = None
    cnic: str | None = None
    locale: str | None = None


@router.patch("/auth/me/profile", summary="Correct your own data (consent management: 'correct')")
def correct_profile(body: ProfileIn, u: User = Depends(current_user), db: Session = Depends(get_db)):
    changes = {}
    for k, v in body.model_dump(exclude_none=True).items():
        if getattr(u, k) != v:
            changes[k] = {"from": getattr(u, k) if k not in ("cnic",) else mask_cnic(getattr(u, k)), "to": v if k != "cnic" else mask_cnic(v)}
            setattr(u, k, v)
    db.commit()
    audit.log(db, action="profile.correct", actor=u, resource_type="user", resource_id=u.id, details={"fields": list(changes)})
    return user_out(u)
