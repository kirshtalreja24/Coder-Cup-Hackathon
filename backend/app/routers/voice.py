"""Urdu voice via Uplift AI (TTS + STT). The API key never leaves the server.
Every call is optional: if the key is missing or Uplift is down, endpoints answer 503 and the app falls back to
pre-rendered clips / the browser's own speech engine, so voice can never block a citizen."""
import hashlib
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import audit, intent as intent_mod
from ..config import get_settings
from ..db import get_db
from ..models import User
from ..security import current_user, rate_limited, require_roles

router = APIRouter(prefix="/voice", tags=["voice"])
TTS_FORMAT = "MP3_22050_64"  # small files: friendly to weak connections
MAX_AUDIO = 5 * 1024 * 1024
_stats = {"tts_calls": 0, "tts_cache_hits": 0, "stt_calls": 0, "errors": 0, "last_error": None}


def _cfg():
    s = get_settings()
    return s.uplift_api_key, s.uplift_base_url.rstrip("/"), s.uplift_voice_id


def enabled() -> bool:
    return bool(_cfg()[0])


def english_stt_enabled() -> bool:
    """English speech-to-text uses a Whisper model on the Groq endpoint (the same key as the LLM). Optional."""
    return bool(get_settings().groq_api)


@router.get("/status", summary="Which voice features are available on this server")
def status():
    on = enabled()
    return {"provider": "Uplift AI" if on else None, "tts": on, "stt": on, "stt_en": english_stt_enabled(), "stats": _stats,
            "fallback": "pre-rendered Urdu clips + browser speech engine"}


class TTSIn(BaseModel):
    text: str = Field(min_length=1, max_length=600)


@router.post("/tts", summary="Urdu text-to-speech (MP3). Cached on disk by text hash.", response_class=Response)
def tts(body: TTSIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    key, base, voice = _cfg()
    if not key:
        raise HTTPException(503, "Voice service not configured; use the built-in browser voice")
    if rate_limited(f"tts:{user.id}", 40, 60):
        raise HTTPException(429, "Too many voice requests", headers={"Retry-After": "20"})
    text = body.text.strip()
    h = hashlib.sha256(f"{voice}|{TTS_FORMAT}|{text}".encode()).hexdigest()[:32]
    cache = Path(get_settings().upload_dir) / "tts"
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / f"{h}.mp3"
    if f.exists():
        _stats["tts_cache_hits"] += 1
        return Response(f.read_bytes(), media_type="audio/mpeg", headers={"X-TTS-Cache": "hit"})
    try:
        r = httpx.post(f"{base}/synthesis/text-to-speech", timeout=20,
                       headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                       json={"voiceId": voice, "text": text, "outputFormat": TTS_FORMAT})
        r.raise_for_status()
    except Exception as e:  # noqa
        _stats["errors"] += 1; _stats["last_error"] = type(e).__name__
        raise HTTPException(502, "Voice provider unavailable; use the built-in browser voice")
    f.write_bytes(r.content)
    _stats["tts_calls"] += 1
    audit.log(db, action="ai.tts", actor_type="ai", actor_id="uplift-orator", tenant_id=user.tenant_id,
              details={"chars": len(text), "by": user.id})  # text itself is not logged (privacy)
    return Response(r.content, media_type="audio/mpeg", headers={"X-TTS-Cache": "miss"})


@router.post("/stt", summary="Speech-to-text. Urdu (default) or English (lang=en|roman). Send a short WAV/MP3/OGG recording.")
async def stt(file: UploadFile = File(...), lang: str = Form("ur"), user: User = Depends(current_user), db: Session = Depends(get_db)):
    if lang not in ("ur", "en", "roman"):
        raise HTTPException(422, "lang must be ur, en or roman")
    if lang in ("en", "roman"):
        return await _stt_english(file, lang, user, db)
    key, base, _ = _cfg()
    if not key:
        raise HTTPException(503, "Voice service not configured; use the built-in browser speech recognition")
    if rate_limited(f"stt:{user.id}", 30, 60):
        raise HTTPException(429, "Too many voice requests", headers={"Retry-After": "20"})
    raw = await file.read(MAX_AUDIO + 1)
    if not raw:
        raise HTTPException(422, "Empty recording")
    if len(raw) > MAX_AUDIO:
        raise HTTPException(413, "Recording too long (max 5 MB)")
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{base}/transcribe/speech-to-text", headers={"Authorization": f"Bearer {key}"},
                             files={"file": (file.filename or "speech.wav", raw, file.content_type or "audio/wav")},
                             data={"model": "scribe", "language": "ur"})
            r.raise_for_status()
            j = r.json() or {}
            text = (j.get("transcript") or j.get("text") or "").strip()  # real API uses "transcript"; docs show "text"
    except Exception as e:  # noqa
        _stats["errors"] += 1; _stats["last_error"] = type(e).__name__
        raise HTTPException(502, "Speech recognition unavailable; type or use the buttons")
    _stats["stt_calls"] += 1
    audit.log(db, action="ai.stt", actor_type="ai", actor_id="uplift-scribe", tenant_id=user.tenant_id,
              details={"chars": len(text), "bytes": len(raw), "by": user.id})
    return {"text": text, "provider": "Uplift AI (scribe)", "chars": len(text)}


class IntentIn(BaseModel):
    text: str = Field(min_length=1, max_length=600)
    lang: str = Field(default="en", pattern="^(en|ur|roman)$")


@router.post("/intent", summary="Understand what the person wants (apply / status / scam check / policy question / human / my data) and say where to go")
def understand(body: IntentIn, user: User = Depends(require_roles("citizen", "helper")), db: Session = Depends(get_db)):
    """Works on the transcript of speech OR typed text. It only SUGGESTS a next step; the app opens the page and the person confirms.
    Any number that matters (ID, income, household) is read with regular expressions, never trusted from an LLM."""
    if rate_limited(f"intent:{user.id}", 60, 60):
        raise HTTPException(429, "Too many requests", headers={"Retry-After": "20"})
    res = intent_mod.classify(body.text, body.lang)
    nxt = intent_mod.plan(res, user.role)
    audit.log(db, action="ai.intent", actor_type="ai", actor_id="intent-1.0", tenant_id=user.tenant_id,
              details={"intent": res.intent, "confidence": res.confidence, "source": res.source,
                       "filled": sorted(nxt["prefill"]), "by": user.id})  # what was filled, never the values or the speech itself
    return {"intent": res.intent, "confidence": res.confidence, "source": res.source, "entities": res.entities.model_dump(exclude_none=True),
            "action": {"type": nxt["type"], "to": nxt["to"]}, "prefill": nxt["prefill"],
            "reply": nxt["reply"], "model_version": "intent-1.0"}


async def _stt_english(file: UploadFile, lang: str, user: User, db: Session):
    """English (and Roman-Urdu spoken in Latin letters) dictation. The text comes back in English letters."""
    st = get_settings()
    if not st.groq_api:
        raise HTTPException(503, "English speech recognition is not configured; use the built-in browser speech recognition")
    if rate_limited(f"stt:{user.id}", 30, 60):
        raise HTTPException(429, "Too many voice requests", headers={"Retry-After": "20"})
    raw = await file.read(MAX_AUDIO + 1)
    if not raw:
        raise HTTPException(422, "Empty recording")
    if len(raw) > MAX_AUDIO:
        raise HTTPException(413, "Recording too long (max 5 MB)")
    base = (st.groq_base_url or "https://api.groq.com/openai/v1").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{base}/audio/transcriptions", headers={"Authorization": f"Bearer {st.groq_api}"},
                             files={"file": (file.filename or "speech.wav", raw, file.content_type or "audio/wav")},
                             data={"model": "whisper-large-v3-turbo", "language": "en", "response_format": "json", "temperature": "0",
                                   # a vocabulary hint: people speak Pakistani names, districts and rupee amounts into this app
                                   "prompt": "Pakistani names and places, for example Fatima Bibi, Zainab, Muhammad Ali, Abdul Karim, Karachi, Hyderabad. Amounts in rupees."})
            r.raise_for_status()
            text = ((r.json() or {}).get("text") or "").strip()
    except Exception as e:  # noqa
        _stats["errors"] += 1; _stats["last_error"] = type(e).__name__
        raise HTTPException(502, "Speech recognition unavailable; type or use the buttons")
    _stats["stt_calls"] += 1
    audit.log(db, action="ai.stt", actor_type="ai", actor_id="whisper-en", tenant_id=user.tenant_id,
              details={"chars": len(text), "bytes": len(raw), "by": user.id, "lang": lang})
    return {"text": text, "provider": "Whisper (English)", "chars": len(text)}
