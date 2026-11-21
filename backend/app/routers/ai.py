from collections import Counter, defaultdict
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import audit, demo, llm, rag, scam, twin
from ..db import get_db
from ..metrics import METRICS
from ..models import Case, Decision, IdempotencyRecord, ScamMessage, Tenant, User, now
from ..security import client_ip, current_user, rate_limited, require_roles
from . import cases as cases_router

router = APIRouter(tags=["ai"])


# ================================================================== SCAM SHIELD
class ScamIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    sender: str | None = Field(default=None, max_length=40)
    area: str | None = Field(default=None, max_length=60)
    report: bool = True


def _check(db: Session, body: ScamIn, user: User | None, tenant_id: str | None) -> dict:
    res = scam.classify(body.text, body.sender)
    if body.report:
        db.add(ScamMessage(tenant_id=tenant_id, reporter_id=user.id if user else None, sender=body.sender, text=body.text[:2000], area=body.area,
                           verdict=res["verdict"], score=res["score"], scam_type=res["scam_type"], reasons=[r["code"] for r in res["reasons"]]))
        db.commit()
    audit.log(db, action="ai.scam_check", actor_type="ai", actor_id="scam-hybrid-1.0", tenant_id=tenant_id, resource_type="scam_message",
              details={"verdict": res["verdict"], "score": res["score"], "type": res["scam_type"], "by": user.id if user else "anonymous"})
    return res


@router.post("/scam/check", summary="Is this message a scam? Returns verdict, simple reasons (EN/UR), and hands over when unsure")
def scam_check(body: ScamIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _check(db, body, user, user.tenant_id)


@router.post("/public/scam-check", summary="Same check, no login (rate-limited) - for a shopkeeper who just got a message")
def public_scam_check(body: ScamIn, request: Request, db: Session = Depends(get_db)):
    if rate_limited(f"pub-scam:{client_ip(request)}", 20, 60):
        raise HTTPException(429, "Slow down a little", headers={"Retry-After": "30"})
    return _check(db, body, None, None)


@router.get("/scam/map", summary="Scam Map: live patterns by type, area and time (from classified reports)")
def scam_map(days: int = 30, user: User = Depends(require_roles("officer", "admin", "auditor")), db: Session = Depends(get_db)):
    since = now() - timedelta(days=days)
    rows = db.query(ScamMessage).filter(ScamMessage.created_at >= since).filter((ScamMessage.tenant_id == user.tenant_id) | (ScamMessage.tenant_id.is_(None))).all()
    flagged = [r for r in rows if r.verdict in ("SCAM", "SUSPICIOUS")]
    by_area, by_type, by_day = Counter(r.area or "Unknown" for r in flagged), Counter(r.scam_type or "other" for r in flagged), Counter(r.created_at.strftime("%Y-%m-%d") for r in flagged)
    cell = defaultdict(Counter)
    for r in flagged:
        cell[r.area or "Unknown"][r.scam_type or "other"] += 1
    half = now() - timedelta(days=days / 2)
    aw = lambda d: d if d.tzinfo else d.replace(tzinfo=timezone.utc)  # SQLite returns naive datetimes
    recent = Counter(r.area or "Unknown" for r in flagged if aw(r.created_at) >= half)
    older = Counter(r.area or "Unknown" for r in flagged if aw(r.created_at) < half)
    rising = [{"area": a, "recent": recent[a], "earlier": older.get(a, 0)} for a in recent if recent[a] > older.get(a, 0) * 1.5 and recent[a] >= 3]
    return {"window_days": days, "total_reports": len(rows), "flagged": len(flagged), "by_area": by_area.most_common(), "by_type": by_type.most_common(),
            "by_day": sorted(by_day.items()), "area_x_type": {a: dict(c) for a, c in cell.items()}, "rising_areas": sorted(rising, key=lambda x: -x["recent"]),
            "note": "Built from classified (synthetic + reported) messages. Area is as reported by the user."}


@router.get("/scam/recent")
def scam_recent(limit: int = 30, user: User = Depends(require_roles("officer", "admin", "auditor")), db: Session = Depends(get_db)):
    rows = db.query(ScamMessage).order_by(ScamMessage.created_at.desc()).limit(limit).all()
    return [{"id": r.id, "area": r.area, "verdict": r.verdict, "score": r.score, "type": r.scam_type, "text": r.text[:160], "at": r.created_at.isoformat()} for r in rows]


@router.get("/scam/eval", summary="Honest evaluation incl. false-alarm rate")
def scam_eval(user: User = Depends(current_user)):
    return scam.evaluate()


# ================================================================== RAG
class AskIn(BaseModel):
    question: str = Field(min_length=2, max_length=500)
    lang: str = "en"


@router.post("/ask", summary="Ask about rules/forms/policies. Answers carry sources; abstains when not covered.")
def ask(body: AskIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    res = rag.ask(db, body.question, body.lang)
    audit.log(db, action="ai.rag_answer", actor_type="ai", actor_id="rag-1.0", tenant_id=user.tenant_id,
              details={"answered": res["answered"], "mode": res.get("mode"), "sources": [s["section"] for s in res["sources"]], "by": user.id})
    return res


@router.post("/public/ask", summary="Ask without login (rate-limited)")
def public_ask(body: AskIn, request: Request, db: Session = Depends(get_db)):
    if rate_limited(f"pub-ask:{client_ip(request)}", 20, 60):
        raise HTTPException(429, "Slow down a little", headers={"Retry-After": "30"})
    return rag.ask(db, body.question, body.lang)


# ================================================================== OFFLINE-FIRST SYNC (idempotent)
class Op(BaseModel):
    op_id: str = Field(min_length=6, max_length=60, description="Client-generated unique id; replays are safe")
    type: str
    payload: dict = Field(default_factory=dict)
    client_ts: str | None = None


class SyncIn(BaseModel):
    ops: list[Op] = Field(max_length=100)


@router.post("/sync/batch", summary="Offline-first sync: replay queued operations with idempotency keys (no loss, no duplicates)")
def sync_batch(body: SyncIn, user: User = Depends(require_roles("citizen", "helper")), db: Session = Depends(get_db)):
    results, id_map = [], {}
    for op in body.ops:
        key = f"sync:{op.op_id}"[:80]
        prev = db.get(IdempotencyRecord, key)
        if prev and prev.user_id == user.id:
            results.append({"op_id": op.op_id, "status": "duplicate_ignored", "result": prev.response})
            continue
        try:
            p = dict(op.payload)
            for k in ("case_id",):  # allow client temp ids created earlier in same batch
                if p.get(k) in id_map:
                    p[k] = id_map[p[k]]
            if op.type == "case.create":
                out = cases_router.create_case(cases_router.CaseCreate(**{k: v for k, v in p.items() if k in ("citizen_id", "type", "data", "progress")}), user, db, f"{op.op_id}-create")
                if p.get("temp_id"):
                    id_map[p["temp_id"]] = out["id"]
            elif op.type == "case.patch":
                out = cases_router.patch_case(p["case_id"], cases_router.CasePatch(data=p.get("data"), progress=p.get("progress")), user, db)
            elif op.type == "case.submit":
                out = cases_router.submit_case(p["case_id"], cases_router.SubmitIn(consent=p.get("consent")), user, db, f"{op.op_id}-submit")
            elif op.type == "scam.check":
                out = _check(db, ScamIn(text=p["text"], sender=p.get("sender"), area=p.get("area")), user, user.tenant_id)
            else:
                raise HTTPException(422, f"unknown op type {op.type}")
            db.merge(IdempotencyRecord(key=key, user_id=user.id, response=_jsonable(out)))
            db.commit()
            results.append({"op_id": op.op_id, "status": "applied", "result": _jsonable(out)})
        except HTTPException as e:
            db.rollback()
            results.append({"op_id": op.op_id, "status": "rejected", "error": e.detail, "http": e.status_code})
        except Exception as e:  # never crash a whole batch
            db.rollback()
            results.append({"op_id": op.op_id, "status": "error", "error": type(e).__name__})
    audit.log(db, action="sync.batch", actor=user, details={"ops": len(body.ops), "applied": sum(1 for r in results if r["status"] == "applied")})
    return {"results": results, "temp_id_map": id_map}


def _jsonable(o):
    import json
    return json.loads(json.dumps(o, default=str))


# ================================================================== VOICE PROMPT MANIFEST (audio is cached by the PWA for offline use)
PROMPTS = {
    "welcome": ("خوش آمدید۔ میں آپ کی مدد کروں گا۔ بٹن دبا کر بولیں۔", "Welcome. I will help you. Press the button and speak."),
    "say_name": ("اپنا نام بولیں۔", "Say your name."),
    "say_cnic": ("اپنا شناختی کارڈ نمبر بولیں، یا نمبر لکھیں۔", "Say your ID card number, or type it."),
    "say_income": ("آپ کی مہینے کی کمائی کتنی ہے؟", "How much do you earn in a month?"),
    "say_household": ("آپ کے گھر میں کتنے لوگ رہتے ہیں؟", "How many people live in your home?"),
    "take_photo": ("اب اپنے شناختی کارڈ کی تصویر لیں۔ کارڈ سیدھا رکھیں۔", "Now take a photo of your ID card. Keep it flat."),
    "photo_blurry": ("تصویر دھندلی ہے۔ براہ کرم دوبارہ لیں۔", "The photo is blurry. Please take it again."),
    "consent_identity": ("کیا آپ شناخت کی جانچ کی اجازت دیتے ہیں؟ ہاں یا نہیں دبائیں۔", "Do you allow an identity check? Press yes or no."),
    "consent_payment": ("کیا آپ رقم بھیجنے کی اجازت دیتے ہیں؟", "Do you allow us to send the payment?"),
    "submitted": ("آپ کی درخواست بھیج دی گئی ہے۔ ایک لمحہ انتظار کریں۔", "Your request was sent. Please wait a moment."),
    "approved": ("مبارک ہو۔ آپ کی درخواست منظور ہو گئی۔", "Congratulations. Your request is approved."),
    "need_proof": ("ہمیں ایک اور چیز چاہیے۔ اسکرین پر دیکھیں۔", "We need one more thing. Look at the screen."),
    "human_review": ("ہمیں پوری تسلی نہیں، اس لیے ایک انسان آپ کا کیس دیکھے گا۔ آپ کو دوبارہ کچھ بتانا نہیں پڑے گا۔", "We are not fully sure, so a person will check your case. You will not need to repeat anything."),
    "declined_appeal": ("ابھی منظور نہیں ہو سکا۔ آپ کسی انسان سے دوبارہ جانچ کروا سکتے ہیں۔", "Not approved right now. You can ask a person to check again."),
    "scam_alert": ("خبردار۔ یہ پیغام دھوکا لگتا ہے۔ جواب نہ دیں، پیسے نہ بھیجیں۔", "Warning. This message looks like a scam. Do not reply, do not send money."),
    "scam_ok": ("یہ پیغام عام لگتا ہے۔ پھر بھی اپنا پن کسی کو نہ بتائیں۔", "This message looks normal. Still, never share your PIN."),
    "offline_saved": ("انٹرنیٹ نہیں ہے۔ آپ کا کام محفوظ ہو گیا ہے۔ نیٹ آنے پر خود بھیج دیا جائے گا۔", "No internet. Your work is saved and will be sent when the connection returns."),
    "back_online": ("انٹرنیٹ واپس آ گیا۔ آپ کا محفوظ کام بھیج دیا گیا۔", "Back online. Your saved work was sent."),
    "consent_withdrawn": ("آپ کی اجازت واپس لے لی گئی ہے۔ اب کوئی آپ کا ڈیٹا نہیں دیکھ سکتا۔", "Your permission was withdrawn. No one can see your data now."),
    "helper_switch": ("اب دوسرے خاندان کا صفحہ کھل گیا ہے۔ پچھلا خاندان بند ہو گیا۔", "Switched to another family. The previous family is now locked."),
    "lock_warning": ("حفاظت کے لیے اسکرین بند ہو رہی ہے۔", "For safety, the screen is locking."),
}


@router.get("/voice/prompts", summary="Urdu/English voice prompt manifest. Audio files are static and cacheable offline.")
def voice_prompts():
    return {"prompts": [{"id": k, "ur": v[0], "en": v[1], "audio_url": f"/static/audio/{k}.mp3"} for k, v in PROMPTS.items()],
            "note": "Audio pre-generated once with a TTS model and cached by the app so voice works with no signal. Browser speech recognition (ur-PK) is used for input, with tap/icon fallbacks."}


# ================================================================== EVALUATION DASHBOARD
RAG_QA = [("Who can apply for the relief payment?", "Who can apply"), ("What documents do I need?", "Documents required"),
          ("Is there a fee to apply?", "Documents required"), ("How do I know a message is real?", "Genuine messages"),
          ("Can I appeal a decision?", "Appeals"), ("How do I take back my data?", "Your data"), ("آپ کا ڈیٹا کون دیکھ سکتا ہے", "Your data"),
          ("helper kitne families ko help kar sakta hai", "Helping many families")]
RAG_OUT_OF_SCOPE = ["How do I apply for a passport?", "What is the weather in Karachi today?", "Who won the cricket match?"]


@router.get("/eval", summary="Evaluation dashboard: accuracy, false alarms, speed, cost, failures")
def evaluation(user: User = Depends(require_roles("admin", "officer", "auditor")), db: Session = Depends(get_db)):
    base = twin.replay(db, user.tenant_id)
    hist = db.query(Decision).join(Case, Case.id == Decision.case_id).filter(Case.is_historical == True, Case.tenant_id == user.tenant_id).all()  # noqa: E712
    truth = {c.id: c.ground_truth for c in db.query(Case).filter_by(tenant_id=user.tenant_id, is_historical=True)}
    bins = []
    for i in range(10):
        lo, hi = i / 10, (i + 1) / 10
        sel = [d for d in hist if lo <= d.p_legit < hi or (i == 9 and d.p_legit == 1.0)]
        if sel:
            bins.append({"bin": f"{lo:.1f}-{hi:.1f}", "n": len(sel), "predicted": round(sum(d.p_legit for d in sel) / len(sel), 3),
                         "actual_genuine": round(sum(1 for d in sel if truth.get(d.case_id) == "legit") / len(sel), 3)})
    brier = round(sum((d.p_legit - (1 if truth.get(d.case_id) == "legit" else 0)) ** 2 for d in hist) / max(len(hist), 1), 4)
    hits = sum(1 for q, sec in RAG_QA if (r := rag.ask(db, q)).get("answered") and any(sec in s["section"] for s in r["sources"]))
    abst = sum(1 for q in RAG_OUT_OF_SCOPE if not rag.ask(db, q).get("answered"))
    m = METRICS.snapshot()
    return {
        "decisions_on_synthetic_history": base["before"],
        "headline": {"wrong_approvals": base["before"]["wrong_approvals"], "genuine_declined": base["before"]["genuine_declined_by_rule"],
                     "auto_rate": base["before"]["auto_rate"], "human_rate": base["before"]["human_rate"], "avg_cost_per_case_pkr": base["before"]["avg_cost_per_case_pkr"]},
        "calibration": {"brier_score": brier, "reliability_bins": bins, "note": "predicted P(genuine) vs actual share genuine, per bin"},
        "scam": scam.evaluate(),
        "rag": {"retrieval_hit_rate": f"{hits}/{len(RAG_QA)}", "abstains_when_out_of_scope": f"{abst}/{len(RAG_OUT_OF_SCOPE)}"},
        "llm": {"enabled": llm.enabled(), **llm.stats, "avg_ms": int(llm.stats["total_ms"] / max(llm.stats["ok"], 1))},
        "service": m,
        "ocr_engine_available": __import__("app.vision", fromlist=["x"]).ocr_available(),
    }


# ================================================================== DEMO HELPERS
@router.get("/demo/scenarios", summary="Ready-made synthetic claim scenarios to reproduce every behaviour")
def scenarios():
    return {"password_for_all_demo_logins": "Demo#12345",
            "scenarios": [{"key": k, **{kk: vv for kk, vv in v.items() if kk != "card"}, "sample_card_url": f"/demo/sample-card/{k}" if v["card"] else None}
                          for k, v in demo.SCENARIOS.items()],
            "scam_samples": demo.SCAM_SAMPLES}


@router.get("/demo/sample-card/{key}", summary="Download the synthetic, watermarked sample ID card photo for a scenario", response_class=Response)
def sample_card(key: str):
    data = demo.make_card(key)
    if not data:
        raise HTTPException(404, "No card for this scenario")
    return Response(content=data, media_type="image/jpeg", headers={"Content-Disposition": f"inline; filename={key}.jpg"})
