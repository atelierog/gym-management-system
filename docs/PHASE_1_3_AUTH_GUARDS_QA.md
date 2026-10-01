# Phase 1.3 — Authentication & Role Guard QA

## Guard model

Protected application paths are partitioned by canonical role:

- `/super-admin/*` → `super_admin`
- `/owner/*` → `owner`
- `/trainer/*` → `trainer`
- `/member/*` → `member`

`src/lib/route-guards.js` is the single route-policy module for these checks.

## Required behavior

| Scenario | Expected result |
|---|---|
| No authenticated session → protected route | Redirect to login |
| Active owner → `/owner/*` | Allow |
| Active trainer → `/trainer/*` | Allow |
| Active member → `/member/*` | Allow |
| Active super admin → `/super-admin/*` | Allow |
| Owner → trainer route | Redirect to owner's landing route |
| Member → owner route | Redirect to member landing route |
| Unknown/invalid role | Reject and return to public entry |
| Suspended gym | Session rejected by profile resolution |
| Inactive profile | Session rejected by profile resolution |
| Refresh on protected route | Guard re-evaluates session/profile |
| Direct URL to another role | Guard blocks it |
| Logout then protected URL | Guard blocks it |

## Security boundary

The route guard is a UX/navigation boundary. It is not the authorization boundary.

Backend authorization and Supabase RLS must independently reject unauthorized reads/writes.

## Acceptance

Phase 1.3 is accepted only when the route policy is centralized, role prefixes are canonical, unauthenticated access is rejected, cross-role navigation is rejected, and profile/session failures fail closed.

No dashboard or role-panel implementation is included in this phase.
