"""RAG over the (mock) official policy pack. Answers ALWAYS carry sources; if nothing relevant is found the system
abstains ("I am not sure") and offers a human, instead of making something up."""
import re
from rank_bm25 import BM25Okapi
from sqlalchemy.orm import Session

from . import llm
from .models import PolicyChunk

POLICY_PACK = [
    ("Relief Programme Guidelines (MOCK)", "1. Who can apply", "en",
     "The emergency relief payment is for adults (18+) whose monthly household income is PKR 30,000 or less. Applicants must be widowed, or live in a household of 5 or more people. One payment of PKR 25,000 is made per household; a new payment cannot be received within 90 days of the last one."),
    ("Relief Programme Guidelines (MOCK)", "1. Who can apply", "ur",
     "ہنگامی امدادی ادائیگی ان بالغ افراد (18 سال یا زیادہ) کے لیے ہے جن کی ماہانہ گھریلو آمدن 30,000 روپے یا کم ہو۔ درخواست گزار بیوہ ہو یا گھر میں 5 یا زیادہ افراد ہوں۔ ہر گھرانے کو 25,000 روپے ایک بار ملتے ہیں اور پچھلی ادائیگی کے 90 دن کے اندر دوبارہ نہیں مل سکتے۔"),
    ("Relief Programme Guidelines (MOCK)", "2. Documents required", "en",
     "You need your ID card number and a clear photo of the ID card. The photo must be sharp and show all four corners and the QR code. If the photo is blurry you will be asked to take it again. No fee is ever charged for applying."),
    ("Relief Programme Guidelines (MOCK)", "2. Documents required", "ur",
     "آپ کو اپنے شناختی کارڈ کا نمبر اور کارڈ کی صاف تصویر چاہیے۔ تصویر واضح ہو اور چاروں کونے اور کیو آر کوڈ نظر آئیں۔ تصویر دھندلی ہو تو دوبارہ لینی ہوگی۔ درخواست دینے کی کوئی فیس نہیں ہے۔"),
    ("Scam Awareness Notice (MOCK, modelled on public BISP/PTA advice)", "Genuine messages", "en",
     "Genuine payment messages are sent only from the short code 8171. Messages from any other number or sender name claiming to be relief or BISP are fake. Real messages never ask you to pay a fee, share your PIN or OTP, send your ID number to a phone number, or click a link to receive money. If unsure, call the helpline 0800-26477 or visit the district office."),
    ("Scam Awareness Notice (MOCK, modelled on public BISP/PTA advice)", "Genuine messages", "ur",
     "اصلی ادائیگی کے پیغامات صرف 8171 سے آتے ہیں۔ کسی اور نمبر یا نام سے آنے والا امدادی پیغام جعلی ہے۔ اصلی پیغام کبھی فیس، پن، او ٹی پی یا شناختی کارڈ نمبر نہیں مانگتا اور نہ لنک پر کلک کرنے کو کہتا ہے۔ شک ہو تو ہیلپ لائن 0800-26477 پر کال کریں۔"),
    ("Appeals and Human Review Policy (MOCK)", "Appeals", "en",
     "Any decision can be reviewed by a person. If your claim is declined or marked 'not sure', an officer reviews it within 3 working days. You can add documents or corrections at any time. Automatic decisions are never final: an appeal is always offered."),
    ("Appeals and Human Review Policy (MOCK)", "Appeals", "ur",
     "ہر فیصلے کا جائزہ کوئی انسان لے سکتا ہے۔ درخواست مسترد ہو یا 'یقین نہیں' ہو تو افسر 3 کام کے دنوں میں دیکھتا ہے۔ آپ کسی بھی وقت کاغذات یا درستی بھیج سکتے ہیں۔ خودکار فیصلہ کبھی حتمی نہیں ہوتا۔"),
    ("Data and Consent Policy (MOCK)", "Your data", "en",
     "Your data is shared only with the people and services you allow. You can see who has it, change what is shared, correct wrong data, and withdraw consent at any time. When you withdraw, access stops immediately and the action is recorded in the audit log. Helpers can only see a family's data if that family has given them consent."),
    ("Data and Consent Policy (MOCK)", "Your data", "ur",
     "آپ کا ڈیٹا صرف انہی لوگوں اور سروسز کے ساتھ شیئر ہوتا ہے جنہیں آپ اجازت دیں۔ آپ دیکھ سکتے ہیں کس کے پاس ہے، کیا شیئر ہو، غلط ڈیٹا درست کر سکتے ہیں اور کسی بھی وقت اجازت واپس لے سکتے ہیں۔ واپس لیتے ہی رسائی فوراً بند ہو جاتی ہے۔"),
    ("Helper Guide (MOCK)", "Helping many families", "en",
     "Community helpers can assist many families from one phone. Each family must give its own consent. Switching to another family locks the previous one. The screen locks after 60 seconds of no activity. Every switch and every action is recorded."),
    ("Payments (MOCK)", "How payment works", "en",
     "Approved payments are sent through a SIMULATED Raast-style rail to the bank or wallet account linked to your ID. No real money moves in this prototype. You get a receipt number."),
]

_index = {"bm25": None, "chunks": [], "n": -1}
_SYN = {"paisay": "payment", "paise": "payment", "raqam": "payment", "rupay": "payment", "shanakhti": "id", "cnic": "id",
        "card": "id", "fees": "fee", "fee": "fee", "jaali": "fake", "jali": "fake", "fraud": "fake", "scam": "fake",
        "beva": "widowed", "bewa": "widowed", "widow": "widowed", "eligible": "apply", "yogya": "apply",
        "ijazat": "consent", "permission": "consent", "dhundli": "blurry", "dhoka": "fake", "helpline": "helpline"}


_STOP = set("""a an the is are was were be to of for in on at by with from and or but if it its this that these those i me my we our you your he she they them
how what who whom when where why which do does did can could should would will shall may might must not no yes any some please tell about know get make use take give want need apply
there here as so than then also very just more most much many been being have has had am into over under again real آپ کا کی کے کو کہ ہے ہیں سکتا سکتی کون کیا کب کہاں کیسے اور سے میں پر یہ وہ ہو ہوں
kitne kya kaise ko kar sakta sakti hai hain ka ki ke mein se par aur""".split())


def _stem(t: str) -> str:
    return t[:-1] if len(t) > 4 and t.endswith("s") else t


def _content(q: str) -> list[str]:
    return [_stem(t) for t in _tok(q) if t not in _STOP and len(t) > 1]


def _tok(s: str) -> list[str]:
    toks = re.findall(r"[\w؀-ۿ]+", s.lower())
    return [_SYN.get(t, t) for t in toks]


def _build(db: Session):
    chunks = db.query(PolicyChunk).all()
    if _index["n"] == len(chunks) and _index["bm25"]:
        return
    _index["chunks"] = chunks
    _index["bm25"] = BM25Okapi([_tok(c.source + " " + c.section + " " + c.text) for c in chunks]) if chunks else None
    _index["n"] = len(chunks)


def seed_policy(db: Session):
    if db.query(PolicyChunk).count():
        return
    for src, sec, lang, text in POLICY_PACK:
        db.add(PolicyChunk(source=src, section=sec, lang=lang, text=text))
    db.commit()


def ask(db: Session, question: str, lang: str = "en", k: int = 3) -> dict:
    _build(db)
    if not _index["bm25"] or not question.strip():
        return _abstain("no question or empty policy base")
    toks = _tok(question)
    scores = _index["bm25"].get_scores(toks)
    ranked = sorted(zip(scores, _index["chunks"]), key=lambda x: -x[0])
    # Prefer chunks in the user's language when scores tie closely
    top = [(s, c) for s, c in ranked[: k + 3] if s > 0][: k]
    best = top[0][0] if top else 0.0
    content = _content(question)
    vocab = {_stem(t) for _, c in top for t in _tok(c.source + " " + c.section + " " + c.text)}
    coverage = (sum(1 for t in content if t in vocab) / len(content)) if content else 0.0
    if content and coverage < 0.5:  # a key word of the question appears in NO official document (e.g. 'passport') -> abstain
        return _abstain(f"key terms not found in the official documents ({coverage:.0%} covered)")
    if best < 1.2:  # relevance floor -> abstain instead of guessing
        return _abstain("no official document covers this question", ranked=[(round(s, 2), c) for s, c in ranked[:2]])
    srcs = [{"n": i + 1, "source": c.source, "section": c.section, "lang": c.lang, "score": round(s, 2), "text": c.text}
            for i, (s, c) in enumerate(top)]
    answer, mode = None, "extractive"
    if llm.enabled():
        ctx = "\n".join(f"[{s['n']}] {s['text']}" for s in srcs)
        sys = ("You answer ONLY from the numbered official excerpts. Use very simple words (reader may have low literacy). "
               "Cite like [1]. If the excerpts do not answer, say exactly: NOT_SURE. Reply in " + ("Urdu" if lang == "ur" else "English") + ".")
        out = llm.chat([{"role": "system", "content": sys}, {"role": "user", "content": f"Excerpts:\n{ctx}\n\nQuestion: {question}"}], max_tokens=700)
        if out and "NOT_SURE" not in out:
            answer, mode = out.strip(), "llm_grounded"
    if not answer:
        pref = [s for s in srcs if s["lang"] == lang] or srcs
        answer = pref[0]["text"] + f" [{pref[0]['n']}]"
    return {"answered": True, "answer": answer, "mode": mode, "sources": srcs, "confidence": round(min(1.0, best / 8), 2)}


def _abstain(reason: str, ranked=None) -> dict:
    return {"answered": False, "answer": "I am not sure about this, and I do not want to guess. I can pass your question to a person.",
            "answer_ur": "مجھے اس بارے میں یقین نہیں اور میں اندازہ نہیں لگانا چاہتا۔ میں آپ کا سوال کسی انسان تک پہنچا سکتا ہوں۔",
            "handoff": True, "reason": reason, "sources": [], "confidence": 0.0}
