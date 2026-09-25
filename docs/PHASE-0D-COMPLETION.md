# Phase 0D — Completion & Release Checklist

## Scope
Phase 0D closes the V1 foundation and portal-stabilisation work. V1 remains limited to members, trainers, memberships, payments/dues, attendance, reports, reminders, settings and role/password management.

## Product rules locked
- Product-facing Owner name: Gym Manager.
- Mobile-first Owner experience.
- Same UI design system across Super Admin, Owner, Trainer and Member portals.
- Owner setup requirements are shown to the Owner, not Super Admin, unless platform-level action is required.
- Member registration owns initial membership setup; no redundant standalone site-membership creation step.
- Payments are history/transactions created by enrollment, renewal or due settlement; the main payment surface is not a manual "collect payment" task.
- Payment history supports member identity, amount, method, date and due state, with search/filtering and dashboard attention for outstanding dues.
- New gym/member/trainer account creation generates temporary credentials automatically; readable temporary credentials are returned only once.
- Password reset uses the configured email workflow.

## Portal completion matrix
### Super Admin
- [x] Login/auth foundation
- [x] Gym onboarding foundation
- [x] Owner credential generation/reset foundation
- [x] Platform-level gym/owner controls
- [ ] Final visual QA against shared design system

### Gym Owner
- [x] Mobile shell and navigation foundation
- [x] Dashboard structure
- [x] Owner-only setup attention model
- [x] Member/trainer creation foundation
- [x] Membership/payment transaction foundation
- [x] Password lifecycle foundation
- [ ] Final browser smoke test for every action
- [ ] Final mobile visual QA

### Trainer
- [x] Role/backend boundary defined
- [x] Attendance permissions defined
- [ ] Full UI/UX smoke test
- [ ] Password/reset smoke test

### Member
- [x] Role/backend boundary defined
- [x] Own membership/payment/attendance scope defined
- [ ] Full UI/UX smoke test
- [ ] Password/reset smoke test

## Backend release gates
- [x] PostgreSQL/Supabase is system of record
- [x] Tenant boundary uses gym_id
- [x] RLS/security architecture documented
- [x] Membership/payment transactions defined server-side
- [x] Attendance validation defined server-side
- [x] Passwords are not stored in readable form
- [ ] Execute full RLS/grant smoke matrix in production
- [ ] Execute cross-tenant denial tests
- [ ] Execute payment impossible-state tests
- [ ] Execute GPS/Sunday/duplicate-attendance tests

## Build/deployment gates
- [ ] Clean production build
- [ ] Migration check
- [ ] Production deployment confirmation
- [ ] Mobile browser smoke test
- [ ] Modal/back/navigation smoke test

## Definition of done
Phase 0D is complete only when every unchecked release gate above has been executed successfully. A successful frontend build alone is not sufficient.
