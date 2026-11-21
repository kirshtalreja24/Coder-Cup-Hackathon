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
