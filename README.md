# Bharosa (بھروسہ) — AI on Public Rails

> **PROTOTYPE ONLY. Not an official service.** Every identity, payment, SMS and data service here is a **mock**; every person is **synthetic**. No real personal data is used anywhere.
> Built for Coder's Cup '26 · AI Hackathon · *The Last Mile: AI on Public Rails*.

| | |
|---|---|
| **Live app** | https://coder-cup-hackathon.vercel.app |
| **Live API / Swagger** | https://bharosa-api-production.up.railway.app · [`/docs`](https://bharosa-api-production.up.railway.app/docs) · [`/health`](https://bharosa-api-production.up.railway.app/health) |
| **Demo video** | _add the public Google Drive link here_ |
| **Judging walkthrough** | [`docs/JUDGING_SIMULATION.md`](docs/JUDGING_SIMULATION.md): the 9 hardest judge questions, where to click, what you will see (with screenshots) |
| **Repository** | https://github.com/kirshtalreja24/Coder-Cup-Hackathon |

**We help widows and low-literacy households (and the helpers who serve them) claim a relief payment, even though they cannot read the forms, have a weak signal, and are flooded with fake "relief" SMS.**

One task, end to end: **relief claim** → identity check → document check → eligibility → decision → (mock) payment → receipt, wrapped in a scam shield, a consent broker and a tamper-evident audit trail.

## The idea: a system designed around being wrong
Most AI services try to look smart. Bharosa tries to be *accountable*:

| Challenge from the brief | What the running system does |
|---|---|
| **01 Cost of being wrong** | Expected-cost decision engine. Admin sets what a wrong approval / review / wrongful block costs; the system picks the cheapest of *act alone · ask for proof · hand to a human*. Auto-approve needs P(genuine) ≥ **99.5%** with the default costs. See **Risk Dial** page. |
| **02 "I am not sure"** | Low confidence → clear handoff with a **case brief** (what we know, what we doubt, suggested questions). Also in scam checker and RAG (abstains: "not in official documents"). |
| **03 Bad data** | Fellegi–Sunter probabilistic matching + Urdu/Roman name canonicalisation (Muhammad/Mohammad/Muhammed…). Missing fields add *zero* evidence, so thin data can never auto-match. Garbage input never crashes. |
| **04 Rules that change** | Versioned JSON rules edited in the admin UI. Publish = effective on the next decision, no redeploy. Every decision pins its rule version. |
| **05 Explain & audit** | Citizen gets a simple reason (Urdu/Roman/English, spoken). Auditor gets the full trace: input, rule version, model version, confidence, expected costs, identity evidence. |
| **06 Consent & take-back** | One server-side consent gate for all personal data. Withdraw → next request is blocked, and the audit chain shows it. "Who looked at my data" log. Panic button. |
| **07 Works for everyone** | Voice-first Urdu (Uplift AI speech-to-text and text-to-speech via our own server, pre-rendered clips cached for offline, browser voice as last fallback), icon-only flow, about 166 KB gzip app (JS + CSS), PWA, saved progress at every step, offline outbox with idempotent sync, photos shrunk for 2G. |
| **08 Scams & fake documents** | Hybrid scam classifier (rules + char-n-gram ML) with an honest confusion matrix and false-alarm rate; document forensics (blur, QR signature, QR-vs-form cross-check, OCR when available). |

### What makes Bharosa different
Most entries will be an assistant that fills in forms. Bharosa is a system that is **accountable for being wrong**, and it proves that live:

| | Feature | Why it matters |
|---|---|---|
| 1 | **Red-Team page**: the running system attacks itself (61 attacks, run in the background with live progress) and prints a pass/fail scorecard | "Behaviour over claims": judges press one button and read what actually happened |
| 2 | **Cost-of-wrong engine + Risk Dial**: expected-cost minimisation, thresholds derived from admin-set costs | Auto-approve needs about 99.5% confidence; the numbers are on screen |
| 3 | **Digital Twin + safety gate**: every rule change is replayed on past cases; a change that raises fraud or lifts automatic payouts by more than 15% is **blocked** unless the admin writes a reason that goes into the audit log | An admin cannot silently make the system less safe |
| 4 | **"What would change this decision?"**: a computed counterfactual shown to the citizen ("with a clear photo this could be approved automatically, confidence 100%") | Real recourse, produced by re-running the actual engine, in Urdu / Roman Urdu / English |
| 5 | **Verifiable decision receipts**: a signed QR that anyone can verify with no login and no personal data, tied to the hash-chained audit log | A citizen carries proof of a decision; tampering is detected |
| 6 | **Helper Mode where only the family can consent**: the one-time code goes to the *family*, helpers cannot self-consent, and the session locks itself after 60 s (enforced on the server) | One shared phone, 40 families, no way for a helper to quietly consent for someone |
| 7 | **Tamper-evident audit chain** with a "prove detection" button | Auditable AI decisions, not a log you must trust |
| 8 | **Offline-first + Urdu voice** (Uplift AI speech-to-text and text-to-speech, cached prompts) | A person who cannot read, on a weak connection, can finish the task |

### More signature features
* **🛡️ Red-Team page** — the system attacks *itself* live (61 attacks: forged JWTs, wrong roles, tenant isolation, consent withdrawal, helper self-consent, forged ID, prompt injection, garbage input, rule changes, SSRF, receipt tampering, audit tampering…) and prints a pass/fail scorecard.
* **🧪 Digital Twin** — test a rule or cost change on 320 past cases (known ground truth) *before* publishing: who flips, fraud leakage, genuine people affected, spend.
* **🔗 Hash-chained audit log** — tamper-evident; auditor can verify the chain and *prove* detection by simulating tampering.
* **👨‍👩‍👧 Helper Mode** — one shared phone, 40 families: per-family OTP consent (mock), 60-second auto-lock, every switch audited.
* **📴 Offline-first** — claims saved locally, synced later with idempotency keys: no loss, no duplicates.
* **🗺️ Scam Map** — live view of scam types × areas × time from classified messages, incl. "rising areas".

### The interface
A calm **Deep Forest × Champagne** design system (forest green, champagne gold, ivory paper) with Urdu / Roman Urdu / English switching on every screen, large tap targets and a prototype banner on every route.
* **Citizen:** a 7-step claim wizard (one question per screen, voice and icon input, auto-save), a 7-stage case tracker with a distinct screen for *approved*, *under human review*, *needs proof* and *not approved (with appeal)*, a decision receipt, and a "who accessed my data?" page.
* **Voice that understands and acts:** speak (or type) on the *Ask a question* page and the assistant works out what you want (apply, check my request, check a message, ask a policy question, talk to a person, my data) in Urdu, Roman Urdu or English. It opens the right page and fills in what you said (name, income, household, widow) for you to check; it never submits anything for you. Policy questions are answered from the official documents or it says it is not sure. Speech is sent for recognition as soon as you stop talking, no extra tap. Numbers are read with regular expressions, never trusted from an LLM; the LLM is only a tie-breaker and its output is schema-validated (`backend/app/intent.py`, `POST /voice/intent`).
* **Offline and voice:** an offline banner for staff, an **Offline Sync Center** (every claim waiting on the device, for citizens and helpers) and a voice assistant for hands-free help.
* **Staff:** review queue, case view with handoff brief, Rules editor with Digital Twin and safety gate, Risk dial, Scam Map, Audit, Analytics, Admin and Red-Team pages.

## Rubric map (where to look)
| Rubric item | Where |
|---|---|
| ≥3 AI features | RAG (`/ask`) · agent with tool calls (`app/agent.py`: a deterministic, auditable tool-calling pipeline; the LLM never decides) · classification & routing (`/scam/check`, decision engine) · computer vision (`app/vision.py`) · voice (Uplift AI Urdu speech-to-text and text-to-speech through our server, 21 pre-rendered Urdu clips for offline, browser speech as fallback) · structured outputs (Pydantic `ClaimForm`) · guardrails + human approval · explainability (user reason + auditor trace + computed recourse + verifiable receipt) · anomaly detection (IsolationForest + rules) · memory (saved progress/consent) · evaluation dashboard (`/s/analytics`) |
| Core SaaS | JWT + RBAC (5 roles) · dashboards · cases (create/assign/escalate/close) · public REST API + API keys + Swagger · audit log · consent mgmt · mock identity/payment/data APIs |
| "Pick 3" (we built 10) | Multi-tenant (2 departments) · rule editor + Digital Twin · notifications (in-app inbox is real; SMS / WhatsApp / email are simulated and labelled) · webhooks (HMAC-signed, SSRF-guarded) · analytics per tenant · review queue (priority + confidence sort) · subscription plans & quotas · background jobs · rate limiting · offline mode |
| Bonus | Digital Twin · Helper Mode · Offline-first sync · Scam Map (all four) |
| Engineering | Postgres (Supabase) + Alembic migrations · Docker · 100 automated tests (`backend/tests`, including the full Red-Team scorecard) · `/health` `/metrics` · structured error handling · request IDs · audit of every AI/agent call |

## Real vs simulated
See [`docs/REAL_VS_SIMULATED.md`](docs/REAL_VS_SIMULATED.md) (also shown in the app under *About*).

## Run it locally
> Full step-by-step guide (Windows/macOS/Linux, demo accounts, voice, phone testing, troubleshooting): **[`docs/HOW_TO_RUN.md`](docs/HOW_TO_RUN.md)**. The deployed app is linked at the top of this README.

```bash
# backend (Python 3.11+)
cd backend
python -m venv .venv && .venv\Scripts\activate      # (Windows)  source .venv/bin/activate (mac/linux)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000            # seeds synthetic data on first start (SQLite if no DATABASE_URL)
# http://localhost:8000/docs  -> Swagger

# frontend
cd frontend && npm install && npm run dev            # http://localhost:5173
```
Copy `.env.example` → `.env` and set `DATABASE_URL` (Supabase Postgres) for the deployed setup. Migrations run automatically on start for Postgres (`alembic upgrade head`).

Tests: `cd backend && python -m pytest tests -q` (100 tests, includes the full Red-Team scorecard).

### Optional services (everything works without them, with fallbacks)
| Service | `.env` keys | Without it |
|---|---|---|
| **Uplift AI** Urdu voice (speech-to-text + text-to-speech) | `UPLIFT_API_KEY`, `UPLIFT_VOICE_ID` | pre-rendered clips + browser speech |
| **LLM** (any OpenAI-compatible endpoint, e.g. Groq) | `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (or `GROQ_API`, `GROQ_BASE_URL`) | deterministic extractive answers and templated explanations |
| **Tesseract OCR** | installed by the `Dockerfile` | QR signature + form cross-check only (reported honestly) |

Re-generate the 21 spoken Urdu prompts (after editing `PROMPTS` in `backend/app/routers/ai.py`):
`cd backend && .venv\Scripts\python scripts/generate_voice_prompts.py --force`

### Reset the demo database
The app seeds synthetic data only when the database is empty. To start from a clean slate (fresh audit chain, no live cases), drop the app tables in Supabase (or delete `backend/bharosa.db` for local SQLite) and start the API again. Seeding over a far-away Postgres can take a few minutes; it is quick when the API runs near the database.

## Demo accounts (password for all: `Demo#12345`)
| Role | Email |
|---|---|
| Citizen (widow, clean) | `widow-clean@citizen.demo` |
| Citizen (name variants) | `widow-variant@citizen.demo` |
| Helper (40 families) | `helper@relief.demo` |
| Officer | `officer1@relief.demo` |
| Admin | `admin@relief.demo` |
| Auditor | `auditor@relief.demo` |
| Second department (tenant isolation) | `officer@flood.demo`, `admin@flood.demo` |

In the claim flow, tap **Demo** (top right of the form) and pick a scenario to load a ready scenario (clean widow, blurry photo, forged ID, name variants, claims-widow-but-married, over income, garbage input). Scenario list: `GET /demo/scenarios`.

## Test the server-side security with curl
```bash
API=http://localhost:8000
curl -i $API/cases                                              # 401 - no token
TOKEN=$(curl -s -X POST $API/auth/login -d "username=officer1@relief.demo&password=Demo#12345" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -i $API/audit -H "Authorization: Bearer $TOKEN"            # 403 - officer is not auditor
curl -s $API/v1/status -H "X-API-Key: bh_demo_public_key_mock_0001"   # public API (mock data)
curl -s -X POST $API/public/scam-check -H "Content-Type: application/json" -d '{"text":"BISP relief approved. Send CNIC and fee Rs 500 to 0300-1234567","sender":"0300"}'
```
Verify a decision receipt with no login (the code is on the citizen's receipt screen): `curl "$API/public/verify-receipt?t=<receipt-code>"`.

Consent: as a citizen submit a claim with consent, then `POST /consents/{id}/withdraw`; the officer's next `GET /cases/{id}` returns `redacted:true` and `POST /cases/{id}/review` returns **403**; `GET /audit?action=access.denied` shows it.

## Architecture (short)
FastAPI + SQLAlchemy + Alembic · Postgres (Supabase) · React PWA · scikit-learn / OpenCV / rapidfuzz / rank-bm25 · optional LLM through any OpenAI-compatible endpoint (**the platform never depends on it**: every LLM step has a deterministic fallback). Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**The decision core is not an LLM.** Rules + calibrated probabilities + explicit costs decide; the LLM (if configured) only explains and answers questions from retrieved documents, and its output is never allowed to approve money.

## Honest limits
* Scam classifier and forgery checks are trained/tested on a **small synthetic set**; numbers show behaviour, not production accuracy. ELA (edit detection) is informational only because it gave false alarms on clean cards.
* OCR needs Tesseract on the server (installed in the Docker image); without it the system relies on QR signature + form cross-check and says so.
* Browser Urdu speech recognition depends on the device; every voice step has an icon/tap fallback.
* Single-process job runner, in-memory rate limiter and in-memory helper session lock: fine for a prototype, not for horizontal scale.
* The claim agent is a deliberately **deterministic** tool-calling pipeline, not an LLM that improvises; the LLM only explains and answers questions.
* Helper one-time codes are delivered to the family's *simulated* SMS / in-app inbox. For a single-person demo, set `DEMO_SHOW_OTP=true` to also return the code in the API response (off by default, clearly labelled when on).
* Photo uploads are accepted only if the file really is a JPEG, PNG or WebP (checked by its signature), max 5 MB. Login limits count failed attempts per account and per address, so a shared network is not locked out. Anonymous scam reports are shown separately on the Scam Map and never counted in the department's numbers. Withdrawing consent hides case data from officers, auditors and admins alike; only the decision record and the audit log (no personal data) remain.
* Demo logins and the demo API key are public on purpose (so judges can try everything); they only unlock synthetic data.
* The Red-Team run creates a throw-away sandbox department in the database each time (synthetic users only; real demo data is untouched).
* The anomaly detector flags 8+ claims from one account within an hour, which is intentional (batch-filing is a fraud signal) but means a very busy helper's batch would be reviewed by a person.

## Team
Kirsh · Krishna · Sanjna · Shivam
