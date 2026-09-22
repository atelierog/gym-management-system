# GymOS V1 Foundation Architecture

## 1. System boundary

    Browser / Android PWA
            |
            v
    Cloudflare Worker / Pages
            |
            v
        React UI
            |
            +--------------------+
            |                    |
            v                    v
       Supabase Auth      Supabase Data API
                                 |
                                 v
                          PostgreSQL + RLS
                                 |
                  +--------------+---------------+
                  |              |               |
                  v              v               v
             memberships     payments        attendance
                  |
                  v
             pg_cron jobs
                  |
                  +--> auto checkout
                  +--> expiry notifications

Privileged server work:
Browser -> Supabase Edge Function -> Auth Admin / service-role operations

## 2. Core rules

1. PostgreSQL is the source of truth. The browser never gets to decide authorization.
2. RLS + grants are both required. RLS controls rows; Postgres grants control which operations are reachable.
3. Security-sensitive workflows are database functions or Edge Functions.
4. Client validation is UX only. Server validation repeats every security-critical rule.
5. Tenant isolation is based on gym_id everywhere.
6. Money-changing operations are transactional. Membership creation/renewal with payment is performed by one database function.
7. Attendance check-in is server-authoritative. The server validates GPS, membership, account status, Sunday closure, duplicate open attendance, and radius.
8. Readable passwords are never stored. Temporary passwords are returned only once and then replaced by Auth.
9. Dates use the gym's configured IANA timezone. Default: Asia/Kolkata.
10. Migrations are the only production schema change path.

## 3. Roles

### Platform Super Admin
Can:
- onboard gyms
- view cross-gym directories
- manage gym owner contact/platform metadata
- reset/force owner passwords

Cannot:
- operate a gym's member/payment data as a tenant admin.

### Gym Admin
Can:
- manage members and trainers
- manage membership durations/prices
- assign and renew memberships
- record and correct payments
- manage dues
- manage attendance/settings/reports/audit

Cannot:
- change a user's tenant or role through the client.

### Trainer
Can:
- check in/out
- view attendance needed for operations
- access their own portal

Cannot:
- access member financial records
- administer accounts.

### Member
Can:
- view own membership
- view own payment history
- view own attendance
- check in/out
- change own password.

## 4. Data domains

- gyms — tenant configuration and timezone
- profiles — identity, role, status, contact
- membership_plans — one duration/price definition per gym
- memberships — membership lifecycle and outstanding balance
- payments — financial transactions with controlled corrections
- attendance — visits and checkout state
- notifications — user-facing reminders
- audit_logs — administrative trace
- platform_admins — platform-level authorization

## 5. Transaction boundaries

### Register member
Edge Function:
1. Auth user creation
2. profile creation
3. client records membership/payment within tenant rules
4. PDF/email delivery

### Assign membership
assign_membership():
1. validate admin
2. validate member/plan
3. calculate expiry
4. create membership
5. create payment when paid
6. audit
7. commit atomically

### Renew membership
renew_membership_v2():
1. validate admin
2. validate member/plan
3. expire previous active membership
4. create replacement membership
5. create payment when paid
6. audit
7. commit atomically

### Attendance
check_in_attendance():
1. validate authenticated user
2. validate role/status
3. load gym coordinates/radius/timezone
4. validate local date and Sunday
5. validate active membership for members
6. calculate server-side distance
7. prevent duplicate open visit
8. insert attendance.

## 6. Frontend structure

The current V1 is intentionally dependency-light:
- React
- Vite
- Supabase JS

The next structural refactor should split the large UI file into:
- src/app/ — boot, routing, auth gates
- src/layouts/ — admin, platform, portal shells
- src/features/members/
- src/features/memberships/
- src/features/payments/
- src/features/attendance/
- src/features/reports/
- src/features/platform/
- src/components/ — reusable UI
- src/lib/ — date, permissions, API helpers, formatting

Do not introduce a state-management library until real cross-page state requires it.

## 7. Release gates

Every release must pass:
- build
- database migration application
- RLS/grant tests
- role smoke tests
- mobile layout smoke tests
- payment/membership transaction tests
- attendance GPS tests
- Super Admin onboarding test
- password lifecycle test

A green JavaScript build alone is not a release approval.
