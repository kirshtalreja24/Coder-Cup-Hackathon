# BHAROSA (بھروسہ) — Plan

> PROTOTYPE ONLY. All identity, payment and data services are mocked. No real personal data.

## 0. Reality check
- Build window ends **Sun 22 Nov, 6 PM PKT**. Today is Sat 21 Nov. Plan for ~24-30 working hours, not 48.
- Judges score **live behavior + curl tests**, not slides. Everything below is ranked by "can it be shown live in 60 seconds".
- Deploy on day 1 (hour ~6) and never stop deploying. An undeployed project scores ~0 on live criteria.

## 1. The sentence (required by the brief)
We help **widows and low-literacy households (and the helpers who serve them)** claim a **mock emergency relief payment**
even though **they cannot read the forms, have weak signal, and are flooded with fake "relief" SMS**.

One task, end to end: **Relief claim**: identity check → document check → eligibility → payment (mock Raast) → receipt, with scam shield
and helper mode wrapped around it. This single task covers all three personas (widow = claimant, shopkeeper = scam target, helper = 40 families).

## 2. The thesis (what makes us different)
Most teams: "AI assistant that fills forms." Ours: **a public-service system designed around being wrong.**
Uncertainty, cost, reversibility and proof are first-class objects, and the system **proves its own behavior live**.

### Signature features (the "speak-of" list)
| # | Feature | Why judges remember it | Rubric hit |
|---|---------|------------------------|-----------|
| 1 | **Risk Dial / Cost-of-Wrong engine**: admin sets cost matrix (wrong approval = 50k PKR loss, human review = 150 PKR, wrongful block = 2k PKR harm). System derives thresholds by minimizing expected cost and **shows the curve + numbers**. Three outcomes: AUTO / ASK-FOR-PROOF (names the exact missing proof) / HUMAN | Answers Challenge 01 with math, not vibes | Uncertainty 5, Risk 3, AI workflow 8 |
| 2 | **Red-Team button**: a live admin page that fires 15 canned attacks at the running system (forged CNIC, name variants, duplicate claim, prompt-injection inside an uploaded doc, fake 8171-lookalike SMS, revoked-consent read, curl as wrong role) and prints a pass/fail scorecard with false-alarm rate | "Behavior over claims" made literal. Nobody else will do this | Reliability 3, Eval dashboard, Quality 6 |
| 3 | **Digital Twin**: edit a rule in a draft, replay on 500 synthetic past cases, see diff (who flips approve→human, projected wrong-approval cost) before publishing. Rules are versioned JSON (effective-from); each decision pins the rule version | Bonus feature + Challenge 04 in one | Innovation 4+4, Rule editor |
| 4 | **Consent Broker + tamper-evident audit**: every data read passes through one server-side gate; withdrawal = instant 403 on next curl; audit log is a hash chain with a "Verify chain" button for the auditor; consent receipts per grant | Server-side enforcement is explicitly tested with curl | Privacy 4, Explain/Audit 3 |
| 5 | **Voice-first, offline-capable PWA**: Urdu prompts **pre-generated once with ElevenLabs and cached in the service worker** (works with zero signal), icon-only flow, page < 50 KB, outbox in IndexedDB with idempotency keys so sync never duplicates | Voice + low literacy + weak internet = 10 pts, all demoable by turning Wi-Fi off | Accessibility 10 |
| 6 | **Scam Shield + Scam Map**: forward an SMS/screenshot → verdict + simple Urdu reason. Hybrid: official-sender rule (BISP says genuine messages come only from **8171**), URL/lookalike checks, fee/"send CNIC" red flags, small char-n-gram classifier. Honest confusion matrix incl. false-alarm cost. Aggregated into a live map | Challenge 08 + bonus | AI features, Real-world |
| 7 | **Helper Mode**: one phone, 40 families; PIN/face-free quick switch, per-family consent, auto-lock after 60 s, every switch audited | Bonus + persona #3 | Innovation, Privacy |
| 8 | **Honest identity matching**: Fellegi–Sunter probabilistic linkage over Urdu/Roman-name phonetic keys (Muhammad/Mohammad/Muhammed), father's name, DOB, district → MATCH / POSSIBLE / NON-MATCH. POSSIBLE goes to a human; never auto-merges | Challenge 03, principled (cited method, not regex) | Bad data, Uncertainty |

Scope guard: **1, 2, 4, 5, 8 are mandatory. 3 and 6 next. 7 only if time remains.** One working > four half-done (the brief says so).

## 3. Required checklist (nothing optional here)
- JWT login + RBAC, 5 roles: Citizen, Helper, Officer, Admin, Auditor (**enforced server-side**; write a curl test per role).
- Dashboard, case management (create / assign / escalate / close), audit log of user + AI + agent actions.
- Consent mgmt (see / share / withdraw / correct), mock identity + payment + data services behind clean APIs.
- Public REST API with API keys + OpenAPI docs (FastAPI gives Swagger free).
- "Pick 3" (we do 6): rule editor, officer review queue (priority + confidence sort), low-bandwidth/offline, rate limiting + error handling, analytics per tenant, multi-tenant (2 departments).
- AI features (need ≥3, we do 8): RAG with citations over mock policy docs, agent with tool calls (identity → eligibility → payment mock), classification/routing, OCR + QR + forgery checks, voice STT/TTS, Pydantic structured outputs, guardrails + human approval, explainability, anomaly detection (duplicate / burst claims), memory, eval dashboard.
- Engineering: Postgres + Alembic migrations, deployed link, logs, a basic pytest suite.
- README with a **"Real vs Simulated"** table and mock labels on every mock screen/API (lose points otherwise).

## 4. Architecture (boring on purpose, so it ships)
- **Backend**: FastAPI (Python, needed for OpenCV/Tesseract/sklearn) + SQLAlchemy + Alembic. One service, clear modules:
  `auth/ rbac/ consent/ audit/ rules/ decision/ identity_match/ vision/ scam/ agent/ rag/ mock_nadra/ mock_raast/ jobs/`
- **DB**: Supabase Postgres (tenants, users, roles, cases, rule_versions, decisions, consents, audit_chain, outbox_ops, scam_msgs).
- **Frontend**: Next.js or plain React PWA, two shells: *Citizen shell* (big icons, voice, tiny) and *Staff shell* (queue, rules, twin, audit).
- **LLM**: Claude Haiku 5.5 for RAG answers, explanations and agent planning, always behind **deterministic fallbacks** (rules + templates) so a dead API never blocks a case. LLM output goes only through Pydantic schemas.
- **Decision core is NOT an LLM.** Rules (versioned) + calibrated scores decide; the LLM explains and assists. This is the "judgment" story.
- **Voice**: STT via browser SpeechRecognition (ur-PK) with Whisper API fallback; TTS = pre-rendered ElevenLabs Urdu clips + browser TTS fallback.
- **Jobs**: lightweight queue (Postgres-based / RQ) for OCR, notifications (mock SMS/WhatsApp log), webhooks.
- **Deploy**: API on Render/Railway/Fly, front on Vercel, DB on Supabase. Rate limit via slowapi.

## 5. The decision engine (Challenge 01, "show the numbers")
Inputs → features (id match score, doc authenticity score, rule result, anomaly score) → calibrated P(legit).
Expected cost of auto-approve = (1−P)·C_wrong_approval. Cost of asking = C_proof + delay. Cost of human = C_review.
Pick the cheapest action. With C_wrong=50,000 vs C_review=150, auto-approval only wins when P(wrong) < 0.3%, so the AUTO band is deliberately narrow.
Admin can change the costs; the Twin shows the effect on historical cases. Evaluate on a synthetic labeled set and **publish**: auto-rate, human-rate, wrong-approvals (target 0), wrongful blocks, avg cost per case.

## 6. Mock data (never real)
Synthetic citizens generated by script: 1,000 people, planted problems (missing fields, duplicates, name variants, wrong gender digit, DOB conflicts), 200 SMS (scam/real, English/Urdu/Roman-Urdu), 20 forged/edited/blurry CNIC images (we generate cards + QR ourselves, clearly watermarked "SAMPLE"). Seed = reproducible.
CNIC structure used for validation: 13 digits, first digit = province, last digit odd=male / even=female (public format; verify nothing against real NADRA).

## 7. Schedule (from now to Sun 6 PM, adjust to actual hour)
| Block | Goal | Done when |
|-------|------|-----------|
| A (first 4-5 h) | Skeleton deployed: auth + RBAC, DB + migrations, audit chain, mock services, seed data, citizen shell stub | Login per role works on live URL; curl role tests pass |
| B (next 6 h) | Core claim flow: identity match, rules engine + versions, decision engine (3 outcomes), case mgmt, officer queue, explanations | A seeded claim goes AUTO / ASK / HUMAN correctly end to end |
| C (next 5 h) | AI layer: OCR/QR/forgery, scam shield, RAG w/ citations, agent tool-calls, voice, consent broker + withdraw | Each has a live demo button |
| D (next 4 h) | Wow layer: Red-Team page, Digital Twin, Risk Dial curve, offline sync, eval dashboard | Scorecard page runs green |
| E (last 4 h) | Polish: README (Real vs Simulated), demo video, tests, bug bash, freeze 2 h before deadline | Submission links ready |

Division for 3-4 people: (1) backend/decision/rules/audit/consent, (2) AI: vision/scam/RAG/agent/eval, (3) frontend citizen PWA + voice + offline, (4) frontend staff + Twin + Red-Team + README/video.

## 8. Demo script (5 min, live)
1. Widow persona: voice in Urdu, icon flow, kill Wi-Fi mid-flow, progress saved, reconnect, synced once.
2. Shopkeeper: pastes fake "relief" SMS → blocked with simple reason; real 8171-style message → allowed (shows false-alarm honesty).
3. Name-variant claim → POSSIBLE → "I'm not sure" handoff with case brief to officer.
4. Admin edits rule → Twin preview → publish → new claim uses v2; old claim still shows v1.
5. Citizen withdraws consent → judge curls the endpoint → 403 → audit chain shows it → "Verify chain" green.
6. Hit **Red-Team**: scorecard prints live. Close on honest limits slide.

## 9. Risks
- Time: cut Helper Mode and multi-tenant polish first; never cut Red-Team, consent curl, or deploy.
- LLM/API outage: fallbacks mandatory. Urdu OCR is weak: lean on QR cross-check + form-field validation, say so honestly.
- Rules/claims may change ("organizers reserve the right"): keep rules data-driven.
- Don't claim what isn't live. Anything mock is labeled MOCK in UI + API responses.

## 10. Sources checked
- BISP/PTA: genuine messages only from 8171; fee/"send CNIC" asks are fraud (Business Recorder, PID press release 5 Jul 2024).
- CNIC format: 13 digits, province digit, odd/even gender (python-stdnum, Geo, Wikipedia).
- Fellegi–Sunter: three-region decision (match / possible-clerical-review / non-match), thresholds from error bounds (US Census working papers).
