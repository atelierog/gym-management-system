import { resolveRouteGuard } from "./lib/route-guards";

const PUBLIC_PATHS = new Set(["/", "/login", "/forgot-password", "/reset-password"]);
const originalPushState = window.history.pushState.bind(window.history);
const originalReplaceState = window.history.replaceState.bind(window.history);
let guardSequence = 0;

function isPublic(pathname) {
  return PUBLIC_PATHS.has(pathname);
}

async function enforce(pathname, mode = "replace") {
  const sequence = ++guardSequence;
  if (isPublic(pathname)) return true;

  try {
    const result = await resolveRouteGuard(pathname);
    if (sequence !== guardSequence) return false;

    if (!result.allowed && result.redirect) {
      if (window.location.pathname !== result.redirect) {
        window.history.replaceState({}, "", result.redirect);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      return false;
    }
    return true;
  } catch {
    if (sequence !== guardSequence) return false;
    window.history.replaceState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    return false;
  }
}

window.__GYM_MANAGER_ROUTE_GUARD__ = enforce;

window.history.pushState = function guardedPushState(state, title, url) {
  const next = new URL(url ?? window.location.href, window.location.origin);
  originalPushState(state, title, next.href);
  void enforce(next.pathname, "push");
};

window.history.replaceState = function guardedReplaceState(state, title, url) {
  const next = new URL(url ?? window.location.href, window.location.origin);
  originalReplaceState(state, title, next.href);
  void enforce(next.pathname, "replace");
};

window.addEventListener("popstate", () => {
  void enforce(window.location.pathname, "pop");
});

// Initial-load guard. Protected content is kept visually hidden until the
// first authorization decision is resolved, preventing a protected screen
// from flashing before an unauthorized user is redirected.
if (!isPublic(window.location.pathname)) {
  document.documentElement.dataset.routeGuardChecking = "true";
  void enforce(window.location.pathname).finally(() => {
    document.documentElement.dataset.routeGuardChecking = "false";
  });
}
