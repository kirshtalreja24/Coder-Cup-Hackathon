"""Digital Twin: a safe copy of the decision system. Replays a DRAFT rule (and/or cost matrix) over past cases and shows
the effect BEFORE it goes live. Nothing is written. Uses stored signals + known (synthetic) ground truth."""
from collections import Counter

from sqlalchemy.orm import Session

from . import decision as dec, rules
from .models import Case, Tenant


def _route(sig: dict, definition: dict, costs: dict) -> tuple[str, dict]:
    ev = rules.evaluate(definition, sig["facts"])
    d = dec.decide(p_identity=sig["p_identity"], identity_decision=sig["identity_decision"], doc=sig.get("doc"),
                   anomaly=sig.get("anomaly", {"risk": 0}), rule_eval=ev, conflicts=sig.get("conflicts", []),
                   costs=costs, has_doc_proof=sig.get("has_doc_proof", True))
    amount = ev["amount"]
    limit = costs.get("auto_payment_limit", 30_000)
    if d["route"] == "AUTO_APPROVE" and amount > limit:
        d["route"] = "HUMAN_REVIEW"
    return d["route"], {"amount": amount, "verdict": ev["verdict"]}


def _summarise(rows: list[dict], costs: dict, base: list[dict] | None = None) -> dict:
    c = Counter(r["route"] for r in rows)
    wrong_app = sum(1 for r in rows if r["route"] == "AUTO_APPROVE" and r["truth"] == "fraud")
    good_auto = sum(1 for r in rows if r["route"] == "AUTO_APPROVE" and r["truth"] == "legit")
    genuine_declined = sum(1 for r in rows if r["route"] == "DECLINE_WITH_APPEAL" and r["truth"] == "legit")
    # A decline caused by the eligibility rule itself is policy, not an error. Collateral = genuine people the CHANGE newly declines.
    wrongful = sum(1 for r, b in zip(rows, base) if r["route"] == "DECLINE_WITH_APPEAL" and r["truth"] == "legit" and b["route"] != "DECLINE_WITH_APPEAL") if base else 0
    legit_wait = sum(1 for r in rows if r["route"] in ("HUMAN_REVIEW", "ASK_PROOF") and r["truth"] == "legit")
    spend = sum(r["amount"] for r in rows if r["route"] == "AUTO_APPROVE")
    cost = (wrong_app * costs["wrong_approval"] + c["HUMAN_REVIEW"] * costs["human_review"] + c["ASK_PROOF"] * costs["ask_proof"]
            + wrongful * costs["wrongful_block"] + legit_wait * costs["delay_harm_human"])
    n = len(rows) or 1
    return {"n": len(rows), "routes": dict(c), "auto_rate": round(c["AUTO_APPROVE"] / n, 3), "human_rate": round(c["HUMAN_REVIEW"] / n, 3),
            "wrong_approvals": wrong_app, "good_auto_approvals": good_auto, "wrongful_declines": wrongful, "genuine_declined_by_rule": genuine_declined,
            "genuine_people_waiting": legit_wait, "auto_spend_pkr": spend, "total_cost_pkr": int(cost),
            "avg_cost_per_case_pkr": round(cost / n, 1)}


def replay(db: Session, tenant_id: str, candidate_def: dict | None = None, candidate_costs: dict | None = None, sample: int = 25) -> dict:
    tenant = db.get(Tenant, tenant_id)
    base_costs = dec.costs_for(tenant.cost_matrix)
    new_costs = {**base_costs, **(candidate_costs or {})}
    live = rules.published(db, tenant_id)
    cand_def = candidate_def or live.definition
    rules.validate_definition(cand_def)
    cases = db.query(Case).filter_by(tenant_id=tenant_id, is_historical=True).all()
    before, after, flips = [], [], []
    for c in cases:
        sig = (c.data or {}).get("signals")
        if not sig:
            continue
        rb, ib = _route(sig, live.definition, base_costs)
        ra, ia = _route(sig, cand_def, new_costs)
        before.append({"route": rb, "truth": c.ground_truth, "amount": ib["amount"]})
        after.append({"route": ra, "truth": c.ground_truth, "amount": ia["amount"]})
        if rb != ra:
            flips.append({"case_id": c.id, "from": rb, "to": ra, "truth": c.ground_truth, "verdict_before": ib["verdict"], "verdict_after": ia["verdict"]})
    sb, sa = _summarise(before, base_costs), _summarise(after, new_costs, before)
    trans = Counter((f["from"], f["to"]) for f in flips)
    delta = {k: round(sa[k] - sb[k], 3) for k in ("auto_rate", "human_rate", "wrong_approvals", "wrongful_declines", "auto_spend_pkr", "total_cost_pkr")}
    verdict = []
    if delta["wrong_approvals"] > 0: verdict.append(f"WARNING: {int(delta['wrong_approvals'])} more wrong approvals on past cases.")
    if delta["wrongful_declines"] > 0: verdict.append(f"{int(delta['wrongful_declines'])} genuine people who are approved/queued today would be newly declined (they can appeal).")
    if delta["total_cost_pkr"] < 0 and delta["wrong_approvals"] <= 0: verdict.append("Lower total expected cost with no extra wrong approvals.")
    if not flips: verdict.append("No past case would change.")
    return {"live_rule_version": live.version, "cases_replayed": len(before), "before": sb, "after": sa, "delta": delta,
            "changed_cases": len(flips), "transitions": [{"from": a, "to": b, "count": n} for (a, b), n in trans.most_common()],
            "sample_changes": flips[:sample], "summary": verdict, "note": "Replay on SYNTHETIC past cases. Nothing was changed or published."}
