"""Verifiable decision receipts. A citizen gets a short signed code (also a QR) that proves WHAT was decided, under WHICH rule
version, WHEN, and which audit-log entry recorded it. Anyone (a shop, a bank, a family member) can verify it without logging in,
and the receipt contains no personal data. Tampering with any field makes the signature fail."""
import base64
import hashlib
import hmac
import io
import json

import qrcode

from .config import get_settings
from .models import AuditEvent, Decision


def _key() -> bytes:
    return (get_settings().jwt_secret + "|decision-receipt").encode()


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sig(body: str) -> str:
    return hmac.new(_key(), body.encode(), hashlib.sha256).hexdigest()[:24]


def web_origin() -> str:
    """Where the verify page lives: the web app's origin (first non-wildcard CORS origin), else local dev."""
    for o in get_settings().cors_origins.split(","):
        o = o.strip().rstrip("/")
        if o and o != "*":
            return o
    return "http://localhost:5173"


def audit_hash_for(db, decision: Decision) -> str | None:
    for ev in db.query(AuditEvent).filter(AuditEvent.action == "ai.decision", AuditEvent.resource_id == decision.case_id).order_by(AuditEvent.seq.desc()).limit(20):
        if (ev.details or {}).get("decision_id") == decision.id:
            return ev.hash
    return None


def make_token(db, decision: Decision) -> str:
    payload = {"d": decision.id, "c": decision.case_id[:8], "r": decision.route, "v": decision.rule_version,
               "p": round(decision.p_legit, 4), "t": decision.created_at.isoformat(), "a": (audit_hash_for(db, decision) or "")[:16]}
    body = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    return f"{body}.{_sig(body)}"


def parse(token: str) -> dict | None:
    try:
        body, sig = token.strip().split(".", 1)
        if not hmac.compare_digest(sig, _sig(body)):
            return None
        return json.loads(_unb64(body))
    except Exception:
        return None


def verify(db, token: str) -> dict:
    p = parse(token)
    if not p:
        return {"valid": False, "message": "This receipt is NOT valid: the code was altered or was not issued by this system."}
    d = db.get(Decision, p.get("d", ""))
    if not d or d.route != p["r"] or d.rule_version != p["v"] or round(d.p_legit, 4) != p["p"]:
        return {"valid": False, "message": "Signature is genuine but the decision record no longer matches (it may have been removed)."}
    ah = audit_hash_for(db, d)
    found = bool(ah) and ah[:16] == p.get("a")
    return {"valid": True, "route": d.route, "rule_version": d.rule_version, "confidence": round(d.p_legit, 4), "decided_at": p["t"],
            "case_ref": p["c"], "audit_entry_found": found, "final_outcome": d.final_outcome,
            "message": "Valid. This decision was issued by the system" + (" and is recorded in its tamper-evident audit log." if found else "."),
            "privacy": "A receipt carries no name, ID number or other personal data."}


def qr_png(url: str) -> bytes:
    img = qrcode.make(url).convert("RGB").resize((360, 360))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()
