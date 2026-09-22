# GYMOS — Final Architecture

## Product boundary
GYMOS is a simple gym operations system for independent gyms. It replaces the paper/spreadsheet work that a small gym owner actually needs.

### V1 jobs
1. Owner creates members and trainers.
2. Owner defines simple membership pricing: duration (any number of days or months) + price.
3. Owner registers/assigns memberships and records payment now or payment due later.
4. Owner renews memberships.
5. Members and trainers check in/out using device GPS.
6. Owner sees attendance, active/expired/expiring memberships, collections and dues.
7. Owner can contact members and follow up on renewals.
8. Owner can export simple reports.

### Explicitly out of V1
No classes, booking, POS, inventory, workout plans, diet plans, payroll, CRM, marketing automation, family accounts, multi-branch scheduling, barcode/QR attendance, or other enterprise features.

## Roles
- Super Admin: platform-level gym creation and owner access management.
- Gym Admin / Owner: full gym operations, including registration, memberships, renewals, payments, reports, settings, and staff.
- Trainer: own check-in/out and attendance visibility required for training work. No renewal, payment, or membership-management authority.
- Member: own check-in/out, membership view, payment history, attendance history, password.

Renewal is Gym Admin/Owner only at both UI and database/RPC layers.

## Application layers
### 1. Presentation
React + Vite + CSS/PWA shell.

The UI is intentionally small:
- Dashboard
- Members
- Trainers
- Attendance
- Memberships
- Payments
- Dues
- Reports
- Settings
- Activity Log

No feature is added merely because another gym SaaS offers it.

### 2. Domain rules
Business rules belong in database functions for authoritative transactional operations, and small frontend helpers for display/UX only.

### 3. Supabase
- PostgreSQL: source of truth
- Auth: identity/password hashing/session
- RLS: tenant and role boundaries
- private schema: privileged SECURITY DEFINER implementations
- public schema: minimal SECURITY INVOKER RPC wrappers
- Edge Functions: operations requiring Auth Admin/service-role capabilities
- pg_cron: auto-checkout and expiry notifications

### 4. Tenant isolation
Every business table carries gym_id. RLS derives the current gym from the authenticated profile rather than trusting a client-supplied tenant id.

### 5. Security model
- Service-role keys never reach the browser.
- Member/trainer attendance writes use the server-side check_in_attendance path.
- Direct attendance INSERT is admin-only.
- Membership assignment/renewal is admin-only.
- Profile update policy prevents admins from promoting users to admin.
- Super Admin RPCs use authenticated-only wrappers and private privileged implementations.
- Password reset/change is handled through authenticated Edge Functions/Auth.

## Core data model
gyms -> profiles -> membership_plans -> memberships -> payments
profiles -> attendance
and audit_logs + notifications.

### Membership plan
Only three business inputs:
- duration value
- duration unit: day/month
- price

The database may retain a generated internal label for compatibility, but the user-facing product does not require a plan name.

### Membership lifecycle
active -> expired

Payment state:
paid | pending | partial

A paid membership must have a payment record. A pending membership has an outstanding due. Partial payment updates both payment history and membership balance.

## Transaction boundaries
Membership assignment and renewal are atomic database operations:
1. validate owner role
2. validate tenant
3. validate member
4. validate active plan
5. calculate expiry
6. close previous active membership
7. create new membership
8. create payment when money was received
9. write audit log

This prevents the UI from creating a membership and payment separately and leaving inconsistent accounting.

## Attendance boundary
Check-in:
1. authenticated member/trainer
2. active account
3. active membership for members
4. gym location configured
5. Sunday closed
6. device coordinates supplied
7. server calculates distance
8. server writes attendance

Check-out:
- user can manually check out their open attendance
- cron can auto-checkout open records after configured duration

## Frontend navigation
Navigation uses browser history. Android/browser Back returns to the previous GYMOS section instead of exiting the application. The GYMOS/AOG logo returns to Dashboard. Mobile navigation uses a drawer.

## UI principle
The product should feel like a small business tool, not enterprise software:
- few primary actions
- one clear job per screen
- dashboard numbers are actionable
- forms are short
- mobile-first touch targets
- no unnecessary configuration

## Deployment
GitHub main -> GitHub build validation -> Cloudflare Worker/Pages deployment -> React/Vite application -> Supabase

Production database migrations must also exist in GitHub so the production environment remains reproducible.

## Change rule
Before adding a feature, ask:
Does this replace a real paper/manual gym-owner task?

If no, it belongs outside V1.
