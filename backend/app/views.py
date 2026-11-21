"""Response shaping: privacy-by-default. PII is only included when the viewer has consent (or is the owner)."""
from sqlalchemy.orm import Session

from . import audit, consent
from .models import Case, Decision, User


def mask_cnic(c: str | None) -> str | None:
    return None if not c else "*" * max(len(c) - 4, 0) + c[-4:]


def mask_phone(p: str | None) -> str | None:
    return None if not p else "*" * 6 + str(p)[-3:]


def mask_name(n: str | None) -> str | None:
    if not n:
        return n
    parts = n.split()
    return parts[0] + (" " + " ".join(p[0] + "." for p in parts[1:]) if len(parts) > 1 else "")


def mask_form(d: dict | None) -> dict | None:
    if d is None:
        return None
    out = dict(d)
    if "cnic" in out: out["cnic"] = mask_cnic(out["cnic"])
    if "phone" in out and out["phone"]: out["phone"] = mask_phone(out["phone"])
    if "name" in out: out["name"] = mask_name(out["name"])
    if "father_name" in out: out["father_name"] = mask_name(out["father_name"])
    if "dob" in out and out["dob"]: out["dob"] = str(out["dob"])[:4] + "-**-**"
    out.pop("signals", None)
    return out


def case_summary(db: Session, c: Case, viewer: User) -> dict:
    latest = db.query(Decision).filter_by(case_id=c.id).order_by(Decision.created_at.desc()).first()
    brief = (c.handoff_brief or {}).get("headline")
    return {"id": c.id, "type": c.type, "status": c.status, "priority": c.priority, "amount": c.amount,
            "citizen_id": c.citizen_id, "assigned_to": c.assigned_to, "created_at": c.created_at.isoformat(),
            "route": latest.route if latest else None, "p_legit": latest.p_legit if latest else None,
            "headline": brief, "has_decision": bool(latest)}


def case_detail(db: Session, c: Case, viewer: User) -> dict:
    out = case_summary(db, c, viewer)
    out["progress"] = c.progress
    if viewer.id == c.citizen_id:
        out["data"] = {k: v for k, v in (c.data or {}).items() if k != "signals"}
        out["redacted"] = False
    elif viewer.role == "helper":
        if consent.check_access(db, subject_id=c.citizen_id, accessor=viewer, scope="case_history"):
            out["data"] = {k: v for k, v in (c.data or {}).items() if k != "signals"}; out["redacted"] = False
        else:
            out["data"], out["redacted"] = None, True
    elif viewer.role == "officer":
        if consent.check_access(db, subject_id=c.citizen_id, accessor=viewer, scope="identity"):
            out["data"] = {k: v for k, v in (c.data or {}).items() if k != "signals"}; out["redacted"] = False
            audit.log(db, action="data.read", actor=viewer, resource_type="case", resource_id=c.id,
                      details={"subject": c.citizen_id, "scope": "identity"})
        else:
            out["data"], out["redacted"] = None, True
            out["redaction_reason"] = "Citizen has not shared (or has withdrawn) identity data."
            audit.log(db, action="access.denied", actor=viewer, resource_type="case", resource_id=c.id, outcome="denied",
                      details={"subject": c.citizen_id, "scope": "identity"})
        out["handoff_brief"] = c.handoff_brief if not out["redacted"] else {"headline": (c.handoff_brief or {}).get("headline"),
                                                                           "why_unsure": (c.handoff_brief or {}).get("why_unsure")}
    else:  # admin / auditor: masked
        out["data"] = mask_form({k: v for k, v in (c.data or {}).items() if k != "signals"})
        out["redacted"], out["masked"] = False, True
    if viewer.role == "citizen" or viewer.role == "helper":
        out["handoff_brief"] = None
    return out


def decision_view(d: Decision, viewer: User, subject_allowed: bool) -> dict:
    base = {"id": d.id, "case_id": d.case_id, "route": d.route, "confidence": d.confidence, "p_legit": d.p_legit,
            "rule_version": d.rule_version, "model_version": d.model_version, "created_at": d.created_at.isoformat(),
            "final_outcome": d.final_outcome, "reason_user": d.reason_user}
    if viewer.role in ("citizen", "helper"):
        return base  # simple reason only
    trace = d.trace or {}
    if viewer.role == "officer" and subject_allowed:
        base["trace"] = trace
    else:
        base["trace"] = _mask_trace(trace)  # auditors/admins see the full reasoning but not personal identifiers
    return base


def _mask_trace(t: dict) -> dict:
    t = dict(t)
    if isinstance(t.get("input"), dict):
        t["input"] = mask_form(t["input"])
    ident = t.get("identity")
    if isinstance(ident, dict):
        t["identity"] = {**ident, "matched_cnic_masked": ident.get("matched_cnic_masked")}
    return t
