"""Tamper-evident audit log: every row commits to the previous row's hash (hash chain)."""
import hashlib
import json
import threading
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from .models import AuditEvent, User, now

GENESIS = "0" * 64
_lock = threading.Lock()


def _ts_norm(dt: datetime) -> str:
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.isoformat(timespec="microseconds")


def _digest(prev: str, ts: datetime, tenant_id, actor_type, actor_id, actor_role, action, rtype, rid, outcome, details) -> str:
    body = json.dumps(
        [prev, _ts_norm(ts), tenant_id, actor_type, actor_id, actor_role, action, rtype, rid, outcome, details],
        sort_keys=True, separators=(",", ":"), default=str, ensure_ascii=False,
    )
    return hashlib.sha256(body.encode()).hexdigest()


def log(db: Session, *, action: str, actor: User | None = None, actor_type: str = "user", actor_id: str | None = None,
        actor_role: str | None = None, tenant_id: str | None = None, resource_type: str | None = None,
        resource_id: str | None = None, outcome: str = "ok", details: dict | None = None, commit: bool = True) -> AuditEvent:
    if actor is not None:
        actor_id, actor_role, tenant_id = actor.id, actor.role, tenant_id or actor.tenant_id
    details = details or {}
    with _lock:
        last = db.query(AuditEvent).order_by(AuditEvent.seq.desc()).first()
        prev = last.hash if last else GENESIS
        ts = now()
        h = _digest(prev, ts, tenant_id, actor_type, actor_id, actor_role, action, resource_type, resource_id, outcome, details)
        ev = AuditEvent(ts=ts, tenant_id=tenant_id, actor_type=actor_type, actor_id=actor_id, actor_role=actor_role,
                        action=action, resource_type=resource_type, resource_id=resource_id, outcome=outcome,
                        details=details, prev_hash=prev, hash=h)
        db.add(ev)
        if commit:
            db.commit()
        else:
            db.flush()
    return ev


def verify_chain(db: Session, simulate_tamper_seq: int | None = None) -> dict:
    res = _verify_chain(db, simulate_tamper_seq)
    res["append_only_enforced"] = append_only_enforced(db)  # real state of the database-level protection
    return res


def _verify_chain(db: Session, simulate_tamper_seq: int | None = None) -> dict:
    """Recompute the whole chain. If simulate_tamper_seq is set, that row is altered IN MEMORY ONLY to prove detection."""
    prev = GENESIS
    checked = 0
    for ev in db.query(AuditEvent).order_by(AuditEvent.seq.asc()).yield_per(500):
        details = ev.details
        if simulate_tamper_seq is not None and ev.seq == simulate_tamper_seq:
            details = {**(details or {}), "tampered": True}
        expect = _digest(prev, ev.ts, ev.tenant_id, ev.actor_type, ev.actor_id, ev.actor_role, ev.action,
                         ev.resource_type, ev.resource_id, ev.outcome, details)
        if ev.prev_hash != prev or ev.hash != expect:
            return {"ok": False, "checked": checked, "broken_at_seq": ev.seq,
                    "message": f"Chain broken at event #{ev.seq}: content or order was altered."}
        prev = ev.hash
        checked += 1
    return {"ok": True, "checked": checked, "head_hash": prev, "broken_at_seq": None,
            "message": f"All {checked} audit events verify. No tampering detected."}


def append_only_enforced(db: Session) -> bool | None:
    """Is the database itself refusing UPDATE/DELETE on audit_events? None = could not tell."""
    try:
        name = db.get_bind().dialect.name
        if name == "sqlite":
            n = db.execute(text("select count(*) from sqlite_master where type='trigger' and name like 'audit_events_no_%'")).scalar()
            return n == 2
        if name == "postgresql":
            return bool(db.execute(text("select 1 from pg_trigger where tgname='audit_events_no_change' and not tgisinternal")).first())
    except Exception:  # noqa
        db.rollback()
    return None
