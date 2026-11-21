"""Receipts, recourse, notifications, helper one-time-code consent, rule safety gate and integrity guards."""
import json

from app import demo

ALL = {"identity": True, "payment": True, "documents": True, "case_history": True}


def _claim(client, h, scenario, consent=ALL):
    s = demo.SCENARIOS[scenario]
    cid = client.post("/cases", json={"data": s["form"]}, headers=h).json()["id"]
    if s["card"]:
        client.post(f"/cases/{cid}/documents", files={"file": ("c.jpg", demo.make_card(scenario), "image/jpeg")}, headers=h)
    return cid, client.post(f"/cases/{cid}/submit", json={"consent": consent}, headers=h).json()


def test_recourse_is_computed_not_canned(client, tok):
    h = tok("widow-blurry@citizen.demo")
    cid, out = _claim(client, h, "widow_blurry_photo")
    assert out["route"] == "ASK_PROOF"
    rec = client.get(f"/cases/{cid}/decision", headers=h).json()["reason_user"]["recourse"]
    flip = [r for r in rec if r.get("would_route") == "AUTO_APPROVE"]
    assert flip and flip[0]["p_legit_after"] > 0.99 and flip[0]["ur"] and flip[0]["roman"]


def test_rule_failure_is_explained_as_recourse(client, tok):
    h = tok("too-rich@citizen.demo")
    cid, out = _claim(client, h, "honestly_over_income")
    rec = client.get(f"/cases/{cid}/decision", headers=h).json()["reason_user"]["recourse"]
    assert any("income" in r["en"].lower() for r in rec)


def test_receipt_verifies_publicly_and_rejects_tampering(client, tok):
    h = tok("widow-forged@citizen.demo")
    cid, out = _claim(client, h, "forged_card")
    r = client.get(f"/cases/{cid}/receipt", headers=h).json()
    v = client.get("/public/verify-receipt", params={"t": r["token"]}).json()
    assert v["valid"] and v["audit_entry_found"] and "name" not in v and "cnic" not in json.dumps(v).lower()
    assert client.get("/public/verify-receipt", params={"t": r["token"][:-4] + "zzzz"}).json()["valid"] is False
    assert client.get(f"/cases/{cid}/receipt.png", headers=h).headers["content-type"] == "image/png"
    assert client.get(f"/cases/{cid}/receipt", headers=tok("family05@citizen.demo")).status_code == 404  # someone else's case


def test_notifications_inbox(client, tok):
    h = tok("widow-forged@citizen.demo")
    inbox = client.get("/notifications", headers=h).json()
    assert inbox["unread"] >= 1
    assert all(i["simulated"] for i in inbox["items"] if i["channel"] != "in_app")
    nid = next(i["id"] for i in inbox["items"] if i["channel"] == "in_app")
    assert client.post(f"/notifications/{nid}/read", headers=h).json()["read"] is True
    assert client.post(f"/notifications/{nid}/read", headers=tok("family06@citizen.demo")).status_code == 404


def test_helper_cannot_self_consent(client, tok, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "demo_show_otp", False)
    hh = tok("helper@relief.demo")
    fam = client.get("/helper/families", headers=hh).json()["families"][10]["citizen_id"]
    # session locked: no action for a family before switching to it
    assert client.post("/cases", json={"citizen_id": fam, "data": {}}, headers=hh).status_code == 423
    client.post(f"/helper/switch/{fam}", headers=hh)
    r = client.post(f"/helper/families/{fam}/consent/request", json={"scopes": ["identity"]}, headers=hh).json()
    assert r["sent"] and r["mock_code_for_demo"] is None  # the code is NOT returned to the helper
    assert client.post(f"/helper/families/{fam}/consent/confirm", json={"code": "123456"}, headers=hh).status_code == 403
    client.post("/helper/lock", headers=hh)
    assert client.post(f"/helper/families/{fam}/consent/request", headers=hh).status_code == 423


def test_publish_safety_gate_blocks_and_allows_with_reason(client, tok):
    a = tok("admin@relief.demo")
    live = client.get("/rules/published", headers=a).json()
    loose = json.loads(json.dumps(live["definition"]))
    loose["conditions"] = [c for c in loose["conditions"] if c["id"] != "vulnerable"]
    d = client.post("/rules/draft", json={"definition": loose}, headers=a).json()
    blocked = client.post(f"/rules/{d['id']}/publish", headers=a)
    assert blocked.status_code == 409 and blocked.json()["detail"]["error"] == "safety_gate"
    assert client.get("/rules/published", headers=a).json()["version"] == live["version"]  # nothing changed
    assert client.post(f"/rules/{d['id']}/publish", json={"override_reason": "short"}, headers=a).status_code == 409  # reason too short
    ok = client.post(f"/rules/{d['id']}/publish", json={"override_reason": "Pilot widening approved by the director"}, headers=a)
    assert ok.status_code == 200 and ok.json()["safety_gate"]["passed"] is False
    # restore the original rule so later tests see the standard rules (a tightening change always passes the gate)
    back = client.post("/rules/draft", json={"definition": live["definition"]}, headers=a).json()
    client.post(f"/rules/{back['id']}/publish", json={"override_reason": "restore standard rules after the test"}, headers=a)


def test_integrity_guards(client, tok):
    a = tok("admin@relief.demo")
    assert client.post("/admin/webhooks", json={"url": "http://127.0.0.1:8000/x"}, headers=a).status_code == 422
    assert client.post("/admin/webhooks", json={"url": "http://169.254.169.254/"}, headers=a).status_code == 422
    assert client.put("/risk/dial", json={"cost_matrix": {"wrong_approval": 0, "human_review": 0, "delay_harm_human": 0}}, headers=a).status_code == 422
    m = client.get("/metrics").json()
    assert "recent_errors" not in m and "top_routes" not in m
    assert client.get("/metrics/detail").status_code == 401


def test_cross_department_documents_are_invisible(client, tok):
    h = tok("widow-blurry@citizen.demo")
    cid = client.get("/cases", headers=h).json()[0]["id"]
    docs = client.get(f"/cases/{cid}/documents", headers=h).json()
    assert docs
    other = tok("officer@flood.demo")
    assert client.get(f"/documents/{docs[0]['id']}/file", headers=other).status_code == 404


def test_admin_endpoints_smoke(client, tok):
    a = tok("admin@relief.demo")
    for path in ("/admin/users", "/admin/api-keys", "/admin/webhooks", "/admin/jobs", "/admin/tenant"):
        assert client.get(path, headers=a).status_code == 200, path
        assert client.get(path, headers=tok("officer1@relief.demo")).status_code == 403, path
    assert all(u["phone"] is None or u["phone"].startswith("*") for u in client.get("/admin/users", headers=a).json())


def test_redteam_runs_in_background_with_live_progress(client, tok):
    import time
    a = tok("admin@relief.demo")
    assert client.post("/redteam/start", headers=tok("officer1@relief.demo")).status_code == 403
    assert client.post("/redteam/start", headers=a).json()["status"] == "running"
    seen_partial = False
    for _ in range(180):
        p = client.get("/redteam/progress", headers=a).json()
        seen_partial = seen_partial or (p["status"] == "running" and p["done"] > 0)
        if p["status"] != "running":
            break
        time.sleep(1)
    assert p["status"] == "done", p.get("error")
    assert not [r["id"] for r in p["results"] if not r["passed"]]
    assert p["result"]["total"] == len(p["results"]) >= 50
