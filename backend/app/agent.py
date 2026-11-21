"""The claim agent: finishes the relief-claim task step by step by calling MOCK identity / payment / data tools.

It is a deliberately DETERMINISTIC tool-calling pipeline, not an LLM that improvises: what it may do is fixed in code (safety),
and the LLM, when configured, only helps explain and answer questions, never approves money. Every tool call is recorded in the
audit chain with actor_type='agent'.

Pipeline: validate_form -> consent_gate -> registry_lookup -> document_analysis -> anomaly_check -> rules -> decide -> act -> notify
"""
from typing import Any

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from . import anomaly, audit, consent, decision as dec, explain, mock_services as ms, rules
from .identity import clean_cnic, validate_cnic
from .models import Case, CaseEvent, Decision, Document, Tenant, User, now
from .notify import notify
from .webhooks import emit

# --------------------------- structured, validated input (bad data tolerant) --------------------------
class ClaimForm(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    father_name: str | None = Field(default=None, max_length=120)
    dob: str | None = None
    cnic: str | None = None
    gender: str | None = None
    district: str | None = None
    marital_status: str | None = None
    monthly_income: int | None = Field(default=None, ge=0, le=100_000_000)
    household_size: int | None = Field(default=None, ge=0, le=60)
    phone: str | None = None

    @field_validator("*", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v == "" or v.lower() in ("n/a", "na", "none", "null", "-", "unknown", "nil"):
                return None
        return v

    @field_validator("monthly_income", "household_size", mode="before")
    @classmethod
    def numeric_strings(cls, v):
        if isinstance(v, str):
            digits = "".join(ch for ch in v if ch.isdigit())
            return int(digits) if digits else None
        return v

    @field_validator("gender", mode="before")
    @classmethod
    def gender_norm(cls, v):
        if not v:
            return None
        s = str(v).strip().lower()
        return "M" if s in ("m", "male", "man", "مرد") else ("F" if s in ("f", "female", "woman", "عورت") else None)

    @field_validator("marital_status", mode="before")
    @classmethod
    def marital_norm(cls, v):
        if not v:
            return None
        s = str(v).strip().lower()
        if s in ("widow", "widowed", "bewa", "beva", "بیوہ"):
            return "widowed"
        if s in ("married", "shadi shuda", "شادی شدہ"):
            return "married"
        if s in ("single", "unmarried", "کنوارہ"):
            return "single"
        return s


def clean_form(raw: dict) -> tuple[ClaimForm | None, list[str]]:
    try:
        return ClaimForm(**{k: v for k, v in (raw or {}).items() if k in ClaimForm.model_fields}), []
    except Exception as e:  # never crash on bad input: report and ask
        errs = []
        for err in getattr(e, "errors", lambda: [])():
            errs.append(f"{'.'.join(str(x) for x in err['loc'])}: {err['msg']}")
        return None, errs or [str(e)]


# --------------------------- helpers -------------------------------------------
def _step(db: Session, steps: list, actor: User, case: Case, tool: str, summary: str, data: Any = None, outcome="ok", persist=True):
    s = {"tool": tool, "summary": summary, "outcome": outcome, "data": data}
    steps.append(s)
    if persist:
        audit.log(db, action=f"agent.{tool}", actor_type="agent", actor_id="claim-agent", actor_role="agent",
                  tenant_id=case.tenant_id, resource_type="case", resource_id=case.id, outcome=outcome,
                  details={"summary": summary, "on_behalf_of": actor.id}, commit=False)


def build_facts(form: ClaimForm, ident: dict, reg, db: Session, cnic: str | None) -> tuple[dict, list[str]]:
    """Facts for the rules engine. When identity is MATCH the registry is authoritative for age/marital status;
    income uses the HIGHER of claimed/registry (conservative: wrong approvals cost more)."""
    conflicts: list[str] = []
    matched = ident["decision"] == "MATCH" and reg is not None
    dob = reg.dob if matched and reg.dob else ms.norm_dob(form.dob)
    marital = reg.marital_status if matched and reg.marital_status else form.marital_status
    income = form.monthly_income
    if matched:
        if form.marital_status == "widowed" and reg.marital_status and reg.marital_status != "widowed":
            conflicts.append(f"Stated 'widowed' but the registry shows '{reg.marital_status}'"
                             f"{' with a living spouse' if reg.spouse_status == 'alive' else ''}.")
        if reg.monthly_income is not None:
            if income is not None and income < 0.7 * reg.monthly_income:
                conflicts.append(f"Stated income PKR {income:,} is much lower than the registry's PKR {reg.monthly_income:,}.")
            income = max(income, reg.monthly_income) if income is not None else reg.monthly_income
    facts = {
        "age": ms.age_from_dob(dob), "monthly_income": income, "marital_status": marital,
        "household_size": form.household_size if form.household_size is not None else (reg.household_size if matched else None),
        "days_since_last_payout": ms.days_since_last_payout(db, cnic),
        "identity_decision": ident["decision"], "district": form.district, "gender": form.gender,
    }
    return facts, conflicts


def risk_priority(p_legit: float, risk: float, amount: int | None) -> int:
    """1 = most urgent. Uncertain + risky + large = look first."""
    score = (1 - p_legit) * 0.5 + risk * 0.4 + min((amount or 0) / 100_000, 0.1)
    return 1 if score > 0.6 else 2 if score > 0.35 else 3 if score > 0.15 else 4


def run_claim(db: Session, case: Case, actor: User, *, consent_flags: dict | None = None, persist: bool = True) -> dict:
    steps: list[dict] = []
    tenant = db.get(Tenant, case.tenant_id)
    citizen = db.get(User, case.citizen_id)
    costs = dec.costs_for(tenant.cost_matrix)

    # 1. structured, validated form ---------------------------------------------------
    form, errs = clean_form(case.data)
    if form is None:
        _step(db, steps, actor, case, "validate_form", "Form could not be parsed; asking the citizen to fix fields.", errs, "error", persist)
        return _finish_ask(db, case, actor, steps, ["fix_form_fields"], errs, persist)
    cn = validate_cnic(form.cnic, form.gender)
    _step(db, steps, actor, case, "validate_form",
          f"Form parsed. CNIC {'valid' if cn['valid'] else 'INVALID: ' + '; '.join(cn['issues'])}.",
          {"cnic_issues": cn["issues"], "missing": [k for k, v in form.model_dump().items() if v is None]}, persist=persist)

    # 2. consent gate -----------------------------------------------------------------
    if actor.role == "helper":
        consent_flags = None  # a helper can never grant consent for a family: only the family's own one-time code can
    if consent_flags is not None and persist:
        mapping = {"identity": ("service", "mock_nadra", "identity"), "payment": ("service", "mock_raast", "payment"),
                   "documents": ("role", "officer", "documents"), "case_history": ("role", "officer", "case_history"),
                   "officer_identity": ("role", "officer", "identity")}
        for key, on in consent_flags.items():
            if on and key in mapping:
                gt, g, sc = mapping[key]
                consent.grant(db, subject=citizen, actor=actor, grantee_type=gt, grantee=g, scope=sc, purpose="relief claim")
                if key == "identity":  # officers need to see identity to review
                    consent.grant(db, subject=citizen, actor=actor, grantee_type="role", grantee="officer", scope="identity", purpose="relief claim review")
                    consent.grant(db, subject=citizen, actor=actor, grantee_type="role", grantee="officer", scope="profile", purpose="relief claim review")
    if not consent.check_service(db, citizen.id, "mock_nadra", "identity"):
        _step(db, steps, actor, case, "consent_gate", "No consent for identity check. Stopped. Nothing was read.", None, "denied", persist)
        case.status = "needs_consent"
        case.progress = {**(case.progress or {}), "step": "consent"}
        if persist:
            audit.log(db, action="agent.stopped_no_consent", actor_type="agent", actor_id="claim-agent", tenant_id=case.tenant_id,
                      resource_type="case", resource_id=case.id, outcome="denied", commit=False)
            db.commit()
        reason = {"en": "We need your permission to check your ID. Nothing has been checked yet.",
                  "ur": "آپ کا شناختی کارڈ چیک کرنے کے لیے آپ کی اجازت چاہیے۔ ابھی کچھ چیک نہیں ہوا۔",
                  "roman": "Aap ka shanakhti card check karne ke liye aap ki ijazat chahiye. Abhi kuch check nahi hua."}
        return {"route": "NEEDS_CONSENT", "status": case.status, "reason_user": reason, "steps": steps, "decision": None}
    _step(db, steps, actor, case, "consent_gate", "Consent for identity check is active.", None, persist=persist)

    # 3. registry lookup (MOCK NADRA) --------------------------------------------------
    query = {"cnic": form.cnic, "name": form.name, "father_name": form.father_name, "dob": ms.norm_dob(form.dob) or form.dob,
             "district": form.district, "gender": form.gender}
    ver = ms.nadra_verify(db, query)
    best = ver["best"]
    cmp_ = best["comparison"] if best else {"decision": "NON_MATCH", "total_weight": 0, "fields": {}, "missing": []}
    reg = ms.nadra_record(db, best["cnic"]) if best and cmp_["decision"] == "MATCH" else None
    weight = cmp_["total_weight"]
    if best and cmp_.get("cnic_exact") and cn["valid"] and cmp_["fields"].get("name", {}).get("level") != "none":
        weight += 6.0  # exact ID number is strong evidence, but only when nothing contradicts it
    ident = {"decision": cmp_["decision"], "total_weight": round(weight, 2), "missing": cmp_.get("missing", []),
             "fields": cmp_.get("fields", {}), "matched_cnic_masked": ("*" * 9 + best["cnic"][-4:]) if best else None}
    if ident["decision"] != "MATCH" and weight >= 18 and len(ident["missing"]) < 2:
        ident["decision"] = "MATCH"
        reg = ms.nadra_record(db, best["cnic"]) if best else None
    p_identity = dec.p_identity_from_weight(weight)
    _step(db, steps, actor, case, "mock_nadra.verify",
          f"Registry (MOCK) says {ident['decision']} (evidence weight {ident['total_weight']}; posterior {p_identity:.1%}).",
          {k: ident[k] for k in ("decision", "total_weight", "missing")}, persist=persist)

    # 4. document analysis -------------------------------------------------------------
    docs = db.query(Document).filter_by(case_id=case.id, deleted=False).order_by(Document.created_at.desc()).all() if persist or case.id else []
    doc_result = None
    if docs:
        doc_result = docs[0].analysis or {}
        _step(db, steps, actor, case, "vision.analyze_document",
              f"Document authenticity {doc_result.get('authenticity')} flag={doc_result.get('flag')}.",
              {"flags": doc_result.get("flags")}, persist=persist)
    else:
        _step(db, steps, actor, case, "vision.analyze_document", "No document yet; will ask for one.", None, persist=persist)

    # 5. anomaly -----------------------------------------------------------------------
    an = anomaly.assess(db, case, {**(case.data or {}), **form.model_dump(exclude_none=True)})
    _step(db, steps, actor, case, "anomaly.assess", f"Anomaly risk {an['risk']:.0%}. {'; '.join(an['flags']) or 'No flags.'}", an["features"], persist=persist)

    # 6. rules (versioned, data-driven) -------------------------------------------------
    facts, conflicts = build_facts(form, ident, reg, db, clean_cnic(form.cnic))
    rv = rules.published(db, case.tenant_id)
    rule_eval = rules.evaluate(rv.definition, facts)
    _step(db, steps, actor, case, "rules.evaluate", f"Rule v{rv.version}: {rule_eval['verdict']}.",
          {"failed": rule_eval["failed"], "unknown": rule_eval["unknown"]}, persist=persist)

    # 7. decide (expected-cost minimisation) --------------------------------------------
    d = dec.decide(p_identity=p_identity, identity_decision=ident["decision"], doc=doc_result, anomaly=an,
                   rule_eval=rule_eval, conflicts=conflicts, costs=costs, has_doc_proof=bool(docs))
    amount = rule_eval["amount"]
    # Guardrail: large payouts always need a human regardless of confidence
    limit = costs.get("auto_payment_limit", 30_000)
    if d["route"] == "AUTO_APPROVE" and amount > limit:
        d["route"], d["override"] = "HUMAN_REVIEW", f"guardrail: amount PKR {amount:,} exceeds auto-payment limit PKR {limit:,}"
    d["recourse"] = dec.recourse(p_identity=p_identity, identity_decision=ident["decision"], doc=doc_result, anomaly=an, rule_eval=rule_eval,
                                 conflicts=conflicts, costs=costs, has_doc_proof=bool(docs), route=d["route"], asks=d["asks"])
    reason = explain.user_reason(d["route"], d, rule_eval, amount)
    reason["recourse"] = explain.recourse_lines(d["recourse"])
    brief = explain.handoff_brief(case.data or {}, d, rule_eval, ident, doc_result) if d["route"] == "HUMAN_REVIEW" else None
    _step(db, steps, actor, case, "decide",
          f"Route {d['route']} (P(legit) {d['p_legit']:.1%}; expected cost auto={d['action_costs'].get('AUTO_APPROVE')} vs review={d['action_costs'].get('HUMAN_REVIEW')}).",
          {"route": d["route"], "override": d["override"]}, persist=persist)

    trace = {"input": {k: v for k, v in (case.data or {}).items() if k != "signals"}, "facts": facts, "identity": ident,
             "document": {k: doc_result.get(k) for k in ("authenticity", "flag", "flags")} if doc_result else None,
             "anomaly": an, "rule": {"version": rv.version, "id": rv.id, "key": rv.key, "result": rule_eval},
             "decision": d, "model_version": "bharosa-decider-1.0 + fellegi-sunter-1.0 + scam-hybrid-1.0"}
    signals = {"identity_weight": ident["total_weight"], "p_identity": p_identity, "identity_decision": ident["decision"],
               "doc": {"authenticity": (doc_result or {}).get("authenticity"), "flag": (doc_result or {}).get("flag")} if doc_result else None,
               "anomaly": {"risk": an["risk"]}, "conflicts": conflicts, "facts": facts, "has_doc_proof": bool(docs)}

    result = {"route": d["route"], "decision": d, "reason_user": reason, "trace": trace, "steps": steps, "amount": amount,
              "rule_version": rv.version, "signals": signals}
    if not persist:
        return result

    # 8. act ------------------------------------------------------------------------------
    dd = Decision(case_id=case.id, tenant_id=case.tenant_id, route=d["route"], p_legit=d["p_legit"], confidence=d["confidence"],
                  rule_version_id=rv.id, rule_version=rv.version, trace=trace, reason_user=reason)
    db.add(dd)
    db.flush()  # assigns dd.id, so the audit entry below can reference it (receipts and auditors rely on this link)
    case.data = {**(case.data or {}), "signals": signals}
    case.amount = amount
    case.priority = risk_priority(d["p_legit"], an["risk"], amount)
    note = None
    if d["route"] == "AUTO_APPROVE":
        if consent.check_service(db, citizen.id, "mock_raast", "payment"):
            pay = ms.raast_pay(db, case_id=case.id, cnic=ident.get("matched_cnic_masked") and best["cnic"] or (clean_cnic(form.cnic) or "0"), amount=amount)
            case.status = "paid"
            dd.final_outcome = "approved_auto"
            case.closed_at = now()
            _step(db, steps, actor, case, "mock_raast.pay", f"Paid PKR {amount:,} via MOCK Raast. Ref {pay.reference}.", {"reference": pay.reference})
            result["payment"] = {"reference": pay.reference, "amount": amount, "rail": pay.rail, "mock": True}
            note = f"Payment PKR {amount:,} sent (MOCK). Ref {pay.reference}."
        else:
            case.status = "awaiting_payment_consent"
            _step(db, steps, actor, case, "consent_gate", "Approved, but no consent to send payment. Waiting for citizen.", None, "denied")
            note = "Approved. Please allow us to send the payment."
            result["route"] = "APPROVED_WAITING_PAYMENT_CONSENT"
    elif d["route"] == "ASK_PROOF":
        case.status = "needs_proof"
        note = reason["en"]
    elif d["route"] == "DECLINE_WITH_APPEAL":
        case.status = "declined"
        dd.final_outcome = "declined_auto"
        note = reason["en"]
    else:
        case.status = "awaiting_human"
        case.handoff_brief = brief
        note = "Handed to a human reviewer with case notes."
    case.progress = {**(case.progress or {}), "step": case.status}
    db.add(CaseEvent(case_id=case.id, actor_id="claim-agent", kind=f"decision.{d['route']}", note=note))
    notify(db, case.citizen_id, reason["ur"] if citizen.locale == "ur" else reason["en"], short=reason["roman"], channels=("in_app", "sms", "whatsapp"))
    audit.log(db, action="ai.decision", actor_type="ai", actor_id="bharosa-decider-1.0", tenant_id=case.tenant_id,
              resource_type="case", resource_id=case.id,
              details={"route": d["route"], "p_legit": d["p_legit"], "rule_version": rv.version, "decision_id": dd.id,
                       "override": d["override"]}, commit=False)
    db.commit()
    emit(db, case.tenant_id, "case.decided", {"case_id": case.id, "route": d["route"], "status": case.status})
    result["decision_id"] = dd.id
    result["status"] = case.status
    return result


def _finish_ask(db, case, actor, steps, asks, errs, persist):
    case.status = "needs_proof"
    if persist:
        db.add(CaseEvent(case_id=case.id, actor_id="claim-agent", kind="decision.ASK_PROOF", note="; ".join(errs)))
        db.commit()
    return {"route": "ASK_PROOF", "status": case.status, "steps": steps, "decision": None, "errors": errs,
            "reason_user": {"en": "Some details look wrong. Please check them and try again.",
                            "ur": "کچھ معلومات درست نہیں لگ رہیں۔ براہ کرم چیک کر کے دوبارہ بھیجیں۔",
                            "roman": "Kuch maloomat durust nahi lag rahin. Check karke dobara bhejein."}}
