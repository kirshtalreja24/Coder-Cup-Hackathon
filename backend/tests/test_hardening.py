"""P1 hardening: consent reaches auditors, login limiter, upload allow-list, Scam Map poisoning."""
import io
import uuid

from app import demo

ALL = {"identity": True, "payment": True, "documents": True, "case_history": True}


def _submit_with_consent(client, tok, who="liar-widow@citizen.demo", scenario="claims_widow_but_married"):
    h = tok(who)
    s = demo.SCENARIOS[scenario]
    cid = client.post("/cases", json={"data": s["form"]}, headers=h).json()["id"]
    r = client.post(f"/cases/{cid}/submit", json={"consent": ALL}, headers=h)
    assert r.status_code == 200, r.text
    return cid, h


# ---------------------------------------------------------------- 1. withdrawing consent also hides the data from auditors/admins
def test_withdrawal_hides_case_data_and_trace_input_from_auditor_and_admin(client, tok):
    cid, h = _submit_with_consent(client, tok)
    aud, adm = tok("auditor@relief.demo"), tok("admin@relief.demo")
    before = client.get(f"/cases/{cid}", headers=aud).json()
    assert before["redacted"] is False and before["masked"] is True and before["data"]["name"]
    trace_before = client.get(f"/cases/{cid}/decision", headers=aud).json()["trace"]
    assert trace_before["input"].get("name")

    assert client.post("/consents/withdraw-all", headers=h).json()["withdrawn"] > 0

    for who in (aud, adm):
        after = client.get(f"/cases/{cid}", headers=who).json()
        assert after["redacted"] is True and after["data"] is None and "withdrawn" in after["redaction_reason"]
    trace_after = client.get(f"/cases/{cid}/decision", headers=aud).json()["trace"]
    assert trace_after["input"].get("redacted") is True and "name" not in trace_after["input"]
    # the decision itself (route, confidence, rule version) stays auditable
    d = client.get(f"/cases/{cid}/decision", headers=aud).json()
    assert d["route"] and d["rule_version"] and d["confidence"] is not None
    rows = client.get("/audit/decisions?limit=500", headers=aud).json()
    mine = [r for r in rows if r["case_id"] == cid]
    assert mine and mine[0]["trace"]["input"].get("redacted") is True


# ---------------------------------------------------------------- 2. login limiter counts failures, not logins
def test_many_successful_logins_from_one_address_are_not_blocked(client):
    for _ in range(25):
        r = client.post("/auth/login", data={"username": "officer1@relief.demo", "password": "Demo#12345"},
                        headers={"x-forwarded-for": "10.77.0.1"})
        assert r.status_code == 200, r.text


def test_repeated_wrong_passwords_lock_that_account_only(client):
    email = f"lock{uuid.uuid4().hex[:6]}@t.demo"  # a throw-away account: the lock must not leak into other tests
    assert client.post("/auth/register", json={"email": email, "name": "Lock Test", "password": "Passw0rd!!"}).status_code == 201
    codes = [client.post("/auth/login", data={"username": email, "password": "wrong-" + str(i)}, headers={"x-forwarded-for": "10.77.1.1"}).status_code
             for i in range(10)]
    assert codes[:8] == [401] * 8 and codes[8] == 429
    # even the right password is refused while locked (a guesser cannot confirm a hit) ...
    assert client.post("/auth/login", data={"username": email, "password": "Passw0rd!!"}, headers={"x-forwarded-for": "10.77.1.2"}).status_code == 429
    # ... but other accounts, even from the same address, are unaffected
    assert client.post("/auth/login", data={"username": "officer2@relief.demo", "password": "Demo#12345"}, headers={"x-forwarded-for": "10.77.1.1"}).status_code == 200


def test_one_address_guessing_many_accounts_is_limited(client):
    codes = [client.post("/auth/login", data={"username": f"nobody{i}@x.demo", "password": "x"}, headers={"x-forwarded-for": "10.77.2.2"}).status_code
             for i in range(62)]
    assert 429 in codes and codes[0] == 401


# ---------------------------------------------------------------- 3. only real photos are accepted
def _case(client, tok):
    h = tok("widow-clean@citizen.demo")
    return client.post("/cases", json={"data": {}}, headers=h).json()["id"], h


def test_upload_rejects_non_images_even_with_an_image_name(client, tok):
    cid, h = _case(client, tok)
    for name, data, ctype in [("card.jpg", b"<html><script>alert(1)</script></html>", "image/jpeg"),
                              ("evil.exe", b"MZ" + b"\0" * 200, "application/octet-stream"),
                              ("doc.pdf", b"%PDF-1.4 fake", "application/pdf")]:
        r = client.post(f"/cases/{cid}/documents", files={"file": (name, data, ctype)}, headers=h)
        assert r.status_code == 415, (name, r.status_code, r.text)
    assert client.get(f"/cases/{cid}/documents", headers=h).json() == []


def test_upload_accepts_real_photos(client, tok):
    cid, h = _case(client, tok)
    r = client.post(f"/cases/{cid}/documents", files={"file": ("c.jpg", demo.make_card("widow_clean"), "image/jpeg")}, headers=h)
    assert r.status_code == 201
    from PIL import Image
    buf = io.BytesIO(); Image.new("RGB", (400, 300), (200, 220, 200)).save(buf, "PNG")
    assert client.post(f"/cases/{cid}/documents", files={"file": ("c.png", buf.getvalue(), "image/png")}, headers=h).status_code == 201


# ---------------------------------------------------------------- 4. anonymous reports cannot move the department's Scam Map
def test_public_scam_reports_are_kept_out_of_the_department_map(client, tok):
    off = tok("officer1@relief.demo")
    before = client.get("/scam/map?days=30", headers=off).json()
    tag = uuid.uuid4().hex[:6]
    for i in range(6):
        r = client.post("/public/scam-check", headers={"x-forwarded-for": f"10.88.{i}.1"}, json={
            "text": f"BISP relief approved! Send your CNIC and fee Rs 500 to JazzCash 0300-12345{i}{i} {tag}{i}", "sender": "0300", "area": "Poisoned Town", "report": True})
        assert r.status_code == 200
    after = client.get("/scam/map?days=30", headers=off).json()
    assert after["flagged"] == before["flagged"] and after["total_reports"] == before["total_reports"]
    assert "Poisoned Town" not in dict(after["by_area"]) and all(a["area"] != "Poisoned Town" for a in after["rising_areas"])
    assert after["public_unverified"]["flagged"] >= 1 and "Poisoned Town" in dict(after["public_unverified"]["by_area"])


# ---------------------------------------------------------------- 5. the audit table refuses UPDATE / DELETE in the database itself
def test_audit_table_is_append_only_in_the_database(client, tok):
    import pytest
    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError
    from app.db import SessionLocal
    client.post("/auth/login", data={"username": "nobody@x.demo", "password": "x"}, headers={"x-forwarded-for": "10.99.0.1"})  # make sure a row exists
    with SessionLocal() as db:
        seq = db.execute(text("select min(seq) from audit_events")).scalar()
        assert seq is not None
        for stmt in ("update audit_events set outcome='ok' where seq=:s", "delete from audit_events where seq=:s"):
            with pytest.raises(DBAPIError, match="append-only"):
                db.execute(text(stmt), {"s": seq}); db.commit()
            db.rollback()
    v = client.get("/audit/verify", headers=tok("auditor@relief.demo")).json()
    assert v["ok"] is True and v["append_only_enforced"] is True


# ---------------------------------------------------------------- 6. helper one-time codes are never stored in clear
def test_helper_code_is_stored_hashed(client, tok):
    from app.db import SessionLocal
    from app.models import IdempotencyRecord
    h = tok("helper@relief.demo")
    fam = client.get("/helper/families", headers=h).json()["families"][20]["citizen_id"]
    client.post(f"/helper/switch/{fam}", headers=h)
    r = client.post(f"/helper/families/{fam}/consent/request", headers=h, json={"scopes": ["identity"]})
    assert r.status_code == 200
    with SessionLocal() as db:
        rec = [x for x in db.query(IdempotencyRecord).all() if x.key.startswith("otp:") and x.key.endswith(fam)]
        assert rec and all("code" not in x.response and len(x.response["code_hash"]) == 64 for x in rec)
