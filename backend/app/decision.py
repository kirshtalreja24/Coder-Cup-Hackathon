"""The decision core. NOT an LLM: explicit expected-cost minimisation, so every number is auditable.

Four actions:  AUTO_APPROVE | ASK_PROOF | HUMAN_REVIEW | DECLINE_WITH_APPEAL
Wrong approvals are far more expensive than slow ones, so the AUTO band is deliberately narrow (see thresholds()).
"""
DEFAULT_COSTS = {
    "wrong_approval": 50_000,   # PKR: payout lost + recovery effort + harm to genuine claimants who then miss out
    "human_review": 150,        # PKR: officer minutes
    "ask_proof": 40,            # PKR-equivalent: effort for the citizen (a photo / a number)
    "delay_harm_human": 100,    # PKR-equivalent: harm to a genuine person waiting for human review
    "delay_harm_proof": 60,     # same for waiting on proof upload
    "wrongful_block": 2_000,    # PKR-equivalent: harm of wrongly declining/delaying a genuine person
    "human_residual_error": 0.02,  # humans are good, not perfect: 2% of wrong claims still slip through review
    "proof_gain": 0.55,         # fraction of remaining doubt that an extra proof typically removes
}

ROUTES = ("AUTO_APPROVE", "ASK_PROOF", "HUMAN_REVIEW", "DECLINE_WITH_APPEAL")


def costs_for(tenant_matrix: dict | None) -> dict:
    return {**DEFAULT_COSTS, **(tenant_matrix or {})}


def action_costs(p: float, c: dict, can_ask: bool = True) -> dict[str, float]:
    """Expected cost (PKR-equivalent) of each action for a claim that is legitimate with probability p."""
    wa = c["wrong_approval"]
    auto = (1 - p) * wa
    human = c["human_review"] + p * c["delay_harm_human"] + (1 - p) * wa * c["human_residual_error"]
    p2 = p + (1 - p) * c["proof_gain"]
    after = min((1 - p2) * wa, c["human_review"] + p2 * c["delay_harm_human"] + (1 - p2) * wa * c["human_residual_error"])
    ask = c["ask_proof"] + p * c["delay_harm_proof"] + after
    out = {"AUTO_APPROVE": auto, "HUMAN_REVIEW": human}
    if can_ask:
        out["ASK_PROOF"] = ask
    return {k: round(v, 2) for k, v in out.items()}


def thresholds(c: dict) -> dict:
    """Break-even probabilities, derived (not guessed). Used by the Risk Dial UI and the README."""
    wa, hr, dh, res = c["wrong_approval"], c["human_review"], c["delay_harm_human"], c["human_residual_error"]
    # AUTO cost == HUMAN cost  ->  (1-p)*wa = hr + p*dh + (1-p)*wa*res
    p_auto = 1 - (hr + dh) / max(wa * (1 - res) + dh, 1e-9)  # guarded: a zero cost matrix must never crash decisions
    # ASK beats HUMAN somewhere in the middle: find by scan
    p_ask_min = None
    for i in range(0, 1001):
        p = i / 1000
        ac = action_costs(p, c)
        if ac["ASK_PROOF"] < ac["HUMAN_REVIEW"] and ac["ASK_PROOF"] < ac["AUTO_APPROVE"]:
            p_ask_min = p
            break
    return {"auto_approve_min_p": round(p_auto, 5), "ask_proof_min_p": p_ask_min,
            "explain": (f"Auto-approve only when P(legit) >= {p_auto:.2%}. A wrong approval costs PKR {wa:,}; "
                        f"a human review costs PKR {hr}. So the system stays humble and asks or hands over otherwise.")}


def curve(c: dict, steps: int = 50) -> list[dict]:
    pts = []
    for i in range(steps + 1):
        p = i / steps
        ac = action_costs(p, c)
        best = min(ac, key=ac.get)
        pts.append({"p": round(p, 3), **{k: v for k, v in ac.items()}, "best": best})
    return pts


def p_identity_from_weight(total_weight: float, registry_size: int = 1000) -> float:
    """Fellegi-Sunter posterior: prior odds ~ 1/registry_size. weight is log2 likelihood ratio."""
    import math
    prior_log2 = -math.log2(max(registry_size, 2))
    x = total_weight + prior_log2
    x = max(min(x, 40), -40)
    odds = 2 ** x
    return odds / (1 + odds)


def decide(*, p_identity: float | None, identity_decision: str, doc: dict | None, anomaly: dict, rule_eval: dict,
           conflicts: list[str], costs: dict, has_doc_proof: bool) -> dict:
    """Pure function: same inputs -> same route. Returns route + full trace for the auditor."""
    reasons_internal: list[str] = []
    asks: list[str] = []
    p_id = p_identity if p_identity is not None else 0.05
    doc_flag = (doc or {}).get("flag")  # None|"blurry"|"forged"|"mismatch"|"unreadable"
    p_doc = (doc or {}).get("authenticity")  # 0..1 or None
    p_doc_eff = p_doc if p_doc is not None else 0.85  # absent doc: moderate prior (and we may ask for it)
    risk = anomaly.get("risk", 0.0)
    p_legit = max(0.0, min(1.0, p_id * p_doc_eff * (1 - risk)))
    if conflicts:
        p_legit *= 0.6 ** len(conflicts)
        reasons_internal.append(f"{len(conflicts)} conflict(s) between what was stated and the registry")

    # ---- missing information we can ASK for (specific, actionable) ----
    if rule_eval["unknown"]:
        asks += [f"missing fact for rule: {u}" for u in rule_eval["unknown"]]
    if not has_doc_proof:
        asks.append("upload_id_photo")
    if doc_flag in ("blurry", "unreadable"):
        asks.append("retake_id_photo")
    if identity_decision == "POSSIBLE":
        asks.append("confirm_father_name_or_dob")
    can_ask = bool(asks) and doc_flag not in ("forged",) and not conflicts

    ac = action_costs(p_legit, costs, can_ask=can_ask)
    th = thresholds(costs)
    route = min(ac, key=ac.get)

    # ---- hard safety overrides (never auto-act against these) ----
    override = None
    if doc_flag == "forged":
        route, override = "HUMAN_REVIEW", "document looks edited/forged: a human must look; never auto-act"
    elif doc_flag == "mismatch":
        route, override = "HUMAN_REVIEW", "document content disagrees with the form"
    elif risk >= 0.6:
        route, override = "HUMAN_REVIEW", "anomaly detector: suspicious pattern (e.g. repeated claim)"
    elif identity_decision == "NON_MATCH":
        route, override = "HUMAN_REVIEW", "person could not be found in the registry"
    elif conflicts and route == "AUTO_APPROVE":
        route, override = "HUMAN_REVIEW", "conflicting data"
    if rule_eval["unknown"] and route == "AUTO_APPROVE":
        route, override = ("ASK_PROOF", "a rule input is missing") if can_ask else ("HUMAN_REVIEW", "a rule input is missing")

    # ---- eligibility: a verified, clean ineligible verdict -> decline WITH appeal; otherwise humans decide ----
    if rule_eval["verdict"] == "INELIGIBLE":
        verified = identity_decision == "MATCH" and not conflicts and doc_flag not in ("forged", "mismatch")
        if verified and p_id >= 0.97:
            route, override = "DECLINE_WITH_APPEAL", "rule says ineligible and identity verified; appeal always offered"
            ac["DECLINE_WITH_APPEAL"] = round((1 - p_id) * costs["wrongful_block"], 2)
        else:
            route, override = "HUMAN_REVIEW", "looks ineligible but data is not reliable enough to decline automatically"

    # a route of AUTO needs p above the derived break-even even if costs are weird
    if route == "AUTO_APPROVE" and (p_legit < th["auto_approve_min_p"] or rule_eval["verdict"] != "ELIGIBLE"):
        route = "ASK_PROOF" if can_ask else "HUMAN_REVIEW"
        override = override or "below the auto-approve probability threshold"

    confidence = round(max(p_legit, 1 - p_legit) if route in ("AUTO_APPROVE", "DECLINE_WITH_APPEAL") else p_legit, 4)
    return {
        "route": route,
        "p_legit": round(p_legit, 4),
        "confidence": confidence,
        "signals": {"p_identity": round(p_id, 4), "identity_decision": identity_decision, "p_doc": p_doc,
                    "doc_flag": doc_flag, "anomaly_risk": risk, "conflicts": conflicts},
        "action_costs": ac,
        "thresholds": th,
        "cost_matrix": costs,
        "override": override,
        "asks": asks,
        "can_ask": can_ask,
        "notes": reasons_internal,
    }


# ---------------------------------------------------------------------------------------------------------------------
# RECOURSE: "what would change this decision?"  Not a canned tip: each hypothetical is run through the SAME decision engine.
# ---------------------------------------------------------------------------------------------------------------------
_PERFECT_DOC = {"authenticity": 1.0, "flag": None}


def recourse(*, p_identity: float | None, identity_decision: str, doc: dict | None, anomaly: dict, rule_eval: dict,
             conflicts: list[str], costs: dict, has_doc_proof: bool, route: str, asks: list[str]) -> list[dict]:
    """Smallest actions that could change the outcome, each with the route and confidence the engine would then give."""
    items: list[dict] = []
    for t in rule_eval.get("trace", []):
        if t["passed"] is False and t["hard"]:
            items.append({"kind": "rule", "rule_id": t["id"], "label": t["label"], "label_ur": t.get("label_ur"), "actual": t["actual"], "would_route": None})
    if route == "AUTO_APPROVE" or rule_eval["verdict"] == "INELIGIBLE" or conflicts or (doc or {}).get("flag") in ("forged", "mismatch"):
        return items  # nothing the citizen can simply "add" to fix these: a person decides
    base = dict(p_identity=p_identity, identity_decision=identity_decision, doc=doc, anomaly=anomaly, rule_eval=rule_eval,
                conflicts=conflicts, costs=costs, has_doc_proof=has_doc_proof)
    for ask in dict.fromkeys(asks):
        if ask in ("upload_id_photo", "retake_id_photo"):
            hyp = {**base, "doc": _PERFECT_DOC, "has_doc_proof": True}
        elif ask == "confirm_father_name_or_dob":
            hyp = {**base, "p_identity": 0.99999, "identity_decision": "MATCH"}
        else:
            continue
        after = decide(**hyp)
        items.append({"kind": "proof", "ask": ask, "would_route": after["route"], "p_legit_after": after["p_legit"]})
    return items
