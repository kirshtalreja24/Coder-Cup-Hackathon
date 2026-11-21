"""Pre-render the Urdu voice prompts with Uplift AI so the app can play them with NO internet (service worker caches them).
Usage (from backend/):  .venv/Scripts/python scripts/generate_voice_prompts.py [--force] [id ...]
Needs UPLIFT_API_KEY in ../.env. Writes ../frontend/public/audio/<id>.mp3"""
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from app.config import get_settings          # noqa: E402
from app.routers.ai import PROMPTS           # noqa: E402

s = get_settings()
if not s.uplift_api_key:
    sys.exit("UPLIFT_API_KEY is missing in .env")
out = ROOT / "frontend" / "public" / "audio"
out.mkdir(parents=True, exist_ok=True)
args = [a for a in sys.argv[1:] if not a.startswith("--")]
force = "--force" in sys.argv
ok = fail = 0
for pid, (ur, _en) in PROMPTS.items():
    if args and pid not in args:
        continue
    dest = out / f"{pid}.mp3"
    if dest.exists() and not force and not args:
        print("skip (exists)", pid); continue
    try:
        r = httpx.post(f"{s.uplift_base_url.rstrip('/')}/synthesis/text-to-speech", timeout=30,
                       headers={"Authorization": f"Bearer {s.uplift_api_key}"},
                       json={"voiceId": s.uplift_voice_id, "text": ur, "outputFormat": "MP3_22050_64"})
        r.raise_for_status()
        dest.write_bytes(r.content); ok += 1
        print(f"ok   {pid:18} {len(r.content)//1024} KB  {r.headers.get('x-uplift-ai-audio-duration', '?')} ms")
    except Exception as e:  # noqa
        fail += 1; print("FAIL", pid, type(e).__name__, getattr(getattr(e, 'response', None), 'text', '')[:120])
print(f"done: {ok} generated, {fail} failed")
