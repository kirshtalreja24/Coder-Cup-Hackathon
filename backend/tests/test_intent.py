"""Voice / text intent: what does the person want, and what did they tell us?"""
import pytest

from app import intent, llm


@pytest.fixture(autouse=True)
def no_llm(monkeypatch):
    monkeypatch.setattr(llm, "enabled", lambda: False)


CASES = [
    # ---- apply
    ("I want to apply for relief", "apply_relief"),
    ("I need money, how do I start my application", "apply_relief"),
    ("Mujhe imdadi raqam ke liye darkhwast deni hai", "apply_relief"),
    ("main relief ke liye apply karna chahti hoon", "apply_relief"),
    ("میں امدادی رقم کے لیے درخواست دینا چاہتی ہوں", "apply_relief"),
    ("مجھے مدد چاہیے", "apply_relief"),
    # ---- status
    ("What is the status of my application?", "check_status"),
    ("Mera case ka status kya hai", "check_status"),
    ("میری درخواست کا کیا ہوا", "check_status"),
    ("Has my claim been approved yet", "check_status"),
    ("When will I get my payment?", "check_status"),
    ("mera paisa kab aayega", "check_status"),
    ("میرے پیسے کب آئیں گے", "check_status"),
    ("I have not received my money", "check_status"),
    # ---- scam
    ("I got a message saying send my CNIC and fee to 0300-1234567, is this real?", "scam_check"),
    ("Yeh message aaya hai, kya ye jaali hai", "scam_check"),
    ("مجھے ایک میسج آیا ہے یہ اصلی ہے یا جعلی", "scam_check"),
    ("Is this a scam", "scam_check"),
    # ---- policy (questions about the rules are NOT requests to act)
    ("Who can apply for relief?", "policy_question"),
    ("Is there a fee to apply?", "policy_question"),
    ("What documents do I need?", "policy_question"),
    ("How do I know a message is real?", "policy_question"),
    ("Can a widow with income 40000 get paid?", "policy_question"),
    ("کیا درخواست کی کوئی فیس ہے؟", "policy_question"),
    ("Kya fee lagti hai", "policy_question"),
    # ---- human
    ("I want to talk to a person", "talk_to_human"),
    ("Mujhe kisi insaan se baat karni hai", "talk_to_human"),
    ("مجھے افسر سے بات کرنی ہے", "talk_to_human"),
    ("I want to appeal the decision", "talk_to_human"),
    # ---- my data
    ("I want to withdraw my consent", "my_data"),
    ("Mera data wapis lena hai", "my_data"),
    ("میں اپنی اجازت واپس لینا چاہتی ہوں", "my_data"),
    # ---- not understood: must not guess
    ("hello", "unknown"),
    ("the weather is nice today", "unknown"),
    ("asdf qwer", "unknown"),
]


@pytest.mark.parametrize("text,want", CASES)
def test_intent_table(text, want):
    r = intent.classify(text)
    assert r.intent == want, f"{text!r} -> {r.intent} {r.scores}"


def test_entities_english():
    e = intent.extract_entities("I want to apply. My name is Zainab Bibi, I am a widow, my income is 18000 a month and we are 5 people at home. CNIC 42101-1234567-8")
    assert e.name == "Zainab Bibi"
    assert e.marital_status == "widowed"
    assert e.monthly_income == 18000
    assert e.household_size == 5
    assert e.cnic == "4210112345678"


def test_entities_roman_and_urdu():
    e = intent.extract_entities("Mera naam Fatima Bibi hai, main bewa hoon, meri kamai pandrah hazar hai")
    assert e.name == "Fatima Bibi" and e.marital_status == "widowed" and e.monthly_income == 15000
    e = intent.extract_entities("میرا نام فاطمہ بی بی ہے میں بیوہ ہوں میری آمدنی پندرہ ہزار ہے ہم چھ لوگ ہیں")
    assert e.name == "فاطمہ بی بی" and e.marital_status == "widowed" and e.monthly_income == 15000 and e.household_size == 6


def test_urdu_digits_and_units():
    assert intent.extract_cnic(intent.normalise("۴۲۱۰۱۱۲۳۴۵۶۷۸")) == "4210112345678"
    assert intent.extract_income(intent.normalise("my monthly income is 20k")) == 20000
    assert intent.extract_income(intent.normalise("income 12,500 per month")) == 12500


def test_cnic_is_never_mistaken_for_income_or_household():
    t = intent.normalise("my cnic is 4210112345678 and my income is 15000")
    assert intent.extract_income(t) == 15000
    assert intent.extract_household(t) is None


def test_name_not_invented_from_a_description():
    assert intent.extract_name("I am a widow and I need help") is None
    assert intent.extract_name("I am from Karachi") is None


def test_unknown_is_low_confidence():
    r = intent.classify("hello")
    assert r.intent == "unknown" and r.confidence < 0.5


def test_scam_text_is_carried_for_checking():
    r = intent.classify("Got a message: send your CNIC and fee to 0300-1234567, is this real?")
    assert r.intent == "scam_check" and "0300-1234567" in r.entities.message_text


# ---------------------------------------------------------------- LLM is only a tie-breaker, and it is validated
def test_llm_cannot_override_confident_rules(monkeypatch):
    monkeypatch.setattr(llm, "enabled", lambda: True)
    monkeypatch.setattr(llm, "chat_json", lambda *a, **k: {"intent": "my_data", "confidence": 0.99})
    r = intent.classify("What is the status of my application?")
    assert r.intent == "check_status" and r.source == "rules"


def test_llm_helps_when_rules_are_unsure(monkeypatch):
    monkeypatch.setattr(llm, "enabled", lambda: True)
    monkeypatch.setattr(llm, "chat_json", lambda *a, **k: {"intent": "apply_relief", "confidence": 0.9, "name": None})
    r = intent.classify("hello there")
    assert r.intent == "apply_relief" and r.source == "llm"


@pytest.mark.parametrize("bad", [{"intent": "delete_everything", "confidence": 1}, {"intent": "apply_relief", "confidence": 7},
                                 "garbage", None, {"intent": "apply_relief"}])
def test_invalid_llm_output_is_ignored(monkeypatch, bad):
    monkeypatch.setattr(llm, "enabled", lambda: True)
    monkeypatch.setattr(llm, "chat_json", lambda *a, **k: bad)
    r = intent.classify("hello there")
    assert r.intent == "unknown" and r.source == "rules"


def test_llm_cannot_invent_a_name(monkeypatch):
    monkeypatch.setattr(llm, "enabled", lambda: True)
    monkeypatch.setattr(llm, "chat_json", lambda *a, **k: {"intent": "apply_relief", "confidence": 0.9, "name": "Ghost Person"})
    assert intent.classify("hello there").entities.name is None


# ---------------------------------------------------------------- the endpoint
def test_intent_endpoint_apply_prefills_and_routes(client, tok):
    h = tok("widow-clean@citizen.demo")
    r = client.post("/voice/intent", headers=h, json={"text": "I want to apply, my name is Zainab Bibi, I am a widow, income 18000, 5 people", "lang": "en"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["intent"] == "apply_relief" and j["action"] == {"type": "navigate", "to": "/c/claim"}
    assert j["prefill"] == {"name": "Zainab Bibi", "monthly_income": 18000, "household_size": 5, "marital_status": "widowed"}
    assert set(j["reply"]) == {"en", "ur", "roman"} and "check it" in j["reply"]["en"]


def test_intent_endpoint_policy_question_is_answered_not_navigated(client, tok):
    j = client.post("/voice/intent", headers=tok("widow-clean@citizen.demo"), json={"text": "Who can apply for relief?"}).json()
    assert j["intent"] == "policy_question" and j["action"]["type"] == "answer" and j["prefill"] == {}


def test_intent_endpoint_helper_goes_to_family_list_and_is_never_prefilled(client, tok):
    j = client.post("/voice/intent", headers=tok("helper@relief.demo"), json={"text": "I want to apply, my name is Zainab, income 18000"}).json()
    assert j["action"]["to"] == "/h" and j["prefill"] == {}


def test_intent_endpoint_roles_and_validation(client, tok):
    assert client.post("/voice/intent", json={"text": "hi"}).status_code == 401
    for who in ("officer1@relief.demo", "admin@relief.demo", "auditor@relief.demo"):
        assert client.post("/voice/intent", headers=tok(who), json={"text": "hi"}).status_code == 403
    h = tok("widow-clean@citizen.demo")
    assert client.post("/voice/intent", headers=h, json={"text": ""}).status_code == 422
    assert client.post("/voice/intent", headers=h, json={"text": "x" * 601}).status_code == 422
    assert client.post("/voice/intent", headers=h, json={"text": "hi", "lang": "klingon"}).status_code == 422


def test_intent_is_audited_without_the_speech_or_the_values(client, tok):
    h = tok("widow-clean@citizen.demo")
    client.post("/voice/intent", headers=h, json={"text": "I want to apply, my name is Zainab Bibi, CNIC 4210112345678"})
    ev = client.get("/audit?action=ai.intent&limit=5", headers=tok("auditor@relief.demo")).json()
    assert ev and ev[0]["actor_type"] == "ai"
    blob = str(ev[0]["details"])
    assert "Zainab" not in blob and "4210112345678" not in blob and "name" in ev[0]["details"]["filled"]
