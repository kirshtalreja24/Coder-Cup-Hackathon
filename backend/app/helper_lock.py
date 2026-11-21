"""Server-side Helper Mode lock. A helper acts for ONE family at a time, and the session locks itself after 60 s of inactivity.
(The browser also shows a countdown, but the lock is enforced here, so a curl script cannot skip it.)
In-memory by design: the prototype runs a single API process."""
import threading
import time
from contextvars import ContextVar

from fastapi import HTTPException

LOCK_SECONDS = 60
_lock = threading.Lock()
_active: dict[str, tuple[str, float]] = {}  # helper_id -> (citizen_id, last_activity)
# Offline sync replays operations that were authorised while the session was live: it must not be locked out by the delay.
bypass: ContextVar[bool] = ContextVar("helper_lock_bypass", default=False)


def activate(helper_id: str, citizen_id: str) -> None:
    with _lock:
        _active[helper_id] = (citizen_id, time.time())


def deactivate(helper_id: str) -> None:
    with _lock:
        _active.pop(helper_id, None)


def is_active(helper_id: str, citizen_id: str, refresh: bool = True) -> bool:
    if bypass.get():
        return True
    with _lock:
        cur = _active.get(helper_id)
        if not cur or cur[0] != citizen_id or time.time() - cur[1] > LOCK_SECONDS:
            return False
        if refresh:
            _active[helper_id] = (citizen_id, time.time())
        return True


def require_active(helper_id: str, citizen_id: str) -> None:
    if not is_active(helper_id, citizen_id):
        raise HTTPException(423, "Helper session is locked. Switch to this family first (it locks after 60 seconds of inactivity).")
