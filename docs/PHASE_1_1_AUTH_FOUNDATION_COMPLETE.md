# Phase 1.1 — Authentication Foundation

## Status

**COMPLETE — implementation foundation committed.**

## Scope completed

### Single login

The existing single Login component remains the shared entry point for all roles. It does not create separate login panels for Super Admin, Owner, Trainer, or Member.

### Sign in

`src/lib/auth.js` provides the canonical `signIn(loginId, password)` operation. It supports email login and the existing Login ID convention, validates the resulting account/profile, checks active status, and checks gym platform suspension before allowing the session to continue.

### Session/profile foundation

`currentProfile()` resolves the authenticated Supabase user into either the active platform administrator or the active gym profile and includes the gym platform context.

### Logout

`signOut()` remains centralized in the authentication service.

### Remember me

The login UI retains the existing local remembered Login ID behavior. No password or authentication secret is stored in local storage.

### Password visibility

The existing password visibility control remains functional.

### Password recovery

`sendPasswordReset(loginId)` now calls Supabase `resetPasswordForEmail` with the application reset route. The Login screen now actually initiates password recovery instead of displaying a fake/static recovery message.

### Password update primitive

`updatePassword(password)` provides the authenticated password-update operation with a minimum-length validation guard.

### Session primitive

`getSession()` provides a centralized session lookup.

### Auth event primitive

`onAuthStateChange(callback)` exposes the Supabase auth-state subscription through the authentication service so the application shell can consume auth changes without importing Supabase auth logic into every screen.

## Error/loading behavior

The login flow retains:

- validation errors;
- authentication errors;
- inactive-account handling;
- suspended-gym handling;
- loading state;
- sign-in button busy state;
- password-recovery loading state;
- safe user-facing recovery messaging.

## Security boundary

The frontend does not decide whether a user is authorized for a protected resource. Authentication is handled by Supabase Auth; profile/gym checks are performed through the existing account data; backend authorization/RLS remains authoritative.

## Files changed

- `src/lib/auth.js`
- `src/login.jsx`

## Verification notes

Static repository verification was performed after the implementation changes. The project declares `npm run build` as its production build command. Runtime browser verification must still be performed in the local/CI environment with valid Supabase configuration before merging this branch into a production branch.

## Acceptance boundary

Phase 1.1 is complete as the **authentication foundation implementation**. The reset-password screen/navigation experience is intentionally kept separate from this foundation and can be finalized with the routing/auth-guard work in the next phase, avoiding duplicate routing logic in the login component.
