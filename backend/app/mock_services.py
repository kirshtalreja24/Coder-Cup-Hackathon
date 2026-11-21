"""SIMULATED national services behind clean APIs. EVERYTHING here is MOCK. No real person, no real money."""
import secrets
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from .identity import clean_cnic, find_candidates, validate_cnic
from .models import Payment, MockNadraRecord, now

MOCK_BANNER = "MOCK / SIMULATED SERVICE - prototype only. Synthetic data. Not an official system."


def nadra_verify(db: Session, query: dict) -> dict:
    """Mock identity service: probabilistic lookup tolerant of missing/misspelled data (Fellegi-Sunter)."""
    v = validate_cnic(query.get("cnic"), query.get("gender"))
    cands = find_candidates(db, query, limit=3)
    best = cands[0] if cands else None
    return {"mock": True, "banner": MOCK_BANNER, "cnic_check": v,
            "decision": best["comparison"]["decision"] if best else "NON_MATCH",
            "best": best, "alternatives": cands[1:], "candidates_considered": len(cands)}


def nadra_record(db: Session, cnic: str) -> MockNadraRecord | None:
    return db.get(MockNadraRecord, clean_cnic(cnic) or "")


def raast_pay(db: Session, *, case_id: str, cnic: str, amount: int) -> Payment:
    """Mock instant-payment rail. Idempotent per case so retries/sync never double-pay."""
    existing = db.query(Payment).filter_by(case_id=case_id).first()
    if existing:
        return existing
    p = Payment(case_id=case_id, cnic=cnic, amount=amount, rail="MOCK-RAAST", status="paid",
                reference="MOCK-" + secrets.token_hex(5).upper())
    db.add(p)
    db.flush()
    return p


def days_since_last_payout(db: Session, cnic: str | None) -> int:
    if not cnic:
        return 9999
    last = db.query(Payment).filter_by(cnic=cnic).order_by(Payment.created_at.desc()).first()
    if not last:
        return 9999
    ts = last.created_at
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return max(0, (now() - ts).days)


def age_from_dob(dob: str | None) -> int | None:
    if not dob:
        return None
    s = str(dob).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            d = datetime.strptime(s[:10], fmt).date()
            t = date.today()
            return t.year - d.year - ((t.month, t.day) < (d.month, d.day))
        except ValueError:
            continue
    return None


def norm_dob(dob: str | None) -> str | None:
    if not dob:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(str(dob).strip()[:10], fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None
