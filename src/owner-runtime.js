// Gym Manager Owner surface: small UI-only behavior layer.
// Backend operations remain in main.jsx/Supabase; this only wires the mobile navigation.
if (typeof window !== "undefined") {
  const toggleDrawer = (open) => {
    const drawer = document.querySelector(".mobile-drawer");
    const scrim = document.querySelector(".mobile-scrim");
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
      toggleDrawer();
      return;
    }
    if (target.closest(".drawer-close") || target.closest(".mobile-scrim")) {
      event.preventDefault();
      toggleDrawer(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggleDrawer(false);
  });
}
