import random
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import audit, consent as cs, helper_lock
from ..db import get_db
from ..config import get_settings
from ..models import AuditEvent, Consent, HelperLink, IdempotencyRecord, User, now
from ..notify import notify
from ..security import require_roles

router = APIRouter(tags=["consent"])


def _subject(db: Session, user: User, subject_id: str | None) -> User:
    if not subject_id or subject_id == user.id:
        if user.role not in ("citizen",) and not subject_id:
            raise HTTPException(422, "subject_id required")
        return user
    if user.role == "helper" and db.query(HelperLink).filter_by(helper_id=user.id, citizen_id=subject_id).first():
        helper_lock.require_active(user.id, subject_id)
        return db.get(User, subject_id)
    raise HTTPException(403, "You cannot manage this person's consent")


def _c(c: Consent) -> dict:
    return {"id": c.id, "grantee_type": c.grantee_type, "grantee": c.grantee, "scope": c.scope, "status": c.status, "purpose": c.purpose,
            "granted_at": c.granted_at.isoformat(), "withdrawn_at": c.withdrawn_at.isoformat() if c.withdrawn_at else None,
            "receipt": c.receipt_hash, "label": cs.SCOPE_LABELS.get(c.scope)}


@router.get("/consents", summary="See who has your data (all grants, active and withdrawn)")
def list_consents(subject_id: str | None = None, user: User = Depends(require_roles("citizen", "helper")), db: Session = Depends(get_db)):
    s = _subject(db, user, subject_id)
    rows = db.query(Consent).filter_by(subject_id=s.id).order_by(Consent.granted_at.desc()).all()
    active = [_c(c) for c in rows if c.status == "active"]
    return {"subject_id": s.id, "active": active, "withdrawn": [_c(c) for c in rows if c.status != "active"], "active_count": len(active)}


class GrantIn(BaseModel):
    subject_id: str | None = None
    grantee_type: str
    grantee: str
    scope: str
    purpose: str | None = None


@router.post("/consents", status_code=201, summary="Share a specific kind of data with a specific party")
def grant(body: GrantIn, user: User = Depends(require_roles("citizen", "helper")), db: Session = Depends(get_db)):
    s = _subject(db, user, body.subject_id)
    if user.role == "helper" and not (body.grantee_type == "user" and body.grantee == user.id):
        raise HTTPException(403, "Helpers can only record consent given to themselves; other grants must be made by the citizen")
    if user.role == "helper":
        raise HTTPException(403, "Use the OTP flow: /helper/families/{id}/consent/request then /confirm")
    return _c(cs.grant(db, subject=s, actor=user, grantee_type=body.grantee_type, grantee=body.grantee, scope=body.scope, purpose=body.purpose))


@router.post("/consents/{consent_id}/withdraw", summary="Take back: stops access on the very next request")
def withdraw(consent_id: str, user: User = Depends(require_roles("citizen", "helper")), db: Session = Depends(get_db)):
    c = db.get(Consent, consent_id)
    if not c:
        raise HTTPException(404, "Consent not found")
    _subject(db, user, c.subject_id)
    return _c(cs.withdraw(db, consent=c, actor=user))


@router.post("/consents/withdraw-all", summary="Panic button: withdraw every active consent at once")
def withdraw_all(subject_id: str | None = None, user: User = Depends(require_roles("citizen", "helper")), db: Session = Depends(get_db)):
    s = _subject(db, user, subject_id)
    n = 0
    for c in db.query(Consent).filter_by(subject_id=s.id, status="active").all():
        cs.withdraw(db, consent=c, actor=user); n += 1
    audit.log(db, action="consent.withdraw_all", actor=user, details={"subject": s.id, "count": n})
    return {"withdrawn": n}


@router.get("/consents/access-log", summary="Who looked at my data, and who was blocked")
def access_log(subject_id: str | None = None, limit: int = 50, user: User = Depends(require_roles("citizen", "helper")), db: Session = Depends(get_db)):
    s = _subject(db, user, subject_id)
    evs = db.query(AuditEvent).filter(AuditEvent.tenant_id == s.tenant_id,
                                      AuditEvent.action.in_(["data.read", "access.denied", "consent.grant", "consent.withdraw", "consent.withdraw_all"])
                                      ).order_by(AuditEvent.seq.desc()).limit(2000).all()
    out = []
    for e in evs:
        if (e.details or {}).get("subject") == s.id:
            who = db.get(User, e.actor_id) if e.actor_id else None
            out.append({"seq": e.seq, "at": e.ts.isoformat(), "action": e.action, "outcome": e.outcome, "by": f"{who.name} ({who.role})" if who else e.actor_type,
                        "scope": (e.details or {}).get("scope")})
        if len(out) >= limit:
            break
    return out


# ---------------------------------------------------------------- Helper Mode (one shared phone, many families)
helper_router = APIRouter(prefix="/helper", tags=["helper-mode"])
MAX_OTP_ATTEMPTS = 5
ALLOWED_SCOPES = ("identity", "documents", "payment")


def _linked(db: Session, helper: User, citizen_id: str) -> User:
    if not db.query(HelperLink).filter_by(helper_id=helper.id, citizen_id=citizen_id).first():
        raise HTTPException(403, "Family not linked to you")
    return db.get(User, citizen_id)


@helper_router.get("/families", summary="All families linked to this helper, with per-family consent status")
def families(user: User = Depends(require_roles("helper")), db: Session = Depends(get_db)):
    out = []
    for l in db.query(HelperLink).filter_by(helper_id=user.id).all():
        f = db.get(User, l.citizen_id)
        has = db.query(Consent).filter_by(subject_id=f.id, grantee_type="user", grantee=user.id, status="active", scope="case_history").first()
        out.append({"citizen_id": f.id, "name": f.name, "helper_consent_active": bool(has)})
    return {"count": len(out), "families": out, "note": "Each family has its own, separate consent."}


@helper_router.post("/switch/{citizen_id}", summary="Switch the shared phone to another family. The previous family is locked; the session auto-locks after 60 s.")
def switch(citizen_id: str, user: User = Depends(require_roles("helper")), db: Session = Depends(get_db)):
    f = _linked(db, user, citizen_id)
    helper_lock.activate(user.id, citizen_id)
    audit.log(db, action="helper.switch", actor=user, resource_type="user", resource_id=citizen_id, details={"subject": citizen_id})
    has = bool(db.query(Consent).filter_by(subject_id=f.id, grantee_type="user", grantee=user.id, status="active", scope="case_history").first())
    return {"active_family": {"id": f.id, "name": f.name}, "consent_active": has, "auto_lock_seconds": helper_lock.LOCK_SECONDS,
            "next": "ready" if has else "request consent first"}


@helper_router.post("/lock", summary="Lock the shared phone now")
def lock(user: User = Depends(require_roles("helper")), db: Session = Depends(get_db)):
    helper_lock.deactivate(user.id)
    audit.log(db, action="helper.lock", actor=user)
    return {"locked": True}


class OtpRequest(BaseModel):
    scopes: list[str] = ["identity", "documents", "payment"]


@helper_router.post("/families/{citizen_id}/consent/request",
                    summary="Send a one-time code to the FAMILY's phone. Only someone holding the code can grant consent.")
def req_otp(citizen_id: str, body: OtpRequest | None = None, user: User = Depends(require_roles("helper")), db: Session = Depends(get_db)):
    _linked(db, user, citizen_id)
    helper_lock.require_active(user.id, citizen_id)
    scopes = [x for x in (body.scopes if body else list(ALLOWED_SCOPES)) if x in ALLOWED_SCOPES]
    code = f"{random.randint(0, 999999):06d}"
    db.merge(IdempotencyRecord(key=f"otp:{user.id}:{citizen_id}"[:80], user_id=user.id,
                               response={"code": code, "exp": (now() + timedelta(minutes=10)).isoformat(), "scopes": scopes, "attempts": 0}))
    notify(db, citizen_id, f"Code {code}: allow helper {user.name} to help you with {', '.join(scopes)}. Do not share this code unless you agree.",
           short=f"Code {code}: allow helper {user.name}? Share only if you agree.", channels=("in_app", "sms"))
    db.commit()
    audit.log(db, action="helper.consent_otp_sent", actor=user, resource_type="user", resource_id=citizen_id, details={"subject": citizen_id, "scopes": scopes})
    show = get_settings().demo_show_otp
    return {"sent": True, "scopes": scopes, "delivered_to": "the family's phone / their in-app inbox (simulated SMS)",
            "mock_code_for_demo": code if show else None,
            "note": "The code is NOT returned to the helper. Ask the family member to read it out (demo: log in as that family and open the inbox)."}


class OtpIn(BaseModel):
    code: str


@helper_router.post("/families/{citizen_id}/consent/confirm", status_code=201)
def confirm_otp(citizen_id: str, body: OtpIn, user: User = Depends(require_roles("helper")), db: Session = Depends(get_db)):
    f = _linked(db, user, citizen_id)
    helper_lock.require_active(user.id, citizen_id)
    key = f"otp:{user.id}:{citizen_id}"[:80]
    rec = db.get(IdempotencyRecord, key)
    exp_ok = rec and rec.response.get("exp", "") > now().isoformat()
    if not rec or not exp_ok or rec.response.get("attempts", 0) >= MAX_OTP_ATTEMPTS:
        audit.log(db, action="helper.consent_otp_failed", actor=user, outcome="denied", details={"subject": citizen_id, "reason": "no valid code"})
        raise HTTPException(403, "No valid code. Request a new one. No consent recorded.")
    if rec.response.get("code") != body.code.strip():
        rec.response = {**rec.response, "attempts": rec.response.get("attempts", 0) + 1}
        db.commit()
        audit.log(db, action="helper.consent_otp_failed", actor=user, outcome="denied", details={"subject": citizen_id, "reason": "wrong code"})
        raise HTTPException(403, "Wrong code. No consent recorded.")
    granted = [_c(cs.grant(db, subject=f, actor=user, grantee_type="user", grantee=user.id, scope=sc, purpose="helper assistance (code confirmed by the family)"))
               for sc in ("profile", "case_history")]
    granted += [_c(c) for c in cs.grant_scopes(db, subject=f, actor=user, scopes=rec.response["scopes"], purpose="relief claim (code confirmed by the family)")]
    db.delete(rec)
    db.commit()
    audit.log(db, action="helper.consent_confirmed", actor=user, resource_type="user", resource_id=citizen_id,
              details={"subject": citizen_id, "scopes": rec.response["scopes"], "method": "one-time code"})
    return {"granted": granted}
