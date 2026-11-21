import hashlib
import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import agent, audit, consent, mock_services as ms, vision
from ..config import get_settings
from ..db import get_db
from ..models import Case, CaseEvent, Decision, Document, HelperLink, IdempotencyRecord, Notification, Tenant, User, now
from ..security import current_user, require_roles
from ..views import case_detail, case_summary, decision_view
from ..webhooks import emit

router = APIRouter(tags=["cases"])
OPEN_FOR_EDIT = ("draft", "needs_consent", "needs_proof", "awaiting_payment_consent", "declined")
MAX_UPLOAD = 5 * 1024 * 1024


# ---------------------------------------------------------------- helpers
def _load(db: Session, case_id: str, user: User) -> Case:
    c = db.get(Case, case_id)
    if not c or c.tenant_id != user.tenant_id or c.is_historical:  # tenant isolation: never reveal other tenants' cases
        raise HTTPException(404, "Case not found")
    if user.role == "citizen" and c.citizen_id != user.id:
        raise HTTPException(404, "Case not found")
    if user.role == "helper" and not db.query(HelperLink).filter_by(helper_id=user.id, citizen_id=c.citizen_id).first():
        raise HTTPException(403, "This family is not linked to you")
    return c


def _owner_check(db: Session, c: Case, user: User):
    """Who may act FOR the citizen: the citizen, or a linked helper who holds that family's consent."""
    if user.id == c.citizen_id:
        return
    if user.role == "helper" and db.query(HelperLink).filter_by(helper_id=user.id, citizen_id=c.citizen_id).first():
        consent.require_access(db, subject_id=c.citizen_id, accessor=user, scope="case_history", resource_type="case", resource_id=c.id)
        return
    raise HTTPException(403, "Only the citizen (or their consented helper) can do this")


def _idem(db: Session, user: User, key: str | None):
    if not key:
        return None
    rec = db.get(IdempotencyRecord, f"{user.id}:{key}"[:80])
    return rec.response if rec else None


def _idem_save(db: Session, user: User, key: str | None, response: dict):
    if key:
        db.merge(IdempotencyRecord(key=f"{user.id}:{key}"[:80], user_id=user.id, response=response))
        db.commit()


def _event(db: Session, case: Case, actor: User | None, kind: str, note: str | None = None):
    db.add(CaseEvent(case_id=case.id, actor_id=actor.id if actor else None, kind=kind, note=note))


# ---------------------------------------------------------------- create / edit
class CaseCreate(BaseModel):
    citizen_id: str | None = None
    type: str = "relief_claim"
    data: dict = Field(default_factory=dict)
    progress: dict = Field(default_factory=dict)


@router.post("/cases", status_code=201, summary="Create a case (citizen, or a helper for a linked family)")
def create_case(body: CaseCreate, user: User = Depends(require_roles("citizen", "helper")), db: Session = Depends(get_db),
                idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    if (prev := _idem(db, user, idempotency_key)):
        return {**prev, "replayed": True}
    if user.role == "citizen":
        cid = user.id
    else:
        if not body.citizen_id or not db.query(HelperLink).filter_by(helper_id=user.id, citizen_id=body.citizen_id).first():
            raise HTTPException(403, "citizen_id must be one of your linked families")
        cid = body.citizen_id
        consent.require_access(db, subject_id=cid, accessor=user, scope="case_history")
    t = db.get(Tenant, user.tenant_id)
    if t.usage_this_month >= t.monthly_quota:  # subscription plan limit
        raise HTTPException(429, f"Plan '{t.plan}' monthly quota ({t.monthly_quota}) reached. Upgrade the plan.")
    t.usage_this_month += 1
    c = Case(tenant_id=user.tenant_id, type=body.type, citizen_id=cid, created_by=user.id, status="draft", data=body.data, progress=body.progress)
    db.add(c); db.flush()
    _event(db, c, user, "created")
    db.commit()
    audit.log(db, action="case.create", actor=user, resource_type="case", resource_id=c.id, details={"for": cid, "by_helper": user.role == "helper"})
    out = case_summary(db, c, user)
    _idem_save(db, user, idempotency_key, out)
    return out


class CasePatch(BaseModel):
    data: dict | None = None
    progress: dict | None = None


@router.patch("/cases/{case_id}", summary="Save form data / progress (works as an offline-sync target)")
def patch_case(case_id: str, body: CasePatch, user: User = Depends(require_roles("citizen", "helper")), db: Session = Depends(get_db)):
    c = _load(db, case_id, user); _owner_check(db, c, user)
    if c.status not in OPEN_FOR_EDIT:
        raise HTTPException(409, f"Case in status '{c.status}' can no longer be edited")
    if body.data is not None:
        c.data = {**(c.data or {}), **{k: v for k, v in body.data.items() if k != "signals"}}
    if body.progress is not None:
        c.progress = {**(c.progress or {}), **body.progress}
    db.commit()
    audit.log(db, action="case.update", actor=user, resource_type="case", resource_id=c.id, details={"fields": list((body.data or {}).keys())})
    return case_summary(db, c, user)


# ---------------------------------------------------------------- documents
@router.post("/cases/{case_id}/documents", status_code=201, summary="Upload an ID photo; it is analysed (blur / QR / edit detection)")
async def upload_document(case_id: str, file: UploadFile = File(...), kind: str = "cnic_front",
                          user: User = Depends(require_roles("citizen", "helper")), db: Session = Depends(get_db)):
    c = _load(db, case_id, user); _owner_check(db, c, user)
    raw = await file.read(MAX_UPLOAD + 1)
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(413, "File too large (max 5 MB). Try a smaller photo.")
    if not raw:
        raise HTTPException(422, "Empty file")
    analysis = vision.analyze_document(raw, claimed=c.data or {})
    sha = hashlib.sha256(raw).hexdigest()
    d = Document(case_id=c.id, owner_id=c.citizen_id, kind=kind[:30], filename=os.path.basename(file.filename or "upload")[:150], path="", sha256=sha, analysis=analysis)
    db.add(d); db.flush()
    folder = Path(get_settings().upload_dir); folder.mkdir(parents=True, exist_ok=True)
    p = folder / f"{d.id}.bin"
    p.write_bytes(raw)
    d.path = str(p)
    _event(db, c, user, "document.uploaded", f"{d.kind}: authenticity {analysis.get('authenticity')} flag {analysis.get('flag')}")
    db.commit()
    audit.log(db, action="document.upload", actor=user, resource_type="document", resource_id=d.id,
              details={"case": c.id, "sha256": sha[:16], "flag": analysis.get("flag"), "authenticity": analysis.get("authenticity")})
    audit.log(db, action="ai.document_analysis", actor_type="ai", actor_id="vision-1.0", tenant_id=c.tenant_id, resource_type="document", resource_id=d.id,
              details={"flags": analysis.get("flags"), "authenticity": analysis.get("authenticity")})
    return {"document_id": d.id, "analysis": analysis,
            "message": {"en": "Photo received." + (" It looks blurry, please retake it." if analysis.get("flag") == "blurry" else ""),
                        "ur": "تصویر مل گئی۔" + (" تصویر دھندلی ہے، دوبارہ لیں۔" if analysis.get("flag") == "blurry" else "")}}


@router.get("/cases/{case_id}/documents")
def list_documents(case_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = _load(db, case_id, user)
    if user.id != c.citizen_id:
        consent.require_access(db, subject_id=c.citizen_id, accessor=user, scope="documents", resource_type="case", resource_id=c.id)
        audit.log(db, action="data.read", actor=user, resource_type="documents", resource_id=c.id, details={"subject": c.citizen_id, "scope": "documents"})
    docs = db.query(Document).filter_by(case_id=c.id, deleted=False).all()
    return [{"id": d.id, "kind": d.kind, "filename": d.filename, "sha256": d.sha256[:16], "analysis": d.analysis, "created_at": d.created_at.isoformat()} for d in docs]


@router.get("/documents/{doc_id}/file")
def get_document_file(doc_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = db.get(Document, doc_id)
    if not d or d.deleted:
        raise HTTPException(404, "Document not found")
    if user.id != d.owner_id:
        consent.require_access(db, subject_id=d.owner_id, accessor=user, scope="documents", resource_type="document", resource_id=d.id)
        audit.log(db, action="data.read", actor=user, resource_type="document", resource_id=d.id, details={"subject": d.owner_id, "scope": "documents"})
    return FileResponse(d.path, media_type="image/jpeg", filename=d.filename)


@router.delete("/documents/{doc_id}", summary="Take back: permanently delete your uploaded document")
def delete_document(doc_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    d = db.get(Document, doc_id)
    if not d or d.deleted or d.owner_id != user.id:
        raise HTTPException(404, "Document not found")
    try:
        os.remove(d.path)
    except OSError:
        pass
    d.deleted, d.path = True, ""
    db.commit()
    audit.log(db, action="document.delete", actor=user, resource_type="document", resource_id=d.id, details={"sha256": d.sha256[:16]})
    return {"deleted": True}


# ---------------------------------------------------------------- submit -> agent
class SubmitIn(BaseModel):
    consent: dict | None = Field(default=None, description="e.g. {identity:true, payment:true, documents:true}. Absent = nothing granted.")


@router.post("/cases/{case_id}/submit", summary="Run the claim agent: identity -> documents -> rules -> decision -> action")
def submit_case(case_id: str, body: SubmitIn | None = None, user: User = Depends(require_roles("citizen", "helper")),
                db: Session = Depends(get_db), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    if (prev := _idem(db, user, idempotency_key)):
        return {**prev, "replayed": True}
    c = _load(db, case_id, user); _owner_check(db, c, user)
    if c.status not in OPEN_FOR_EDIT:
        raise HTTPException(409, f"Case is '{c.status}'; it cannot be submitted again")
    result = agent.run_claim(db, c, user, consent_flags=(body.consent if body else None))
    out = {"case": case_summary(db, c, user), "route": result["route"], "reason_user": result.get("reason_user"),
           "steps": [{"tool": s["tool"], "summary": s["summary"], "outcome": s["outcome"]} for s in result["steps"]],
           "payment": result.get("payment"), "decision_id": result.get("decision_id")}
    _idem_save(db, user, idempotency_key, out)
    return out


@router.post("/cases/{case_id}/appeal", summary="Ask a person to re-check an automatic decision (always allowed)")
def appeal(case_id: str, note: str = "", user: User = Depends(require_roles("citizen", "helper")), db: Session = Depends(get_db)):
    c = _load(db, case_id, user); _owner_check(db, c, user)
    if c.status not in ("declined", "needs_proof", "rejected"):
        raise HTTPException(409, "Only declined/rejected/waiting cases can be appealed")
    c.status, c.priority = "awaiting_human", min(c.priority, 2)
    c.handoff_brief = {**(c.handoff_brief or {}), "headline": "Citizen appealed an automatic decision", "why_unsure": "Appeal requested by the citizen.", "citizen_note": note[:500]}
    _event(db, c, user, "appeal", note[:500])
    db.commit()
    audit.log(db, action="case.appeal", actor=user, resource_type="case", resource_id=c.id)
    return case_summary(db, c, user)


# ---------------------------------------------------------------- reading
@router.get("/cases", summary="List cases visible to you (role-scoped, tenant-scoped)")
def list_cases(status: str | None = None, limit: int = Query(50, le=200), user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(Case).filter(Case.tenant_id == user.tenant_id, Case.is_historical == False)  # noqa: E712
    if user.role == "citizen":
        q = q.filter(Case.citizen_id == user.id)
    elif user.role == "helper":
        ids = [l.citizen_id for l in db.query(HelperLink).filter_by(helper_id=user.id).all()]
        q = q.filter(Case.citizen_id.in_(ids or ["-"]))
    if status:
        q = q.filter(Case.status == status)
    return [case_summary(db, c, user) for c in q.order_by(Case.created_at.desc()).limit(limit).all()]


@router.get("/cases/{case_id}", summary="Case detail. Personal data is REDACTED unless the citizen consented.")
def get_case(case_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return case_detail(db, _load(db, case_id, user), user)


@router.get("/cases/{case_id}/timeline")
def timeline(case_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = _load(db, case_id, user)
    ev = db.query(CaseEvent).filter_by(case_id=c.id).order_by(CaseEvent.created_at.asc()).all()
    ds = db.query(Decision).filter_by(case_id=c.id).order_by(Decision.created_at.asc()).all()
    return {"events": [{"kind": e.kind, "note": e.note, "at": e.created_at.isoformat(), "actor": e.actor_id} for e in ev],
            "decisions": [{"id": d.id, "route": d.route, "p_legit": d.p_legit, "rule_version": d.rule_version, "at": d.created_at.isoformat()} for d in ds]}


@router.get("/cases/{case_id}/decision", summary="Latest decision: simple reason for citizens, full trace for officers/auditors")
def latest_decision(case_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = _load(db, case_id, user)
    d = db.query(Decision).filter_by(case_id=c.id).order_by(Decision.created_at.desc()).first()
    if not d:
        raise HTTPException(404, "No decision yet")
    allowed = user.role == "officer" and consent.check_access(db, subject_id=c.citizen_id, accessor=user, scope="identity")
    if user.role == "officer" and allowed:
        audit.log(db, action="data.read", actor=user, resource_type="decision", resource_id=d.id, details={"subject": c.citizen_id, "scope": "identity"})
    return decision_view(d, user, allowed)


# ---------------------------------------------------------------- case management (staff)
@router.get("/queue", summary="Officer review queue sorted by priority and confidence")
def queue(sort: str = "priority", include_waiting: bool = False, limit: int = Query(50, le=200),
          user: User = Depends(require_roles("officer", "admin")), db: Session = Depends(get_db)):
    statuses = ["awaiting_human", "escalated"] + (["needs_proof"] if include_waiting else [])
    cases = db.query(Case).filter(Case.tenant_id == user.tenant_id, Case.is_historical == False, Case.status.in_(statuses)).all()  # noqa: E712
    rows = [case_summary(db, c, user) for c in cases]
    keyf = {"priority": lambda r: (r["priority"], r["p_legit"] if r["p_legit"] is not None else 1, r["created_at"]),
            "confidence": lambda r: (r["p_legit"] if r["p_legit"] is not None else 1, r["priority"]),
            "age": lambda r: r["created_at"]}.get(sort, lambda r: (r["priority"],))
    rows.sort(key=keyf)
    return {"sort": sort, "count": len(rows), "items": rows[:limit]}


class AssignIn(BaseModel):
    officer_id: str | None = None


@router.post("/cases/{case_id}/assign")
def assign(case_id: str, body: AssignIn | None = None, user: User = Depends(require_roles("officer", "admin")), db: Session = Depends(get_db)):
    c = _load(db, case_id, user)
    target = (body.officer_id if body and body.officer_id else user.id)
    if user.role == "officer" and target != user.id:
        raise HTTPException(403, "Officers can only assign cases to themselves; ask an admin to assign others")
    t = db.get(User, target)
    if not t or t.tenant_id != user.tenant_id or t.role not in ("officer", "admin"):
        raise HTTPException(422, "Assignee must be an officer in your department")
    c.assigned_to = target
    _event(db, c, user, "assigned", f"to {t.name}")
    db.commit()
    audit.log(db, action="case.assign", actor=user, resource_type="case", resource_id=c.id, details={"to": target})
    return case_summary(db, c, user)


class EscalateIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


@router.post("/cases/{case_id}/escalate")
def escalate(case_id: str, body: EscalateIn, user: User = Depends(require_roles("officer", "admin")), db: Session = Depends(get_db)):
    c = _load(db, case_id, user)
    c.status, c.priority, c.assigned_to = "escalated", 1, None
    _event(db, c, user, "escalated", body.reason)
    for a in db.query(User).filter_by(tenant_id=c.tenant_id, role="admin").all():
        db.add(Notification(user_id=a.id, channel="in_app", body=f"Case {c.id[:8]} escalated: {body.reason}"))
    db.commit()
    audit.log(db, action="case.escalate", actor=user, resource_type="case", resource_id=c.id, details={"reason": body.reason})
    emit(db, c.tenant_id, "case.escalated", {"case_id": c.id})
    return case_summary(db, c, user)


class ReviewIn(BaseModel):
    action: str = Field(pattern="^(approve|reject|request_proof)$")
    note: str = Field(default="", max_length=1000)


@router.post("/cases/{case_id}/review", summary="Officer approves / rejects / requests proof. Needs the citizen's consent.")
def review(case_id: str, body: ReviewIn, user: User = Depends(require_roles("officer", "admin")), db: Session = Depends(get_db)):
    c = _load(db, case_id, user)
    if c.status not in ("awaiting_human", "escalated", "needs_proof", "declined", "in_review"):
        raise HTTPException(409, f"Case is '{c.status}'; nothing to review")
    if user.role == "admin":
        raise HTTPException(403, "Admins manage the system; decisions on claims are made by officers")
    consent.require_access(db, subject_id=c.citizen_id, accessor=user, scope="identity", resource_type="case", resource_id=c.id)
    if body.action in ("reject", "request_proof") and len(body.note.strip()) < 3:
        raise HTTPException(422, "A note is required so the citizen can be told why")
    d = db.query(Decision).filter_by(case_id=c.id).order_by(Decision.created_at.desc()).first()
    overrides_ai = bool(d and ((body.action == "approve" and d.route in ("DECLINE_WITH_APPEAL",)) or (body.action == "reject" and d.route == "AUTO_APPROVE")))
    msg = None
    if body.action == "approve":
        if not consent.check_service(db, c.citizen_id, "mock_raast", "payment"):
            c.status = "awaiting_payment_consent"
            msg = "Approved by officer; waiting for the citizen's consent to send payment."
        else:
            cn = (c.data or {}).get("cnic") or "0"
            pay = ms.raast_pay(db, case_id=c.id, cnic=''.join(ch for ch in cn if ch.isdigit()), amount=c.amount or 0)
            c.status, c.closed_at = "paid", now()
            msg = f"Approved by officer. PKR {c.amount:,} sent via MOCK Raast. Ref {pay.reference}."
    elif body.action == "reject":
        c.status, c.closed_at = "rejected", now()
        msg = f"Rejected by officer: {body.note}"
    else:
        c.status = "needs_proof"
        msg = f"Officer needs more proof: {body.note}"
    if d:
        d.final_outcome = {"approve": "approved_human", "reject": "rejected_human", "request_proof": "proof_requested"}[body.action]
    _event(db, c, user, f"review.{body.action}", body.note)
    db.add(Notification(user_id=c.citizen_id, channel="in_app", body=msg))
    db.add(Notification(user_id=c.citizen_id, channel="sms", body="[MOCK SMS] " + msg))
    db.commit()
    audit.log(db, action=f"officer.{body.action}", actor=user, resource_type="case", resource_id=c.id,
              details={"note": body.note, "ai_route": d.route if d else None, "human_overrides_ai": overrides_ai})
    emit(db, c.tenant_id, f"case.{body.action}", {"case_id": c.id, "status": c.status})
    return case_summary(db, c, user)


@router.post("/cases/{case_id}/close")
def close(case_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = _load(db, case_id, user)
    if user.role not in ("citizen", "helper", "officer", "admin"):
        raise HTTPException(403, "Not allowed")
    if user.role in ("citizen", "helper"):
        _owner_check(db, c, user)
    c.status, c.closed_at = "closed", now()
    _event(db, c, user, "closed")
    db.commit()
    audit.log(db, action="case.close", actor=user, resource_type="case", resource_id=c.id)
    return case_summary(db, c, user)
