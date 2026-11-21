import random
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import audit, consent as cs
from ..db import get_db
from ..models import AuditEvent, Consent, HelperLink, IdempotencyRecord, Notification, User, now
from ..security import current_user, require_roles

router = APIRouter(tags=["consent"])


def _subject(db: Session, user: User, subject_id: str | None) -> User:
    if not subject_id or subject_id == user.id:
        if user.role not in ("citizen",) and not subject_id:
            raise HTTPException(422, "subject_id required")
        return user
    if user.role == "helper" and db.query(HelperLink).filter_by(helper_id=user.id, citizen_id=subject_id).first():
        s = db.get(User, subject_id)
        return s
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
    s = _subject(db, user, c.subject_id)
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


@helper_router.get("/families", summary="All families linked to this helper, with per-family consent status")
def families(user: User = Depends(require_roles("helper")), db: Session = Depends(get_db)):
    out = []
    for l in db.query(HelperLink).filter_by(helper_id=user.id).all():
        f = db.get(User, l.citizen_id)
        has = db.query(Consent).filter_by(subject_id=f.id, grantee_type="user", grantee=user.id, status="active", scope="case_history").first()
        out.append({"citizen_id": f.id, "name": f.name, "helper_consent_active": bool(has)})
    return {"count": len(out), "families": out, "note": "Each family has its own, separate consent."}


@helper_router.post("/switch/{citizen_id}", summary="Switch the shared phone to another family (audited; previous family is locked)")
def switch(citizen_id: str, user: User = Depends(require_roles("helper")), db: Session = Depends(get_db)):
    if not db.query(HelperLink).filter_by(helper_id=user.id, citizen_id=citizen_id).first():
        raise HTTPException(403, "Family not linked to you")
    f = db.get(User, citizen_id)
    audit.log(db, action="helper.switch", actor=user, resource_type="user", resource_id=citizen_id, details={"subject": citizen_id})
    has = bool(db.query(Consent).filter_by(subject_id=f.id, grantee_type="user", grantee=user.id, status="active", scope="case_history").first())
    return {"active_family": {"id": f.id, "name": f.name}, "consent_active": has, "auto_lock_seconds": 60,
            "next": "ready" if has else "request consent first"}


@helper_router.post("/families/{citizen_id}/consent/request", summary="Send a MOCK one-time code to the family's phone")
def req_otp(citizen_id: str, user: User = Depends(require_roles("helper")), db: Session = Depends(get_db)):
    if not db.query(HelperLink).filter_by(helper_id=user.id, citizen_id=citizen_id).first():
        raise HTTPException(403, "Family not linked to you")
    code = f"{random.randint(0, 999999):06d}"
    db.merge(IdempotencyRecord(key=f"otp:{user.id}:{citizen_id}"[:80], user_id=user.id, response={"code": code, "exp": (now() + timedelta(minutes=10)).isoformat()}))
    db.add(Notification(user_id=citizen_id, channel="sms", body=f"[MOCK SMS] Code {code}: allow helper {user.name} to help you. Do not share unless you agree."))
    db.commit()
    audit.log(db, action="helper.consent_otp_sent", actor=user, resource_type="user", resource_id=citizen_id, details={"subject": citizen_id})
    return {"sent": True, "mock": True, "mock_code_for_demo": code, "note": "In production the code goes only to the family's phone."}


class OtpIn(BaseModel):
    code: str


@helper_router.post("/families/{citizen_id}/consent/confirm", status_code=201)
def confirm_otp(citizen_id: str, body: OtpIn, user: User = Depends(require_roles("helper")), db: Session = Depends(get_db)):
    rec = db.get(IdempotencyRecord, f"otp:{user.id}:{citizen_id}"[:80])
    if not rec or rec.response.get("code") != body.code.strip():
        audit.log(db, action="helper.consent_otp_failed", actor=user, outcome="denied", details={"subject": citizen_id})
        raise HTTPException(403, "Wrong or expired code. No consent recorded.")
    f = db.get(User, citizen_id)
    out = []
    for scope in ("profile", "case_history"):
        out.append(_c(cs.grant(db, subject=f, actor=user, grantee_type="user", grantee=user.id, scope=scope, purpose="helper assistance (OTP confirmed)")))
    db.delete(rec); db.commit()
    return {"granted": out}
