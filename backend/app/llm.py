"""Provider-agnostic LLM client (any OpenAI-compatible endpoint: OmniRoute, OpenRouter, Groq, local...).
The platform NEVER depends on it: every caller has a deterministic fallback. A circuit breaker avoids slow retries."""
import json
import time

import httpx

from .config import get_settings

_fail_count = 0
_open_until = 0.0
stats = {"calls": 0, "ok": 0, "fail": 0, "last_error": None, "total_ms": 0}


def enabled() -> bool:
    s = get_settings()
    return bool(s.llm_base_url and s.llm_api_key and s.llm_model)


def chat(messages: list[dict], *, max_tokens: int = 400, temperature: float = 0.1, json_mode: bool = False) -> str | None:
    global _fail_count, _open_until
    s = get_settings()
    if not enabled() or time.time() < _open_until:
        return None
    stats["calls"] += 1
    t0 = time.time()
    body = {"model": s.llm_model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    try:
        r = httpx.post(s.llm_base_url.rstrip("/") + "/chat/completions", json=body, timeout=s.llm_timeout_s,
                       headers={"Authorization": f"Bearer {s.llm_api_key}"})
        r.raise_for_status()
        out = r.json()["choices"][0]["message"]["content"]
        stats["ok"] += 1
        stats["total_ms"] += int((time.time() - t0) * 1000)
        _fail_count = 0
        return out
    except Exception as e:  # noqa
        stats["fail"] += 1
        stats["last_error"] = f"{type(e).__name__}"
        _fail_count += 1
        if _fail_count >= 3:
            _open_until = time.time() + 60
        return None


def chat_json(messages: list[dict], **kw) -> dict | None:
    out = chat(messages, json_mode=True, **kw)
    if not out:
        return None
    try:
        out = out.strip()
        if out.startswith("```"):
            out = out.strip("`").split("\n", 1)[1]
        return json.loads(out)
    except Exception:
        return None
