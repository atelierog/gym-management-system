# Gym Manager V1 — Git & QA Rules

## Purpose

This document is the delivery gate for Gym Manager V1. It defines how changes are isolated, reviewed, tested, and accepted before reaching the main product branch.

## Branching

- `main` is the protected product baseline.
- Phase work happens on dedicated branches.
- Feature/fix branches must describe one logical change.
- Do not combine unrelated UI, backend, database, and refactoring work in one change unless required for the same feature.
- Do not force-push or rewrite shared history unless explicitly required for recovery.

## Commit rules

Commits should be small enough to understand and revert.

Preferred pattern:

```text
feat: add owner member list
fix: correct attendance date handling
refactor: extract member service
style: align owner card spacing
test: verify member tenant isolation
docs: update architecture contract
```

A commit should leave the branch buildable whenever practical.

## Pull request gate

A feature should not be considered complete until:

1. Code is on a dedicated branch.
2. Build succeeds.
3. Relevant tests/checks pass.
4. Security/role behavior is verified.
5. Mobile behavior is verified.
6. No obsolete implementation remains reachable.
7. The change has a clear purpose and no unrelated modifications.

## Mandatory QA matrix

### Authentication

- Login success.
- Invalid credentials.
- Loading state.
- Auth error state.
- Session restoration.
- Logout.
- Expired/invalid session.
- Forgot password.
- Password reset/change where applicable.

### Authorization

For every protected feature:

- unauthenticated access is rejected;
- correct role can enter;
- incorrect role is rejected;
- restricted action is rejected;
- direct URL access is checked;
- refresh/deep-link is checked.

### Tenant isolation

For owner/trainer/member features:

- correct gym data is visible;
- another gym's data is not visible;
- changing URL/query/body `gym_id` does not bypass authorization;
- backend/RLS remains authoritative;
- member-level access cannot be expanded through client state.

### Data states

Every data-driven screen must be checked for:

- loading;
- populated;
- empty;
- error;
- mutation/loading;
- mutation success;
- mutation failure;
- permission denied.

## UI QA

Check the actual rendered interface, not just source code.

Verify:

- typography;
- spacing;
- alignment;
- component states;
- focus states;
- touch targets;
- text clipping;
- overflow;
- modals/dialogs;
- keyboard behavior;
- loading indicators;
- error messaging.

## Responsive QA

Primary mobile widths:

`360, 375, 390, 393, 412, 430px`

Also verify tablet and desktop layouts when the feature is intended to support them.

Rules:

- no unintended horizontal scrolling;
- no clipped controls/text;
- no inaccessible controls;
- no desktop-only assumptions in mobile flows;
- mobile remains the same product hierarchy rather than a separately invented product.

## Regression QA

After a change, verify the nearest affected flows plus authentication and navigation.

For shared components, test every known consumer before merging.

For routing changes, test:

- direct URL;
- refresh;
- authenticated session;
- unauthenticated session;
- wrong role;
- missing profile;
- logout.

## Backend verification

A UI success state is not sufficient for a data mutation.

For mutations verify:

```text
UI action
  ↓
service call
  ↓
backend operation
  ↓
authorization
  ↓
database mutation
  ↓
returned result
  ↓
UI state
```

Security-sensitive rules must be enforced server-side/RLS-side, not only in React.

## Console/network QA

Before acceptance:

- no unexplained runtime errors;
- no broken image requests;
- no failed API calls caused by the feature;
- no accidental credential/token logging;
- no repeated request loops;
- no stale endpoint references.

## Legacy cleanup gate

When replacing a screen or component:

1. Search for imports of the old implementation.
2. Search for route references.
3. Search for obsolete CSS/classes.
4. Verify the old implementation is not reachable.
5. Only then remove it.

Do not keep two competing login, dashboard, or role-shell implementations alive.

## Acceptance checklist

A feature is **DONE** only when all applicable checks are true:

- [ ] Correct branch
- [ ] Focused commit/change
- [ ] Build passes
- [ ] Authentication verified
- [ ] Authorization verified
- [ ] Tenant isolation verified
- [ ] Loading state verified
- [ ] Empty state verified
- [ ] Error state verified
- [ ] Mutation state verified
- [ ] Mobile verified
- [ ] Responsive behavior verified
- [ ] Console clean
- [ ] Network behavior checked
- [ ] Legacy implementation unreachable/removed
- [ ] No unrelated changes

## Stop-the-line conditions

Do not declare a feature complete if:

- authentication is broken;
- a protected screen is accessible without authorization;
- tenant isolation is uncertain;
- a sensitive mutation relies only on client-side checks;
- critical data can be silently lost;
- the primary route does not work after refresh;
- a required asset is broken;
- the build fails;
- a known regression remains unexplained.

## Foundation completion gate

Phase 0.5 is complete only when:

- Product specification exists;
- Technical architecture exists;
- Design system exists;
- Frontend architecture exists;
- Routing/role model exists;
- Git/QA rules exist.

Phase 1 may begin after this foundation is reviewed. Phase 1 implementation must follow these documents rather than bypassing them for speed.