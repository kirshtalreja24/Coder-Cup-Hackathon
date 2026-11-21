"""Admin / officer / auditor endpoints: rules, Digital Twin, Risk Dial, users, API keys, webhooks, tenants, audit, analytics."""
import csv
import io
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import audit, decision as dec, rules, twin
from ..db import get_db
from ..models import (AuditEvent, Case, Consent, Decision, RuleVersion, ScamMessage, Tenant, User)
from ..security import current_user, require_roles
from ..views import _mask_trace

router = APIRouter(tags=["staff"])


# ================================================================== RULES (no-code changes)
@router.get("/rules", summary="All rule versions for my department")
def list_rules(key: str = "relief_eligibility", user: User = Depends(require_roles("admin", "officer", "auditor")), db: Session = Depends(get_db)):
    rows = db.query(RuleVersion).filter_by(tenant_id=user.tenant_id, key=key).order_by(RuleVersion.version.desc()).all()
    return [{"id": r.id, "version": r.version, "status": r.status, "note": r.note, "definition": r.definition,
             "created_at": r.created_at.isoformat(), "published_at": r.published_at.isoformat() if r.published_at else None} for r in rows]


@router.get("/rules/published")
def published_rule(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rv = rules.published(db, user.tenant_id)
    return {"id": rv.id, "version": rv.version, "definition": rv.definition, "published_at": rv.published_at.isoformat()}


class DraftIn(BaseModel):
    definition: dict
    note: str | None = None
    key: str = "relief_eligibility"


@router.post("/rules/draft", status_code=201, summary="Create a draft rule version (validated; not live yet)")
def make_draft(body: DraftIn, user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rv = rules.create_draft(db, user.tenant_id, body.key, body.definition, body.note, user.id)
    db.commit()
    audit.log(db, action="rule.draft", actor=user, resource_type="rule", resource_id=rv.id, details={"version": rv.version})
    return {"id": rv.id, "version": rv.version, "status": rv.status}


BUDGET_GATE_PCT = 0.15  # a rule that raises automatic payouts by more than 15% needs a written justification


class PublishIn(BaseModel):
    override_reason: str | None = Field(default=None, max_length=500)


@router.post("/rules/{rule_id}/publish", summary="Publish: effective on the very next decision. No redeploy.")
def publish_rule(rule_id: str, body: PublishIn | None = None, user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rv = db.get(RuleVersion, rule_id)
    if not rv or rv.tenant_id != user.tenant_id:
        raise HTTPException(404, "Rule not found")
    prev = rules.published(db, user.tenant_id, rv.key)
    # SAFETY GATE: replay the rule on past cases first. A change that lets more fraud through needs a written reason.
    gate = twin.replay(db, user.tenant_id, rv.definition)
    reason = (body.override_reason or "").strip() if body else ""
    spend_before, spend_after = gate["before"]["auto_spend_pkr"], gate["after"]["auto_spend_pkr"]
    spend_up = (spend_after - spend_before) / max(spend_before, 1)
    problems = []
    if gate["delta"]["wrong_approvals"] > 0:
        problems.append(f"it would approve {int(gate['delta']['wrong_approvals'])} more fraudulent claim(s)")
    if spend_after > spend_before and spend_up > BUDGET_GATE_PCT:
        problems.append(f"it would raise automatic payouts by {spend_up:.0%} (PKR {spend_before:,} to PKR {spend_after:,}), above the {BUDGET_GATE_PCT:.0%} budget guard")
    if problems and len(reason) < 10:
        audit.log(db, action="rule.publish_blocked", actor=user, resource_type="rule", resource_id=rv.id, outcome="denied",
                  details={"version": rv.version, "problems": problems})
        raise HTTPException(409, {"error": "safety_gate",
                                  "message": f"Blocked by the safety gate: on {gate['cases_replayed']} past cases " + " and ".join(problems)
                                             + ". Adjust the rule, or publish again with a written override_reason (10+ characters).",
                                  "twin": {"before": gate["before"], "after": gate["after"], "delta": gate["delta"], "summary": gate["summary"],
                                           "cases_replayed": gate["cases_replayed"], "changed_cases": gate["changed_cases"],
                                           "transitions": gate["transitions"], "sample_changes": [], "spend_increase_pct": round(spend_up, 3)}})
    rules.publish(db, rv)
    db.commit()
    audit.log(db, action="rule.publish", actor=user, resource_type="rule", resource_id=rv.id,
              details={"version": rv.version, "previous_version": prev.version if prev else None, "definition": rv.definition,
                       "twin_delta": gate["delta"], "override_reason": reason or None})
    return {"published_version": rv.version, "previous_version": prev.version if prev else None, "effective": "immediately",
            "safety_gate": {"passed": not problems, "problems": problems, "override_reason": reason or None, "delta": gate["delta"]}}


class TwinIn(BaseModel):
    definition: dict | None = None
    rule_id: str | None = None
    cost_matrix: dict | None = None


@router.post("/rules/twin", summary="DIGITAL TWIN: replay a draft rule / cost matrix on past cases. Nothing is changed.")
def run_twin(body: TwinIn, user: User = Depends(require_roles("admin", "officer", "auditor")), db: Session = Depends(get_db)):
    d = body.definition
    if body.rule_id:
        rv = db.get(RuleVersion, body.rule_id)
        if not rv or rv.tenant_id != user.tenant_id:
            raise HTTPException(404, "Rule not found")
        d = rv.definition
    res = twin.replay(db, user.tenant_id, d, body.cost_matrix)
    audit.log(db, action="twin.run", actor=user, details={"changed": res["changed_cases"], "delta": res["delta"]})
    return res


# ================================================================== RISK DIAL (cost-of-being-wrong)
@router.get("/risk/dial", summary="The numbers behind auto / ask / human: thresholds + cost curve")
def risk_dial(user: User = Depends(require_roles("admin", "officer", "auditor")), db: Session = Depends(get_db)):
    c = dec.costs_for(db.get(Tenant, user.tenant_id).cost_matrix)
    return {"cost_matrix": c, "thresholds": dec.thresholds(c), "curve": dec.curve(c, 50),
            "how_to_read": "For each probability the claim is genuine, the cheapest action wins. Wrong approvals are 300x costlier than a review, so AUTO needs very high confidence."}


class CostIn(BaseModel):
    cost_matrix: dict = Field(description="Any subset of: wrong_approval, human_review, ask_proof, delay_harm_human, wrongful_block, auto_payment_limit ...")


@router.put("/risk/dial", summary="Change the cost matrix (audited). Use /rules/twin first to see the effect.")
def set_costs(body: CostIn, user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    allowed = set(dec.DEFAULT_COSTS) | {"auto_payment_limit"}
    bad = [k for k in body.cost_matrix if k not in allowed]
    if bad:
        raise HTTPException(422, f"Unknown cost keys: {bad}")
    for k, v in body.cost_matrix.items():
        if not isinstance(v, (int, float)) or v < 0:
            raise HTTPException(422, f"{k} must be a non-negative number")
    t = db.get(Tenant, user.tenant_id)
    old = dict(t.cost_matrix or {})
    merged = dec.costs_for({**old, **body.cost_matrix})
    if merged["wrong_approval"] <= merged["human_review"] + merged["delay_harm_human"]:
        raise HTTPException(422, "wrong_approval must be larger than human_review + delay_harm_human, otherwise the system would never ask for review")
    t.cost_matrix = {**old, **body.cost_matrix}
    db.commit()
    audit.log(db, action="risk.cost_matrix_change", actor=user, details={"old": old, "new": t.cost_matrix})
    c = dec.costs_for(t.cost_matrix)
    return {"cost_matrix": c, "thresholds": dec.thresholds(c)}


# ================================================================== AUDIT (read-only)
def _ev(e: AuditEvent) -> dict:
    return {"seq": e.seq, "ts": e.ts.isoformat(), "actor_type": e.actor_type, "actor_id": e.actor_id, "actor_role": e.actor_role, "action": e.action,
            "resource_type": e.resource_type, "resource_id": e.resource_id, "outcome": e.outcome, "details": e.details, "hash": e.hash[:16], "prev_hash": e.prev_hash[:16]}


@router.get("/audit", summary="Audit log (read-only; auditor/admin)")
def audit_log(action: str | None = None, actor_type: str | None = None, outcome: str | None = None, resource_id: str | None = None,
              limit: int = Query(100, le=500), before_seq: int | None = None,
              user: User = Depends(require_roles("auditor", "admin")), db: Session = Depends(get_db)):
    q = db.query(AuditEvent).filter(AuditEvent.tenant_id == user.tenant_id)
    if action: q = q.filter(AuditEvent.action.like(action.replace("*", "%")))
    if actor_type: q = q.filter(AuditEvent.actor_type == actor_type)
    if outcome: q = q.filter(AuditEvent.outcome == outcome)
    if resource_id: q = q.filter(AuditEvent.resource_id == resource_id)
    if before_seq: q = q.filter(AuditEvent.seq < before_seq)
    return [_ev(e) for e in q.order_by(AuditEvent.seq.desc()).limit(limit).all()]


@router.get("/audit/verify", summary="Verify the tamper-evident hash chain (optionally simulate tampering to prove detection)")
def audit_verify(simulate_tamper_seq: int | None = None, user: User = Depends(require_roles("auditor", "admin")), db: Session = Depends(get_db)):
    return audit.verify_chain(db, simulate_tamper_seq)


@router.get("/audit/consents", summary="All consent records (auditor)")
def audit_consents(limit: int = 200, user: User = Depends(require_roles("auditor", "admin")), db: Session = Depends(get_db)):
    ids = [u.id for u in db.query(User.id).filter_by(tenant_id=user.tenant_id).all()]
    rows = db.query(Consent).filter(Consent.subject_id.in_([i[0] if isinstance(i, tuple) else i for i in ids])).order_by(Consent.granted_at.desc()).limit(limit).all()
    return [{"id": c.id, "subject": c.subject_id[:8] + "…", "grantee": c.grantee, "grantee_type": c.grantee_type, "scope": c.scope, "status": c.status,
             "granted_at": c.granted_at.isoformat(), "withdrawn_at": c.withdrawn_at.isoformat() if c.withdrawn_at else None, "receipt": c.receipt_hash} for c in rows]


@router.get("/audit/decisions", summary="Every AI decision with its full trace (personal identifiers masked)")
def audit_decisions(limit: int = 50, route: str | None = None, user: User = Depends(require_roles("auditor", "admin")), db: Session = Depends(get_db)):
    q = db.query(Decision).filter(Decision.tenant_id == user.tenant_id)
    if route: q = q.filter(Decision.route == route)
    out = []
    for d in q.order_by(Decision.created_at.desc()).limit(limit).all():
        out.append({"id": d.id, "case_id": d.case_id, "route": d.route, "p_legit": d.p_legit, "confidence": d.confidence, "rule_version": d.rule_version,
                    "model_version": d.model_version, "final_outcome": d.final_outcome, "created_at": d.created_at.isoformat(),
                    "reason_user": d.reason_user, "trace": _mask_trace(d.trace or {})})
    return out


@router.get("/audit/export.csv")
def audit_csv(user: User = Depends(require_roles("auditor", "admin")), db: Session = Depends(get_db)):
    buf = io.StringIO(); w = csv.writer(buf)
    w.writerow(["seq", "ts", "actor_type", "actor_role", "action", "resource_type", "resource_id", "outcome", "hash"])
    for e in db.query(AuditEvent).filter(AuditEvent.tenant_id == user.tenant_id).order_by(AuditEvent.seq.asc()).limit(20000):
        w.writerow([e.seq, e.ts.isoformat(), e.actor_type, e.actor_role, e.action, e.resource_type, e.resource_id, e.outcome, e.hash])
    buf.seek(0)
    return StreamingResponse(iter([buf.read()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=audit.csv"})


# ================================================================== ANALYTICS per tenant
@router.get("/analytics", summary="Per-tenant analytics dashboard data")
def analytics(user: User = Depends(require_roles("admin", "officer", "auditor")), db: Session = Depends(get_db)):
    tid = user.tenant_id
    live = db.query(Case).filter(Case.tenant_id == tid, Case.is_historical == False).all()  # noqa: E712
    hist = db.query(Case).filter(Case.tenant_id == tid, Case.is_historical == True).all()  # noqa: E712
    decs = db.query(Decision).filter(Decision.tenant_id == tid).all()
    routes = Counter(d.route for d in decs)
    n = max(sum(routes.values()), 1)
    scam_rows = db.query(ScamMessage).filter(ScamMessage.tenant_id == tid).all()
    return {"tenant": db.get(Tenant, tid).name, "cases_live": len(live), "cases_historical_synthetic": len(hist),
            "status_live": dict(Counter(c.status for c in live)), "status_all": dict(Counter(c.status for c in live + hist)),
            "routes": dict(routes), "auto_rate": round(routes["AUTO_APPROVE"] / n, 3), "human_rate": round(routes["HUMAN_REVIEW"] / n, 3),
            "ask_rate": round(routes["ASK_PROOF"] / n, 3), "decline_rate": round(routes["DECLINE_WITH_APPEAL"] / n, 3),
            "avg_p_legit": round(sum(d.p_legit for d in decs) / n, 3),
            "p_legit_histogram": [sum(1 for d in decs if i / 10 <= d.p_legit < (i + 1) / 10 + (0.001 if i == 9 else 0)) for i in range(10)],
            "scam_reports": len(scam_rows), "scam_by_verdict": dict(Counter(s.verdict for s in scam_rows)),
            "open_queue": sum(1 for c in live if c.status in ("awaiting_human", "escalated")),
            "payments_mock_total_pkr": sum(c.amount or 0 for c in live if c.status == "paid")}
