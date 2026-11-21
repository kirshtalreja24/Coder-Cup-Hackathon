"""Anomaly detection for claims: transparent rule signals + IsolationForest on case-level features."""
from datetime import timedelta
from functools import lru_cache

import numpy as np
from sqlalchemy import func
from sqlalchemy.orm import Session

from .identity import clean_cnic
from .models import Case, Payment, now


def _int(x) -> int:
    try:
        return int(x)
    except (TypeError, ValueError):
        return 0


def features_for(db: Session, case: Case, data: dict) -> dict:
    cnic = clean_cnic(data.get("cnic"))
    phone = (data.get("phone") or "").strip()
    since_90 = now() - timedelta(days=90)
    dup_open = db.query(Case).filter(Case.id != case.id, Case.status.notin_(["rejected", "closed"]),
                                     Case.is_historical == False, Case.tenant_id == case.tenant_id).all()  # noqa: E712
    same_cnic = sum(1 for c in dup_open if clean_cnic((c.data or {}).get("cnic")) == cnic and cnic)
    same_phone_ids = {clean_cnic((c.data or {}).get("cnic")) for c in dup_open if phone and (c.data or {}).get("phone") == phone}
    same_phone_ids.discard(cnic)
    paid_recent = 0
    if cnic:
        paid_recent = db.query(func.count(Payment.id)).filter(Payment.cnic == cnic, Payment.created_at >= since_90).scalar() or 0
    last_hour = db.query(func.count(Case.id)).filter(Case.created_by == case.created_by, Case.id != case.id,
                                                     Case.created_at >= now() - timedelta(hours=1)).scalar() or 0
    return {"same_cnic_open": same_cnic, "phone_shared_with_other_cnics": len(same_phone_ids),
            "paid_last_90d": int(paid_recent), "claims_by_creator_last_hour": int(last_hour),
            "income": _int(data.get("monthly_income")), "household": _int(data.get("household_size"))}


@lru_cache(maxsize=1)
def _iforest():
    from sklearn.ensemble import IsolationForest
    rng = np.random.default_rng(3)
    n = 400
    X = np.column_stack([
        rng.poisson(0.05, n), rng.poisson(0.05, n), rng.poisson(0.02, n), rng.poisson(0.4, n),
        rng.normal(18000, 6000, n).clip(0), rng.integers(1, 9, n),
    ])
    return IsolationForest(n_estimators=100, contamination=0.03, random_state=3).fit(X)


def assess(db: Session, case: Case, data: dict) -> dict:
    f = features_for(db, case, data)
    flags, risk = [], 0.0
    if f["paid_last_90d"]:
        flags.append("A payment was already made to this ID in the last 90 days."); risk = max(risk, 0.95)
    if f["same_cnic_open"]:
        flags.append("Another open claim exists for the same ID (duplicate claim)."); risk = max(risk, 0.8)
    if f["phone_shared_with_other_cnics"] >= 2:
        flags.append(f"This phone number is used on {f['phone_shared_with_other_cnics']} other people's claims."); risk = max(risk, 0.55)
    if f["claims_by_creator_last_hour"] >= 8:
        flags.append("Unusual burst of claims from one account in the last hour (helpers: review before submitting)."); risk = max(risk, 0.45)
    x = np.array([[f["same_cnic_open"], f["phone_shared_with_other_cnics"], f["paid_last_90d"],
                   f["claims_by_creator_last_hour"], f["income"], f["household"]]])
    iso = float(-_iforest().score_samples(x)[0])  # higher = more anomalous (~0.35..0.8)
    iso_risk = max(0.0, min(1.0, (iso - 0.5) / 0.3))
    if iso_risk > 0.5 and not flags:
        flags.append("Statistical outlier compared to typical claims.");
    risk = max(risk, min(iso_risk, 0.5))
    return {"risk": round(risk, 3), "flags": flags, "features": f, "iforest_score": round(iso, 3)}
