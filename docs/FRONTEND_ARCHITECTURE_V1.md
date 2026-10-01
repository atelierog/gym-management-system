# Gym Manager V1 — Frontend Architecture

## 1. Purpose

This document defines how the React frontend is organized. It exists to prevent the previous pattern of putting routing, authentication, UI, database calls, business rules, reports, and unrelated screens into one large component.

The frontend is responsible for presentation, interaction, client-side state, and calling approved backend contracts. It is not the security authority and it must not duplicate server business rules.

## 2. Target structure

```text
src/
├── app/
│   ├── App.jsx
│   ├── routes.jsx
│   ├── providers/
│   └── guards/
│
├── layouts/
│   ├── AuthLayout.jsx
│   ├── OwnerLayout.jsx
│   ├── TrainerLayout.jsx
│   ├── MemberLayout.jsx
│   └── SuperAdminLayout.jsx
│
├── features/
│   ├── auth/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── auth.service.js
│   │   └── auth.types.js
│   ├── dashboard/
│   ├── members/
│   ├── trainers/
│   ├── memberships/
│   ├── payments/
│   ├── attendance/
│   ├── reports/
│   └── settings/
│
├── components/
│   ├── ui/
│   ├── forms/
│   ├── feedback/
│   └── data-display/
│
├── services/
│   ├── supabase.js
│   └── api/
│
├── hooks/
├── lib/
├── styles/
└── assets/
```

The exact file extensions may follow the repository's existing conventions, but responsibilities must remain separated.

## 3. Responsibility boundaries

### App layer
Owns application bootstrapping, providers, route definitions and global error boundaries.

### Layout layer
Owns role-specific navigation shells and shared page framing. Layouts do not implement feature business logic.

### Feature layer
Owns one product capability. A feature may contain its pages, feature-specific components, hooks and service adapters.

### UI components
Own reusable presentation primitives such as Button, Input, Modal, Card, Badge, EmptyState and LoadingState. They must not directly query Supabase.

### Services
Own calls to approved backend contracts. Components should call services/hooks rather than embedding complex Supabase/RPC/Edge Function calls inside JSX.

### Hooks
Own reusable client-side state/interaction logic. Hooks may call feature services but must not bypass authorization boundaries.

### Lib
Own low-level shared utilities and configuration only.

## 4. Route architecture

Routes are defined centrally. Feature pages are not allowed to register ad-hoc routes from arbitrary components.

Conceptually:

```text
/auth/login
/auth/forgot-password
/auth/reset-password

/owner/dashboard
/owner/members
/owner/trainers
/owner/memberships
/owner/payments
/owner/attendance
/owner/reports
/owner/settings

/trainer/home
/trainer/attendance
/trainer/password

/member/home
/member/attendance
/member/membership
/member/payments
/member/password

/super-admin/...
```

Exact route names can change during implementation, but each route must have one owner component and one clear role policy.

## 5. Authentication and role resolution

Authentication is centralized. The application obtains the Supabase authenticated session, resolves the server-backed profile/role/tenant context, and then selects the appropriate protected shell.

The browser must never treat a client-stored role or gym ID as authoritative.

Route guards are UX/access boundaries; RLS and backend authorization remain the actual security boundary.

## 6. Tenant context

A signed-in user's tenant context is represented by server-derived profile data. Feature code should not accept arbitrary `gym_id` values from navigation parameters as permission proof.

Where a backend operation requires a tenant, the service should use the authenticated context expected by the backend contract.

## 7. Feature service pattern

Use a predictable pattern:

```text
Component
  ↓
Feature hook (optional)
  ↓
Feature service
  ↓
Approved RPC / Edge Function / Supabase query
  ↓
PostgreSQL + RLS
```

Example:

```text
RegisterMemberForm
  ↓
useRegisterMember()
  ↓
members.service.registerMember()
  ↓
admin-create-user / approved membership operation
  ↓
Database
```

Do not create a second server endpoint simply because a screen needs data that an existing approved backend contract already provides.

## 8. Component rules

Prefer composition over screen-specific copies.

Shared primitives:
- Button
- Input
- PasswordInput
- Checkbox
- Select
- Modal
- ConfirmDialog
- Card
- StatCard
- Badge
- PageHeader
- LoadingState
- EmptyState
- ErrorState
- Toast/feedback

A feature may create a specialized component when the behavior is genuinely feature-specific. It should not copy a shared component just to change one visual property.

## 9. State model

Every data-driven feature explicitly handles:

```text
idle/loading
loaded
empty
error
mutating
success feedback
permission denied
```

Server data should have one clear source of truth. Avoid maintaining multiple independent copies of the same member, payment, membership or attendance record unless there is a documented caching requirement.

## 10. Forms

Forms should separate:

- input state
- client validation
- submission state
- server response
- error presentation

Client validation improves UX but does not replace server validation.

## 11. Error handling

Backend errors should be converted into user-readable messages by a consistent service/error layer. Components should not contain large blocks of backend error parsing logic.

Never silently swallow authentication, payment, membership or attendance errors.

## 12. Loading and navigation

Avoid full-screen spinners for small mutations. Use local loading states when possible.

Navigation must preserve the application's role/tenant boundaries and must not rely on hiding unauthorized links as the security mechanism.

## 13. Legacy migration strategy

The existing frontend is not rewritten in one risky operation.

Migration order:

1. Freeze current behavior.
2. Introduce the new app/route/layout structure.
3. Extract authentication.
4. Extract shared UI primitives.
5. Move one feature at a time.
6. Remove old imports/routes after the replacement is verified.
7. Search the repository for obsolete references.
8. Build and test after each meaningful migration.

The old dashboard must not remain reachable after its replacement is accepted.

## 14. No giant component rule

No new feature should be added to a monolithic `main.jsx` or equivalent catch-all file.

A file should have one clear responsibility. If a component becomes difficult to reason about because it owns multiple screens, services or workflows, split it before adding more functionality.

## 15. Direct backend access rule

UI components must not directly implement privileged database workflows. Examples that belong behind approved backend contracts include:

- user creation
- membership assignment/renewal
- payment collection/correction
- attendance validation
- role changes
- tenant changes
- audit-sensitive operations

Read-only queries may be made through the established service layer and remain subject to RLS.

## 16. Asset rules

Assets must be imported or referenced through a stable project asset path. A broken image must be treated as an implementation defect, not hidden with alt text or a placeholder.

When replacing an asset, search for all old references and remove obsolete imports where the old asset is no longer part of the design.

## 17. Responsive implementation

Responsive CSS belongs with the component/system that owns the behavior. Avoid scattered emergency media queries that override unrelated screens.

Mobile and desktop share components and information architecture. Responsive differences should be deliberate and documented.

## 18. Testing expectations

Before accepting a feature:

- verify the route directly;
- verify refresh/deep-link behavior;
- verify loading state;
- verify empty state;
- verify error state;
- verify successful mutation;
- verify unauthorized role behavior;
- verify tenant isolation through backend tests where applicable;
- run the production build;
- search for obsolete references after replacement.

## 19. Definition of architectural completion

Phase 0.5D is complete when the team has a clear location for every new page, component, service, hook and route, and when new development can proceed without adding more responsibilities to the existing monolithic entry component.

This document governs frontend structure for Gym Manager V1. Changes should be intentional and reviewed against the technical architecture and design system documents.