# Architecture

```
React PWA (citizen shell: voice/icons/offline · staff shell: queue, rules, twin, audit)
        │  HTTPS, JWT / API key
FastAPI  ── middleware: request-id, rate limit, gzip, metrics, error shield
  ├─ auth / RBAC (server-side)           ├─ consent broker  ── every personal-data read
  ├─ cases + claim agent (tool calls)    ├─ audit (hash chain, append-only)
  ├─ decision engine (expected cost)     ├─ rules (versioned JSON) + Digital Twin replay
  ├─ identity (Fellegi–Sunter)           ├─ vision (blur, QR signature, cross-check, OCR)
  ├─ scam (rules + char-n-gram ML)       ├─ RAG (BM25 + citations, abstains)
  ├─ anomaly (IsolationForest + rules)   ├─ jobs + webhooks (HMAC, retries)
  └─ mock services: /mock/nadra, /mock/raast (clearly labelled)
        │
Postgres (Supabase) — Alembic migrations
```

## Claim agent (plan → tools → act)
`validate_form → consent_gate → mock_nadra.verify → vision.analyze_document → anomaly.assess → rules.evaluate → decide → act (mock_raast.pay | ask | human | decline) → notify`.
Every step is audited (`actor_type=agent`). The agent can *only* pay if the decision engine says AUTO_APPROVE, the amount is under the auto-payment limit, **and** the citizen consented to payment.

## Decision engine
For P = P(claimant genuine) the expected cost of each action:
* auto-approve = (1−P)·C_wrong_approval
* human review = C_review + P·C_delay + (1−P)·C_wrong·ε
* ask proof = C_ask + P·C_delay + expected cost after proof
The cheapest wins, then **hard safety overrides** apply (forged/mismatched document, anomaly ≥ 0.6, identity NON_MATCH, conflicts, missing rule input, large payout). P = identity posterior (Fellegi–Sunter weight with prior 1/N) × document authenticity × (1 − anomaly risk), discounted per conflict. Default costs: wrong approval 50,000; review 150 → auto-approve requires P ≥ 99.5%.

## Data protection
* Citizen data readable only by: the citizen; a linked helper with that family's consent; an officer with an active role-consent for the scope.
* Admin/auditor never read PII; they see masked views. Withdrawal is checked live (no cache).
* Documents can be deleted by the citizen; reads are audited (`data.read`, `access.denied`).

## Reliability
LLM optional behind a circuit breaker; deterministic fallbacks everywhere; idempotency keys on create/submit/sync; global error shield returns a safe message and logs the stack trace.
