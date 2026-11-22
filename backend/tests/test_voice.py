"""Voice endpoints: server-side Uplift proxy with graceful fallback (provider is mocked: no network, no key needed)."""
import httpx

from app.config import get_settings


class FakeResp:
    def __init__(self, content=b"ID3fakeaudio", json_data=None):
        self.content, self._json = content, json_data

    def raise_for_status(self):
        pass

    def json(self):
        return self._json


def test_voice_disabled_without_key_falls_back(client, tok):
    s = get_settings()
    old = s.uplift_api_key
    s.uplift_api_key = ""
    try:
        assert client.get("/voice/status").json()["tts"] is False
        r = client.post("/voice/tts", json={"text": "سلام"}, headers=tok("widow-clean@citizen.demo"))
        assert r.status_code == 503  # app then uses pre-rendered clips / browser voice
    finally:
        s.uplift_api_key = old


def test_voice_requires_login(client):
    assert client.post("/voice/tts", json={"text": "x"}).status_code == 401
    assert client.post("/voice/stt", files={"file": ("a.wav", b"x", "audio/wav")}).status_code == 401


def test_tts_proxies_and_caches(client, tok, monkeypatch):
    s = get_settings()
    s.uplift_api_key = "sk_api_test"
    calls = []

    def fake_post(url, **kw):
        calls.append((url, kw["headers"]["Authorization"], kw["json"]["voiceId"]))
        return FakeResp()
    monkeypatch.setattr(httpx, "post", fake_post)
    try:
        h = tok("widow-clean@citizen.demo")
        a = client.post("/voice/tts", json={"text": "آپ کا نام بولیں"}, headers=h)
        b = client.post("/voice/tts", json={"text": "آپ کا نام بولیں"}, headers=h)
        assert a.status_code == 200 and a.headers["x-tts-cache"] == "miss" and a.content.startswith(b"ID3")
        assert b.headers["x-tts-cache"] == "hit" and len(calls) == 1  # second request never leaves the server
        assert calls[0][1] == "Bearer sk_api_test" and calls[0][0].endswith("/synthesis/text-to-speech")
    finally:
        s.uplift_api_key = ""


def test_stt_proxies_and_survives_provider_failure(client, tok, monkeypatch):
    s = get_settings()
    s.uplift_api_key = "sk_api_test"
    mode = {"fail": False}

    class FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, **kw):
            if mode["fail"]:
                raise httpx.ConnectError("down")
            assert url.endswith("/transcribe/speech-to-text") and kw["data"]["language"] == "ur"
            return FakeResp(json_data={"transcript": "فاطمہ بی بی"})
    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    try:
        h = tok("widow-clean@citizen.demo")
        ok = client.post("/voice/stt", files={"file": ("s.wav", b"RIFFxxxx", "audio/wav")}, headers=h)
        assert ok.status_code == 200 and ok.json()["text"] == "فاطمہ بی بی"
        mode["fail"] = True
        bad = client.post("/voice/stt", files={"file": ("s.wav", b"RIFFxxxx", "audio/wav")}, headers=h)
        assert bad.status_code == 502  # provider down -> clean error, frontend falls back to browser recognition
        assert client.post("/voice/stt", files={"file": ("s.wav", b"", "audio/wav")}, headers=h).status_code in (422, 502)
    finally:
        s.uplift_api_key = ""


# ---------------------------------------------------------------- English dictation (site language = English)
def test_stt_rejects_unknown_language(client, tok):
    r = client.post("/voice/stt", headers=tok("widow-clean@citizen.demo"), data={"lang": "klingon"}, files={"file": ("a.wav", b"RIFFxxxx", "audio/wav")})
    assert r.status_code == 422


def test_english_stt_is_unavailable_without_a_key_and_status_says_so(client, tok, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "groq_api", "")
    assert client.get("/voice/status").json()["stt_en"] is False
    r = client.post("/voice/stt", headers=tok("widow-clean@citizen.demo"), data={"lang": "en"}, files={"file": ("a.wav", b"RIFFxxxx", "audio/wav")})
    assert r.status_code == 503  # the app then falls back to the browser's own English recognition


def test_english_stt_returns_english_text_and_is_audited(client, tok, monkeypatch):
    from app.config import get_settings
    from app.routers import voice
    monkeypatch.setattr(get_settings(), "groq_api", "test-key")

    class FakeResp:
        def raise_for_status(self): pass
        def json(self): return {"text": " My name is Zainab Bibi "}

    class FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, **kw):
            assert url.endswith("/audio/transcriptions") and kw["data"]["language"] == "en"
            return FakeResp()

    monkeypatch.setattr(voice.httpx, "AsyncClient", FakeClient)
    assert client.get("/voice/status").json()["stt_en"] is True
    r = client.post("/voice/stt", headers=tok("widow-clean@citizen.demo"), data={"lang": "en"}, files={"file": ("a.wav", b"RIFFxxxx", "audio/wav")})
    assert r.status_code == 200 and r.json()["text"] == "My name is Zainab Bibi"
    ev = client.get("/audit?action=ai.stt&limit=3", headers=tok("auditor@relief.demo")).json()
    assert ev and ev[0]["details"]["lang"] == "en" and "Zainab" not in str(ev[0]["details"])  # the speech itself is never logged
