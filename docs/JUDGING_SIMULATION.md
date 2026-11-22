# Judging simulation: where to go, what you will see, what to say

Every step below was executed on the real app (screenshots in [`judging-simulation/`](judging-simulation/)). The screenshots come from a local run with the same seeded synthetic data as the live site, so the live site looks identical.

* **Web:** https://coder-cup-hackathon.vercel.app  **API / Swagger:** https://bharosa-api-production.up.railway.app/docs
* **All demo passwords:** `Demo#12345`
* Phone-size screens = citizen/helper pages. Desktop = staff pages.

## Rules of the room (read first)
1. **Each scenario citizen can be run cleanly once.** A second run of the same person is flagged as a repeat claim (that is the anomaly detector working). Do **not** rehearse on the live site before judging, or ask for a re-seed first.
2. **Only failed logins are limited** (8 wrong passwords per account, 60 per address, per 5 minutes). Judges sharing a network can log in freely. If you mistype a password 8 times, that account is locked for about 5 minutes.
3. **Say "prototype, mock data" out loud.** Every screen already carries the banner.
4. Never claim: "autonomous agent" (it is an audited deterministic tool-calling pipeline), "forgery detection" beyond QR-signature and cross-checks, "accuracy" on real data, "no one can see your data after withdrawal" without the caveat in Q4 (the audit log, which holds no personal data, and the decision record stay), or that voice works until you have heard it on your own phone.
5. The **Ask a question** page has a **typed box at the top** and a microphone. Both go through the same "what do you want?" step (Q10). Speech is sent automatically when you stop talking.

---

## Q1 "What happens when the AI is uncertain?"
**Go to:** log in `officer1@relief.demo` → **Review queue** → open the case "claims-widow-but-married" (priority 2 or 3, confidence shown).
**You see:** AI Handoff Brief ("Why the system stopped", the exact doubts, expected loss if auto-approved vs review), the claimant's evidence, and **Approve / Reject / Request proof / Assign / Escalate**. Tabs: citizen notice, algorithmic decision trace, audit timeline.
**Then:** log in `liar-widow@citizen.demo` → **My requests** → the case: "Under human review", "What would change this?", "Decision receipt".
**Say:** "It does not guess. It stops, writes a brief so the citizen never repeats anything, and a person decides."
Screenshots: `q1a_officer_queue`, `q1b_officer_case_handoff`, `q1c_citizen_human_review`.

## Q2 "Why should we trust this identity match?"
**Go to:** officer → queue → case "name variant" (`widow-variant@citizen.demo`) → tab **Algorithmic Decision Trace**.
**You see:** the identity evidence per field (name, father, date of birth, district), the match outcome (match / possible / non-match) and the probability. Missing fields add zero evidence, so thin data cannot auto-match. Muhammad / Mohammad / Muhammed are treated as the same name but never auto-merged.
Screenshot: `q2_identity_trace`.

## Q3 "What happens if the eligibility rule changes?"
**Go to:** `admin@relief.demo` → **Rules & Twin**.
1. Edit the income limit (e.g. 30000 → 15000) → **Simulate on Past Cases (Digital Twin)**: it replays 320 past cases and shows who flips, fraud leakage, genuine people affected and spend.
2. Tick off conditions (or raise payouts a lot) → **Publish to Live System**: the **safety gate** blocks it ("would raise automatic payouts by 58%") unless you write a reason (10+ characters), which is stored in the audit log.
3. A safe change publishes immediately; the next decision uses the new version, and old decisions keep their old version (auditor → Algorithmic Decisions shows v1 and v2 side by side).
Also open **Risk dial** to show the cost-of-being-wrong thresholds (auto-approve only above about 99.5%).
Screenshots: `q3a_rules_editor`, `q3b_rules_safety_gate_blocks`, `q3c_risk_dial`.
**Afterwards restore the original rule** (publish v1 again) so later demos are not affected.

## Q4 "Can a helper (or officer) access data after consent is withdrawn?"
**Go to:**
1. `officer1` → open the case: data visible (`q4a`).
2. `liar-widow@citizen.demo` → **My data** → red **Panic / Withdraw all** → **Confirm Lockdown: Revoke All** (`q4b`, `q4c`).
3. `officer1` → refresh the case: red banner "Personal Data Redacted", claimant data withheld, Approve/Reject/Request proof greyed out (`q4d`).
4. **Server-side proof (curl, no frontend):**
```bash
API=https://bharosa-api-production.up.railway.app
T=$(curl -s -X POST $API/auth/login -d "username=officer1@relief.demo&password=Demo#12345" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -i -X POST $API/cases/<CASE_ID>/review -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"action":"approve","note":"try"}'
# -> 403 "No active consent for scope 'identity'. The citizen has not shared this data or has withdrawn it."
curl -i $API/cases/<CASE_ID>/documents -H "Authorization: Bearer $T"      # -> 403 as well
```
5. `auditor@relief.demo` → **Audit** → Immutable Event Log: `consent.withdraw` and `access.denied` entries (`q4f`).
**Helper Mode:** `helper@relief.demo` → 40 families (`q4g_helper_40_families`). Pick a family → send the one-time code → the helper never sees it (the code goes to the family's inbox: log in as `family01@citizen.demo` → 🔔). A helper cannot act for family B while on family A, and the screen locks after 60 s, enforced on the server (HTTP 423).
**Auditor and admin too:** `auditor@relief.demo` → open the same case (`q4h` before, `q4i` after): after withdrawal the claimant data is gone and the decision trace shows `input: redacted`. What stays is the decision record (route, confidence, rule and model version) and the hash-chained log, which contain no personal data. That is the honest answer if asked.

## Q5 "How do you prevent false scam detection?"
**Go to:** `widow-clean@citizen.demo` → **Is this message real?** (also works without login at `/public/scam`). Tap the three examples or paste your own:
* Fake fee SMS → **SCAM** with reasons (`q5a_scam_fake_message`)
* Official 8171 message → **Probably safe** (`q5b_scam_genuine_message`)
* Ambiguous → **Not sure, a person should check** (`q5c_scam_uncertain_message`)
**Say:** "It combines transparent rules with a small ML model and has an explicit *not sure* band, because blocking a real message is also a cost. The held-out set has 51 hand-written messages, including polite scams and official-looking real notices: 0 wrong verdicts, 8 handed to a person, scam recall 90.9% (sending to a person counts as not caught), 0 false alarms. It is still a small, synthetic set and we say so."
**Numbers:** auditor/admin → **Evaluation**, or `GET /scam/eval`.

## Q6 "How do you prove the AI's decision?"
**Go to:**
1. `widow-clean@citizen.demo` → **My requests** → approved case (`q6a`) → **Decision receipt** (signed QR, `q6b`) → **Verify** (public page, no login, no personal data, `q6b2`: valid, rule version, confidence, "in audit log: yes").
2. `auditor@relief.demo` → **Audit** → **Verify Entire Chain Integrity** (`q6c`) then **Simulate Tampering (In-Memory)** (`q6d`): "Chain broken at event #N". Algorithmic Decisions tab = full trace with masked identifiers.
**Say:** "The citizen reads a simple reason; the auditor reads inputs, rule version, model version, confidence, costs, and the log is hash-chained."

## Q7 "What happens when the network disconnects?"
**Go to:** a citizen on a phone (or Chrome device toolbar) → **Apply for relief** (`q7a`). Switch the device to offline (DevTools → Network → Offline, or airplane mode): banner "No internet. Your work is saved and will send itself later." (`q7b`). Keep filling; go back online (`q7c`). Submitted work that could not be sent is queued on the device and listed in the **Offline Sync Center** on the Welcome page until it syncs (not captured in a screenshot: test it on your phone).
**Proof of no duplicates (server):** `POST /sync/batch` with the same `op_id` twice returns `applied` then `duplicate_ignored` (Swagger → `/sync/batch`).
**Caveat:** test this on your real phone before judging.

## Q8 "Can it finish the main task end to end?"
**Go to:** a fresh scenario citizen, e.g. `widow-clean@citizen.demo` (not yet used) → **Apply for relief** → tap **Demo** (top of the form) → choose "Widow, clean data, clear ID photo -> auto-approve" → steps: personal info, situation, ID photo (sample card), income/household, consent toggles → **Proceed to Submit** → **Send**. Result: approved, spoken reason, **Decision receipt** (mock Raast payment, no money moves).
`q8a_citizen_home`, `q8b_claim_demo_scenarios`, `q8c_my_requests`.
The other entries in the same **Judge Evaluation Scenario** list show each behaviour: blurry photo (asks for a clearer photo), edited ID card (human review with fraud flag), name spelled differently (not sure, never a wrong match), claims widow but the registry shows a living spouse (human review), income above the limit (declined WITH appeal), garbage data (no crash). Each scenario signs in as its own citizen (see `GET /demo/scenarios`, field `login`).

## Q9 "Is it real RAG? What if it does not know?"
**Go to:** citizen (`widow-clean@citizen.demo`) → **Ask a question** → type in the box at the top and press **Ask**.
* "Who can apply for relief?" → grounded answer with numbered sources (`q9b_ask_typed_answer`).
* "Can I get a passport through this?" → **POLICY ABSTENTION**: "I am not sure about this ... I can pass your question to a person" (`q9c_ask_typed_abstains`).
* An Urdu question gets an Urdu answer (`q9d_ask_typed_urdu`). The page itself is `q9a_ask_page_typed_box`.
**API version (no login):** `POST /public/ask` in Swagger (`q9_swagger_rag_abstains_out_of_scope`).
**Say:** "BM25 retrieval over our mock policy pack, an LLM that may only use the retrieved excerpts, sources always shown, and it abstains when the text does not cover the question." Do not say "embeddings" or "vector database": it is lexical retrieval.

## Q10 "Does the voice assistant actually understand and act?"
**Go to:** citizen → **Ask a question**. Type in the box (or tap the microphone, speak, tap again to finish). No extra button is needed.
| Say or type | What happens | Screenshot |
|---|---|---|
| "I want to apply, my name is Zainab Bibi, I am a widow, my income is 18000 a month and we are 5 people at home" | A card says "Apply for relief · 99% sure", lists the details it heard, then opens the claim form with name, income, household and widow already filled in (Cancel stops it) | `v1a_typed_apply_understood`, `v1b_claim_form_prefilled` |
| "Who can apply for relief?" | Answers in place from the official documents with sources | `v2_typed_policy_answer` |
| "I got a message: BISP relief approved, send your CNIC and fee Rs 500 to JazzCash 0300-1234567. Is this real?" | Opens the message checker with that text and checks it | `v3_typed_scam_checked` |
| "What is the status of my application?" | Opens My requests | `v4_status_opens_requests` |
| "Mujhe imdadi raqam ke liye darkhwast deni hai" (Roman Urdu) | Opens the claim form | |
| "the weather is nice today" | Does nothing risky: says it is not sure | |
| Urdu speech: "میں امدادی رقم کے لیے درخواست دینا چاہتی ہوں" | Real speech recognition, then the claim form opens by voice alone | `v9a_voice_understood`, `v9b_voice_opened_claim` |
A helper is sent to the family list (never pre-filled). **Say:** "It only suggests a page; the person confirms, and nothing is submitted for them. Numbers like the ID and income are read by regular expressions, not by an LLM." `POST /voice/intent` is in Swagger.

## Extras if time allows
* **Red-Team page** (`admin` → **Red-Team** → Run): the system attacks itself with 61 attacks and prints a scorecard (`x1_redteam`).
* **Scam Map**, **Analytics**, **Admin** (users, API keys, webhooks, jobs, plan), **About** (what is real vs simulated): `x2` to `x5`. Login screen: `x0`. Swagger overview: `x6`.
* **API key (public API):** `curl $API/v1/status -H "X-API-Key: bh_demo_public_key_mock_0001"`; without the key you get 401.
* **RBAC from curl:** `curl -i $API/cases` → 401; an officer calling `$API/audit` → 403; a citizen opening another citizen's case → 404.

## Known gaps to be ready for
* No demo video link yet in the README (add the public Drive link).
* Voice on a real phone is still untested (I tested with a recorded Urdu sentence through a virtual microphone and the real speech service). Browser speech recognition fallback is weaker, and Roman Urdu speech is recognised as Urdu.
* Audit entries (who did what, when) stay after withdrawal by design: they contain no personal data.
* Evaluation numbers come from synthetic data; the scam set is small.
