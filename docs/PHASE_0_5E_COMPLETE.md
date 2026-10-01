# Phase 0.5E — Routing & Role Model Completion Record

**Status: COMPLETE**

## Scope completed

Phase 0.5E establishes the V1 routing, authentication entry point, role model, tenant boundary, navigation rules, and protected-route behavior for Gym Manager.

## Canonical roles

- `super_admin` — Atelier OG platform operator
- `owner` — gym/business owner
- `trainer` — trainer operating within an assigned gym
- `member` — gym member operating within an assigned gym

## Single authentication entry

All four roles use the same login entry point:

- `/auth/login`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/change-password`

The application resolves the authenticated user's trusted role after authentication and sends the user to the correct protected application area.

## Canonical landing routes

- Super Admin → `/super-admin/dashboard`
- Owner → `/owner/dashboard`
- Trainer → `/trainer/home`
- Member → `/member/home`

## Protected route groups

### Super Admin

`/super-admin`, `/super-admin/dashboard`, `/super-admin/gyms`, `/super-admin/users`, `/super-admin/subscriptions`, `/super-admin/audit`, `/super-admin/settings`

### Owner

`/owner`, `/owner/dashboard`, `/owner/members`, `/owner/members/:memberId`, `/owner/trainers`, `/owner/trainers/:trainerId`, `/owner/memberships`, `/owner/payments`, `/owner/attendance`, `/owner/reports`, `/owner/settings`

### Trainer

`/trainer`, `/trainer/home`, `/trainer/members`, `/trainer/attendance`, `/trainer/schedule`, `/trainer/profile`, `/trainer/password`

### Member

`/member`, `/member/home`, `/member/attendance`, `/member/membership`, `/member/payments`, `/member/profile`, `/member/password`

## Guard model

```text
Route
  ↓
AuthGuard
  ↓
RoleGuard
  ↓
Tenant/context checks where applicable
  ↓
Feature
```

These frontend guards are navigation/UX controls only. Supabase RLS and backend authorization remain the security boundary.

## Tenant rules

Owner, trainer, and member data is tenant-scoped. A URL, query parameter, local state value, or client-provided `gym_id` can never grant authorization to another tenant.

## Unauthorized states

- Unauthenticated → authentication
- Wrong role → permission denied or canonical role landing page
- Wrong tenant → deny access
- Missing/incomplete trusted profile → setup/error state

The frontend must never guess a role when trusted profile resolution fails.

## Session rules

- Restore existing Supabase session on startup.
- Do not flash protected content while profile/role resolution is pending.
- Sign out clears application auth state and returns to `/auth/login`.
- Expired/invalid sessions return to authentication.
- Password reset/change flows remain separate from normal protected application routing.

## Navigation rules

Navigation is role-aware and declarative. Each item has a label, route, icon, access requirement, active-route behavior, and optional feature flag.

Hiding an item is not authorization; direct navigation must still be blocked.

## Verification checklist

- [x] One login entry for all roles
- [x] Four canonical roles defined
- [x] Canonical landing route defined for each role
- [x] Public authentication routes defined
- [x] Protected route groups defined
- [x] AuthGuard/RoleGuard hierarchy defined
- [x] Tenant boundary defined
- [x] Direct URL and refresh behavior defined
- [x] Unauthorized behavior defined
- [x] Role-change behavior defined
- [x] Navigation contract defined
- [x] Legacy migration procedure defined
- [x] Frontend is explicitly not treated as the security boundary

## Implementation rule for Phase 1

Do not destructively rewrite routing during the first build step. Introduce the centralized route model, guards, and role shells incrementally; verify each migration before removing legacy route logic.

## Source of truth

`docs/ROUTING_ROLE_MODEL_V1.md` is the detailed routing and role specification. This file records that Phase 0.5E has been completed and provides the acceptance checklist for the next phase.
