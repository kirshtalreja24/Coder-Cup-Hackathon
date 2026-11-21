# Team tasks (backend + frontend are already built and working — now we polish, verify and deploy)

Deadline: **Sun 22 Nov 6:00 PM PKT**. Freeze all features at **Sun 2:00 PM**; after that only bug fixes.

## Kirsh — deploy + backend owner
- [ ] Put Supabase `DATABASE_URL` in `.env`; run backend once (migrations + seed run automatically).
- [ ] Deploy API on Render (`render.yaml`, Docker). Set `DATABASE_URL`, `JWT_SECRET`, optional `LLM_*`.
- [ ] Run `python -m pytest tests -q` before every deploy; hit `/health`.
- [ ] Optional LLM: set `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL` (any OpenAI-compatible endpoint). App works without it.

## Krishna — citizen experience (`frontend/src/pages/ClaimFlow.jsx`, `CitizenHome.jsx`, `voice.js`)
- [ ] Test on a real phone (Chrome Android): voice input (ur-PK), camera capture, numpad, offline mode (airplane mode mid-flow).
- [ ] Review Urdu strings in `i18n.jsx` and `PROMPTS` in `backend/app/routers/ai.py` with a native speaker; fix wording.
- [ ] Check large tap targets, contrast, RTL layout on a small screen.

## Sanjna — staff experience (`Queue.jsx`, `StaffCase.jsx`, `Rules.jsx`, `RiskDial.jsx`, `Audit.jsx`)
- [ ] Walk the full officer flow: queue → case → approve/reject/request proof/escalate.
- [ ] Walk the admin flow: edit rule → Twin → publish → new claim uses v2.
- [ ] Walk the auditor flow: verify chain, tamper simulation, consent records, decisions.
- [ ] Fix any layout glitches on laptop screens; screenshot every page for the slides.

## Shivam — proof, docs and demo (`README.md`, `docs/`, Red-Team, video)
- [ ] Run **Red-Team** page; screenshot the 40/40 scorecard.
- [ ] Record the demo video from `docs/DEMO_SCRIPT.md` (screen + voice); upload to Google Drive, set "Anyone with the link".
- [ ] Rehearse the live demo twice; write the 5 most likely judge questions + answers.
- [ ] Final README pass: add deployed URL, repo link, video link at the top.

## Everyone
- Never commit `.env`. Never use real personal data. Everything mock stays labelled MOCK.
- Judges will use `curl`: try the commands in README yourselves.
