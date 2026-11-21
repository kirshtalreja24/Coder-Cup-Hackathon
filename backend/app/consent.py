"""Consent broker. EVERY read of a citizen's personal data goes through check_access() on the server.
Withdrawal takes effect on the very next request (no caching)."""
import hashlib
import json

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import audit, helper_lock
from .models import Consent, HelperLink, User, now

SCOPES = ("profile", "identity", "documents", "case_history", "payment")
SCOPE_LABELS = {
    "profile": {"en": "Your basic profile", "ur": "آپ کی بنیادی معلومات"},
    "identity": {"en": "Identity check (ID number, name)", "ur": "شناخت کی جانچ"},
    "documents": {"en": "Your uploaded documents", "ur": "آپ کے اپ لوڈ کیے گئے کاغذات"},
    "case_history": {"en": "Your claim history", "ur": "آپ کی درخواستوں کی تاریخ"},
    "payment": {"en": "Sending a payment to you", "ur": "آپ کو رقم بھیجنا"},
}


def _receipt(c: Consent) -> str:
    body = json.dumps([c.id, c.subject_id, c.grantee_type, c.grantee, c.scope, c.purpose, str(c.granted_at)], sort_keys=True)
    return hashlib.sha256(body.encode()).hexdigest()


def grant(db: Session, *, subject: User, actor: User, grantee_type: str, grantee: str, scope: str,
          purpose: str | None = None) -> Consent:
    if scope not in SCOPES:
        raise HTTPException(422, f"Unknown scope '{scope}'. Valid: {list(SCOPES)}")
    if grantee_type not in ("user", "role", "service"):
        raise HTTPException(422, "grantee_type must be user|role|service")
    existing = db.query(Consent).filter_by(subject_id=subject.id, grantee=grantee, scope=scope, status="active").first()
    if existing:
        return existing
    c = Consent(subject_id=subject.id, grantee_type=grantee_type, grantee=grantee, scope=scope, purpose=purpose)
    db.add(c)
    db.flush()
    c.receipt_hash = _receipt(c)
    audit.log(db, action="consent.grant", actor=actor, resource_type="consent", resource_id=c.id,
              details={"subject": subject.id, "grantee": grantee, "grantee_type": grantee_type, "scope": scope,
                       "purpose": purpose, "on_behalf_of_by_helper": actor.id != subject.id, "receipt": c.receipt_hash},
              commit=False)
    db.commit()
    return c


def withdraw(db: Session, *, consent: Consent, actor: User) -> Consent:
    if consent.status == "withdrawn":
        return consent
    consent.status = "withdrawn"
    consent.withdrawn_at = now()
    audit.log(db, action="consent.withdraw", actor=actor, resource_type="consent", resource_id=consent.id,
              details={"subject": consent.subject_id, "grantee": consent.grantee, "scope": consent.scope}, commit=False)
    db.commit()
    return consent


# What each consent a citizen (or, via OTP, a family) gives actually opens. One definition, used by every path.
SCOPE_GRANTS = {
    "identity": [("service", "mock_nadra", "identity"), ("role", "officer", "identity"), ("role", "officer", "profile")],
    "documents": [("role", "officer", "documents"), ("role", "officer", "case_history")],
    "payment": [("service", "mock_raast", "payment")],
}


def grant_scopes(db: Session, *, subject: User, actor: User, scopes: list[str], purpose: str) -> list[Consent]:
    out = []
    for sc in scopes:
        for gt, g, scope in SCOPE_GRANTS.get(sc, []):
            out.append(grant(db, subject=subject, actor=actor, grantee_type=gt, grantee=g, scope=scope, purpose=purpose))
    return out


def _has_consent(db: Session, subject_id: str, accessor: User, scope: str) -> Consent | None:
    subject = db.get(User, subject_id)
    if not subject or subject.tenant_id != accessor.tenant_id:  # consent never crosses departments
        return None
    q = db.query(Consent).filter(Consent.subject_id == subject_id, Consent.status == "active",
                                 Consent.scope.in_([scope, "*"]))
    for c in q.all():
        if c.grantee_type == "user" and c.grantee == accessor.id:
            return c
        if c.grantee_type == "role" and c.grantee == accessor.role:
            return c
    return None


def check_service(db: Session, subject_id: str, service: str, scope: str) -> bool:
    return db.query(Consent).filter(Consent.subject_id == subject_id, Consent.status == "active",
                                    Consent.grantee_type == "service", Consent.grantee == service,
                                    Consent.scope.in_([scope, "*"])).first() is not None


def check_access(db: Session, *, subject_id: str, accessor: User, scope: str,
                 resource_type: str = "person_data", resource_id: str | None = None) -> bool:
    """True if accessor may read subject's data in this scope. Always audited when denied."""
    if accessor.id == subject_id:
        return True
    if accessor.role == "helper":
        linked = db.query(HelperLink).filter_by(helper_id=accessor.id, citizen_id=subject_id).first()
        if linked and _has_consent(db, subject_id, accessor, scope) and helper_lock.is_active(accessor.id, subject_id):
            return True
        return False
    if accessor.role == "officer":
        c = _has_consent(db, subject_id, accessor, scope)
        return c is not None
    return False  # admin/auditor never read personal data directly (auditor sees masked views)


def require_access(db: Session, *, subject_id: str, accessor: User, scope: str,
                   resource_type: str = "person_data", resource_id: str | None = None) -> None:
    if check_access(db, subject_id=subject_id, accessor=accessor, scope=scope):
        return
    audit.log(db, action="access.denied", actor=accessor, resource_type=resource_type, resource_id=resource_id,
              outcome="denied", details={"subject": subject_id, "scope": scope, "reason": "no active consent or not authorised"})
    raise HTTPException(403, f"No active consent for scope '{scope}'. The citizen has not shared this data or has withdrawn it.")
