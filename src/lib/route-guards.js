import { currentProfile, resolveLandingPath } from "./auth";

const ROLE_ROUTE_PREFIXES = {
  super_admin: "/super-admin",
  owner: "/owner",
  trainer: "/trainer",
  member: "/member",
};

export function roleCanAccessPath(role, pathname) {
  const prefix = ROLE_ROUTE_PREFIXES[role];
  if (!prefix || !pathname) return false;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname = window.location.pathname) {
  return Object.values(ROLE_ROUTE_PREFIXES).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function guardPath(profile, pathname = window.location.pathname) {
  if (!profile) return { allowed: false, reason: "unauthenticated", redirect: "/" };

  const role = profile.app_role;
  if (!role || !ROLE_ROUTE_PREFIXES[role]) {
    return { allowed: false, reason: "invalid_role", redirect: "/" };
  }

  if (!roleCanAccessPath(role, pathname)) {
    return {
      allowed: false,
      reason: "forbidden",
      redirect: resolveLandingPath(role),
    };
  }

  return { allowed: true, reason: "authorized", redirect: pathname };
}

export async function resolveRouteGuard(pathname = window.location.pathname) {
  if (!isProtectedPath(pathname)) {
    return { allowed: true, reason: "public", profile: null, redirect: pathname };
  }

  try {
    const profile = await currentProfile();
    const result = guardPath(profile, pathname);
    return { ...result, profile };
  } catch (error) {
    return {
      allowed: false,
      reason: "guard_error",
      error,
      profile: null,
      redirect: "/",
    };
  }
}

export { ROLE_ROUTE_PREFIXES };