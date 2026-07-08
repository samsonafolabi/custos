# Custos

Automated loan reconciliation for microfinance lenders in Nigeria.

## What it does

- **Onboard borrowers** in 30 seconds — create a virtual account, disburse loan via bank transfer
- **Auto-reconcile repayments** — Nomba webhooks hit our system, we match payments to installments in real-time
- **Handle edge cases** — overpayments stored as credit, underpayments flagged as disputes
- **Full visibility** — portfolio, aging report, disputes queue, disbursements log, cleared loans

## Reviewer Access

No login required — the dashboard loads immediately with live data. Live URL has been provided in the submission form.

### Test a Disbursement

1. Click **"Add Borrower"** (top right of portfolio)
2. Fill the form:
   - **Full Name:** Any name (e.g., "Test User")
   - **Phone:** Any Nigerian number (e.g., `+2348012345678`)
   - **Loan Amount:** `240`
   - **Monthly Repayment:** `40`
   - **Number of Months:** `6`
   - **First Repayment Date:** Any future date
   - **Disbursement Bank:** Any bank (e.g., GTBank)
   - **Account Number:** `0123456789`
3. Click **"Review Loan →"**
4. Review details, then **"Confirm & Disburse"**

The system creates a virtual account for the borrower, attempts disbursement via the Nomba API, and shows a success screen with the repayment account number.

**Note:** Disbursement uses the live Nomba API — use small amounts (120-600) from the disbursement pool. If the Nomba account balance is insufficient, disbursement fails gracefully with an error message.

### What to Check After Disbursing

| Page | What You'll See |
|---|---|
| Portfolio | New borrower listed with loan progress (e.g., "0/5 installments") |
| Disbursements | Your test loan appears in the log |
| Cleared | Updates here once installments are marked paid |

### Live Balance

Top-right of the dashboard shows:
- **Pool** — Nomba parent account balance (available for lending)
- **Inflow** — Sub-account balance (borrower repayments collected)

### Reset Test Data

To clear test borrowers and start fresh, contact us.


## Stack

- Node.js + Express + TypeScript
- Supabase (Postgres)
- Nomba API (auth, virtual accounts, bank transfers, webhooks)
- Vanilla JS frontend

## Key Features

| Feature                        | Status  |
| ------------------------------ | ------- |
| Virtual account creation       | ✅ Live |
| Loan disbursement              | ✅ Live |
| Webhook auto-reconciliation    | ✅ Live |
| Payment cascading              | ✅ Live |
| Credit balance (overpayment)   | ✅ Live |
| Dispute routing (underpayment) | ✅ Live |
| Portfolio dashboard            | ✅ Live |
| Aging report                   | ✅ Live |
| Disbursements log              | ✅ Live |
| Cleared loans                  | ✅ Live |
| Live balance (Pool + Inflow)   | ✅ Live |

## Environment Variables

```
NOMBA_MAIN_ACCOUNT_ID=
NOMBA_SUB_ACCOUNT_ID=
NOMBA_LIVE_CLIENT_ID=
NOMBA_LIVE_PRIVATE_KEY=
NOMBA_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## API Endpoints

- `POST /api/borrowers` — create borrower + disburse loan
- `POST /webhooks/nomba` — Nomba webhook receiver
- `GET /api/portfolio` — all borrowers with loans/installments
- `GET /api/disputes` — open disputes
- `GET /api/aging` — overdue installments
- `GET /api/disbursements` — loan disbursement history
- `GET /api/installments/completed` — paid installments + cleared loans
- `GET /api/balance` — live Nomba parent + sub-account balances

## Webhook Security

- HMAC-SHA256 signature verification on every payload
- Idempotency check on `requestId` — duplicates rejected
- Immediate 200 ACK to prevent Nomba retry storms

## Database Schema

```
lenders
borrowers (credit_balance)
loans
installments (status: pending/partial/paid)
payments
disputes
webhook_events
```

## Nomba Integration Points

| Endpoint                                   | Usage                         |
| ------------------------------------------ | ----------------------------- |
| `POST /v1/auth/token/issue`                | Auth                          |
| `POST /v1/accounts/virtual/{subAccountId}` | Create borrower VA            |
| `POST /v2/transfers/bank`                  | Disburse loan                 |
| `POST /webhooks/nomba`                     | Receive payment notifications |


