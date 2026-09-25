// Gym Manager Owner surface: small UI-only behavior layer.
// Backend operations remain in main.jsx/Supabase; this only wires the mobile navigation.
if (typeof window !== "undefined") {
  const getDrawer = () => document.querySelector(".mobile-drawer");
  const getScrim = () => document.querySelector(".mobile-scrim");

  const toggleDrawer = (open) => {
    const drawer = getDrawer();
    const scrim = getScrim();
    if (!drawer) return;
    const shouldOpen = typeof open === "boolean" ? open : !drawer.classList.contains("is-open");
    drawer.classList.toggle("is-open", shouldOpen);
    if (scrim) scrim.classList.toggle("is-open", shouldOpen);
    drawer.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
    document.body.classList.toggle("owner-drawer-open", shouldOpen);
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest(".owner-menu-button")) {
      event.preventDefault();
      requestAnimationFrame(() => toggleDrawer(true));
      return;
    }

    if (target.closest(".drawer-close") || target.closest(".mobile-scrim")) {
      event.preventDefault();
      toggleDrawer(false);
    }
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggleDrawer(false);
  });

  const observer = new MutationObserver(() => {
    const drawer = getDrawer();
    const scrim = getScrim();
    if (!drawer) {
      document.body.classList.remove("owner-drawer-open");
      return;
    }
    // React mounts the drawer from state; apply the visual open state after mount.
    if (!drawer.classList.contains("is-open") && !drawer.getAttribute("aria-hidden")) {
      drawer.classList.add("is-open");
      if (scrim) scrim.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      document.body.classList.add("owner-drawer-open");
    }
  });

  observer.observe(document.documentElement, {subtree:true, childList:true});
}
