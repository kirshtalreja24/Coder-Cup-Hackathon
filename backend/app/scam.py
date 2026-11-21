"""Scam Shield: transparent rules + a char-n-gram ML model, combined, with an explicit UNSURE band (handoff).
Works for English, Urdu script and Roman-Urdu. Evaluation is computed live on a held-out set and exposed honestly,
including the false-alarm rate (blocking a real message is also a cost)."""
import random
import re
from functools import lru_cache

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

OFFICIAL_SENDER = "8171"
HELPLINE = "0800-26477"

RE_URL = re.compile(r"(https?://\S+|www\.\S+|\b[\w-]+\.(?:com|net|org|xyz|top|info|co|pk|link|site|online)\b\S*)", re.I)
SHORTENERS = ("bit.ly", "tinyurl", "t.co", "cutt.ly", "rb.gy", "is.gd", "shorturl")
RELIEF = r"(bisp|benazir|ehsaas|ehsas|relief|imdad|امداد|بینظیر|بے نظیر|احساس|income support|kafalat|کفالت)"
FEE = r"(fee|charges?|processing|registration|jazz\s?cash|easy\s?paisa|send rs|deposit|advance|فیس|چارجز|جمع کر)"
SENSITIVE = r"(cnic|pin\b|otp|password|account number|card number|shanakhti|شناختی|پن کوڈ|او ٹی پی|پاسورڈ)"
SEND = r"(send|share|reply|submit|bhej|bhejen|bhejein|dein|دیں|بھیج|شیئر|ریپلائی)"
URGENT = r"(urgent|immediately|within \d+ ?(hours?|hrs)|last chance|expire|block|suspend|فوری|آج ہی|بند ہو|jald|foran)"
PRIZE = r"(congratulations|congrats|winner|lucky|prize|jeeta|jeet|inaam|انعام|مبارک|جیت)"
JOB = r"(part.?time|hiring|earn rs|work from home|ghar baithe|کمائیں|نوکری)"
PHONE = re.compile(r"(?<!\d)(03\d{2}[-\s]?\d{7}|\+92\s?3\d{2}[-\s]?\d{7})")


def _has(p: str, t: str) -> bool:
    return re.search(p, t, re.I) is not None


def rule_features(text: str, sender: str | None) -> dict:
    t = text or ""
    s = (sender or "").strip()
    urls = RE_URL.findall(t)
    non_gov = [u for u in urls if not re.search(r"\.gov\.pk", u, re.I)]
    is_official = s == OFFICIAL_SENDER
    f = {
        "relief_claim": _has(RELIEF, t),
        "fee_request": _has(FEE, t) and _has(r"(pay|send|deposit|جمع|ادا|rs\.?\s?\d|\d+\s?rs|فیس)", t),
        "sensitive_request": _has(SENSITIVE, t) and _has(SEND, t),
        "bad_link": bool(non_gov),
        "shortener": any(x in t.lower() for x in SHORTENERS),
        "urgency": _has(URGENT, t),
        "prize": _has(PRIZE, t),
        "job_bait": _has(JOB, t),
        "phone_in_body": bool(PHONE.search(t)),
        "official_sender": is_official,
        "relief_from_unofficial": _has(RELIEF, t) and not is_official,
    }
    return f


def rule_score(f: dict) -> tuple[float, list[dict]]:
    w = [("relief_from_unofficial", 0.45, "Says it is about relief/BISP but did NOT come from the official sender 8171."),
         ("fee_request", 0.30, "Asks you to pay a fee or send money. Real relief never charges a fee."),
         ("sensitive_request", 0.30, "Asks you to send/share your ID number, PIN, OTP or account details."),
         ("bad_link", 0.28, "Contains a link that is not an official government (.gov.pk) address."),
         ("shortener", 0.15, "Uses a shortened link that hides where it goes."),
         ("prize", 0.25, "Promises a prize/lucky win."),
         ("urgency", 0.15, "Pressures you to act urgently."),
         ("job_bait", 0.20, "Offers easy money/jobs."),
         ("phone_in_body", 0.12, "Asks you to call a personal mobile number.")]
    score, reasons = 0.0, []
    for k, wt, msg in w:
        if f.get(k):
            score += wt
            reasons.append({"code": k, "weight": wt, "text": msg})
    if f.get("official_sender") and not (f["bad_link"] or f["fee_request"] or f["sensitive_request"]):
        score -= 0.5
        reasons.append({"code": "official_sender_clean", "weight": -0.5,
                        "text": "Comes from the official short code 8171 and asks for nothing risky."})
    return max(0.0, min(1.0, score)), reasons


def scam_type(f: dict) -> str:
    if f["sensitive_request"]:
        return "otp_pin_theft"
    if f["fee_request"]:
        return "advance_fee"
    if f["relief_from_unofficial"] and f["bad_link"]:
        return "relief_phishing_link"
    if f["relief_from_unofficial"]:
        return "relief_impersonation"
    if f["prize"]:
        return "fake_prize"
    if f["job_bait"]:
        return "job_bait"
    if f["bad_link"]:
        return "phishing_link"
    return "other"


# ---------------- synthetic training corpus (procedural; clearly synthetic) ---------
def _corpus(seed: int, n: int = 500):
    r = random.Random(seed)
    amt = lambda: r.choice(["25,000", "12,500", "50,000", "10000", "30,000"])
    num = lambda: "03" + str(r.randint(0, 4)) + str(r.randint(0, 9)) + "-" + "".join(str(r.randint(0, 9)) for _ in range(7))
    url = lambda: r.choice(["http://bisp-relief.xyz/claim", "https://bit.ly/3xRelief", "www.ehsaas-payment.top/verify", "http://relief-pk.info/id"])
    scam_t = [
        lambda: f"Congratulations! You are selected for BISP relief of Rs {amt()}. Send your CNIC and processing fee Rs 500 to JazzCash {num()} to receive payment.",
        lambda: f"URGENT: Your Ehsaas payment of Rs {amt()} is blocked. Verify now: {url()} within 24 hours",
        lambda: f"Benazir Income Support: share your OTP and account number to release Rs {amt()}. Reply immediately.",
        lambda: f"Mubarak ho! Aap ka relief payment {amt()} rupay approve ho gaya hai. Apna CNIC aur PIN {num()} par bhejein.",
        lambda: f"Aap ka BISP ka inaam nikla hai. Rs {amt()} lene ke liye {url()} par click karein, jald karein.",
        lambda: f"مبارک ہو! آپ کی امدادی رقم {amt()} روپے منظور ہو گئی ہے۔ شناختی کارڈ نمبر اور فیس {num()} پر بھیجیں۔",
        lambda: f"فوری: آپ کا احساس پروگرام کا کھاتہ بند ہو جائے گا۔ لنک پر کلک کریں {url()}",
        lambda: f"Work from home! Earn Rs {amt()} daily part time. WhatsApp {num()} now. Limited seats.",
        lambda: f"Lucky draw winner! You won a prize of Rs {amt()}. Pay Rs 1000 delivery charges to claim. Call {num()}",
        lambda: f"Dear customer your account is suspended. Share your PIN and OTP to reactivate immediately {url()}",
        lambda: f"Relief fund: registration is open, deposit Rs 300 fee to Easypaisa {num()} to confirm your name.",
        lambda: f"Government relief Rs {amt()} approved. Click {url()} and enter ID card number to receive money today.",
    ]
    real_t = [
        lambda: f"Your payment of Rs {amt()} is ready. Please visit your nearest authorised retailer with your original ID card. No fee is charged.",
        lambda: f"Aap ki kafalat ki raqam {amt()} tayyar hai. Apna asal shanakhti card le kar qareebi retailer se wasool karein.",
        lambda: f"آپ کی رقم {amt()} روپے تیار ہے۔ اصل شناختی کارڈ کے ساتھ قریبی مجاز ریٹیلر سے وصول کریں۔",
        lambda: f"Your K-Electric bill of Rs {r.randint(800, 9000)} is due on {r.randint(10, 28)}th. Pay at any bank branch or app. Ignore if already paid.",
        lambda: f"Your Raast transfer of Rs {r.randint(500, 9000)} to Ali Raza was successful. Ref {r.randint(100000, 999999)}.",
        lambda: f"Reminder: your appointment at the district office is on Monday 10am. Bring your original ID card.",
        lambda: f"Salam, kal shaam ghar aa jayen, khana hai. Ammi ne bulaya hai.",
        lambda: f"Your parcel has been dispatched and will arrive in {r.randint(2, 5)} days. Track in the official app.",
        lambda: f"Dear customer, your mobile package of Rs {r.randint(100, 900)} has been activated. Dial *123# to check balance.",
        lambda: f"Assalam o Alaikum, meeting 5 baje hai office mein. Please confirm.",
        lambda: f"Your school fee voucher for November is available at the school office. Last date is the 25th.",
        lambda: f"Payment received: Rs {amt()}. Thank you. Reference {r.randint(100000, 999999)}.",
    ]
    X, y = [], []
    for _ in range(n):
        if r.random() < 0.5:
            X.append(r.choice(scam_t)()); y.append(1)
        else:
            X.append(r.choice(real_t)()); y.append(0)
    return X, y


# Held-out, hand-written messages (different wording from the training templates) incl. hard cases.
HOLDOUT = [
    ("12345", "BISP officer here. Your name is in the lucky list. send 1000 rupees on 0300-1234567 for stamp and get 25000", 1),
    ("BISP", "Ehsaas stipend update: check your balance at http://ehsaas-check.top today else your file will be closed", 1),
    ("0345", "Sir aap ka benazir wala paisa phans gaya hai, shanakhti card ki tasveer aur OTP bhej dein abhi", 1),
    ("JazzCash", "Your JazzCash account will be blocked in 2 hours. Verify your PIN at bit.ly/jz-verify", 1),
    ("PTCL", "Win a free motorbike! Register free at www.bike-winner.xyz and enter your CNIC", 1),
    ("0300", "بینظیر انکم سپورٹ سے رقم لینے کے لیے پہلے 500 روپے ایزی پیسہ کریں", 1),
    ("Info", "Earn Rs 5000 daily at home, just share this to 10 groups. WhatsApp 0311-7654321", 1),
    ("8170", "Relief payment approved. Reply with your ID number to confirm payee.", 1),
    ("NBP", "Dear user your card is blocked. Update at nbp-secure.info/login immediately", 1),
    ("Ali", "Congratulations you are selected for government laptop scheme pay Rs 2000 registration", 1),
    ("8171", "Aap ki raqam Rs 25000 tayyar hai. Authorised retailer se apna asal CNIC le kar wasool karein.", 0),
    ("8171", "Your relief payment of Rs 25000 is ready at your nearest retailer. Take your original ID. No charges apply.", 0),
    ("8171", "آپ کی ادائیگی تیار ہے۔ قریبی ریٹیلر سے وصول کریں۔", 0),
    ("SNGPL", "Your gas bill for Oct is Rs 1,450. Due date 25 Nov. Pay via any bank or the official app.", 0),
    ("HBL", "Rs 3,000 debited from your account at an ATM. If this was not you call 111-111-425.", 0),
    ("Mother", "Beta aaj raat khana ghar par khana, bhai aa raha hai", 0),
    ("0321", "Meeting shifted to 4pm tomorrow, please confirm.", 0),
    ("EasyPaisa", "You received Rs 5,000 from Imran. Your new balance is Rs 7,310.", 0),
    ("School", "Parent-teacher meeting on Saturday 10am. Please attend.", 0),
    ("K-Electric", "Your bill of Rs 4,210 is due 28 Nov. Pay via the K-Electric app. Ignore if paid.", 0),
    # hard negatives: real-looking but unsafe-looking words
    ("NADRA", "Your ID card renewal is ready for collection at the NADRA centre. Bring your receipt. No other fee.", 0),
    ("Ufone", "Your account will expire soon. Recharge via the app or dial *333# to continue.", 0),
]


@lru_cache(maxsize=1)
def _model():
    X, y = _corpus(seed=7, n=700)
    pipe = make_pipeline(
        TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True),
        LogisticRegression(C=3.0, max_iter=500, class_weight="balanced"),
    )
    pipe.fit(X, y)
    return pipe


def classify(text: str, sender: str | None = None) -> dict:
    text = (text or "").strip()
    if not text:
        return {"verdict": "UNSURE", "score": 0.5, "reasons": [{"code": "empty", "text": "Empty message."}], "scam_type": None}
    f = rule_features(text, sender)
    rs, reasons = rule_score(f)
    p_ml = float(_model().predict_proba([text])[0][1])
    score = 0.6 * rs + 0.4 * p_ml
    disagree = abs(rs - p_ml) > 0.55
    if f["official_sender"] and rs <= 0.1 and p_ml < 0.7:
        verdict = "LIKELY_REAL"
    elif disagree:
        verdict = "UNSURE"
    elif score >= 0.62:
        verdict = "SCAM"
    elif score >= 0.42:
        verdict = "SUSPICIOUS"
    elif score <= 0.22:
        verdict = "LIKELY_REAL"
    else:
        verdict = "UNSURE"
    stype = scam_type(f) if verdict in ("SCAM", "SUSPICIOUS") else None
    advice = {
        "SCAM": {"en": "This looks like a SCAM. Do not reply, do not click, do not send money. Real relief messages come only from 8171.",
                 "ur": "یہ دھوکا لگتا ہے۔ جواب نہ دیں، لنک نہ کھولیں، پیسے نہ بھیجیں۔ اصلی امدادی پیغام صرف 8171 سے آتا ہے۔"},
        "SUSPICIOUS": {"en": "This message looks risky. Do not share any ID, PIN or money. Check with the helpline 0800-26477.",
                       "ur": "یہ پیغام خطرناک لگتا ہے۔ شناختی کارڈ، پن یا پیسے نہ دیں۔ ہیلپ لائن 0800-26477 سے پوچھیں۔"},
        "LIKELY_REAL": {"en": "This looks normal. Still, never share your PIN or OTP with anyone.",
                        "ur": "یہ عام پیغام لگتا ہے۔ پھر بھی اپنا پن یا او ٹی پی کسی کو نہ بتائیں۔"},
        "UNSURE": {"en": "I am not sure about this message, so I will not guess. A person can check it. Until then do not click links or send money.",
                   "ur": "مجھے اس پیغام کے بارے میں یقین نہیں، اس لیے میں اندازہ نہیں لگاؤں گا۔ کوئی انسان دیکھ لے۔ تب تک لنک نہ کھولیں، پیسے نہ بھیجیں۔"},
    }[verdict]
    return {"verdict": verdict, "score": round(score, 3), "rule_score": round(rs, 3), "ml_score": round(p_ml, 3),
            "scam_type": stype, "reasons": reasons, "features": f, "advice": advice,
            "handoff": verdict == "UNSURE", "model_version": "scam-hybrid-1.0", "helpline": HELPLINE}


def evaluate() -> dict:
    """Live, honest evaluation on the held-out set. Counts false alarms (real flagged as scam/suspicious) separately."""
    tp = fp = tn = fn = unsure_scam = unsure_real = 0
    errors = []
    for sender, text, label in HOLDOUT:
        v = classify(text, sender)["verdict"]
        flagged = v in ("SCAM", "SUSPICIOUS")
        if v == "UNSURE":
            if label: unsure_scam += 1
            else: unsure_real += 1
            continue
        if label and flagged: tp += 1
        elif label and not flagged: fn += 1; errors.append({"text": text, "got": v, "want": "SCAM"})
        elif not label and flagged: fp += 1; errors.append({"text": text, "got": v, "want": "REAL"})
        else: tn += 1
    n = len(HOLDOUT)
    decided = tp + fp + tn + fn
    cost = fn * 2000 + fp * 300 + (unsure_scam + unsure_real) * 40  # missed scam >> false alarm > human check
    return {
        "dataset": "held-out hand-written messages (synthetic, different wording from training templates)",
        "n": n, "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn}, "handed_to_human": unsure_scam + unsure_real,
        "accuracy_on_decided": round((tp + tn) / decided, 3) if decided else None,
        "scam_recall": round(tp / (tp + fn + unsure_scam), 3) if (tp + fn + unsure_scam) else None,
        "false_alarm_rate": round(fp / (fp + tn + unsure_real), 3) if (fp + tn + unsure_real) else None,
        "cost_model_pkr": {"missed_scam": 2000, "false_alarm": 300, "human_check": 40, "total": cost},
        "errors": errors, "note": "Small prototype dataset; numbers show behaviour, not production accuracy.",
    }
