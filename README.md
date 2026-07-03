# Custos

Loan repayment intelligence for Nigerian lenders. Every borrower gets a dedicated Nomba virtual account. Payments auto-reconcile via webhooks. Partial, overpaid, and unmatched payments surface as disputes for human review.

**Live:** https://custos-production-cbc5.up.railway.app/dashboard

---

## Stack

- **Runtime:** Node.js + Express + TypeScript
- **Database:** Supabase (Postgres)
- **Payments:** Nomba (Virtual Accounts + Webhooks)
- **Hosting:** Railway

---

## Database Schema

| Table            | Purpose                                                                               |
| ---------------- | ------------------------------------------------------------------------------------- |
| `lenders`        | One row per lending business                                                          |
| `borrowers`      | Customers with VA details (`account_ref`, `bank_account_number`, `account_holder_id`) |
| `loans`          | Principal, installment amount, term, status                                           |
| `installments`   | Individual due dates & statuses (`pending`, `partial`, `paid`, `overdue`)             |
| `payments`       | Every inbound payment from Nomba webhooks                                             |
| `disputes`       | Ambiguous payments needing manual resolution (`partial`, `overpaid`, `unmatched`)     |
| `webhook_events` | Idempotency log — dedupes duplicate Nomba deliveries                                  |

---

## Local Setup

```bash
# 1. Clone & install
git clone &lt;repo&gt;
cd custos
npm install

# 2. Env vars — copy and fill
cp .env.example .env
```
