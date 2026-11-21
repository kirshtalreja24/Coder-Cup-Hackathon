"""Webhooks to outside systems: HMAC-signed, delivered by the background job runner with retries (never blocks a request)."""
import hashlib
import hmac
import ipaddress
import json
import socket
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from .models import Job, Webhook, WebhookDelivery, now


def is_public_url(url: str) -> bool:
    """SSRF guard: only http(s) URLs whose host resolves to public addresses (no localhost, private, link-local or metadata IPs)."""
    try:
        u = urlparse(url)
        if u.scheme not in ("http", "https") or not u.hostname:
            return False
        for info in socket.getaddrinfo(u.hostname, u.port or (443 if u.scheme == "https" else 80), proto=socket.IPPROTO_TCP):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
                return False
        return True
    except Exception:
        return False


def sign(secret: str, body: str) -> str:
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def emit(db: Session, tenant_id: str, event: str, payload: dict) -> int:
    n = 0
    for wh in db.query(Webhook).filter_by(tenant_id=tenant_id, active=True).all():
        if wh.events and event not in wh.events and "*" not in wh.events:
            continue
        db.add(Job(kind="webhook", payload={"webhook_id": wh.id, "event": event, "data": payload}))
        n += 1
    if n:
        db.commit()
    return n


def deliver(db: Session, job: Job) -> dict:
    wh = db.get(Webhook, job.payload["webhook_id"])
    if not wh or not wh.active:
        return {"skipped": True}
    if not is_public_url(wh.url):  # re-checked at delivery time (DNS can change after the hook was created)
        return {"skipped": "blocked: internal address"}
    body = json.dumps({"event": job.payload["event"], "data": job.payload["data"], "mock": True,
                       "sent_at": now().isoformat()}, separators=(",", ":"))
    code, ok = None, False
    try:
        r = httpx.post(wh.url, content=body, timeout=5,
                       headers={"Content-Type": "application/json", "X-Bharosa-Signature": sign(wh.secret, body),
                                "X-Bharosa-Event": job.payload["event"]})
        code, ok = r.status_code, r.status_code < 300
    except Exception:
        code, ok = None, False
    db.add(WebhookDelivery(webhook_id=wh.id, event=job.payload["event"], status_code=code, ok=ok))
    if not ok:
        raise RuntimeError(f"webhook delivery failed (status {code})")
    return {"status_code": code}
