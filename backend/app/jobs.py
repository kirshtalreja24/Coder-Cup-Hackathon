"""Background jobs: DB-backed queue + a worker thread started with the app. Retries with attempt cap; failures are visible."""
import threading
import time

from .db import SessionLocal
from .models import Job, now

_stop = threading.Event()
MAX_ATTEMPTS = 3


def enqueue(db, kind: str, payload: dict) -> Job:
    j = Job(kind=kind, payload=payload)
    db.add(j)
    db.commit()
    return j


def run_one(db, job: Job) -> None:
    from . import webhooks
    claimed = db.query(Job).filter(Job.id == job.id, Job.status == "queued").update({"status": "running", "attempts": job.attempts + 1})
    db.commit()
    if not claimed:  # another worker already took this job
        return
    db.refresh(job)
    try:
        if job.kind == "webhook":
            job.result = webhooks.deliver(db, job)
        elif job.kind == "noop":
            job.result = {"ok": True}
        else:
            job.result = {"skipped": f"unknown kind {job.kind}"}
        job.status, job.finished_at = "done", now()
    except Exception as e:  # noqa
        job.result = {"error": str(e)[:200]}
        job.status = "failed" if job.attempts >= MAX_ATTEMPTS else "queued"
        if job.status == "failed":
            job.finished_at = now()
    db.commit()


def worker_loop():
    while not _stop.is_set():
        try:
            with SessionLocal() as db:
                job = db.query(Job).filter_by(status="queued").order_by(Job.created_at.asc()).first()
                if job:
                    run_one(db, job)
                    continue
        except Exception:
            pass
        time.sleep(2.0)


def start():
    t = threading.Thread(target=worker_loop, daemon=True, name="bharosa-jobs")
    t.start()
    return t


def drain(db, limit: int = 50) -> int:
    """Run queued jobs synchronously (tests / admin 'run now')."""
    n = 0
    for job in db.query(Job).filter_by(status="queued").order_by(Job.created_at.asc()).limit(limit).all():
        run_one(db, job)
        n += 1
    return n
