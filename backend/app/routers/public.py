"""Public REST API (API-key auth, scoped, rate-limited) + MOCK national services + health/metrics."""
import os
import secrets
from collections import OrderedDict
import time
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import mock_services as ms, rag, rules, scam
from ..db import get_db
from ..metrics import METRICS
from ..models import ApiKey, Tenant, User
from ..security import api_key_auth, require_roles
from .ai import AskIn

router = APIRouter()

# ------------------------------------------------------------------ health / monitoring
@router.get("/health", tags=["ops"], summary="Liveness + DB check")
def health(db: Session = Depends(get_db)):
    db.execute(__import__("sqlalchemy").text("select 1"))
    return {"status": "ok", "service": "bharosa", "prototype": True, "db": "ok"}


@router.get("/metrics", tags=["ops"], summary="Request counts, error counts, latency percentiles")
def metrics():
    m = METRICS.snapshot()
    return {k: m[k] for k in ("uptime_s", "requests", "by_status", "latency_ms")}  # no routes / error details for the public


@router.get("/metrics/detail", tags=["ops"], summary="Full metrics incl. top routes and recent errors (admin/auditor)")
def metrics_detail(user: User = Depends(require_roles("admin", "auditor"))):
    return METRICS.snapshot()


@router.get("/about", tags=["ops"], summary="What is real and what is simulated")
def about():
    return {"name": "Bharosa", "status": "PROTOTYPE ONLY - not an official service.",
            "real": ["JWT auth + RBAC (server-side)", "consent broker + hash-chained audit log", "versioned rules engine + digital twin",
                     "Fellegi-Sunter identity matching", "expected-cost decision engine", "document forensics (blur/QR/ELA)", "scam classifier (rules + ML)",
                     "RAG with citations", "voice/typed intent understanding (rules + validated LLM tie-break)", "idempotent offline sync", "background jobs + webhooks", "API keys + rate limits"],
            "simulated": ["NADRA-style identity registry (synthetic people)", "Raast-style payments (no money moves)", "SMS/WhatsApp (logged only)",
                          "OTP codes (shown in demo responses)", "ID cards (watermarked samples)", "all citizen data (synthetic)"]}


# ------------------------------------------------------------------ Public v1 API (API key)
@router.get("/v1/status", tags=["public-api"])
def v1_status(key: ApiKey = Depends(api_key_auth("public:read")), db: Session = Depends(get_db)):
    t = db.get(Tenant, key.tenant_id)
    return {"ok": True, "tenant": t.slug, "key": key.name, "usage_count": key.usage_count, "mock": True}


class V1Scam(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    sender: str | None = None


@router.post("/v1/scam/check", tags=["public-api"], summary="Classify a message (no data stored)")
def v1_scam(body: V1Scam, key: ApiKey = Depends(api_key_auth("scam:check"))):
    return scam.classify(body.text, body.sender)


class V1Precheck(BaseModel):
    age: int | None = None
    monthly_income: int | None = None
    marital_status: str | None = None
    household_size: int | None = None
    days_since_last_payout: int | None = 9999


@router.post("/v1/eligibility/precheck", tags=["public-api"], summary="Rules-only pre-check against the PUBLISHED rule version. Nothing stored.")
def v1_precheck(body: V1Precheck, key: ApiKey = Depends(api_key_auth("eligibility:precheck")), db: Session = Depends(get_db)):
    rv = rules.published(db, key.tenant_id)
    facts = {**body.model_dump(), "identity_decision": "MATCH"}
    res = rules.evaluate(rv.definition, facts)
    return {"rule_version": rv.version, "verdict": res["verdict"], "unknown_inputs": res["unknown"], "failed": res["failed"], "trace": res["trace"],
            "note": "Pre-check only. A real claim also needs identity + document checks and a decision."}


@router.post("/v1/policy/ask", tags=["public-api"], summary="Ask the policy knowledge base (sources included)")
def v1_ask(body: AskIn, key: ApiKey = Depends(api_key_auth("policy:ask")), db: Session = Depends(get_db)):
    return rag.ask(db, body.question, body.lang)


@router.get("/v1/rules/published", tags=["public-api"])
def v1_rule(key: ApiKey = Depends(api_key_auth("public:read")), db: Session = Depends(get_db)):
    rv = rules.published(db, key.tenant_id)
    return {"version": rv.version, "published_at": rv.published_at.isoformat(), "definition": rv.definition}


# ------------------------------------------------------------------ MOCK national services (clean APIs)
class MockVerify(BaseModel):
    cnic: str | None = None
    name: str | None = None
    father_name: str | None = None
    dob: str | None = None
    district: str | None = None
    gender: str | None = None


@router.post("/mock/nadra/verify", tags=["mock-services"], summary="MOCK identity verification (probabilistic; synthetic registry)")
def mock_verify(body: MockVerify, key: ApiKey = Depends(api_key_auth("mock:nadra")), db: Session = Depends(get_db)):
    res = ms.nadra_verify(db, body.model_dump())
    # privacy: public API never returns the registry's full record, only a masked match summary
    best = res["best"]
    if best:
        best = {"cnic_masked": "*" * 9 + best["cnic"][-4:], "comparison": best["comparison"]}
    return {"mock": True, "banner": ms.MOCK_BANNER, "decision": res["decision"], "cnic_check": res["cnic_check"], "best": best}


class MockPay(BaseModel):
    to_cnic: str
    amount: int = Field(gt=0, le=1_000_000)
    idempotency_key: str = Field(min_length=6)


_seen_pay: "OrderedDict[str, dict]" = OrderedDict()  # bounded: the oldest idempotency keys are forgotten first
_SEEN_PAY_MAX = 2000


@router.post("/mock/raast/transfer", tags=["mock-services"], summary="MOCK instant payment. No money moves. Idempotent.")
def mock_transfer(body: MockPay, key: ApiKey = Depends(api_key_auth("mock:raast"))):
    if body.idempotency_key in _seen_pay:
        return {**_seen_pay[body.idempotency_key], "replayed": True}
    r = {"mock": True, "banner": ms.MOCK_BANNER, "status": "SIMULATED_OK", "rail": "MOCK-RAAST", "amount": body.amount,
         "to": "*" * 9 + "".join(c for c in body.to_cnic if c.isdigit())[-4:], "reference": "MOCK-" + secrets.token_hex(5).upper()}
    _seen_pay[body.idempotency_key] = r
    while len(_seen_pay) > _SEEN_PAY_MAX:
        _seen_pay.popitem(last=False)
    return r


# ------------------------------------------------------------------ diagnostics (admin/auditor)
@router.get("/ops/diag", tags=["ops"], summary="Where is the API running and how far is the database? (admin/auditor)")
def diag(user: User = Depends(require_roles("admin", "auditor")), db: Session = Depends(get_db)):
    from sqlalchemy import text
    from ..config import get_settings
    from ..db import engine
    rtts = []
    for _ in range(6):
        t0 = time.perf_counter()
        db.execute(text("select 1"))
        rtts.append(round((time.perf_counter() - t0) * 1000, 1))
    host = urlparse(get_settings().database_url).hostname
    return {"db_host": host, "db_roundtrip_ms": rtts, "typical_ms": sorted(rtts)[len(rtts) // 2],
            "platform_region": os.getenv("RAILWAY_REPLICA_REGION") or os.getenv("RAILWAY_REGION") or os.getenv("FLY_REGION"),
            "pool": engine.pool.status() if hasattr(engine.pool, "status") else None,
            "hint": "Under ~30 ms is excellent; 100 ms is Singapore-Sydney; 300+ ms means the API and database are on different continents."}
