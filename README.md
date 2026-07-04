# Custos

**Loan repayment intelligence for digital lenders — built on Nomba Virtual Accounts.**

> Nomba x DevCareer Hackathon 2026 — Infrastructure Track

---

## The Problem

Lenders collecting repayments from many borrowers today use one shared bank account for everyone. Every incoming transfer has to be manually matched to a borrower by eyeballing names and amounts. In lending specifically, partial repayment is the norm — so reconciliation breaks down constantly, leaving lenders with messy books and borrowers with unclear repayment status.

## What Custos Does

Custos issues every borrower a **dedicated Nomba virtual account (NUBAN)**. Money landing there is unambiguously theirs — the account number _is_ the identity. The system automatically updates the repayment ledger the moment a payment arrives via webhook, handles partial payments and overpayments with an auditable dispute queue, and surfaces overdue installments in a real-time aging report.

**No more manual reconciliation. No more guessing who paid what.**

---

## Live Demo

**Dashboard:** https://custos-production-cbc5.up.railway.app/dashboard

**API health:** https://custos-production-cbc5.up.railway.app/

---

## How It Works

```
Borrower transfers to their unique NUBAN
  → Nomba fires payment_success webhook
  → Custos verifies HMAC-SHA256 signature
  → Matches payment to borrower via aliasAccountReference
  → Exact amount  → installment marked paid instantly
  → Wrong amount  → dispute created, lender notified
  → Dashboard updates in real time
```

---

## Stack

| Layer      | Technology                 |
| ---------- | -------------------------- |
| Runtime    | Node.js + TypeScript       |
| Framework  | Express                    |
| Database   | PostgreSQL (Supabase)      |
| Payments   | Nomba Virtual Accounts API |
| Deployment | Railway                    |
| Dashboard  | Vanilla JS + HTML          |

---

## Key Engineering Decisions

**Idempotency first** — every webhook is logged by `requestId` before processing. Duplicate deliveries are silently ignored, never double-counted.

**Acknowledge immediately, process async** — the server returns `200 OK` to Nomba before any database work begins. This prevents retry storms from a slow database write being mistaken for a failed delivery.

**Kobo-level amount comparison** — all monetary comparisons happen in integer kobo (×100), not floating-point naira. Avoids `parseFloat("10000.00") !== 10000` class of bugs entirely.

**Dispute idempotency on refunds** — `merchant_tx_ref` is generated at dispute-creation time, not when the lender clicks "Refund." If the button fires twice, the same ref goes to Nomba's transfer API both times — and Nomba deduplicates it. No double-refund possible.

**Static virtual accounts, no expectedAmount** — setting `expectedAmount` would cause Nomba to reject partial payments at the bank rail level, before Custos ever sees them. By omitting it, every transfer gets through — and Custos's own matching logic handles the partial/overpaid cases with full context.

---

## Running Locally

```bash
git clone https://github.com/yourusername/custos
cd custos
npm install
cp .env.example .env   # fill in your credentials
npm run dev
```

**Environment variables required:**

```
NOMBA_MAIN_ACCOUNT_ID=
NOMBA_SUB_ACCOUNT_ID=
NOMBA_LIVE_CLIENT_ID=
NOMBA_LIVE_PRIVATE_KEY=
NOMBA_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORT=3000
```

**For local webhook testing:**

```bash
ngrok http 3000
# submit https://your-ngrok-url.ngrok-free.app/webhooks/nomba to Nomba
```

---

## API Reference

| Method | Path                        | Description                                      |
| ------ | --------------------------- | ------------------------------------------------ |
| GET    | `/`                         | Health check                                     |
| GET    | `/dashboard`                | Lender dashboard UI                              |
| GET    | `/api/portfolio`            | All borrowers with loan + installment data       |
| GET    | `/api/disputes`             | Open disputes with borrower + payment enrichment |
| GET    | `/api/aging`                | Overdue installments sorted by days past due     |
| POST   | `/api/disputes/:id/resolve` | Resolve a dispute (claim / refund / write_off)   |
| POST   | `/webhooks/nomba`           | Nomba webhook receiver (signature-verified)      |

---

## What's Not Built (v1 Scope)

- Multi-lender SaaS / admin roles
- Interest or amortization math (fixed installments only)
- Outbound loan disbursement transfers
- Borrower SMS/WhatsApp notifications
- Real-time WebSocket updates (dashboard polls on load)

---

## Nomba Integration Notes

These took real debugging to confirm — documented here for anyone building on the same stack:

- **Auth host:** `api.nomba.com` for all calls including sandbox (not `sandbox.nomba.com`)
- **Body parsing:** Nomba sends webhooks with non-standard `Content-Type` — use `express.json({ type: () => true })` or you'll get empty request bodies
- **Server binding:** bind to `0.0.0.0` not `localhost` for Railway/any cloud deployment
- **Signature field:** called "Private key" in the dashboard, but the API field name is `client_secret`
- **Success check:** `status` field in responses is unreliable — check `code === "00"` instead
- **VA creation:** use `POST /v1/virtual-accounts/sub-account` (not `/accounts/virtual`) to scope under your sub-account for correct webhook delivery

---
