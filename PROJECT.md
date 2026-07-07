# Custos — Project Submission

## Problem

Microfinance lenders in Nigeria spend 60%+ of their time manually tracking repayments. Borrowers pay into random accounts, lenders check bank statements, match to spreadsheets, chase defaulters. No automation, no visibility, no scale.

## Solution

Custos automates the entire lending lifecycle using Nomba's banking infrastructure:

1. **One virtual account per borrower** — created via Nomba API
2. **Automatic reconciliation** — every payment matched to the right installment via webhook
3. **Smart handling** — overpayments stored as credit, underpayments flagged for review
4. **Full dashboard** — see everything: who owes what, what's overdue, what's cleared, your live balance

## What We Built (MVP)

### Backend

- Express API with 8 endpoints
- Nomba integration: auth, VA creation, bank transfers, webhooks
- Webhook handler with HMAC verification + idempotency
- Payment cascading logic (kobo-safe arithmetic)
- Credit balance system for overpayments
- Dispute routing for underpayments

### Frontend

- Dark-mode dashboard (5 views)
- Portfolio with progress bars
- Disputes queue with resolution actions
- Aging report (days overdue)
- Disbursements log
- Cleared loans + paid installments
- Live balance chips (Pool + Inflow)

### Database

- 6 tables, fully relational
- Supabase Postgres with RLS-ready structure

## Live Links

- **Dashboard:** https://custos-production-cbc5.up.railway.app/dashboard
- **Repo:** https://github.com/samsonafolabi/custos

## Tech Stack

Node.js · TypeScript · Express · Supabase · Nomba API · Vanilla JS

## Future

- Borrower SMS notifications
- Credit scoring
- Multi-lender support
- Mobile app

## Hackathon

DevCareer x Nomba Build Week 2026
