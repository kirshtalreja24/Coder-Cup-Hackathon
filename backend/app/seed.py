"""Synthetic data ONLY. Nothing here is a real person. Deterministic (seeded) so demos and tests are reproducible."""
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from . import decision as dec, rag, rules, scam
from .identity import name_key
from .mock_services import norm_dob
from .models import (ApiKey, Case, Decision, HelperLink, MockNadraRecord, ScamMessage, Tenant, User, uid)
from .security import hash_key, hash_password

MALE = ["Muhammad Ali", "Ahmed Raza", "Imran Khan", "Bilal Ahmed", "Usman Ghani", "Hassan Raza", "Abdul Rehman", "Yousuf Khan",
        "Ibrahim Shah", "Zubair Hussain", "Tariq Mehmood", "Kamran Akbar", "Naveed Iqbal", "Shahid Afridi", "Rashid Ali",
        "Farhan Malik", "Salman Baig", "Waqas Ahmed", "Asif Zardari", "Junaid Jamshed", "Nadeem Baloch", "Saeed Anwar",
        "Ghulam Mustafa", "Ghulam Rasool", "Allah Bachayo", "Mehboob Ali", "Din Muhammad", "Rahim Bakhsh", "Aslam Pervaiz"]
FEMALE = ["Fatima Bibi", "Ayesha Khatoon", "Zainab Bibi", "Rukhsana Parveen", "Nasreen Akhtar", "Shabana Kausar", "Razia Sultana",
          "Naseem Akhtar", "Shaheen Bibi", "Hameeda Begum", "Salma Noreen", "Mumtaz Bibi", "Kulsoom Bibi", "Bushra Naz",
          "Samina Kausar", "Farzana Yasmin", "Gulshan Bibi", "Parveen Akhtar", "Nusrat Bibi", "Amina Bibi", "Sakina Bibi"]
SURNAMES = ["Khan", "Shah", "Malik", "Qureshi", "Ansari", "Baloch", "Memon", "Siddiqui", "Chaudhry", "Rajput", "Soomro", "Mirza"]
FATHERS = ["Muhammad Yousuf", "Abdul Rehman", "Ghulam Hussain", "Mohammad Ibrahim", "Allah Ditta", "Nazir Ahmad", "Haji Rashid",
           "Muhammad Siddique", "Abdul Karim", "Fazal Din", "Noor Muhammad", "Khuda Bakhsh", "Muhammad Aslam", "Abdul Ghafoor"]
DISTRICTS = [("Karachi East", "4"), ("Karachi West", "4"), ("Karachi Central", "4"), ("Hyderabad", "4"), ("Sukkur", "4"),
             ("Larkana", "4"), ("Lahore", "3"), ("Multan", "3"), ("Faisalabad", "3"), ("Rawalpindi", "3"), ("Peshawar", "1"),
             ("Mardan", "1"), ("Quetta", "5"), ("Turbat", "5"), ("Islamabad", "6")]

DEMO_PASSWORD = "Demo#12345"
DEMO_API_KEY = "bh_demo_public_key_mock_0001"  # public, mock-only, read/precheck scopes. Shown in README for judges.


def _cnic(r: random.Random, prov: str, female: bool) -> str:
    mid = "".join(str(r.randint(0, 9)) for _ in range(11))
    last = r.choice("2468") if female else r.choice("1357")
    return prov + mid + last


def _record(r: random.Random, female: bool | None = None) -> dict:
    female = r.random() < 0.5 if female is None else female
    first = r.choice(FEMALE if female else MALE)
    name = first if (female and r.random() < 0.7) else f"{first} {r.choice(SURNAMES)}" if r.random() < 0.6 else first
    dist, prov = r.choice(DISTRICTS)
    y = r.randint(1948, 2004)
    dob = f"{y}-{r.randint(1, 12):02d}-{r.randint(1, 28):02d}"
    marital = r.choices(["married", "widowed", "single", "divorced"], weights=[55, 25, 14, 6])[0]
    if y > 2000: marital = "single"
    income = int(max(3000, r.lognormvariate(9.9, 0.5)))
    return {"cnic": _cnic(r, prov, female), "name": name, "father_name": r.choice(FATHERS), "dob": dob,
            "gender": "F" if female else "M", "district": dist, "marital_status": marital,
            "spouse_status": {"widowed": "deceased", "married": "alive"}.get(marital), "monthly_income": income,
            "household_size": r.randint(1, 9)}


PERSONAS = [  # fixed demo people (SYNTHETIC)
    dict(key="widow_clean", cnic="4210112345672", name="Fatima Bibi", father_name="Muhammad Yousuf", dob="1978-03-14", gender="F",
         district="Karachi East", marital_status="widowed", spouse_status="deceased", monthly_income=14000, household_size=6),
    dict(key="widow_blurry", cnic="4210122233346", name="Zainab Bibi", father_name="Ghulam Hussain", dob="1982-06-18", gender="F",
         district="Karachi Central", marital_status="widowed", spouse_status="deceased", monthly_income=11000, household_size=5),
    dict(key="widow_forged", cnic="4210199900018", name="Ayesha Khatoon", father_name="Abdul Karim", dob="1979-12-01", gender="F",
         district="Karachi East", marital_status="widowed", spouse_status="deceased", monthly_income=13000, household_size=4),
    dict(key="widow_variant", cnic="4220198765434", name="Rukhsana Parveen", father_name="Abdul Rehman", dob="1985-07-22", gender="F",
         district="Karachi West", marital_status="widowed", spouse_status="deceased", monthly_income=12000, household_size=4),
    dict(key="shopkeeper", cnic="4230155544413", name="Muhammad Aslam", father_name="Nazir Ahmad", dob="1972-11-02", gender="M",
         district="Karachi Central", marital_status="married", spouse_status="alive", monthly_income=26000, household_size=7),
    dict(key="liar_widow", cnic="4210177788892", name="Nasreen Akhtar", father_name="Fazal Din", dob="1980-01-30", gender="F",
         district="Hyderabad", marital_status="married", spouse_status="alive", monthly_income=18000, household_size=3),
    dict(key="too_rich", cnic="4210133344456", name="Shabana Kausar", father_name="Haji Rashid", dob="1975-09-09", gender="F",
         district="Karachi East", marital_status="widowed", spouse_status="deceased", monthly_income=52000, household_size=5),
    dict(key="duplicate_target", cnic="4210155566678", name="Ghulam Mustafa", father_name="Noor Muhammad", dob="1969-05-05", gender="M",
         district="Larkana", marital_status="married", spouse_status="alive", monthly_income=15000, household_size=8),
]


def seed_all(db: Session) -> None:
    if db.query(Tenant).count():
        return
    r = random.Random(2026)
    pw = hash_password(DEMO_PASSWORD)  # one hash reused for all synthetic users (speed)

    # ---- tenants -------------------------------------------------------------
    t1 = Tenant(slug="relief", name="Emergency Relief Department (MOCK)", plan="pro", monthly_quota=10000,
                cost_matrix={"auto_payment_limit": 30000})
    t2 = Tenant(slug="flood", name="Sindh Flood Support Cell (MOCK)", plan="free", monthly_quota=1000,
                cost_matrix={"auto_payment_limit": 20000, "wrong_approval": 40000})
    db.add_all([t1, t2]); db.flush()

    # ---- staff + demo users ----------------------------------------------------
    def mk(tenant, email, name, role, **kw) -> User:
        u = User(tenant_id=tenant.id, email=email, name=name, role=role, password_hash=pw, locale=kw.pop("locale", "ur"), **kw)
        db.add(u); return u
    admin = mk(t1, "admin@relief.demo", "Admin (Relief Dept)", "admin", locale="en")
    off1 = mk(t1, "officer1@relief.demo", "Officer Saima Hashmi", "officer", locale="en")
    off2 = mk(t1, "officer2@relief.demo", "Officer Daniyal Qazi", "officer", locale="en")
    aud = mk(t1, "auditor@relief.demo", "Auditor Hira Naeem", "auditor", locale="en")
    helper = mk(t1, "helper@relief.demo", "Helper Shabnam (serves 40 families)", "helper")
    mk(t2, "admin@flood.demo", "Admin (Flood Cell)", "admin", locale="en")
    mk(t2, "officer@flood.demo", "Officer (Flood Cell)", "officer", locale="en")
    db.flush()

    # ---- synthetic registry (1000 people + personas) -------------------------------
    seen = set()
    for _ in range(1000):
        rec = _record(r)
        if rec["cnic"] in seen: continue
        seen.add(rec["cnic"])
        db.add(MockNadraRecord(name_key=name_key(rec["name"]), **rec))
    persona_users = {}
    for p in PERSONAS:
        key = p.pop("key")
        db.merge(MockNadraRecord(name_key=name_key(p["name"]), **p))
        role_email = f"{key}@citizen.demo".replace("_", "-")
        u = mk(t1, role_email, p["name"], "citizen", cnic=p["cnic"], phone="0300-0000" + str(len(persona_users)).zfill(3))
        persona_users[key] = u
        p["key"] = key
    db.flush()

    # ---- helper's families: 40 synthetic citizens -----------------------------------
    for i in range(40):
        rec = _record(r, female=True if i % 3 else None)
        db.merge(MockNadraRecord(name_key=name_key(rec["name"]), **rec))
        fam = mk(t1, f"family{i + 1:02d}@citizen.demo", rec["name"], "citizen", cnic=rec["cnic"])
        db.flush()
        db.add(HelperLink(helper_id=helper.id, citizen_id=fam.id))
    db.flush()

    # ---- rules, API key, policies, scam messages ------------------------------------
    rv = rules.create_draft(db, t1.id, "relief_eligibility", rules.DEFAULT_RELIEF, "Initial rule set", admin.id)
    rules.publish(db, rv)
    flood_def = {**rules.DEFAULT_RELIEF, "title": "Flood Support Grant (MOCK)", "amount": 20000}
    rules.publish(db, rules.create_draft(db, t2.id, "relief_eligibility", flood_def, "Initial", None))
    db.add(ApiKey(tenant_id=t1.id, name="Public demo key (MOCK data only)", prefix=DEMO_API_KEY[:10], key_hash=hash_key(DEMO_API_KEY),
                  scopes=["public:read", "scam:check", "eligibility:precheck", "policy:ask", "mock:nadra", "mock:raast"], rate_limit_per_min=60))
    rag.seed_policy(db)
    _seed_scam_messages(db, r, t1.id)
    db.commit()
    _seed_history(db, r, t1, admin)
    db.commit()


AREAS = ["Karachi East", "Karachi West", "Karachi Central", "Korangi", "Malir", "Hyderabad", "Sukkur", "Larkana", "Lahore", "Peshawar", "Quetta", "Multan"]


def _seed_scam_messages(db: Session, r: random.Random, tid: str):
    samples = {
        "relief_impersonation": ("0300-1112223", "BISP Relief Rs 25000 approved for you. Reply with CNIC to get payment."),
        "advance_fee": ("03451234567", "Relief payment ready. Send Rs 500 fee to Easypaisa 0300-7654321 to confirm."),
        "relief_phishing_link": ("Ehsaas", "Your Ehsaas payment is blocked. Verify now http://ehsaas-pay.top/id"),
        "otp_pin_theft": ("JazzCash", "Share OTP and PIN to release your relief payment immediately."),
        "fake_prize": ("55555", "Congratulations! Lucky winner Rs 100000. Pay delivery charges to claim."),
        "job_bait": ("0311", "Earn Rs 5000 daily at home. WhatsApp now 0311-1234567."),
    }
    weights = {"Karachi East": 6, "Karachi West": 8, "Korangi": 7, "Malir": 5, "Hyderabad": 4, "Lahore": 3, "Sukkur": 3,
               "Larkana": 3, "Peshawar": 2, "Quetta": 2, "Multan": 2, "Karachi Central": 4}
    for _ in range(90):
        area = r.choices(list(weights), weights=list(weights.values()))[0]
        stype = r.choices(list(samples), weights=[30, 18, 20, 12, 8, 6])[0]
        sender, text = samples[stype]
        res = scam.classify(text, sender)
        db.add(ScamMessage(tenant_id=tid, sender=sender, text=text, area=area, verdict=res["verdict"], score=res["score"],
                           scam_type=stype, reasons=[x["code"] for x in res["reasons"]],
                           created_at=datetime.now(timezone.utc) - timedelta(days=r.randint(0, 29), hours=r.randint(0, 23))))


def _seed_history(db: Session, r: random.Random, tenant: Tenant, admin: User, n: int = 320):
    """Historical claims with GROUND TRUTH (synthetic) so the Digital Twin + evaluation dashboard have real data to replay."""
    rv = rules.published(db, tenant.id)
    costs = dec.costs_for(tenant.cost_matrix)
    cit = db.query(User).filter_by(tenant_id=tenant.id, role="citizen").first()
    for i in range(n):
        fraud = r.random() < 0.18
        ftype = r.choice(["forged_doc", "duplicate", "identity_mismatch", "fake_widow"]) if fraud else None
        age = r.randint(19, 72)
        income = int(r.choices([r.randint(4000, 28000), r.randint(30001, 60000)], weights=[85, 15])[0])
        widowed = r.random() < 0.4
        hh = r.randint(1, 9)
        p_weight = r.gauss(28, 4)
        flag, auth, risk, conflicts, days_since = None, r.gauss(0.93, 0.04), r.random() * 0.08, [], 9999
        ident = "MATCH"
        has_doc = r.random() > 0.05
        if not fraud:
            if r.random() < 0.12: p_weight, ident = r.uniform(9, 16), "POSSIBLE"   # missing fields
            if r.random() < 0.09: flag, auth = "blurry", r.uniform(0.45, 0.65)
            if r.random() < 0.03: days_since = r.randint(10, 80)
        else:
            if ftype == "forged_doc": flag, auth = "forged", r.uniform(0.1, 0.35)
            elif ftype == "duplicate": risk, days_since = r.uniform(0.8, 0.95), r.randint(5, 60)
            elif ftype == "identity_mismatch": p_weight, ident = r.uniform(-4, 12), r.choice(["NON_MATCH", "POSSIBLE"])
            elif ftype == "fake_widow": conflicts, widowed = ["Stated 'widowed' but the registry shows a living spouse."], True
        facts = {"age": age, "monthly_income": income, "marital_status": "widowed" if widowed else "married", "household_size": hh,
                 "days_since_last_payout": days_since, "identity_decision": ident}
        ev = rules.evaluate(rv.definition, facts)
        signals = {"identity_weight": round(p_weight, 2), "p_identity": dec.p_identity_from_weight(p_weight), "identity_decision": ident,
                   "doc": {"authenticity": round(min(1, max(0, auth)), 3), "flag": flag} if has_doc else None,
                   "anomaly": {"risk": round(risk, 3)}, "conflicts": conflicts, "facts": facts, "has_doc_proof": has_doc}
        d = dec.decide(p_identity=signals["p_identity"], identity_decision=ident, doc=signals["doc"], anomaly={"risk": risk},
                       rule_eval=ev, conflicts=conflicts, costs=costs, has_doc_proof=has_doc)
        created = datetime.now(timezone.utc) - timedelta(days=r.randint(1, 60), hours=r.randint(0, 23))
        status = {"AUTO_APPROVE": "paid", "DECLINE_WITH_APPEAL": "declined", "ASK_PROOF": "needs_proof", "HUMAN_REVIEW": "awaiting_human"}[d["route"]]
        c = Case(tenant_id=tenant.id, citizen_id=cit.id, created_by=cit.id, status=status, is_historical=True,
                 ground_truth="fraud" if fraud else "legit", data={"signals": signals, "fraud_type": ftype}, amount=ev["amount"],
                 created_at=created, updated_at=created)
        db.add(c); db.flush()
        db.add(Decision(case_id=c.id, tenant_id=tenant.id, route=d["route"], p_legit=d["p_legit"], confidence=d["confidence"],
                        rule_version_id=rv.id, rule_version=rv.version, trace={"decision": d, "historical": True},
                        reason_user={"en": "historical (synthetic)"}, created_at=created))
