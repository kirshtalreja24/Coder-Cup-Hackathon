"""End-to-end behaviour tests of the claim agent on the demo scenarios (all synthetic)."""
import pytest
from app import demo

ALL_CONSENT = {"identity": True, "payment": True, "documents": True, "case_history": True}


def run_scenario(client, tok, key, consent=ALL_CONSENT, upload=True):
    s = demo.SCENARIOS[key]
    h = tok(s["login"])
    cid = client.post("/cases", json={"data": s["form"]}, headers=h).json()["id"]
    if s["card"] and upload:
        img = demo.make_card(key)
        r = client.post(f"/cases/{cid}/documents", files={"file": ("card.jpg", img, "image/jpeg")}, headers=h)
        assert r.status_code == 201, r.text
    r = client.post(f"/cases/{cid}/submit", json={"consent": consent}, headers=h)
    assert r.status_code == 200, r.text
    return cid, r.json()


def test_clean_widow_is_auto_approved_with_payment(client, tok):
    cid, out = run_scenario(client, tok, "widow_clean")
    assert out["route"] == "AUTO_APPROVE", out
    assert out["payment"]["reference"].startswith("MOCK-")


def test_duplicate_claim_never_auto_approved(client, tok):
    cid, out = run_scenario(client, tok, "widow_clean")  # same person again, already paid in test above
    assert out["route"] != "AUTO_APPROVE", out


def test_blurry_photo_asks_for_proof(client, tok):
    cid, out = run_scenario(client, tok, "widow_blurry_photo")
    assert out["route"] in ("ASK_PROOF", "HUMAN_REVIEW"), out


def test_forged_card_goes_to_human(client, tok):
    cid, out = run_scenario(client, tok, "forged_card")
    assert out["route"] == "HUMAN_REVIEW", out


def test_name_variant_does_not_auto_approve(client, tok):
    cid, out = run_scenario(client, tok, "name_variant_missing_fields")
    assert out["route"] in ("ASK_PROOF", "HUMAN_REVIEW"), out


def test_claims_widow_but_married_is_flagged(client, tok):
    cid, out = run_scenario(client, tok, "claims_widow_but_married")
    assert out["route"] == "HUMAN_REVIEW", out


def test_honest_over_income_is_declined_with_appeal(client, tok):
    cid, out = run_scenario(client, tok, "honestly_over_income")
    assert out["route"] == "DECLINE_WITH_APPEAL", out


def test_garbage_input_does_not_crash(client, tok):
    cid, out = run_scenario(client, tok, "garbage_input")
    assert out["route"] in ("ASK_PROOF", "HUMAN_REVIEW", "NEEDS_CONSENT"), out


def test_no_consent_means_nothing_is_read(client, tok):
    s = demo.SCENARIOS["widow_clean"]
    h = tok("family01@citizen.demo")
    cid = client.post("/cases", json={"data": s["form"]}, headers=h).json()["id"]
    r = client.post(f"/cases/{cid}/submit", json={"consent": {}}, headers=h).json()
    assert r["route"] == "NEEDS_CONSENT"
