"""Admin-only management: users and roles, API keys, webhooks, background jobs, subscription plan."""
import secrets
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import audit, jobs, webhooks
from ..db import get_db
from ..models import ROLES, ApiKey, Job, Tenant, User, Webhook, WebhookDelivery
from ..security import hash_password, new_api_key, require_roles
from ..views import mask_phone
from .auth import user_out

router = APIRouter(tags=["admin"])


# ================================================================== USERS (admin)
@router.get("/admin/users")
def users(user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    return [user_out(u) | {"is_active": u.is_active, "phone": mask_phone(u.phone)} for u in db.query(User).filter_by(tenant_id=user.tenant_id).order_by(User.role, User.name).limit(300).all()]


class NewUser(BaseModel):
    email: str
    name: str
    role: str
    password: str = Field(min_length=8)


@router.post("/admin/users", status_code=201)
def create_user(body: NewUser, user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if body.role not in ROLES:
        raise HTTPException(422, f"role must be one of {ROLES}")
    if db.query(User).filter_by(email=body.email.lower()).first():
        raise HTTPException(409, "Email exists")
    u = User(tenant_id=user.tenant_id, email=body.email.lower(), name=body.name, role=body.role, password_hash=hash_password(body.password))
    db.add(u); db.commit()
    audit.log(db, action="admin.user_create", actor=user, resource_type="user", resource_id=u.id, details={"role": body.role})
    return user_out(u)


class UserPatch(BaseModel):
    role: str | None = None
    is_active: bool | None = None


@router.patch("/admin/users/{user_id}")
def patch_user(user_id: str, body: UserPatch, user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u or u.tenant_id != user.tenant_id:
        raise HTTPException(404, "User not found")
    if u.id == user.id and (body.is_active is False or (body.role and body.role != "admin")):
        raise HTTPException(409, "You cannot lock yourself out")
    if body.role:
        if body.role not in ROLES:
            raise HTTPException(422, "bad role")
        u.role = body.role
    if body.is_active is not None:
        u.is_active = body.is_active
    db.commit()
    audit.log(db, action="admin.user_update", actor=user, resource_type="user", resource_id=u.id, details=body.model_dump(exclude_none=True))
    return user_out(u)


# ================================================================== API KEYS, WEBHOOKS, PLAN
class KeyIn(BaseModel):
    name: str
    scopes: list[str] = ["public:read", "scam:check", "eligibility:precheck", "policy:ask"]
    rate_limit_per_min: int = 60


@router.post("/admin/api-keys", status_code=201, summary="Create an API key (shown ONCE)")
def make_key(body: KeyIn, user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    raw, prefix, h = new_api_key()
    k = ApiKey(tenant_id=user.tenant_id, name=body.name, prefix=prefix, key_hash=h, scopes=body.scopes, rate_limit_per_min=body.rate_limit_per_min)
    db.add(k); db.commit()
    audit.log(db, action="admin.apikey_create", actor=user, resource_type="api_key", resource_id=k.id, details={"scopes": body.scopes})
    return {"id": k.id, "api_key": raw, "note": "Store it now. Only a hash is kept.", "scopes": k.scopes}


@router.get("/admin/api-keys")
def list_keys(user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    return [{"id": k.id, "name": k.name, "prefix": k.prefix, "scopes": k.scopes, "usage_count": k.usage_count, "active": k.active} for k in db.query(ApiKey).filter_by(tenant_id=user.tenant_id).all()]


@router.delete("/admin/api-keys/{key_id}")
def revoke_key(key_id: str, user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    k = db.get(ApiKey, key_id)
    if not k or k.tenant_id != user.tenant_id:
        raise HTTPException(404, "Not found")
    k.active = False; db.commit()
    audit.log(db, action="admin.apikey_revoke", actor=user, resource_type="api_key", resource_id=k.id)
    return {"revoked": True}


class WebhookIn(BaseModel):
    url: str
    events: list[str] = ["*"]


@router.post("/admin/webhooks", status_code=201)
def make_webhook(body: WebhookIn, user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    if not webhooks.is_public_url(body.url):
        raise HTTPException(422, "url must be a public http(s) address (internal / private addresses are not allowed)")
    w = Webhook(tenant_id=user.tenant_id, url=body.url, events=body.events, secret=secrets.token_hex(16))
    db.add(w); db.commit()
    audit.log(db, action="admin.webhook_create", actor=user, resource_type="webhook", resource_id=w.id)
    return {"id": w.id, "secret": w.secret, "events": w.events, "signature_header": "X-Bharosa-Signature (HMAC-SHA256 of body)"}


@router.get("/admin/webhooks")
def list_webhooks(user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    out = []
    for w in db.query(Webhook).filter_by(tenant_id=user.tenant_id).all():
        dl = db.query(WebhookDelivery).filter_by(webhook_id=w.id).order_by(WebhookDelivery.created_at.desc()).limit(5).all()
        out.append({"id": w.id, "url": w.url, "events": w.events, "active": w.active, "recent": [{"event": d.event, "ok": d.ok, "status": d.status_code} for d in dl]})
    return out


@router.get("/admin/jobs", summary="Background job queue (webhook deliveries, retries)")
def list_jobs(user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    mine = {w.id for w in db.query(Webhook).filter_by(tenant_id=user.tenant_id).all()}
    rows = [j for j in db.query(Job).order_by(Job.created_at.desc()).limit(300).all() if (j.payload or {}).get("webhook_id") in mine][:50]
    return {"counts": dict(Counter(j.status for j in rows)), "recent": [{"id": j.id, "kind": j.kind, "status": j.status, "attempts": j.attempts, "result": j.result} for j in rows[:20]]}


@router.post("/admin/jobs/run-now")
def run_jobs(user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    return {"ran": jobs.drain(db)}


class PlanIn(BaseModel):
    plan: str = Field(pattern="^(free|pro|enterprise)$")


@router.get("/admin/tenant", summary="Subscription plan and usage")
def tenant_info(user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    t = db.get(Tenant, user.tenant_id)
    return {"id": t.id, "slug": t.slug, "name": t.name, "plan": t.plan, "monthly_quota": t.monthly_quota, "usage_this_month": t.usage_this_month,
            "remaining": t.monthly_quota - t.usage_this_month}


@router.put("/admin/tenant/plan")
def change_plan(body: PlanIn, user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    t = db.get(Tenant, user.tenant_id)
    t.plan, t.monthly_quota = body.plan, {"free": 1000, "pro": 10000, "enterprise": 1_000_000}[body.plan]
    db.commit()
    audit.log(db, action="admin.plan_change", actor=user, details={"plan": body.plan})
    return tenant_info(user, db)
