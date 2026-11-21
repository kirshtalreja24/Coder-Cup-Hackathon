# Deployment (as deployed): Supabase + Railway + Vercel

```
Browser ──► Vercel (React app)  ──VITE_API_URL──►  Railway (FastAPI, Docker, Singapore)  ──►  Supabase Postgres (Sydney)
                                                         └──► Uplift AI (voice), Groq (LLM)  [both optional]
```
Live: app https://coder-cup-hackathon.vercel.app · API https://bharosa-api-production.up.railway.app (`/docs`, `/health`).

## 1. Database: Supabase
Project Settings → Database → Connection string → **Session pooler** (port **5432**). Use this one, not the direct `db.<ref>.supabase.co` host: Railway cannot reach IPv6, and the direct host is IPv6-only. Tables are created by Alembic and demo data is seeded automatically when the database is empty.

## 2. API: Railway
1. New Project → Deploy from GitHub repo → this repository.
2. Service → Settings: **Root Directory** `backend` (Railway builds `backend/Dockerfile`, which also installs Tesseract OCR), **Region** Southeast Asia (Singapore), **Healthcheck Path** `/health`, then Networking → **Generate Domain**.
3. Variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Supabase **Session pooler** string with your real password |
| `JWT_SECRET` | long random text (30+ characters) |
| `ENV` | `prod` |
| `CORS_ORIGINS` | `https://coder-cup-hackathon.vercel.app` (the web app origin, no trailing slash) |
| `DEMO_SHOW_OTP` | optional, demo only: `true` also returns the helper one-time code in the API response. Leave unset in normal use. |
| `UPLIFT_API_KEY` | optional: Urdu voice |
| `GROQ_API`, `GROQ_BASE_URL` | optional: LLM |

Every push to `main` redeploys automatically (about 5 minutes).

## 3. Web app: Vercel
Import the repository: **Root Directory** `frontend`, framework Vite. Environment variable `VITE_API_URL=https://bharosa-api-production.up.railway.app` (Production and Preview; include `https://`, no trailing slash). Vercel bakes it in at build time, so **redeploy after changing it**. `vercel.json` makes deep links such as `/s/audit` work.

## 4. Smoke test
```bash
curl -s https://bharosa-api-production.up.railway.app/health
curl -s https://bharosa-api-production.up.railway.app/v1/status -H "X-API-Key: bh_demo_public_key_mock_0001"
```
Open the app → log in as `admin@relief.demo` (password `Demo#12345`) → **Red-Team** → run: expect all green (takes about 2 minutes because the database is in another country).
Admin-only diagnostics: `GET /ops/diag` shows the Railway region and the database round-trip time.

## Known issues and fixes
| Symptom | Cause / fix |
|---|---|
| Healthcheck fails, log says "Network is unreachable" | `DATABASE_URL` is the direct (IPv6) host. Use the Session pooler string. |
| Web app login does nothing / 405 | `VITE_API_URL` wrong or redeploy missing. Check the Network tab for the request URL. |
| Slow pages (seconds) | Database far from the API. Put the Supabase project in Singapore (same region as Railway). |
| Genuine claim held for review because of OCR | OCR is a weak signal: only a valid signed QR can vouch for the number (see `backend/app/vision.py`). |

## Reset the demo data before judging
The app seeds only when the database is empty. Drop the app tables in Supabase, then start the API (or run a Railway redeploy) to re-create and re-seed. See the README ("Reset the demo database"). Rotate the Supabase password and the Groq/Uplift keys after the event.
