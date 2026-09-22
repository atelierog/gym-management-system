# Gym Management System

Multi-tenant gym management SaaS — V1.

## V1 scope
- Multi-tenant gym isolation
- Admin, trainer and member roles
- ID + password login
- Account activation/deactivation
- Location-based attendance
- Manual checkout
- 3-hour member auto-checkout
- Sunday gym closure
- Memberships and expiry tracking
- Fees and payment records
- Bills/receipts
- Dashboard and reports
- PWA-ready frontend

## Architecture
The production version will use React/Vite + Supabase/PostgreSQL + Cloudflare Pages. Tenant isolation will be enforced at the database layer with Row Level Security.

The current repository begins with a dependency-free prototype while the production stack is implemented.
