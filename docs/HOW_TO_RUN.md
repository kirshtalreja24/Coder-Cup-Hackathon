# How to run Bharosa (there is no live deployment yet)

Bharosa has two parts that you start in **two terminals**:

| Part | Folder | Address when running |
|---|---|---|
| Backend API (FastAPI + Python) | `backend/` | http://localhost:8000 (Swagger at `/docs`) |
| Web app (React) | `frontend/` | http://localhost:5173 |

> PROTOTYPE ONLY. All identity, payment and data services are mocks; all people are synthetic.

## 1. Prerequisites
* **Python 3.11 or newer** (check: `python --version`)
* **Node.js 20 or newer** (check: `node --version`)
* **Git**
* Optional: Tesseract OCR (only adds an extra document check; the app runs without it).

## 2. Get the code
```bash
git clone https://github.com/kirshtalreja24/Coder-Cup-Hackathon.git
cd Coder-Cup-Hackathon
```

## 3. Configure `.env` (project root, never commit it)
Copy `.env.example` to `.env`. **Everything is optional for a first run.**

| Key | What it does | If empty |
|---|---|---|
| `DATABASE_URL` | Postgres (Supabase). | Uses a local SQLite file `backend/bharosa.db`. |
| `JWT_SECRET` | Signs login tokens. | A development default is used. |
| `UPLIFT_API_KEY` | Urdu speech-to-text and text-to-speech. | Pre-rendered clips + the browser's own voice. |
| `GROQ_API`, `GROQ_BASE_URL` (or `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`) | LLM for explanations and Q&A. | Deterministic templates. |

**Important:** if your `.env` already contains a Supabase `DATABASE_URL`, the app will use it. Supabase is far away and slow from Pakistan (each request takes seconds), so for local development override it with SQLite:

* PowerShell: `$env:DATABASE_URL = "sqlite:///./bharosa.db"`
* Command Prompt: `set DATABASE_URL=sqlite:///./bharosa.db`
* Git Bash: `export DATABASE_URL="sqlite:///./bharosa.db"`

Set it in the same terminal where you start the backend (step 4).

## 4. Start the backend (terminal 1)
**Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL = "sqlite:///./bharosa.db"      # local database (see above)
python -m uvicorn app.main:app --reload --port 8000
```
**macOS / Linux:**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="sqlite:///./bharosa.db"
python -m uvicorn app.main:app --reload --port 8000
```
The first start creates the tables and loads the synthetic data (about 10 to 30 seconds). When you see `Uvicorn running on http://127.0.0.1:8000`, check http://localhost:8000/health. It should return `{"status":"ok",...}`.

## 5. Start the web app (terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**. The app talks to `http://localhost:8000` by default. To point it at another API, create `frontend/.env` containing `VITE_API_URL=http://your-api-address`.

## 6. Log in (password for every demo account: `Demo#12345`)
| Role | Email | What to try |
|---|---|---|
| Citizen (widow) | `widow-clean@citizen.demo` | *Apply* → tap the **🎬 demo** button to load a ready scenario → Send |
| Citizen (name variants) | `widow-variant@citizen.demo` | Misspelled name, missing fields → "not sure" handoff |
| Helper (40 families) | `helper@relief.demo` | Pick a family → one-time-code consent → claim |
| Officer | `officer1@relief.demo` | Review queue, case brief, approve / reject |
| Admin | `admin@relief.demo` | Rules + **Digital Twin**, Risk dial, users, API keys, **Red-Team** |
| Auditor | `auditor@relief.demo` | Audit log, verify chain, AI decision traces |
| Second department | `officer@flood.demo`, `admin@flood.demo` | Tenant isolation |

The login page also has one-click buttons for the main accounts. A suspicious message can be checked without logging in at http://localhost:5173/public/scam.

## 7. Check everything works
```bash
cd backend
python -m pytest tests -q          # 24 tests, includes the 40-attack Red-Team scorecard
```
In the app: log in as **admin** → **Red-Team** → *Run the attacks*. The score should be **40/40**.

Try the server-side security with curl (what judges will do):
```bash
curl -i http://localhost:8000/cases                                   # 401: no token
curl -s -X POST http://localhost:8000/auth/login -d "username=officer1@relief.demo&password=Demo#12345"
curl -s http://localhost:8000/v1/status -H "X-API-Key: bh_demo_public_key_mock_0001"
```

## 8. Voice (Urdu)
* Without `UPLIFT_API_KEY` the app still speaks, using the pre-rendered clips in `frontend/public/audio/` and the browser's voice.
* With the key, dynamic text is spoken through Uplift and the microphone button (🎤, tap again to stop) is transcribed by Uplift.
* The microphone only works on `http://localhost` or an `https://` address (browser rule).
* To re-generate the 21 prompt clips after editing the Urdu text: `cd backend` then `python scripts/generate_voice_prompts.py --force`.

## 9. Try it on a phone (same Wi-Fi)
1. Find your computer's IP (Windows: `ipconfig`).
2. Start the backend with `--host 0.0.0.0`, and set `frontend/.env` to `VITE_API_URL=http://<your-ip>:8000`.
3. Start the frontend with `npm run dev -- --host` and open `http://<your-ip>:5173` on the phone.
Note: browsers block the **microphone** on plain `http://` addresses other than localhost. To test the mic on a phone, use a deployed HTTPS link (or a tunnel such as `cloudflared`).

## 10. Reset the demo data
Stop the backend and delete `backend/bharosa.db`; the next start re-creates and re-seeds everything. For Supabase, drop the app tables and start the API once (see README, "Reset the demo database").

## Troubleshooting
| Problem | Fix |
|---|---|
| Web app says "No connection to the server" | Backend not running, or `VITE_API_URL` is wrong. Open http://localhost:8000/health. |
| Everything is very slow (seconds per click) | You are using the Supabase `DATABASE_URL` from a far-away country. Use SQLite locally (step 3). |
| `Address already in use` | Another program uses the port: use `--port 8001` (and set `VITE_API_URL` to match), or stop the old process. |
| `python-dotenv could not parse statement...` | Harmless. A line in `.env` is not `KEY=value`; delete or fix it. |
| Login fails with 401 | The password is `Demo#12345` (capital D, `#`). In curl, quote it. |
| 🎤 does nothing | Allow microphone permission; use localhost or HTTPS; otherwise type or use the buttons. |
| `pip install` fails on a package | Use Python 3.11 or 3.12 (very new Python versions may lack prebuilt wheels). |
| Port 5173 shows an old page | Hard refresh (Ctrl+Shift+R). |

## Production build (optional)
```bash
cd frontend && npm run build && npm run preview    # serves the built app on http://localhost:4173
```
Deployment notes for when a host is chosen: `docs/DEPLOY.md`.
