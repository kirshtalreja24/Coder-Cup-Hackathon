# Deployment

## 1. Database (Supabase)
Project Settings → Database → **Connection string → URI (Session pooler)**. Put it in `.env` / Render as `DATABASE_URL`.
Tables are created by Alembic (`alembic upgrade head`) automatically when the API starts; synthetic data is seeded on first start.

## 2. API on Render (Docker, includes Tesseract)
1. Push the repo to GitHub (check `.env` is **not** committed).
2. Render → New → Blueprint → select the repo (`render.yaml`). Add env vars: `DATABASE_URL`, optional `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. `JWT_SECRET` is generated.
3. Wait for `/health` to return `{"status":"ok"}`. Swagger at `/docs`.
Free instances sleep after inactivity: open `/health` 2 minutes before the demo.

## 3. Frontend on Vercel
Import the repo, root directory `frontend`, framework Vite. Env var `VITE_API_URL=https://<your-render-url>`.
`vercel.json` already handles SPA routes. After deploy, set Render `CORS_ORIGINS` to your Vercel URL (or leave `*`).

## 4. Smoke test the deployed link
```bash
curl -s https://API/health
curl -s https://API/v1/status -H "X-API-Key: bh_demo_public_key_mock_0001"
```
Log in as `admin@relief.demo` → Red-Team → run.

## Local without Docker
See README. SQLite is used when `DATABASE_URL` is empty.
