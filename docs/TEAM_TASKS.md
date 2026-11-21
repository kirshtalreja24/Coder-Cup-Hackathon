# Team tasks

**Status (Sat 21 Nov, evening):** backend and frontend are built and tested (24 automated tests; Red-Team scorecard 40/40; all roles and pages checked in a headless browser). Urdu voice (Uplift AI) is wired in and all 21 prompts are pre-rendered. Supabase is migrated and seeded. **Still to do: deploy, real-phone testing, Urdu wording review, demo video.**

Deadline: **Sun 22 Nov, 6:00 PM PKT**. Feature freeze: **Sun 2:00 PM** (bug fixes only after that). Final evaluation: Mon 23 Nov, FAST-NUCES Karachi Library.

## Kirsh — deploy + backend owner
- [ ] Choose the host for the API and deploy it (Render needs a card; see `docs/DEPLOY.md`). Env vars: `DATABASE_URL` (Supabase **Session pooler** URL), `JWT_SECRET`, `UPLIFT_API_KEY`, `GROQ_API`/`GROQ_BASE_URL` (or `LLM_*`), `ENV=prod`. Prefer a region near Supabase (Sydney / Singapore).
- [ ] Deploy the frontend on Vercel (root `frontend`, env `VITE_API_URL` = API URL). Set the API `CORS_ORIGINS` to the Vercel URL.
- [ ] Smoke test the live link: `/health`, log in as each role, Red-Team page 40/40, one voice round trip.
- [ ] Wipe + re-seed the demo database right before the final demo (see README "Reset the demo database").
- [ ] Rotate the Supabase password and keys after the hackathon (they were shown in logs during development).

## Krishna — citizen experience (`ClaimFlow.jsx`, `CitizenHome.jsx`, `Tools.jsx`, `voice.js`)
- [ ] On a real Android phone (Chrome, HTTPS link): tap 🎤, say your name in Urdu, tap ⏹ — the field must fill. Also test spoken results, camera capture, numpad and **airplane mode mid-claim** (must say "saved offline", then sync once).
- [ ] Review all Urdu text with a native speaker: `frontend/src/i18n.jsx` and `PROMPTS` in `backend/app/routers/ai.py`. If you change a prompt, tell Kirsh to re-run `scripts/generate_voice_prompts.py --force`.
- [ ] Check tap-target size, contrast and RTL layout on a small screen; note anything confusing for someone who cannot read.

## Sanjna — staff experience (`Queue.jsx`, `StaffCase.jsx`, `Rules.jsx`, `RiskDial.jsx`, `Audit.jsx`, `ScamMap.jsx`)
- [ ] Officer flow: queue → open a case → read the handoff brief → approve / reject / request proof / escalate.
- [ ] Admin flow: edit the income cap → **Digital Twin** → publish → new claim shows rule v2, old decision still v1.
- [ ] Auditor flow: verify chain, simulate tampering, consent records, AI decisions with traces.
- [ ] Screenshot every page (laptop width) for the slides; fix any layout glitches.

## Shivam — proof, docs and demo (`README.md`, `docs/`, Red-Team, video)
- [ ] Run the **Red-Team** page on the deployed link; screenshot the scorecard.
- [ ] Record the demo video following `docs/DEMO_SCRIPT.md` (screen + voice, under 5 min); upload to Google Drive with "Anyone with the link can view".
- [ ] Fill in the three links at the top of `README.md` (live app, live API, video).
- [ ] Rehearse the live demo twice; prepare answers to the likely judge questions (cost of being wrong, "why not just an LLM?", consent withdrawal, what is mock).

## Everyone
- Never commit `.env`. Never use real personal data. Everything mock stays labelled MOCK.
- Judges will use `curl` against the live API: run the commands in the README yourselves.
- Pull the latest `main` before testing; tell Kirsh about bugs instead of editing backend files in parallel.
