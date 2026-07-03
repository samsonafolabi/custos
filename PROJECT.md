# Custos

### Dedicated Virtual Account ledger for loan repayment collection

**Hackathon:** Nomba x DevCareer Hackathon — Infrastructure Track
**Status:** Planning → Build
**Builder:** Solo (open to collaborators)

---

## 1. Problem

⚠️ **Critical hackathon timing constraint (confirmed by organizers):**
webhooks do not get routed to anyone until the **Build phase, June 30 – July
7**. Submitting/updating the webhook URL form works any time — Nomba syncs
registered URLs **every 2 hours** — but no real webhook will arrive before
June 30, regardless of setup correctness. Don't chase "why isn't my webhook
firing" before that date — it's expected, not a bug. Use this window to
finish schema + mock-data testing of the matching/dispute logic, so the
handler has somewhere real to write the moment real webhooks start.

Lenders (microfinance institutions, digital lenders, cooperative loan
schemes) collecting repayments from many borrowers usually funnel everyone
into one shared account. Every repayment then has to be manually matched to
a borrower by eyeballing names and amounts — and unlike rent, partial
repayment is the _norm_ here, not the exception, making manual reconciliation
even messier.

**Fix:** give every borrower their own permanent Nomba virtual account
number. Money landing in that account is unambiguously theirs — no manual
matching for the common case — with a real dispute/recovery layer for the
partial-payment reality of lending.

## 2. Use Case (the one we demo)

> Loan repayment collection for a digital lender / microfinance-style
> operation — fixed installment loans, no interest math (simplified scope).
> E.g.: borrower takes a ₦60,000 loan, repays ₦10,000/month for 6 months.

**Why this use case (not rent/fees):**

- Partial payments are the _normal_ case in lending, not an edge case —
  makes the dispute/recovery layer the core value prop, not a bonus feature
- Aging report maps directly to a real lending concept (days-past-due)
- Reads as more "fintech-core" to judges than rent collection
- BVN-per-borrower is a natural fit (most lenders already require this)

**Scope decision:** fixed installments only, no amortization/interest
schedule — same build complexity as rent would have been, different story.

## 3. Nomba API — Key Concepts

| Term              | Meaning                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `accountId`       | Parent ID for your business. Required on every API call.                   |
| `subAccountId`    | Child account for splitting revenue. **Not used in this build.**           |
| Virtual Account   | Persistent account number tied to one payer. The actual DVA mechanism.     |
| `accountRef`      | Your own unique reference per payer, sent when creating their account.     |
| `accountHolderId` | Nomba's internal ID, returned after creation — store against payer record. |

**Auth:** `POST https://api.nomba.com/v1/auth/token/issue` → bearer token.

✅ **Confirmed empirically (not just from docs):**

- Correct host is `api.nomba.com` — **not** `sandbox.nomba.com` despite what
  the dedicated sandbox/testing docs implied. Sandbox vs live is determined
  by _which credentials_ you send, not the hostname.
- Request body field names: `client_id` and `client_secret` — even though
  Nomba's dashboard/email labels the secret value "Private key," the API
  body field is still `client_secret`.
- Token expiry is **60 minutes**, not 30 (one doc page said 30, the
  interactive setup guide said 60 — 60 is correct, confirmed by the actual
  `expiry` field in a real response). Refresh at the ~55 min mark.
- Auth uses the **main/parent** `accountId`, not the sub-account ID.
  Sub-account scoping (per the hackathon credential email — "scope your
  calls to your sub-account ID") applies at the virtual-account-creation
  step, not at auth.
- ⚠️ Response includes a `status: false` field even on a clearly successful
  call (`code: "00"`, `description: "Successful"`, real access token
  present). **Don't trust `status` as the success indicator in code — check
  `code === "00"` and the presence of `data.access_token` instead.**

**Create virtual account:** `POST /v1/accounts/virtual`

✅ **Confirmed (from Nomba's own docs):** there are two virtual account types:

- **Static** — permanent, non-expiring, for recurring payments. Created by
  **omitting `expiryDate`**. This is what we use for rent/fees collection.
- **Dynamic** — temporary, time-bound, one-off payments. Created by setting
  `expiryDate`. Not used in this build.

✅ **Confirmed: omit `expectedAmount` too.** If set, Nomba's docs warn the
account will _only_ accept that exact amount — other amounts may be declined
by the sender's bank or auto-reversed, **before our dispute logic ever sees
the payment**. Our whole partial/overpaid detection layer depends on
amounts being allowed through so we can handle mismatches ourselves —
so don't let Nomba pre-filter them at the bank level.

```json
{
  "accountRef": "borrower-014",
  "accountName": "Chidinma Okafor",
  "currency": "NGN"
}
```

(`bvn` optional — inherits parent account's BVN if omitted. `expiryDate` and
`expectedAmount` both omitted, per above.)

⚠️ **Sandbox limits — UPDATED:**

- The 2-virtual-account cap was a **per-hackathon-participant provisioning
  limit**, not a shared pool — Nomba confirmed via support channel it has
  now been **lifted** for everyone. Can create more freely now.
- Each account can receive transfers up to **₦150** in sandbox (still applies)
- Virtual account expiration is **not testable** in sandbox
- ⚠️ **Nomba has explicitly sanctioned using LIVE/production credentials**
  for this hackathon, since sandbox doesn't support card tokenization or
  direct-debit. **Our flow (bank transfer into a virtual account) doesn't
  need either**, so sandbox should remain sufficient for the core build.
  Decision: keep using sandbox for everything except where a specific
  sandbox limitation blocks something we actually need — switch
  deliberately, one call at a time, not as a blanket switch-over.
- Real money implication if/when live credentials are used: each test
  transfer is real naira (~₦100-500 range works fine for triggering a
  real webhook) — trivial cost (~₦1,000-2,000 total) for full test coverage.

**Demo data implication:** can create real sandbox accounts more freely
now. Still worth seeding most "30 borrowers" as mock/database rows and
only creating a few real ones live in the demo for authenticity.

## 4. Data Model

```
lenders      (id, name, nomba_account_id)
borrowers    (id, lender_id, name, bvn, account_ref, account_holder_id,
              bank_account_number, phone)
loans        (id, borrower_id, principal_amount, installment_amount,
              num_installments, start_date, status: active | completed | defaulted)
installments (id, loan_id, installment_number, amount_due, due_date,
              status: pending | paid | partial | overpaid | unmatched)
payments     (id, installment_id, borrower_id, amount_received, sender_name_raw,
              nomba_transaction_id, matched_confidence, status, received_at)
webhook_events (id, nomba_event_id UNIQUE, payload_json, processed_at)

disputes     (id, payment_id, borrower_id NULLABLE,
              type: misdirected | partial | overpaid | unmatched,
              suggested_borrower_id, confidence_score, reasoning,
              recommended_action: claim | refund | review,
              merchant_tx_ref,            -- generated at creation, used for refund idempotency
              status: open | claimed | refunded | written_off,
              resolution_notes, created_at, resolved_at)
```

Each `loan` has N `installments` generated up front (fixed amount, fixed
schedule — no interest/amortization math). A `payment` is matched against
the borrower's **next unpaid installment**, not a single "current period"
invoice, since a borrower might be ahead or behind schedule.

`webhook_events.nomba_event_id` UNIQUE constraint = idempotency guard against
duplicate webhook delivery. Build this table first.

`disputes` rows are immutable once created — resolution only updates
`status`/`resolution_notes`/`resolved_at`. This is the audit trail: every
misdirected/ambiguous payment has a permanent record, even after it's
resolved. Powers the aging report (open disputes by `created_at`, and
overdue installments by `due_date`) for free.

## 5. Matching & Detection Logic

```
On webhook received:
1. Log in webhook_events. If nomba_event_id exists already → stop (duplicate).
2. Resolve borrower via account_ref on the virtual account.
3. Find borrower's next unpaid installment (earliest due_date, status=pending/partial).
4. Compare amount_received vs amount_due on that installment:
   - exact      → paid, auto_matched. Done.
5. If NOT a clean match, score confidence using multiple signals:
   - amount proximity      (how close received is to due, not just over/under)
   - sender metadata       (fuzzy match sender_name_raw against borrower list)
   - timing                (does this arrive near a due date / fit a repayment pattern?)
   - historical patterns   (has this borrower over/underpaid before? consistently late?)
6. Route by confidence:
   - confidence > 90%  → auto-match, but flag the payment as "auto, review-flagged"
   - else              → create a `disputes` record (type, suggested_borrower_id,
                          confidence_score, reasoning, recommended_action)
```

## 6. Intelligence Layer (scoped honestly)

Only triggers on the ambiguous path (step 5) — not the main flow, since DVAs
make most matches exact by design.

- **Cheap tier:** string similarity (rapidfuzz / Postgres `pg_trgm`) +
  amount/timing/history scoring — no AI needed for most of this signal.
- **LLM tier:** narration-based ambiguity (nicknames, partial names) →
  structured JSON `{suggested_borrower_id, confidence, reasoning, recommended_action}`.
  This becomes the seed of the `disputes` record, not just a UI suggestion —
  show the `reasoning` live in the demo.
- **Important constraint:** the LLM never auto-acts. It only proposes; a
  human (the merchant) clicks the actual claim/refund/write-off button.
  Reliability of the ledger > intelligence of the suggestion.

## 7. Smart Recovery Flow (dispute lifecycle)

```
Dispute created (status: open)
  → merchant dashboard shows it with suggested match + confidence + reasoning
  → (optional, lower priority) notification fires to merchant /
     borrower with a claim link: /claim/{dispute_id}
  → merchant resolves via one-click UI:
      a. Reassign → updates suggested_borrower_id as confirmed, relinks
         payment to correct installment, recalculates loan balance,
         status: claimed
      b. Refund → calls Nomba POST /v2/transfers/bank using the
         dispute's pre-generated merchant_tx_ref (idempotency key,
         created at dispute-creation time, NOT at click-time — avoids
         double-refund on double-click or PENDING retries),
         status: refunded
      c. Write off → status: written_off, resolution_notes required
         (e.g. "goodwill", "fee", "unrecoverable")
  → resolved_at set, original dispute row stays immutable
```

Customer-level statements show "misdirected → resolved" transparently
instead of silently disappearing. Aging report = open disputes sorted by
`created_at`, oldest first.

**Notification layer (WhatsApp/SMS):** real value for the pitch, but treat
as lower priority for a solo build — see build order below. Demo the
trigger/claim-link flow; fake or stub actual delivery unless time allows
wiring Africa's Talking or Twilio for real.

## 8. Build Order (next sessions, priority-ranked)

- [x] ~~Verify `expiryDate` behavior in sandbox~~ — confirmed via docs, omit it for static accounts
- [x] ~~Fetch exact webhook payload shape from Nomba docs~~ — confirmed, see section 3/11
- [x] TypeScript + Express scaffolded, webhook route live, ngrok tunnel verified, registered with Nomba
- [x] Signature verification function written and unit-tested (rejects missing headers, rejects fake signature)
- [x] Authenticate against Nomba sandbox API — confirmed working, real access token received
- [x] Attempted virtual account creation — hit "2 account limit," confirmed via support it's now lifted
- [~] **BLOCKED until June 30:** real webhook delivery — Nomba confirmed webhooks don't route until Build phase starts. Nothing to debug here, just waiting.
- [ ] **Set up hosted Postgres (Supabase)** — in progress, locating connection string
- [ ] **Create database schema** — lenders/borrowers/loans/installments/payments/webhook_events/disputes (section 4)
- [ ] **Retry virtual account creation** now that the limit is lifted — confirm it actually works end to end
- [ ] **Build webhook handler against MOCKED payloads** (we have the real shape — section 3/11) — exact-match logic, idempotency check, dispute creation on ambiguous cases. This is the highest-value work available _right now_, fully unblocked.
- [ ] **`disputes` table + lifecycle** wired to handler
- [ ] **Richer confidence scoring** — amount proximity + history
- [ ] Minimal dashboard (borrower list, disputes/needs-review queue, aging view)
- [ ] Fuzzy/LLM matching layer → feeds dispute creation
- [ ] **Claim link + merchant resolution UI**
- [ ] **Refund button wired to Nomba `POST /v2/transfers/bank`**
- [ ] **June 30+: re-test with REAL webhooks** once Build phase opens — validate mocked-payload logic against the real thing
- [ ] WhatsApp/SMS delivery — only if time allows; stub/fake for demo otherwise
- [ ] Seed demo data (real sandbox accounts + mock data for the rest) + rehearse edge-case demo
- [ ] README + deploy to Render

## 9. Demo Script (5-7 min)

1. Problem (30s)
2. Create DVA for a borrower live via API (1m)
3. Happy path: simulate payment → webhook → dashboard updates (1m)
4. **Edge cases** (2.5m): duplicate webhook ignored · partial payment flagged ·
   misdirected payment auto-detected → dispute created with suggested match +
   confidence + reasoning shown live → merchant resolves it (reassign or refund)
   in one click
5. Aging report / data model glance (1m)
6. Explicitly out of scope + why (30s)

## 10. Explicitly Out of Scope (v1)

- Account freezing/reissuing
- Multi-tenant admin roles (multiple lenders on one deployment)
- Revenue splitting / sub-accounts
- Real WhatsApp/SMS delivery (flow exists, delivery stubbed)
- Live credentials (sandbox only until post-hackathon)

## 11. Open Questions / TODO

- [x] ~~Webhook payload exact schema~~ — confirmed: `event_type`, `requestId`,
      `data.merchant`, `data.transaction` (incl. `aliasAccountReference` = the
      account_ref tie-back), `data.customer.senderName` for fuzzy matching
- [x] ~~`expiryDate` behavior~~ — confirmed, omit for static/permanent accounts
- [ ] BVN collection — any compliance note worth flagging in README scope section
- [ ] Confirm rapidfuzz vs pg_trgm choice based on stack
- [ ] Confirm Nomba transfer idempotency behavior on PENDING retries against `merchant_tx_ref` (see transfers doc)
- [ ] Can a virtual account be linked to a sub-account instead of the parent
      account (separate endpoint exists for this) — decide if relevant later,
      not needed for MVP
- [ ] Check "Filter virtual accounts" and "Debug webhooks" doc pages if
      troubleshooting is needed once real testing starts
