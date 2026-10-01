# Gym Manager V1 — Routing & Role Model

## Purpose

This document defines the application's route structure, authentication flow, role resolution, tenant boundary, and navigation rules for V1.

It is the source of truth for **who can enter which application area**. It does not replace backend authorization or Supabase RLS; those remain authoritative.

## Roles

V1 has four application roles:

- `super_admin` — Atelier OG platform operator
- `owner` — gym/business owner
- `trainer` — trainer operating within an assigned gym
- `member` — gym member operating within an assigned gym

A user's role and gym/tenant context must come from trusted server-backed profile data. Client-provided role or `gym_id` values are never permission proof.

## Public routes

```text
/auth/login
/auth/forgot-password
/auth/reset-password
/auth/change-password
```

The login page is a single shared authentication entry point for all roles. The application resolves the account's role after successful authentication and redirects to the correct protected area.

## Protected route groups

### Super Admin

```text
/super-admin
/super-admin/dashboard
/super-admin/gyms
/super-admin/users
/super-admin/subscriptions
/super-admin/audit
/super-admin/settings
```

### Owner

```text
/owner
/owner/dashboard
/owner/members
/owner/members/:memberId
/owner/trainers
/owner/trainers/:trainerId
/owner/memberships
/owner/payments
/owner/attendance
/owner/reports
/owner/settings
```

### Trainer

```text
/trainer
/trainer/home
/trainer/members
/trainer/attendance
/trainer/schedule
/trainer/profile
/trainer/password
```

### Member

```text
/member
/member/home
/member/attendance
/member/membership
/member/payments
/member/profile
/member/password
```

Exact paths may be adjusted during implementation, but every screen must have one canonical route and one explicit access policy.

## Route resolution flow

```text
Open application
      ↓
Check Supabase session
      ↓
No session ─────────────→ /auth/login
      ↓
Session exists
      ↓
Load trusted profile / role / tenant context
      ↓
Resolve role
      ↓
┌──────────────┬──────────┬──────────┬──────────┐
│ super_admin  │ owner    │ trainer  │ member   │
└──────┬───────┴────┬─────┴────┬─────┴────┬─────┘
       ↓             ↓          ↓          ↓
 /super-admin    /owner    /trainer    /member
```

If profile/role resolution fails, the application must not guess a role. Show an appropriate account/setup/error state and prevent access to protected application areas.

## Guard hierarchy

```text
Route
 ↓
AuthGuard
 ↓
RoleGuard
 ↓
Tenant/context checks where applicable
 ↓
Feature page
```

These guards improve navigation safety and user experience. They are **not** the security boundary. Supabase RLS and backend authorization must independently enforce access.

## Role matrix

| Area | Super Admin | Owner | Trainer | Member |
|---|---|---|---|---|
| Platform administration | Full | No | No | No |
| Gym management | Full | Own gym | No | No |
| Owner dashboard | No | Own gym | No | No |
| Members | Platform support | Own gym | Assigned/allowed members | Self |
| Trainers | Platform support | Own gym | Self | No |
| Memberships | Platform support | Own gym | View as permitted | Own membership |
| Payments | Platform support | Own gym | View as permitted | Own payments |
| Attendance | Platform support | Own gym | Operational attendance | Own attendance |
| Reports | Platform | Own gym | Assigned/allowed reports | Own relevant data |
| Personal profile | Own | Own | Own | Own |
| Platform settings | Full | No | No | No |
| Gym settings | Support/administration | Own gym | No | No |

This matrix describes intended product access. Every sensitive operation must still be enforced by backend authorization/RLS.

## Tenant isolation

A gym is a tenant boundary for owner, trainer, and member data.

Rules:

1. Owner access is restricted to the authenticated owner's gym(s) according to the backend contract.
2. Trainer access is restricted to the authenticated trainer's permitted gym and assigned/allowed data.
3. Member access is restricted to the authenticated member's own account and permitted gym data.
4. Super Admin operates at the platform level according to explicit backend permissions.
5. A route such as `/owner/members?gym_id=other-gym` must never grant access to another tenant.
6. Services must not treat URL/query parameters as authorization.

## Navigation rules

Navigation is generated from role-aware configuration rather than scattered conditional links.

Each item should define:

```text
label
route
icon
required role
active route/pattern
optional feature flag
```

Hiding an unauthorized navigation item is only a UX measure. Direct navigation must still be rejected by guards/backend authorization.

## Canonical landing pages

After successful login:

```text
super_admin → /super-admin/dashboard
owner       → /owner/dashboard
trainer     → /trainer/home
member      → /member/home
```

If a role has an incomplete account setup, route to a dedicated setup/error state instead of silently sending the user to another role's dashboard.

## Session behavior

- Restore an existing Supabase session on application startup.
- While session/profile resolution is pending, show an application loading state rather than flashing protected content.
- Sign out clears the local authenticated application state and returns to `/auth/login`.
- Expired/invalid sessions must return the user to authentication without exposing protected data.
- Password reset/change routes must remain accessible only according to their authentication/token requirements.

## Unauthorized behavior

Use distinct outcomes:

- **Unauthenticated:** redirect to login.
- **Authenticated but wrong role:** show a permission-denied state or route to the user's own canonical landing page according to UX rules.
- **Authenticated but wrong tenant:** deny access; never silently switch tenant based on URL parameters.
- **Missing/incomplete profile:** show account setup/error state; do not guess permissions.

## Direct URL and refresh requirements

Every protected route must work correctly when:

- opened directly;
- refreshed;
- opened from a bookmark;
- opened after restoring a valid session.

The route system must not rely on having visited the dashboard first.

## Feature-level access

Role access is the first gate, not the only gate. Some actions may require finer permissions within a role.

Examples:

```text
Owner → can manage trainers
Owner → can view payment data
Trainer → may record attendance
Trainer → cannot change owner billing settings
Member → may view own payment history
Member → cannot view another member
```

Fine-grained permissions should be introduced through explicit backend policy rather than arbitrary frontend booleans.

## Role changes

A role change is a privileged backend operation.

The frontend must not:

- write a privileged role directly from arbitrary form state;
- assume the new role immediately without server confirmation;
- keep stale navigation permissions after a role change.

After a confirmed role change, refresh the trusted profile/context and recompute navigation/route access.

## Migration rules

The current application may contain legacy route logic in large components. Phase 0.5E does **not** authorize a destructive rewrite.

Migration order:

1. Document the canonical route map.
2. Identify current routes and redirects.
3. Identify current role/profile resolution.
4. Introduce centralized route definitions.
5. Introduce AuthGuard/RoleGuard boundaries.
6. Migrate one role shell at a time.
7. Verify direct URLs and refresh behavior.
8. Search for obsolete routes/imports.
9. Remove unreachable legacy routing only after verification.

## Acceptance criteria

Phase 0.5E routing/role architecture is accepted when:

- every V1 role has a canonical route group;
- login is shared across roles;
- role resolution is server-backed;
- route definitions are centralized;
- auth and role guards are conceptually separated;
- tenant context is never trusted from the URL alone;
- unauthorized roles cannot reach protected feature routes;
- backend/RLS remains the security authority;
- direct URL and refresh behavior is explicitly covered;
- no new feature introduces ad-hoc route registration.
