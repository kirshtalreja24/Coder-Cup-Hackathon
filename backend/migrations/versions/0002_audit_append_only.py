"""audit_events is append-only (Postgres trigger)

Revision ID: 0002
Revises: 0001

Fail-safe by design: the whole block runs inside a PL/pgSQL exception handler, so if the database role lacks a privilege the
migration records a NOTICE and the API still starts (the hash chain keeps detecting tampering either way).
GET /audit/verify reports `append_only_enforced` so the real state is visible.
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return  # SQLite gets its triggers from the model (see app/models.py)
    op.execute("""
        DO $do$
        BEGIN
            CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger AS $fn$
            BEGIN
                RAISE EXCEPTION 'audit_events is append-only';
            END;
            $fn$ LANGUAGE plpgsql;
            DROP TRIGGER IF EXISTS audit_events_no_change ON audit_events;
            CREATE TRIGGER audit_events_no_change BEFORE UPDATE OR DELETE ON audit_events
                FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'audit append-only trigger NOT installed (see SQLERRM)';
        END
        $do$
    """)


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("DROP TRIGGER IF EXISTS audit_events_no_change ON audit_events")
    op.execute("DROP FUNCTION IF EXISTS audit_events_append_only()")
