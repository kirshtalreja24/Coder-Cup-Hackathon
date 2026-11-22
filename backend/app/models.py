import uuid
from datetime import datetime, timezone
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


def uid() -> str:
    return uuid.uuid4().hex


def now() -> datetime:
    return datetime.now(timezone.utc)


ROLES = ("citizen", "helper", "officer", "admin", "auditor")


class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    slug: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    plan: Mapped[str] = mapped_column(String(20), default="free")
    monthly_quota: Mapped[int] = mapped_column(Integer, default=1000)
    usage_this_month: Mapped[int] = mapped_column(Integer, default=0)
    cost_matrix: Mapped[dict] = mapped_column(JSON, default=dict)  # Risk Dial settings
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    email: Mapped[str] = mapped_column(String(160), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20), index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    locale: Mapped[str] = mapped_column(String(10), default="ur")
    cnic: Mapped[str | None] = mapped_column(String(15), nullable=True)  # MOCK cnic of the citizen
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    tenant = relationship("Tenant")


class HelperLink(Base):
    """Helper -> citizen relationship (Helper Mode: one shared phone, many families)."""
    __tablename__ = "helper_links"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    helper_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    citizen_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("helper_id", "citizen_id"),)


class MockNadraRecord(Base):
    """SIMULATED national identity registry. Synthetic people only."""
    __tablename__ = "mock_nadra"
    cnic: Mapped[str] = mapped_column(String(15), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    name_key: Mapped[str] = mapped_column(String(160), index=True)
    father_name: Mapped[str | None] = mapped_column(String(120))
    dob: Mapped[str | None] = mapped_column(String(10))
    gender: Mapped[str | None] = mapped_column(String(1))
    district: Mapped[str | None] = mapped_column(String(60))
    marital_status: Mapped[str | None] = mapped_column(String(20))
    spouse_cnic: Mapped[str | None] = mapped_column(String(15))
    spouse_status: Mapped[str | None] = mapped_column(String(20))
    monthly_income: Mapped[int | None] = mapped_column(Integer)
    household_size: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="active")
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True)


class RuleVersion(Base):
    __tablename__ = "rule_versions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    key: Mapped[str] = mapped_column(String(60), index=True)  # e.g. relief_eligibility
    version: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), default="draft")  # draft|published|archived
    definition: Mapped[dict] = mapped_column(JSON)
    note: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (UniqueConstraint("tenant_id", "key", "version"),)


class Case(Base):
    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    type: Mapped[str] = mapped_column(String(30), default="relief_claim")
    status: Mapped[str] = mapped_column(String(24), default="new", index=True)
    citizen_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))  # citizen or helper acting for them
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=3)  # 1 highest
    data: Mapped[dict] = mapped_column(JSON, default=dict)  # submitted form (validated)
    progress: Mapped[dict] = mapped_column(JSON, default=dict)  # saved step progress
    handoff_brief: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_historical: Mapped[bool] = mapped_column(Boolean, default=False)  # seeded past cases for Digital Twin
    ground_truth: Mapped[str | None] = mapped_column(String(12), nullable=True)  # legit|fraud (synthetic only)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CaseEvent(Base):
    __tablename__ = "case_events"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), index=True)
    actor_id: Mapped[str | None] = mapped_column(String(32))
    kind: Mapped[str] = mapped_column(String(30))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Decision(Base):
    __tablename__ = "decisions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), index=True)
    tenant_id: Mapped[str] = mapped_column(String(32), index=True)
    route: Mapped[str] = mapped_column(String(20))  # AUTO_APPROVE|ASK_PROOF|HUMAN_REVIEW|AUTO_REJECT_SAFE
    p_legit: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    rule_version_id: Mapped[str | None] = mapped_column(String(32))
    rule_version: Mapped[int | None] = mapped_column(Integer)
    model_version: Mapped[str] = mapped_column(String(40), default="bharosa-decider-1.0")
    trace: Mapped[dict] = mapped_column(JSON)  # full auditor trace
    reason_user: Mapped[dict] = mapped_column(JSON)  # {en, ur, roman}
    final_outcome: Mapped[str | None] = mapped_column(String(20))  # set after human/auto resolution
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    case_id: Mapped[str | None] = mapped_column(ForeignKey("cases.id"), index=True, nullable=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30), default="cnic_front")
    filename: Mapped[str] = mapped_column(String(200))
    path: Mapped[str] = mapped_column(String(400))
    sha256: Mapped[str] = mapped_column(String(64))
    analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Consent(Base):
    __tablename__ = "consents"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    subject_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)  # the citizen
    grantee_type: Mapped[str] = mapped_column(String(20))  # user|role|service
    grantee: Mapped[str] = mapped_column(String(80))  # user id, role name ('officer'), or service ('mock_raast')
    scope: Mapped[str] = mapped_column(String(30))  # identity|documents|case_history|payment|profile
    status: Mapped[str] = mapped_column(String(12), default="active")  # active|withdrawn
    purpose: Mapped[str | None] = mapped_column(String(200))
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    receipt_hash: Mapped[str | None] = mapped_column(String(64))
    __table_args__ = (Index("ix_consent_lookup", "subject_id", "grantee", "scope", "status"),)


class AuditEvent(Base):
    """Append-only, hash-chained. Each row commits to the previous row's hash."""
    __tablename__ = "audit_events"
    seq: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    tenant_id: Mapped[str | None] = mapped_column(String(32), index=True)
    actor_type: Mapped[str] = mapped_column(String(10))  # user|ai|agent|system
    actor_id: Mapped[str | None] = mapped_column(String(32))
    actor_role: Mapped[str | None] = mapped_column(String(20))
    action: Mapped[str] = mapped_column(String(60), index=True)
    resource_type: Mapped[str | None] = mapped_column(String(30))
    resource_id: Mapped[str | None] = mapped_column(String(40))
    outcome: Mapped[str] = mapped_column(String(12), default="ok")  # ok|denied|error
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))


class ApiKey(Base):
    __tablename__ = "api_keys"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    prefix: Mapped[str] = mapped_column(String(12), index=True)
    key_hash: Mapped[str] = mapped_column(String(64))
    scopes: Mapped[list] = mapped_column(JSON, default=list)
    rate_limit_per_min: Mapped[int] = mapped_column(Integer, default=60)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ScamMessage(Base):
    __tablename__ = "scam_messages"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    tenant_id: Mapped[str | None] = mapped_column(String(32), index=True)
    reporter_id: Mapped[str | None] = mapped_column(String(32))
    sender: Mapped[str | None] = mapped_column(String(40))
    text: Mapped[str] = mapped_column(Text)
    channel: Mapped[str] = mapped_column(String(12), default="sms")
    area: Mapped[str | None] = mapped_column(String(60), index=True)
    verdict: Mapped[str] = mapped_column(String(12))  # SCAM|SUSPICIOUS|LIKELY_REAL|UNSURE
    score: Mapped[float] = mapped_column(Float)
    scam_type: Mapped[str | None] = mapped_column(String(30), index=True)
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), index=True)
    cnic: Mapped[str] = mapped_column(String(15), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    rail: Mapped[str] = mapped_column(String(30), default="MOCK-RAAST")
    status: Mapped[str] = mapped_column(String(12), default="paid")
    reference: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    channel: Mapped[str] = mapped_column(String(12), default="in_app")  # sms/whatsapp/email are MOCK logs
    body: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Webhook(Base):
    __tablename__ = "webhooks"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    url: Mapped[str] = mapped_column(String(300))
    events: Mapped[list] = mapped_column(JSON, default=list)
    secret: Mapped[str] = mapped_column(String(64))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    webhook_id: Mapped[str] = mapped_column(ForeignKey("webhooks.id"), index=True)
    event: Mapped[str] = mapped_column(String(60))
    status_code: Mapped[int | None] = mapped_column(Integer)
    ok: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class IdempotencyRecord(Base):
    """Offline-first sync: replaying the same op never duplicates work."""
    __tablename__ = "idempotency"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), index=True)
    response: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class PolicyChunk(Base):
    """Official (mock) rules/forms/policies for RAG."""
    __tablename__ = "policy_chunks"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    source: Mapped[str] = mapped_column(String(120))
    section: Mapped[str] = mapped_column(String(120))
    text: Mapped[str] = mapped_column(Text)
    lang: Mapped[str] = mapped_column(String(8), default="en")


class Job(Base):
    """Lightweight DB-backed background job queue."""
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    kind: Mapped[str] = mapped_column(String(30), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(12), default="queued", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# ---- the audit log is append-only AT THE DATABASE LEVEL (not just by convention) ---------------------------
# SQLite (local dev + tests): triggers created together with the table. Postgres (Supabase): the same rule is installed by
# migration 0002. Either way an UPDATE or DELETE on audit_events fails, so a bug or an injected statement cannot rewrite history.
from sqlalchemy import DDL, event  # noqa: E402

event.listen(AuditEvent.__table__, "after_create", DDL(
    "CREATE TRIGGER IF NOT EXISTS audit_events_no_update BEFORE UPDATE ON audit_events "
    "BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END").execute_if(dialect="sqlite"))
event.listen(AuditEvent.__table__, "after_create", DDL(
    "CREATE TRIGGER IF NOT EXISTS audit_events_no_delete BEFORE DELETE ON audit_events "
    "BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END").execute_if(dialect="sqlite"))
