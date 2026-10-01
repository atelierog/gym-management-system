# Gym Manager V1 — Product Specification

**Status:** Phase 0.5A — Draft baseline
**Product:** Gym Manager
**Parent platform:** Business OS / Atelier OG
**Architecture:** Multi-tenant SaaS

## 1. Product purpose

Gym Manager is a mobile-first gym management SaaS for gym owners and their staff, with member-facing and trainer-facing access. It manages the operational lifecycle of a gym while keeping tenant data isolated by gym.

The V1 product prioritizes reliable core gym operations over feature breadth.

## 2. V1 roles

### Super Admin

Platform-level Atelier OG role.

Primary responsibilities:
- Create and manage gyms/tenants.
- Create/manage gym-owner accounts.
- Manage platform-level configuration and support controls.
- View platform-level operational information where explicitly authorized.
- Maintain platform security and tenant boundaries.

Super Admin is not a normal gym-owner role and must not receive unrestricted browser-side access to another gym's data.

### Gym Owner / Admin

Gym-level administrator.

Primary responsibilities:
- View gym dashboard.
- Manage members.
- Manage trainers.
- Manage membership plans.
- Assign and renew memberships.
- Manage payments and outstanding dues.
- View/manage attendance.
- View operational reports.
- Manage gym settings.

Owner data and actions are restricted to the owner's gym.

### Trainer

Gym-level operational user.

V1 capabilities:
- View trainer home/dashboard.
- Record/manage permitted attendance operations.
- View their permitted account information.
- Change their password.

Trainer permissions must not become owner permissions through client-side manipulation.

### Member

Gym-level customer/user.

V1 capabilities:
- View member home/dashboard.
- View membership information.
- View payment information permitted for the member.
- Record permitted attendance actions.
- Change password.

Member permissions must remain restricted to the authenticated member's own account/data.

## 3. V1 owner navigation

The owner application will contain these primary areas:

1. Dashboard
2. Members
3. Trainers
4. Memberships
5. Payments / Dues
6. Attendance
7. Reports
8. Settings

The exact visual navigation pattern will be designed separately. Navigation labels must not be duplicated across multiple competing implementations.

## 4. Owner Dashboard

The dashboard is an operational summary, not the place where every management action is implemented.

Required V1 information:
- Active members.
- Today's attendance.
- Active trainers.
- Outstanding payment dues.
- Relevant membership expiry/attention information.
- Quick actions for the most common owner tasks.

Dashboard figures must come from the authoritative backend/database state.

Dashboard UI may be redesigned without changing the underlying business rules.

## 5. Members

V1 member management must support:
- Member list.
- Search/filter as appropriate.
- Register member.
- View member details.
- Edit permitted member information.
- Deactivate/remove through the approved backend workflow.
- View membership information.
- View permitted payment/due information.
- Password/account management through approved server-side workflow.

Registering a member may create the required authentication/profile records and, when selected, membership/payment state through the existing backend contracts.

## 6. Trainers

V1 trainer management must support:
- Trainer list.
- Create trainer.
- View trainer details.
- Edit permitted trainer information.
- Deactivate/remove through approved backend workflow.
- Manage/view permitted trainer attendance information.
- Password/account management through approved server-side workflow.

Trainer creation must use the established privileged account-creation workflow rather than duplicating authentication logic in the browser.

## 7. Memberships

V1 membership functionality must support:
- Membership plans.
- Create/edit plans.
- Activate/deactivate plans.
- Assign a plan to a member.
- Renew a membership.
- Track membership start/end/active state.
- Handle expiry and upcoming expiry states.

Membership assignment and renewal must use the authoritative backend transaction/RPC contracts.

## 8. Payments / Dues

V1 payment functionality must support:
- Record permitted payments.
- Partial payments where supported by the backend contract.
- Outstanding dues.
- Payment history.
- Payment correction through the approved correction workflow.
- Dashboard/report totals derived from authoritative payment records.

The frontend must never be the final authority for whether a payment amount or state change is valid.

## 9. Attendance

V1 attendance must support the configured gym attendance workflow for members and trainers.

Required business rules include, where applicable:
- Authenticated account validation.
- Gym/tenant validation.
- Membership/account status validation.
- Duplicate/open attendance prevention.
- Sunday closure rule where configured by product policy.
- Gym location/radius validation where configured.
- Check-in.
- Checkout.
- Automatic checkout where configured.

Security-critical attendance validation must be enforced server-side. Browser-side checks are UX assistance only.

## 10. Reports

V1 owner reports may expose operational summaries such as:
- Collection totals.
- Payment-method totals.
- Attendance summaries.
- New/active/expired/expiring memberships.
- Outstanding dues.
- Recent payments.
- CSV export where already supported and retained in the final V1 design.

Reports must not bypass tenant isolation.

## 11. Settings

V1 gym settings may include:
- Gym name.
- Timezone.
- Gym coordinates.
- Attendance radius.
- Automatic checkout enable/disable.
- Automatic checkout duration.

Settings changes must use the authorized backend/database path and generate audit information where required.

## 12. Authentication

V1 uses the existing Supabase authentication architecture.

There is one common login entry point for the supported roles. The authenticated role determines the destination and permissions after login.

Required authentication capabilities:
- Login ID/email + password.
- Password visibility toggle.
- Remembered Login ID where currently supported.
- Forgot password.
- Password change/recovery flow.
- Loading state.
- Error state.
- Session handling.
- Protected routing.

Authentication UI can be redesigned independently from backend authentication logic.

## 13. Tenant isolation

Every gym-level user and operation must remain scoped to the authenticated gym.

The browser must not be trusted to supply or alter authoritative `gym_id`, role, permissions, payment state, membership state, or security-sensitive values.

RLS, database constraints, RPCs, and Edge Functions remain the security boundary.

## 14. Auditability

Security-sensitive and important administrative actions should remain auditable through the existing audit infrastructure.

Removing an Activity Log screen from the UI must never mean removing the underlying audit trail.

## 15. V1 exclusions / not automatically included

The following are not part of the V1 baseline unless explicitly approved later:
- Online payment gateway integration.
- Marketing/CRM automation.
- Payroll.
- Inventory management.
- Diet/nutrition management.
- Advanced analytics/BI.
- Public gym discovery.
- Multi-branch management beyond the existing tenant architecture.
- Complex class scheduling.
- Automated WhatsApp/SMS systems requiring additional paid providers.
- Any feature that requires a new external paid provider without explicit approval.

Existing code for excluded features must not be deleted blindly; it should be classified as legacy/optional until the cleanup phase.

## 16. Product principles

1. **Backend is authoritative.** UI is not security.
2. **One feature, one source of truth.** Do not keep competing implementations alive.
3. **Mobile-first, responsive everywhere.** Mobile is not a separate product.
4. **No patch-stack architecture.** Fix the owning component/service instead of adding another override file.
5. **Every action has a defined backend path.** A button is not complete merely because it opens a UI element.
6. **Tenant isolation is mandatory.** A user can only access what their role and gym authorize.
7. **Existing working backend contracts are preserved unless a deliberate migration is approved.**
8. **Design before implementation.** A screen is agreed conceptually before coding it.
9. **No feature is considered complete without functional verification.**
10. **Git history is the rollback mechanism.** Do not delete legacy code before identifying dependencies.

## 17. Definition of Done — V1 feature

A feature is complete only when:

- UI is implemented.
- Required mobile layouts work.
- Required desktop/tablet layouts work where applicable.
- Loading state exists.
- Empty state exists where applicable.
- Error state exists.
- Backend connection is identified and verified.
- Database/RPC/Edge Function behavior is verified.
- RLS/authorization is verified for the feature.
- Correct role can perform the action.
- Incorrect role cannot perform the action.
- Cross-tenant access is denied.
- Refresh/session behavior works.
- Direct navigation cannot bypass authorization.
- No unintended duplicate/legacy implementation controls the same feature.
- Production build succeeds.
- No known blocking console/runtime errors remain.

## 18. Change-control rule

Before adding a new V1 feature, update this specification first.

Before removing a V1 feature, mark it explicitly as removed/deferred and identify any backend/UI dependencies.

Before changing a backend contract, identify all frontend consumers and migration requirements.

## 19. Current implementation baseline

The repository currently contains a working backend foundation and a monolithic/patch-heavy frontend. Phase 0 established that the backend should be preserved while the frontend architecture is progressively cleaned up.

Phase 0.5A locks the product baseline. Later Phase 0.5 steps will define the technical architecture, backend contracts, design system, and development workflow before feature implementation resumes.
