# Gym Manager V1 — Technical Architecture & Backend Contract

**Status:** Phase 0.5B — baseline
**Parent:** Atelier OG / Business OS
**Product:** Gym Manager
**Scope:** V1 implementation contract

## 1. Architecture decision

Gym Manager remains a dependency-light, multi-tenant web/PWA application.

```text
Mobile / Desktop Browser
        |
        v
React + Vite
        |
        +--------------------+
        |                    |
        v                    v
Supabase Auth        Supabase Data API
                             |
                             v
                      PostgreSQL + RLS
                             |
             +---------------+----------------+
             |               |                |
             v               v                v
        Memberships       Payments       Attendance
             |
             v
          pg_cron
             |
       +-----+------+
       |            |
       v            v
Auto checkout   Expiry/reminder jobs

Privileged operations:
Browser -> Supabase Edge Function -> server-authoritative operation
```

Cloudflare Workers/Pages remains the hosting/deployment layer. The existing React/Vite/Supabase stack is retained; no second frontend framework, separate API server, microservice layer, or global state library is introduced without an explicit architecture decision.

## 2. Source-of-truth hierarchy

The system has one authority at each layer:

1. **PostgreSQL** — authoritative application state and financial/membership/attendance rules.
2. **RLS + database grants** — tenant and row-level authorization boundary.
3. **RPC/database functions** — transactional business operations.
4. **Edge Functions** — privileged Auth Admin/service-role workflows and other operations that must not expose service credentials to the browser.
5. **Frontend services** — typed/centralized calls to the backend contract; never the final security authority.
6. **React UI state** — presentation state only.

The browser must never be treated as authoritative for `gym_id`, role, permissions, membership status, payment validity, attendance validity, or other security-sensitive state.

## 3. Tenant model

Every gym is a tenant identified by `gym_id`.

Tenant-owned records must be linked to the gym directly or through an authoritative relationship. Queries and mutations must be constrained to the authenticated user's permitted tenant.

The frontend may display a gym ID, but must not be allowed to elevate or change it through client-side state.

Super Admin is platform-level and is not treated as a normal tenant admin. Platform operations that need cross-tenant visibility use explicitly authorized server-side paths.

## 4. Authentication contract

The application uses the existing Supabase Auth system.

There is one common login entry point. The authenticated account determines the role and destination after successful authentication.

Current account model:

- Platform Super Admin is represented through `platform_admins`.
- Gym-level users are represented through `profiles`.
- Gym-level profile records contain the authoritative `gym_id`, role and status.
- A suspended gym blocks access.

The current auth helper signs in through Supabase Auth, then resolves platform/profile access and gym status before returning an application profile. This behavior is preserved during frontend refactoring.

The current Supabase client intentionally keeps the auth session in `sessionStorage` while retaining the session through reloads in the same browser session. Remember-me behavior must not silently change this security decision.

## 5. Role contract

### `super_admin`

Platform-level access only. Can perform explicitly authorized onboarding/platform operations.

### `admin`

Gym Owner/Admin. Full V1 gym-management operations within the authenticated gym.

### `trainer`

Attendance/operational access defined by the V1 product specification. No owner-level financial administration.

### `member`

Own membership, permitted payment history, own attendance and password operations only.

Role enforcement must exist server-side. Hiding a navigation item is not authorization.

## 6. Backend operation categories

Every feature must use one of these paths:

### A. Read-only tenant data

```text
React feature service
 -> Supabase Data API
 -> RLS
 -> PostgreSQL
```

Use this for safe reads where RLS is sufficient.

### B. Ordinary tenant mutation

```text
React feature service
 -> Supabase Data API
 -> RLS/grants/constraints
 -> PostgreSQL
```

Only use direct mutations when the operation is safe under RLS and does not require multi-step transactional business logic.

### C. Transactional business operation

```text
React feature service
 -> PostgreSQL RPC
 -> authorization + validation
 -> transaction
 -> tables/audit
 -> response
```

Membership assignment, renewal and payment-changing operations belong here where the existing backend contract provides an RPC.

### D. Privileged Auth/platform operation

```text
React feature service
 -> Edge Function
 -> authenticated actor verification
 -> service-role operation
 -> database/audit
 -> response
```

Account creation, Auth Admin operations, platform operations and other service-role work belong here.

## 7. Known V1 backend contracts

The existing architecture defines the following business boundaries and they must remain stable unless a migration is deliberately approved:

| Operation | Expected authority | Required behavior |
|---|---|---|
| Login | Supabase Auth + profile/platform resolution | Authenticate and resolve role/tenant/status |
| Member/trainer account creation | Edge Function | Verify actor, create Auth user/profile, preserve tenant, audit, rollback Auth user if profile creation fails |
| Membership assignment | DB transaction/RPC | Validate admin/member/plan, calculate lifecycle, create membership/payment as applicable, audit atomically |
| Membership renewal | DB transaction/RPC | Validate admin/member/plan, close prior lifecycle, create replacement membership/payment, audit atomically |
| Payment collection | DB transaction/RPC | Validate membership/due/amount/method and update authoritative financial state atomically |
| Payment correction | DB transaction/RPC | Controlled correction; never allow impossible balances or unauthorized edits |
| Attendance check-in | Server-side RPC/function | Validate user/role/status, tenant, membership, Sunday/date rules, GPS/radius and duplicate open visit before insert |
| Attendance checkout | Server-side RPC/function | Validate ownership/permission and close the permitted open visit |
| Automatic checkout | PostgreSQL scheduled job | Operate on authoritative open visits using gym timezone/configuration |
| Expiry/reminders | Scheduled backend job | Derive from authoritative membership state and gym timezone |
| Audit | Database/audit function/table | Preserve an administrative trace for important security/business actions |

Exact function names and signatures are treated as repository contracts and must be discovered from the migration/function source before a frontend feature is wired to them. Do not invent an RPC name or payload.

## 8. Account creation contract

The existing `admin-create-user` Edge Function is an example of the required pattern:

1. Require an Authorization header.
2. Resolve the authenticated actor.
3. Load actor profile.
4. Require the actor to be an active admin.
5. Accept only member/trainer roles for tenant account creation.
6. Validate identity/contact/password inputs.
7. Allocate or validate the tenant-specific login ID.
8. Create the Auth user server-side.
9. Create the profile with the actor's `gym_id`.
10. If profile creation fails, delete the newly created Auth user.
11. Record the administrative action.
12. Return the resulting profile.

The frontend must not duplicate this workflow with direct Auth Admin calls.

## 9. Financial contract

Money-changing workflows must be transactional.

The frontend can collect input and show validation messages, but the backend must revalidate:

- actor authorization
- tenant ownership
- membership ownership
- plan validity
- amount boundaries
- outstanding balance
- payment method
- lifecycle state
- duplicate/impossible transactions

Dashboard/report totals must be derived from authoritative payment/membership records, never from cached frontend counters.

## 10. Attendance contract

Attendance is security-sensitive.

The client may obtain device GPS and provide it to the backend for UX, but the server remains responsible for the security decision.

The authoritative workflow must validate, as applicable:

- authenticated identity
- permitted role/status
- authenticated gym/tenant
- gym coordinates/radius
- gym timezone/local date
- Sunday closure
- active membership for members
- duplicate open visit
- permitted checkout ownership

A client-side distance calculation is not sufficient evidence of authorization.

## 11. Frontend architecture contract

The current application has a large monolithic `src/main.jsx`. Phase 1 will progressively refactor it without changing the backend contract.

Target structure:

```text
src/
├── app/
│   ├── App.jsx
│   ├── routes.jsx
│   └── guards/
├── auth/
├── layouts/
│   ├── OwnerLayout.jsx
│   ├── TrainerLayout.jsx
│   ├── MemberLayout.jsx
│   └── SuperAdminLayout.jsx
├── features/
│   ├── dashboard/
│   ├── members/
│   ├── trainers/
│   ├── memberships/
│   ├── payments/
│   ├── attendance/
│   ├── reports/
│   └── settings/
├── components/
├── services/
└── lib/
```

This is a target architecture, not a requirement to split every file immediately. Extraction happens feature-by-feature with working behavior preserved.

## 12. Service-layer rule

React components should not contain large database workflows.

A feature component should call a service such as:

```text
members.service.js
memberships.service.js
payments.service.js
attendance.service.js
```

The service owns the backend call, input mapping and normalized error handling.

The service does not replace backend authorization.

## 13. State-management rule

Do not introduce Redux, Zustand or another global state library in V1 unless a concrete cross-feature state requirement is demonstrated.

Prefer:

- local React state for local UI state
- feature hooks for feature data
- Supabase session/auth state for authentication
- server/database state as the source of truth

## 14. Error contract

Every feature must distinguish at least:

- loading
- success
- empty
- validation error
- authorization error
- backend/system error

Do not expose raw database/service-role errors to end users when a safe human-readable message can be provided.

Operational errors should remain observable through the existing platform-error/audit mechanisms where appropriate.

## 15. Security contract

Never:

- put Supabase service-role keys in frontend code
- trust client-supplied `gym_id`
- trust client-supplied role
- allow browser-side role escalation
- use UI hiding as authorization
- calculate payment truth solely in JavaScript
- calculate attendance authorization solely in JavaScript
- bypass migrations for production schema changes
- create a second authentication system

Edge Functions may use service-role credentials only server-side.

## 16. Data-change rule

Database schema changes must be delivered as migrations.

A frontend change that requires a schema change must document:

1. migration name
2. affected tables/functions/policies
3. frontend consumers
4. rollback considerations
5. verification steps

No direct production schema editing becomes the normal workflow.

## 17. Legacy-code rule

Legacy files are not deleted merely because they look old.

Before deletion:

1. identify imports/references
2. identify runtime usage
3. identify backend dependencies
4. identify whether another feature still uses the code
5. remove/replace consumers
6. build and smoke-test
7. delete the now-unreferenced implementation

One feature must have one active implementation.

## 18. API/backend contract verification rule

Before calling a feature complete, record:

```text
UI action
 -> service
 -> exact RPC/Edge Function/query
 -> exact database domain
 -> authorization boundary
 -> expected response
 -> UI state update
```

If any link is unknown, the feature remains incomplete.

## 19. Release verification

A release candidate must pass:

- npm build
- database migration verification
- RLS/grant tests
- Super Admin smoke test
- Owner smoke test
- Trainer smoke test
- Member smoke test
- membership/payment transaction tests
- attendance GPS/radius tests
- password lifecycle tests
- responsive layout smoke tests
- direct-route authorization tests
- no blocking console/runtime errors

## 20. Known implementation observations

The current repository already uses React 19, Vite 8, Supabase JS 2 and Wrangler, with a deliberately small dependency set. fileciteturn853file0L2-L2

The existing `main.jsx` is very large and currently mixes UI, database operations, PDF generation, navigation and business workflows. It is therefore a refactoring target, not a reason to replace the backend. fileciteturn856file0L2-L2

The existing auth helper resolves both platform-admin and gym-profile access after Supabase authentication and checks gym suspension state. fileciteturn866file0L2-L2

The current `admin-create-user` Edge Function already demonstrates the required server-side authorization, tenant assignment, Auth creation, rollback and audit pattern. fileciteturn865file0L2-L2

## 21. Phase 0.5B decision

The technical architecture is now frozen for Phase 1:

- Keep React + Vite.
- Keep Supabase + PostgreSQL + RLS.
- Keep Edge Functions for privileged operations.
- Keep Cloudflare hosting.
- Keep PostgreSQL as source of truth.
- Preserve existing backend contracts unless a deliberate migration is approved.
- Refactor the frontend progressively by feature.
- Do not add unnecessary infrastructure.
- Verify every feature through the full UI-to-database chain.
