# Custos

### Dedicated Virtual Account ledger for loan repayment collection

**Hackathon:** Nomba x DevCareer Hackathon — Infrastructure Track
**Status:** Deployed ✅
**Builder:** Solo
**Live URL:** https://custos-production-cbc5.up.railway.app

---

## 1. What Custos Does

Lenders collecting loan repayments from many borrowers typically funnel
everyone into one shared bank account, then manually match incoming transfers
to borrowers by eyeballing names and amounts. In lending specifically, partial
repayment is the norm — so "exact match or fail" reconciliation breaks down
constantly, leaving lenders with messy books and borrowers with unclear
repayment status.

**Custos fixes this by issuing every borrower a dedicated Nomba virtual
account (NUBAN).** Money landing there is unambiguously theirs. The system
automatically updates the repayment ledger the moment a payment arrives,
handles partial/overpaid edge cases with a dispute queue, and surfaces
overdue installments in an aging report — all in real time via webhooks.

**Use case:** fixed-installment loan repayment collection.
E.g. borrower takes ₦60,000 loan, repays ₦10,000/month × 6 months.

---

## 2. Architecture

```
Borrower pays → Nomba DVA (unique NUBAN per borrower)
  → Nomba fires payment_success webhook
  → Railway server (Express/TypeScript)
      → HMAC-SHA256 signature verification
      → Idempotency check (webhook_events table)
      → Match payment to borrower via aliasAccountReference
      → Exact match  → mark installment paid
      → Mismatch     → create dispute record
  → Supabase (Postgres) — source of truth
  → Dashboard (vanilla JS) — lender UI
```

---

## 3. Nomba API — Confirmed Empirically

| Concept        | What we confirmed                                                                     |
| -------------- | ------------------------------------------------------------------------------------- |
| Auth host      | `api.nomba.com` (not `sandbox.nomba.com`) for all calls                               |
| Auth field     | `client_secret` (even though dashboard calls it "Private key")                        |
| Token expiry   | 60 minutes (not 30 as some docs said)                                                 |
| VA creation    | `POST /v1/virtual-accounts/sub-account` — scoped to sub-account                       |
| Static VA      | Omit `expiryDate` and `expectedAmount` for persistent recurring accounts              |
| Webhook host   | Production only — webhooks don't work in sandbox                                      |
| Body parsing   | Must use `express.json({ type: () => true })` — Nomba sends non-standard Content-Type |
| Server binding | Must bind to `0.0.0.0` not `localhost` for Railway deployment                         |
| Success check  | Trust `code === "00"`, not `status` field (which is `false` even on success)          |

**Signature verification (HMAC-SHA256):**

```
string = event_type:requestId:userId:walletId:transactionId:type:time:responseCode:timestamp
signature = base64(hmac_sha256(string, secret))
compare via timingSafeEqual
```

Confirmed against Nomba's own Python reference implementation — field order matches exactly.

**Webhook payload shape (payment_success):**

```json
{
  "event_type": "payment_success",
  "requestId": "uuid",
  "data": {
    "merchant": { "userId": "...", "walletId": "..." },
    "transaction": {
      "transactionId": "...",
      "type": "vact_transfer",
      "time": "2026-07-03T...",
      "aliasAccountReference": "borrower-001",
      "amount": "10000.00"
    },
    "customer": { "senderName": "JOHN OKAFOR" }
  }
}
```

---

## 4. Data Model

```
lenders      (id, name, nomba_account_id)

borrowers    (id, lender_id, name, bvn, account_ref, account_holder_id,
              bank_account_number, phone)

loans        (id, borrower_id, principal_amount, installment_amount,
              num_installments, start_date,
              status: active | completed | defaulted)

installments (id, loan_id, installment_number, amount_due, due_date,
              status: pending | partial | paid | overdue)

payments     (id, installment_id, borrower_id, amount_received,
              sender_name_raw, nomba_transaction_id,
              matched_confidence, status, received_at)

webhook_events (id, nomba_event_id UNIQUE, payload_json, processed_at)

disputes     (id, payment_id, borrower_id,
              type: partial | overpaid | no_open_loan,
              suggested_borrower_id, confidence_score, reasoning,
              recommended_action: claim | refund | review,
              merchant_tx_ref,
              status: open | claimed | refunded | written_off,
              resolution_notes, created_at, resolved_at)
```

Key design decisions:

- `webhook_events.nomba_event_id` UNIQUE = idempotency guard
- `disputes` rows immutable — resolution updates status only, never deletes
- `merchant_tx_ref` generated at dispute-creation time, not click-time (prevents double-refund)
- Payment matched against borrower's **next unpaid installment** by due_date, not "current period"

---

## 5. Matching Logic

```
On webhook received:
1. Verify HMAC-SHA256 signature — reject 401 if invalid
2. Acknowledge 200 immediately (before async processing — prevents Nomba retry storms)
3. Idempotency: check webhook_events for requestId — stop if duplicate
4. Log raw event to webhook_events
5. Resolve borrower via aliasAccountReference → account_ref
6. Find borrower's next pending installment (earliest due_date)
7. Compare amount (in kobo to avoid float errors):
   - exact match  → mark installment paid, payment matched, done
   - under        → create partial dispute
   - over         → create overpaid dispute
   - no open loan → create no_open_loan dispute
```

---

## 6. Intelligence Layer

LLM only invoked on ambiguous disputes — not the main matching path.

Input: payment details + borrower context
Output: `{ suggested_borrower_id, confidence, reasoning, recommended_action }`

The `reasoning` field is shown live in the dashboard dispute queue —
the "wow" moment for judges. LLM proposes; human always confirms.

---

## 7. Dashboard (3 views)

**Portfolio** — borrower table, progress bars, collected/outstanding amounts,
next due date, loan status badges

**Disputes Queue** — open disputes with AI reasoning shown, one-click
Claim / Refund / Write Off actions, confidence scoring

**Aging Report** — overdue installments sorted by days past due, severity
coloring (30d / 60d thresholds), at-risk count

Stack: vanilla JS + plain HTML served from Express, dark fintech theme,
JetBrains Mono for financial figures.

---

## 8. Hard Problems Solved

| Problem                    | Solution                                                        |
| -------------------------- | --------------------------------------------------------------- |
| Railway 404s               | Bind to `0.0.0.0` not `localhost`                               |
| Empty webhook body         | `express.json({ type: () => true })` — accepts any Content-Type |
| Signature failures         | Reconstruct hash from parsed fields, not raw JSON string        |
| Dashboard 404 on Railway   | Corrected static path from `dist/` to `src/public/`             |
| Nomba mutating accountName | Use original request param, not Nomba's returned name           |
| Retry storms               | Acknowledge 200 before async processing                         |
| Double-refund risk         | Generate `merchant_tx_ref` at dispute creation, not click-time  |
| Floating point money       | Compare in kobo (integer) not naira (float)                     |

---

## 9. Build Status

### ✅ Done

- Live Nomba API authentication
- VA creation with sub-account scoping
- Supabase schema + seed data (3 borrowers, realistic loan states)
- Express + TypeScript server deployed on Railway
- Webhook handler: idempotency, signature verification, exact match, disputes
- First real webhook received, processed, dispute auto-created
- Dark-themed lender dashboard (Portfolio, Disputes, Aging)

### 🔲 Remaining

- `POST /api/borrowers` — self-serve borrower creation from dashboard
- Configurable loan amounts per borrower
- Outbound transfers — loan disbursement + dispute refunds
- LLM matcher integration (Groq/Claude) for dispute reasoning
- Borrower SMS notifications (Africa's Talking)
- Demo video (2-3 min)
- README polish

### ❌ Out of Scope (v1)

- Multi-lender SaaS / admin roles
- Interest/amortization math
- Account freezing/reissuing
- Real-time WebSocket updates (polling works for now)

---

## 10. Demo Script (5-7 min)

1. **Problem** (30s) — lender manually matching SMS alerts to borrower names
2. **Create borrower + DVA** live via API (1m)
3. **Happy path** — simulate payment → webhook fires → dashboard updates (1m)
4. **Edge cases** (2m):
   - Duplicate webhook arrives → silently ignored, idempotency log shown
   - Partial payment → dispute auto-created with reasoning
   - Lender resolves dispute with one click
5. **Aging report** — show overdue borrowers, days past due (30s)
6. **Out of scope** — what's explicitly not built and why (30s)

---

## 11. Environment Variables

```
NOMBA_MAIN_ACCOUNT_ID
NOMBA_SUB_ACCOUNT_ID
NOMBA_LIVE_CLIENT_ID
NOMBA_LIVE_PRIVATE_KEY
NOMBA_TEST_CLIENT_ID
NOMBA_TEST_PRIVATE_KEY
NOMBA_WEBHOOK_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
PORT
```
