"""Data-driven, versioned eligibility rules. NO eval(), no code deploys: rules are JSON edited by an admin.
Publishing a new version takes effect on the very next decision; old decisions keep pointing at their version."""
from typing import Any, Literal

from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from .models import RuleVersion, now

Op = Literal[">=", "<=", ">", "<", "==", "!=", "in", "not_in", "exists"]


class Atom(BaseModel):
    fact: str
    op: Op
    value: Any = None


class Condition(BaseModel):
    id: str
    label: str
    label_ur: str | None = None
    hard: bool = True  # failing a hard condition makes the claim ineligible
    fact: str | None = None
    op: Op | None = None
    value: Any = None
    any_of: list[Atom] | None = None  # OR-group


class RuleDefinition(BaseModel):
    title: str
    amount: int = Field(ge=0, le=10_000_000)
    conditions: list[Condition] = Field(min_length=1)


DEFAULT_RELIEF = {
    "title": "Emergency Relief Payment (MOCK programme)",
    "amount": 25000,
    "conditions": [
        {"id": "adult", "label": "Applicant is 18 or older", "label_ur": "درخواست گزار کی عمر 18 سال یا زیادہ ہو",
         "fact": "age", "op": ">=", "value": 18, "hard": True},
        {"id": "income", "label": "Monthly household income is PKR 30,000 or less",
         "label_ur": "ماہانہ گھریلو آمدن 30,000 روپے یا کم ہو", "fact": "monthly_income", "op": "<=", "value": 30000, "hard": True},
        {"id": "vulnerable", "label": "Widowed, or a household of 5+ people",
         "label_ur": "بیوہ ہوں، یا گھر میں 5 یا زیادہ افراد ہوں", "hard": True,
         "any_of": [{"fact": "marital_status", "op": "==", "value": "widowed"},
                    {"fact": "household_size", "op": ">=", "value": 5}]},
        {"id": "no_recent_payout", "label": "No relief payment received in the last 90 days",
         "label_ur": "پچھلے 90 دنوں میں کوئی امدادی رقم نہیں ملی", "fact": "days_since_last_payout", "op": ">=", "value": 90, "hard": True},
        {"id": "identity_verified", "label": "Identity verified against the registry",
         "label_ur": "شناخت رجسٹری سے تصدیق شدہ ہو", "fact": "identity_decision", "op": "==", "value": "MATCH", "hard": False},
    ],
}


def validate_definition(defn: dict) -> RuleDefinition:
    try:
        rd = RuleDefinition(**defn)
    except ValidationError as e:
        raise HTTPException(422, {"error": "invalid rule definition", "details": e.errors(include_url=False)})
    for c in rd.conditions:
        if not c.any_of and not (c.fact and c.op):
            raise HTTPException(422, f"Condition '{c.id}' needs fact+op or any_of")
    return rd


def _atom(fact: str, op: str, value: Any, facts: dict) -> tuple[bool | None, Any]:
    """Returns (passed, actual). passed=None means UNKNOWN (fact missing) - never silently treated as pass."""
    actual = facts.get(fact)
    if op == "exists":
        return actual is not None, actual
    if actual is None:
        return None, None
    try:
        if op == ">=": return actual >= value, actual
        if op == "<=": return actual <= value, actual
        if op == ">": return actual > value, actual
        if op == "<": return actual < value, actual
        if op == "==": return actual == value, actual
        if op == "!=": return actual != value, actual
        if op == "in": return actual in value, actual
        if op == "not_in": return actual not in value, actual
    except TypeError:
        return None, actual
    return None, actual


def evaluate(definition: dict, facts: dict) -> dict:
    """Pure function. Returns per-condition trace + overall verdict: ELIGIBLE | INELIGIBLE | UNKNOWN."""
    rd = RuleDefinition(**definition)
    trace, hard_fail, hard_unknown = [], [], []
    for c in rd.conditions:
        if c.any_of:
            res = [_atom(a.fact, a.op, a.value, facts) for a in c.any_of]
            if any(p is True for p, _ in res):
                passed = True
            elif any(p is None for p, _ in res):
                passed = None
            else:
                passed = False
            actual = {a.fact: v for a, (_, v) in zip(c.any_of, res)}
        else:
            passed, actual = _atom(c.fact, c.op, c.value, facts)
        trace.append({"id": c.id, "label": c.label, "label_ur": c.label_ur, "passed": passed, "actual": actual,
                      "expected": f"{c.fact} {c.op} {c.value}" if not c.any_of else "any of: " + ", ".join(f"{a.fact} {a.op} {a.value}" for a in c.any_of),
                      "hard": c.hard})
        if c.hard and passed is False:
            hard_fail.append(c.id)
        elif c.hard and passed is None:
            hard_unknown.append(c.id)
    verdict = "INELIGIBLE" if hard_fail else ("UNKNOWN" if hard_unknown else "ELIGIBLE")
    return {"verdict": verdict, "failed": hard_fail, "unknown": hard_unknown, "trace": trace, "amount": rd.amount}


# ---- persistence / versioning ---------------------------------------------------
def published(db: Session, tenant_id: str, key: str = "relief_eligibility") -> RuleVersion | None:
    return (db.query(RuleVersion).filter_by(tenant_id=tenant_id, key=key, status="published")
            .order_by(RuleVersion.version.desc()).first())


def next_version(db: Session, tenant_id: str, key: str) -> int:
    last = db.query(RuleVersion).filter_by(tenant_id=tenant_id, key=key).order_by(RuleVersion.version.desc()).first()
    return (last.version + 1) if last else 1


def create_draft(db: Session, tenant_id: str, key: str, definition: dict, note: str | None, user_id: str | None) -> RuleVersion:
    validate_definition(definition)
    rv = RuleVersion(tenant_id=tenant_id, key=key, version=next_version(db, tenant_id, key), status="draft",
                     definition=definition, note=note, created_by=user_id)
    db.add(rv)
    db.flush()
    return rv


def publish(db: Session, rv: RuleVersion) -> RuleVersion:
    for old in db.query(RuleVersion).filter_by(tenant_id=rv.tenant_id, key=rv.key, status="published").all():
        old.status = "archived"
    rv.status = "published"
    rv.published_at = now()
    db.flush()
    return rv
