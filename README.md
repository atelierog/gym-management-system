# Gym Management System

Multi-tenant gym management SaaS — V1.

## V1 scope
- Multi-tenant gym isolation with PostgreSQL RLS
- Admin, trainer and member roles
- ID + password login
- Remember-me session control
- Account activation/deactivation
- Admin password reset for member/trainer accounts
- Location-based attendance
- Secure manual checkout
- Configurable automatic checkout
- Sunday gym closure
- Membership plans: 1, 3, 6 and 12 months
- Membership start/expiry/renewal tracking
- Expiry counts and in-app expiry reminders
- Fees and payment records
- Printable receipts with membership plan and paid status
- Dashboard with present/absent attendance counts
- Daily/weekly/monthly-style reports and CSV export
- Admin audit log
- PWA-ready responsive frontend

## Architecture
React/Vite + Supabase/PostgreSQL + Cloudflare Workers/Pages.

Tenant isolation is enforced at the database layer with Row Level Security. Privileged operations such as account creation and password reset run through authenticated Supabase Edge Functions.

## Database source of truth
The current model is documented in `supabase/schema.sql`. Production hardening changes are recorded in `supabase/migrations/20260922_gymos_hardening.sql`.

## Deployment
Production frontend:
`https://gym-management-system.atelierog-co.workers.dev/`
