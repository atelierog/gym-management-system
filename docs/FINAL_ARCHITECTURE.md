# GymOS — Final Foundation Architecture

## Product boundary
GymOS is deliberately a small gym operating system for independent gyms. It replaces the daily register/spreadsheet/paper work:
- member and trainer accounts
- flexible membership pricing
- registration and renewals
- payments and outstanding dues
- member/trainer check-in and check-out
- dashboard and simple reports
- account/profile management
- gym settings

V1 intentionally excludes class scheduling, workout programming, POS/inventory, payroll, CRM/lead funnels, multi-branch operations, marketing automation, social/community features and complex booking.

## Frontend
React 19 + Vite. One responsive web/PWA surface with role-aware shells for Super Admin, Gym Admin, Trainer and Member. Mobile navigation uses browser history: Dashboard is the root, Back goes to the previous section, and the GYMOS/AOG brand returns home.

Current entry files are `src/main.jsx` and `src/app.css`. Future feature work should move domain components into `src/features/*` without changing the domain contracts below.

## Backend
Supabase is the system of record:
- PostgreSQL for data and constraints
- Supabase Auth for credentials/session management
- RLS for tenant isolation
- SECURITY DEFINER functions for sensitive transactions
- Edge Functions where server-side Auth Admin or external services are required
- pg_cron for automatic checkout and membership expiry

## Tenant boundary
Every gym-owned record carries `gym_id`. Authorization derives the current gym from the authenticated profile. Client-supplied gym IDs are never trusted for authorization.

## Core domain
gyms -> profiles -> membership_plans -> memberships -> payments
                       -> attendance
                       -> notifications
                       -> audit_logs

Platform layer: platform_admins -> gyms -> gym owners.

## Membership model
A membership plan is only duration_value, duration_unit (day/month), price and active. The owner does not invent plan names; display labels are derived automatically.

Membership state: planned -> active -> expired.
Payment state: paid | pending | partial.

Outstanding balance belongs to the membership. Actual money received belongs to payment records.

## Transaction rules
1. Registration creates the member account and membership.
2. Paid registration creates the payment in the same server-side transaction.
3. Due registration creates no fake payment and records the outstanding balance.
4. Payment collection creates a payment and updates the membership balance.
5. Renewal/assignment uses server-side transactional functions.
6. Attendance check-in uses a server-side function that validates role, active membership, Sunday closure, gym location and radius before inserting attendance.
7. Manual checkout uses a protected server-side function.
8. Automatic checkout is handled by pg_cron.

## Security
- No service-role key in the browser.
- RLS on tenant tables.
- Sensitive operations use SECURITY DEFINER with explicit authorization.
- Super Admin functions verify platform-admin status.
- Passwords are never stored in readable form.
- Temporary credentials are shown only at creation/reset time.
- Initial password change is enforced.
- Administrative actions are audited.

## UX rules
Keep the owner workflow short. Prefer one clear action per task. Do not add enterprise features merely because competitors have them. Empty states explain the next action. Destructive actions require confirmation. Financial operations must leave consistent transaction records. Reports clearly distinguish selected-period metrics from current-state metrics.

## Release gates
A release is production-ready only when the build passes, migrations are source-controlled, RLS/security is reviewed, all four roles pass their happy paths, mobile Back/modal behavior is tested, registration/payment/due/renewal flows are tested, attendance/checkout/auto-checkout is tested, and production deployment is explicitly confirmed.

## Competitor-informed scope
Glofox, Gymdesk and PushPress offer broader features such as booking, branded apps, marketing automation, advanced billing, POS, workout programming and multi-location tooling. GymOS intentionally does not copy that breadth in V1. Its advantage should be a simpler daily workflow: people, memberships, money, attendance and simple reporting.
