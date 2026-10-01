import { resolveRouteGuard } from "./lib/route-guards";

const PUBLIC_PATHS = new Set(["/", "/login", "/forgot-password", "/reset-password"]);
let guardSequence = 0;

function isPublic(pathname) {
  return PUBLIC_PATHS.has(pathname);
}

async function enforce(pathname) {
  const sequence = ++guardSequence;
  if (isPublic(pathname)) return true;

  try {
    const result = await resolveRouteGuard(pathname);
    if (sequence !== guardSequence) return false;

    if (!result.allowed && result.redirect && window.location.pathname !== result.redirect) {
      window.history.replaceState({}, "", result.redirect);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return false;
    }

    return result.allowed;
  } catch {
    if (sequence !== guardSequence) return false;
    window.history.replaceState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    return false;
  }
}

window.__GYM_MANAGER_ROUTE_GUARD__ = enforce;

// Protect initial deep links before protected content can be shown.
if (!isPublic(window.location.pathname)) {
  document.documentElement.dataset.routeGuardChecking = "true";
  void enforce(window.location.pathname).finally(() => {
    document.documentElement.dataset.routeGuardChecking = "false";
  });
}

window.addEventListener("popstate", () => {
  void enforce(window.location.pathname);
});
