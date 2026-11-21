import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import jobs, seed
from .config import BACKEND, get_settings
from .db import Base, SessionLocal, engine
from .metrics import METRICS
from .routers import admin, ai, auth, cases, consents, notifications, public, receipts, staff, voice
from .security import client_ip, rate_limited

settings = get_settings()
log = logging.getLogger("bharosa")
DESCRIPTION = """
**Bharosa (بھروسہ)** - AI on Public Rails. **PROTOTYPE ONLY - not an official service.**
All identity, payment and data services are **MOCKS** with synthetic people. No real personal data.

* Auth: `POST /auth/login` -> Bearer JWT. Roles: citizen, helper, officer, admin, auditor (enforced **server-side**).
* Public API: send `X-API-Key` (demo key in README) to `/v1/*` and `/mock/*`.
* Every decision has two views: a simple reason for the citizen and a full trace for the auditor.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(engine)  # local dev/tests only
    else:
        from alembic import command
        from alembic.config import Config
        cfg = Config()
        cfg.set_main_option("script_location", str(BACKEND / "migrations"))
        command.upgrade(cfg, "head")  # Postgres/Supabase: real migrations on every start (idempotent)
    if settings.seed_on_start:
        with SessionLocal() as db:
            seed.seed_all(db)
    jobs.start()
    yield


app = FastAPI(title="Bharosa API (PROTOTYPE)", version="1.0.0", description=DESCRIPTION, lifespan=lifespan,
              contact={"name": "Bharosa prototype"}, openapi_tags=[
                  {"name": "auth"}, {"name": "cases"}, {"name": "consent"}, {"name": "helper-mode"}, {"name": "staff"}, {"name": "ai"},
                  {"name": "public-api"}, {"name": "mock-services"}, {"name": "ops"}])

@app.middleware("http")
async def guard(request: Request, call_next):
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    t0 = time.time()
    path = request.url.path
    if not path.startswith(("/docs", "/openapi", "/static", "/health")) and rate_limited(f"ip:{client_ip(request)}", settings.rate_limit_per_min * 5, 60):
        return JSONResponse({"detail": "Too many requests. Please wait a moment."}, status_code=429, headers={"Retry-After": "20", "X-Request-ID": rid})
    err = None
    try:
        resp = await call_next(request)
    except Exception as e:  # last-resort: never leak a stack trace
        err = type(e).__name__
        log.exception("unhandled error rid=%s path=%s", rid, path)
        resp = JSONResponse({"detail": "Something went wrong on our side. Nothing was lost; please try again.", "request_id": rid}, status_code=500)
    resp.headers["X-Request-ID"] = rid
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Prototype"] = "true; mock data only"
    ms = (time.time() - t0) * 1000
    METRICS.record(path if not path.count("/") > 3 else "/".join(path.split("/")[:4]), resp.status_code, ms, err)
    return resp


origins = [o.strip() for o in settings.cors_origins.split(",")] if settings.cors_origins else ["*"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["*"], allow_headers=["*"],
                   expose_headers=["X-Request-ID", "Retry-After"])
app.add_middleware(GZipMiddleware, minimum_size=500)  # low-bandwidth: compress responses


app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(consents.router)
app.include_router(consents.helper_router)
app.include_router(staff.router)
app.include_router(admin.router)
app.include_router(ai.router)
app.include_router(voice.router)
app.include_router(notifications.router)
app.include_router(receipts.router)
app.include_router(public.router)
try:
    from .routers import redteam
    app.include_router(redteam.router)
except ImportError:
    pass

static_dir = BACKEND / "static"
static_dir.mkdir(exist_ok=True)
(static_dir / "audio").mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/", include_in_schema=False)
def root():
    return {"service": "Bharosa API", "prototype": True, "docs": "/docs", "openapi": "/openapi.json", "about": "/about", "health": "/health"}
