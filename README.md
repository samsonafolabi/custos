# Custos

Automated loan reconciliation for microfinance lenders in Nigeria.

## What it does

- **Onboard borrowers** in 30 seconds — create a virtual account, disburse loan via bank transfer
- **Auto-reconcile repayments** — Nomba webhooks hit our system, we match payments to installments in real-time
- **Handle edge cases** — overpayments stored as credit, underpayments flagged as disputes
- **Full visibility** — portfolio, aging report, disputes queue, disbursements log, cleared loans

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

## Demo Flow

1. Click "Add Borrower" → fill form → review → confirm disbursement
2. Borrower receives loan in their bank account
3. Borrower repays to their unique virtual account
4. Nomba sends webhook → payment auto-reconciled against installments
5. Dashboard updates: portfolio, disputes (if underpaid), aging, cleared
