"""Server-side security checks (what judges will curl) + the full self-attack scorecard."""
from app import demo


def test_rbac_matrix(client, tok):
    assert client.get("/cases").status_code == 401
    assert client.get("/audit", headers=tok("family02@citizen.demo")).status_code == 403
    assert client.post("/rules/draft", json={"definition": {}}, headers=tok("officer1@relief.demo")).status_code == 403
    assert client.get("/admin/users", headers=tok("officer1@relief.demo")).status_code == 403
    assert client.get("/audit", headers=tok("auditor@relief.demo")).status_code == 200
    assert client.get("/admin/users", headers=tok("admin@relief.demo")).status_code == 200


def test_auditor_is_read_only(client, tok):
    assert client.post("/cases", json={"data": {}}, headers=tok("auditor@relief.demo")).status_code == 403
    assert client.put("/risk/dial", json={"cost_matrix": {"wrong_approval": 1}}, headers=tok("auditor@relief.demo")).status_code == 403


def test_public_api_key(client):
    assert client.get("/v1/status").status_code == 401
    ok = client.get("/v1/status", headers={"X-API-Key": "bh_demo_public_key_mock_0001"})
    assert ok.status_code == 200 and ok.json()["mock"] is True
    r = client.post("/v1/eligibility/precheck", json={"age": 40, "monthly_income": 15000, "marital_status": "widowed", "household_size": 4},
                    headers={"X-API-Key": "bh_demo_public_key_mock_0001"})
    assert r.json()["verdict"] == "ELIGIBLE"


def test_consent_withdrawal_stops_access(client, tok):
    h = tok("liar-widow@citizen.demo")
    s = demo.SCENARIOS["claims_widow_but_married"]
    cid = client.post("/cases", json={"data": s["form"]}, headers=h).json()["id"]
    client.post(f"/cases/{cid}/submit", json={"consent": {"identity": True, "documents": True, "case_history": True}}, headers=h)
    off = tok("officer1@relief.demo")
    assert client.get(f"/cases/{cid}", headers=off).json()["data"]["name"] == "Nasreen Akhtar"
    for g in client.get("/consents", headers=h).json()["active"]:
        if g["grantee"] == "officer":
            client.post(f"/consents/{g['id']}/withdraw", headers=h)
    d = client.get(f"/cases/{cid}", headers=off).json()
    assert d["redacted"] is True and d["data"] is None
    assert client.post(f"/cases/{cid}/review", json={"action": "approve", "note": "x"}, headers=off).status_code == 403
    denied = client.get("/audit?action=access.denied", headers=tok("auditor@relief.demo")).json()
    assert denied


def test_audit_chain_and_tamper_detection(client, tok):
    a = tok("auditor@relief.demo")
    assert client.get("/audit/verify", headers=a).json()["ok"] is True
    assert client.get("/audit/verify?simulate_tamper_seq=3", headers=a).json()["ok"] is False


def test_idempotent_create(client, tok):
    h = {**tok("family03@citizen.demo"), "Idempotency-Key": "abc-123-xyz"}
    a = client.post("/cases", json={"data": {"name": "X"}}, headers=h).json()
    b = client.post("/cases", json={"data": {"name": "X"}}, headers=h).json()
    assert a["id"] == b["id"] and b.get("replayed") is True


def test_sync_replay_does_not_duplicate(client, tok):
    h = tok("family04@citizen.demo")
    ops = {"ops": [{"op_id": "op-aaaaaa-1", "type": "case.create", "payload": {"temp_id": "t1", "data": {"name": "Offline Person"}}},
                   {"op_id": "op-aaaaaa-2", "type": "case.patch", "payload": {"case_id": "t1", "data": {"district": "Malir"}}}]}
    r1 = client.post("/sync/batch", json=ops, headers=h).json()
    r2 = client.post("/sync/batch", json=ops, headers=h).json()
    assert [x["status"] for x in r1["results"]] == ["applied", "applied"]
    assert [x["status"] for x in r2["results"]] == ["duplicate_ignored", "duplicate_ignored"]
    assert len(client.get("/cases", headers=h).json()) == 1


def test_scam_and_rag(client):
    bad = client.post("/public/scam-check", json={"text": "BISP relief approved! send CNIC and Rs 500 fee to 0300-1234567", "sender": "0300"}).json()
    assert bad["verdict"] == "SCAM"
    good = client.post("/public/scam-check", json={"text": "Your payment is ready at an authorised retailer. No charges.", "sender": "8171"}).json()
    assert good["verdict"] == "LIKELY_REAL"
    a = client.post("/public/ask", json={"question": "Is there a fee to apply?"}).json()
    assert a["answered"] and a["sources"]
    n = client.post("/public/ask", json={"question": "How do I apply for a passport?"}).json()
    assert n["answered"] is False and n["handoff"] is True


def test_digital_twin_and_rule_versioning(client, tok):
    a = tok("admin@relief.demo")
    pub = client.get("/rules/published", headers=a).json()
    d = pub["definition"]
    for cnd in d["conditions"]:
        if cnd["id"] == "income":
            cnd["value"] = 15000
    res = client.post("/rules/twin", json={"definition": d}, headers=a).json()
    assert res["cases_replayed"] > 100 and res["changed_cases"] > 0
    assert client.get("/rules/published", headers=a).json()["version"] == pub["version"]  # twin changed nothing


def test_risk_dial_numbers(client, tok):
    r = client.get("/risk/dial", headers=tok("officer1@relief.demo")).json()
    assert r["thresholds"]["auto_approve_min_p"] > 0.99


def test_redteam_scorecard_all_green(client, tok):
    r = client.post("/redteam/run", headers=tok("admin@relief.demo"))
    assert r.status_code == 200, r.text
    out = r.json()
    failed = [x for x in out["results"] if not x["passed"]]
    assert not failed, [(x["id"], x["attack"], x["actual"]) for x in failed]


def test_diag_is_admin_only(client, tok):
    assert client.get("/ops/diag").status_code == 401
    assert client.get("/ops/diag", headers=tok("officer1@relief.demo")).status_code == 403
    d = client.get("/ops/diag", headers=tok("admin@relief.demo")).json()
    assert len(d["db_roundtrip_ms"]) == 6 and "typical_ms" in d


OUT_OF_SCOPE = ["Can I get a passport through this?", "How do I get a driving licence?", "What is the interest rate on a bank loan?",
                "Can I renew my passport here?", "Who won the cricket match yesterday?", "How do I register a company?"]
IN_SCOPE = [("Who can apply for relief?", "Who can apply"), ("What documents do I need?", "Documents required"),
            ("Can a widow with income 40000 get paid?", "Who can apply"), ("How do I take back my data?", "Your data")]


def test_rag_abstains_on_out_of_scope_without_llm(client, monkeypatch):
    from app import llm
    monkeypatch.setattr(llm, "enabled", lambda: False)
    for q in OUT_OF_SCOPE:
        r = client.post("/public/ask", json={"question": q}).json()
        assert r["answered"] is False and r["handoff"] is True and r["sources"] == [], q
    for q, sec in IN_SCOPE:
        r = client.post("/public/ask", json={"question": q}).json()
        assert r["answered"] and any(sec in s["section"] for s in r["sources"]), q


def test_rag_llm_not_sure_is_respected(client, monkeypatch):
    """Regression: when the model answers NOT_SURE the system used to fall back to the top retrieved paragraph (a wrong-topic answer)."""
    from app import llm
    monkeypatch.setattr(llm, "enabled", lambda: True)
    monkeypatch.setattr(llm, "chat", lambda *a, **k: "NOT_SURE")
    r = client.post("/public/ask", json={"question": "Who can apply for relief?"}).json()
    assert r["answered"] is False and r["handoff"] is True and r["sources"] == []
