# 5-minute live demo script

Open two windows: citizen (phone-size) and staff (desktop). Logins: password `Demo#12345`.

1. **Opening (15 s)** — "We help widows and low-literacy households claim relief even though they can't read forms, have weak signal and get fake SMS. The system is built around *being wrong*, not around looking smart."
2. **Widow, voice + icons (60 s)** — `widow-clean@citizen.demo` → *Apply* → press 🔊, speak or tap the numpad → consent toggles → **Send** → ✅ approved, spoken reason, step-by-step "what the system did". Switch Wi-Fi off mid-flow: "saved offline" banner, finish, turn Wi-Fi on → syncs once, no duplicate.
3. **Scam (30 s)** — Shopkeeper: *Is this message real?* (no login needed) → sample fake relief SMS → 🚫 SCAM with reasons; sample 8171 message → ✅; ambiguous → 🤔 "not sure, a person will check".
4. **"I am not sure" (45 s)** — claim as `widow-variant` (🎬 demo → *name spelled differently*) → not auto-approved; log in as `officer1` → **Review queue** → case with handoff brief (what we know / doubt / suggested questions) → officer decides.
5. **Rules change, no redeploy (45 s)** — `admin@relief.demo` → *Rules & Twin* → income cap 30,000 → 15,000 → **Digital Twin** shows how many of 320 past cases flip and fraud leakage → Publish → next claim shows *rule v2*; old decision still shows *v1*.
6. **Cost of being wrong (30 s)** — *Risk dial*: drag "wrong approval" → break-even moves; "auto only when ≥ 99.5% sure".
7. **Consent take-back (45 s)** — citizen *My data* → 🛑 withdraw → officer refreshes the case: data redacted, approve = 403 (show the curl) → Auditor: access.denied + consent.withdraw in log → **Verify chain** ✅ → *simulate tampering* ❌ detected.
8. **Helper Mode (20 s)** — `helper@relief.demo` → switch family, OTP consent, 60-second lock.
9. **Finale (30 s)** — `admin` → **Red-Team → Run the attacks** → live scorecard (all attacks green) incl. false-alarm figures. Close: "Honest limits are on the About page and in the README."

## Extra "wow" moments (add 30 s each if time allows)
* **What would change this decision?** Claim as `widow-blurry@citizen.demo` (🎬 demo → *blurry photo*): the result says "with a clear photo this could be approved automatically (confidence 100%)". That sentence was computed by re-running the real engine.
* **Receipt:** on the decision screen tap **🧾 Decision receipt**, then **Verify**: it opens a public page that confirms the decision, rule version and the audit-log entry, with no personal data. Change one character of the code and it turns red.
* **Safety gate:** as admin, loosen the rules (untick *hard* on "Widowed or household of 5+", or raise the income cap) and press **Publish to live**: the Twin shows automatic payouts jumping about 50% and the system **blocks** publishing until you write a justification, which then appears in the audit log.
* **Helper Mode, honestly:** as `helper@relief.demo` pick a family and send the code. The helper never sees it: open the family's login (for example `family01@citizen.demo`) → 🔔 Inbox to read it, or set `DEMO_SHOW_OTP=true` for a one-device demo.
