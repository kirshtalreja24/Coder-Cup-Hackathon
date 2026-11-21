"""Two views of every decision: (1) a simple reason for the citizen in Urdu/Roman-Urdu/English, (2) the full trace for the auditor."""

ASK_TEXT = {
    "upload_id_photo": {"en": "a clear photo of your ID card", "ur": "اپنے شناختی کارڈ کی صاف تصویر", "roman": "apne shanakhti card ki saaf tasveer"},
    "retake_id_photo": {"en": "a new, clearer photo of your ID card (the last one was blurry)", "ur": "شناختی کارڈ کی نئی اور صاف تصویر (پچھلی دھندلی تھی)", "roman": "shanakhti card ki nayi saaf tasveer (pichli dhundli thi)"},
    "confirm_father_name_or_dob": {"en": "your father's name or date of birth, to be sure it is you", "ur": "آپ کے والد کا نام یا تاریخ پیدائش، تاکہ یقین ہو کہ یہ آپ ہی ہیں", "roman": "walid ka naam ya tareekh-e-paidaish, taake yaqeen ho ke yeh aap hi hain"},
}


def _ask_phrase(asks: list[str], lang: str) -> str:
    parts = []
    for a in asks:
        if a in ASK_TEXT:
            parts.append(ASK_TEXT[a][lang])
        elif a.startswith("missing fact for rule:"):
            f = a.split(":", 1)[1].strip()
            names = {"monthly_income": ("your monthly income", "آپ کی ماہانہ آمدن", "aap ki mahana aamdan"),
                     "age": ("your age", "آپ کی عمر", "aap ki umar"),
                     "household_size": ("how many people live in your home", "گھر میں کتنے افراد ہیں", "ghar mein kitne afraad hain"),
                     "marital_status": ("your marital status", "آپ کی ازدواجی حیثیت", "aap ki azdawaji haisiyat")}
            en, ur, ro = names.get(f, (f, f, f))
            parts.append({"en": en, "ur": ur, "roman": ro}[lang])
    sep = {"en": " and ", "ur": " اور ", "roman": " aur "}[lang]
    return sep.join(dict.fromkeys(parts))


def user_reason(route: str, decision: dict, rule_eval: dict, amount: int | None = None) -> dict:
    asks = decision.get("asks", [])
    failed = [t for t in rule_eval.get("trace", []) if t["passed"] is False and t["hard"]]
    if route == "AUTO_APPROVE":
        return {
            "en": f"Approved. We checked your ID and the rules, and everything matches. PKR {amount:,} will be sent to you.",
            "ur": f"منظور ہو گیا۔ آپ کی شناخت اور شرائط سب درست ہیں۔ {amount:,} روپے آپ کو بھیجے جائیں گے۔",
            "roman": f"Manzoor ho gaya. Aap ki shanakht aur sharait sab durust hain. {amount:,} rupay aap ko bheje jayenge.",
        }
    if route == "ASK_PROOF":
        return {
            "en": f"We are not fully sure yet. Please give us {_ask_phrase(asks, 'en')}. Then we can continue.",
            "ur": f"ہمیں ابھی پوری تسلی نہیں ہے۔ براہ کرم {_ask_phrase(asks, 'ur')} دیں۔ پھر ہم آگے بڑھ سکتے ہیں۔",
            "roman": f"Hamein abhi poori tasalli nahi hai. Meharbani karke {_ask_phrase(asks, 'roman')} dein. Phir hum aage barh sakte hain.",
        }
    if route == "DECLINE_WITH_APPEAL":
        why_en = "; ".join(t["label"] for t in failed) or "a rule was not met"
        why_ur = "؛ ".join((t["label_ur"] or t["label"]) for t in failed) or "ایک شرط پوری نہیں ہوئی"
        return {
            "en": f"We cannot approve this now because: {why_en}. This is not final. You can ask a person to check it again.",
            "ur": f"ابھی منظور نہیں ہو سکتا کیونکہ: {why_ur}۔ یہ حتمی نہیں ہے۔ آپ کسی انسان سے دوبارہ جانچ کروا سکتے ہیں۔",
            "roman": "Abhi manzoor nahi ho sakta kyunke ek shart poori nahi hui. Yeh aakhri faisla nahi hai. Aap kisi insaan se dobara check karwa sakte hain.",
        }
    return {
        "en": "We are not sure, so we did not guess. A person will check your case. Your notes are attached so you will not need to repeat anything.",
        "ur": "ہمیں یقین نہیں ہے، اس لیے ہم نے اندازہ نہیں لگایا۔ ایک انسان آپ کا کیس دیکھے گا۔ آپ کے نوٹس ساتھ لگے ہیں، دوبارہ کچھ بتانے کی ضرورت نہیں۔",
        "roman": "Hamein yaqeen nahi, is liye humne andaza nahi lagaya. Ek insaan aap ka case dekhega. Aap ke notes saath lage hain, dobara kuch batane ki zaroorat nahi.",
    }


def handoff_brief(case_data: dict, decision: dict, rule_eval: dict, identity: dict, doc: dict | None) -> dict:
    """Case notes that travel with a 'I am not sure' handoff so the officer never starts from zero."""
    known, doubts, questions = [], [], []
    if identity.get("decision") == "MATCH":
        known.append("Identity matched the registry with high confidence.")
    else:
        doubts.append(f"Identity match is {identity.get('decision')} (weight {identity.get('total_weight')}).")
        if identity.get("missing"):
            questions.append(f"Ask the citizen to confirm: {', '.join(identity['missing'])}.")
    for t in rule_eval.get("trace", []):
        (known if t["passed"] else doubts).append(f"Rule '{t['label']}': {'met' if t['passed'] else ('unknown' if t['passed'] is None else 'NOT met')} (actual: {t['actual']}).")
    if doc:
        for f in doc.get("flags", []):
            doubts.append(f"Document: {f}")
    for c in decision["signals"].get("conflicts", []):
        doubts.append(f"Conflict: {c}")
    if decision["signals"].get("anomaly_risk", 0) >= 0.3:
        doubts.append("Anomaly detector raised the risk of this claim.")
    why = decision.get("override") or "Confidence is below the level where auto-approval is cheaper than review."
    return {
        "headline": f"Needs a human: P(legit)={decision['p_legit']:.0%}",
        "why_unsure": why,
        "what_we_know": known,
        "what_we_doubt": doubts,
        "suggested_questions": questions,
        "expected_cost_if_auto_approved_pkr": decision["action_costs"].get("AUTO_APPROVE"),
        "expected_cost_if_reviewed_pkr": decision["action_costs"].get("HUMAN_REVIEW"),
        "submitted": {k: v for k, v in case_data.items() if k not in ("signals",)},
    }
