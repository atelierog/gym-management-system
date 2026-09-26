/* Gym Manager — mobile owner navigation hardening
 * Keeps navigation outside the React content stacking context so the drawer
 * always opens from the viewport edge and stays above the owner dashboard.
 */
(() => {
  const STYLE_ID = "gm-owner-navigation-fix-style";
  const DRAWER_ID = "gm-owner-native-drawer";
  const SCRIM_ID = "gm-owner-native-scrim";
  const ITEMS = [
    ["OVERVIEW", [["Dashboard", "Dashboard"]]],
    ["PEOPLE", [["Members", "Members"], ["Trainers", "Trainers"]]],
    ["OPERATIONS", [["Attendance", "Attendance"], ["Memberships", "Memberships"], ["Payments", "Payments"], ["Dues", "Dues"]]],
    ["SYSTEM", [["Settings", "Settings"]]]
  ];

  function isOwner() {
    return !!document.querySelector(".admin-app .owner-topbar");
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* Hide the React drawer: it lives inside the main content stacking context. */
      .admin-app > .admin-main > .mobile-drawer,
      .admin-app > .admin-main > .mobile-scrim { display:none!important; }
      #${SCRIM_ID}{position:fixed;inset:0;z-index:2147483000;background:rgba(16,24,40,.58);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .18s ease}
      #${SCRIM_ID}.is-open{opacity:1;pointer-events:auto}
      #${DRAWER_ID}{position:fixed;inset:0 auto 0 0;z-index:2147483001;width:min(340px,88vw);height:100dvh;box-sizing:border-box;background:#0b1220;color:#fff;border:1px solid #29364a;border-left:0;border-radius:0 22px 22px 0;box-shadow:20px 0 70px rgba(0,0,0,.52);display:flex;flex-direction:column;overflow:hidden;transform:translateX(-110%);transition:transform .22s cubic-bezier(.2,.8,.2,1);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #${DRAWER_ID}.is-open{transform:translateX(0)}
      #${DRAWER_ID} .gm-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px;border-bottom:1px solid #29364a;flex:none;background:#0b1220}
      #${DRAWER_ID} .gm-drawer-brand{display:flex;align-items:center;gap:9px;border:0;background:transparent;color:#fff;padding:0;text-align:left;cursor:pointer}
      #${DRAWER_ID} .gm-brand-mark{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:#d5a343;color:#17120a;font-size:9px;font-weight:900;letter-spacing:.4px;flex:none}
      #${DRAWER_ID} .gm-drawer-brand b{font-size:13px;line-height:1;font-weight:750}
      #${DRAWER_ID} .gm-drawer-brand small{display:block;color:#8995a7;font-size:9px;margin-top:3px}
      #${DRAWER_ID} .gm-drawer-close{width:36px;height:36px;border:1px solid #344054;border-radius:10px;background:#ffffff08;color:#fff;font-size:21px;line-height:1;display:grid;place-items:center;cursor:pointer;flex:none}
      #${DRAWER_ID} .gm-drawer-nav{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:12px 14px 14px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
      #${DRAWER_ID} .gm-nav-group{margin-top:15px}
      #${DRAWER_ID} .gm-nav-group:first-child{margin-top:0}
      #${DRAWER_ID} .gm-nav-label{display:block;margin:0 8px 6px;color:#78869b;font-size:9px;letter-spacing:1.5px;font-weight:800}
      #${DRAWER_ID} .gm-nav-item{display:flex;align-items:center;gap:10px;width:100%;padding:12px 10px;border:0;border-radius:11px;background:transparent;color:#b8c2d0;text-align:left;cursor:pointer;font-size:13px;line-height:1.2}
      #${DRAWER_ID} .gm-nav-item:hover,#${DRAWER_ID} .gm-nav-item:active{background:#ffffff12;color:#fff}
      #${DRAWER_ID} .gm-nav-icon{width:19px;height:19px;flex:none;color:currentColor}
      #${DRAWER_ID} .gm-drawer-footer{border-top:1px solid #29364a;padding:8px 14px 12px;flex:none;background:#0b1220}
      #${DRAWER_ID} .gm-footer-item{display:block;width:100%;padding:12px 8px;border:0;border-radius:9px;background:transparent;color:#b8c2d0;text-align:left;cursor:pointer;font-size:13px}
      #${DRAWER_ID} .gm-footer-item:hover,#${DRAWER_ID} .gm-footer-item:active{background:#ffffff08;color:#fff}
      body.gm-owner-menu-open{overflow:hidden}
      @media(max-width:700px){#${DRAWER_ID}{width:min(340px,90vw);border-radius:0 20px 20px 0}#${DRAWER_ID} .gm-drawer-head{padding-top:max(14px,env(safe-area-inset-top));}}
    `;
    document.head.appendChild(style);
  }

  const paths = {
    Dashboard: "M3 12l9-8 9 8v8a2 2 0 01-2 2h-4v-6H9v6H5a2 2 0 01-2-2z",
    Members: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    Trainers: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8",
    Attendance: "M4 4h16v16H4zM8 12l2.5 2.5L16 9",
    Memberships: "M3 7h18M5 7V5h14v2M5 7v12h14V7M9 11h6",
    Payments: "M3 6h18v12H3zM3 10h18M7 15h3",
    Dues: "M5 5h14v14H5zM8 12h8",
    Settings: "M12 8a4 4 0 100 8 4 4 0 000-8zM4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M2 12h2M20 12h2M12 2v2M12 20v2"
  };

  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.className.baseVal = "gm-nav-icon";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", paths[name] || paths.Dashboard);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  function findReactNav(label) {
    return [...document.querySelectorAll(".admin-app .mobile-drawer .nav-item")]
      .find(button => String(button.textContent || "").trim() === label);
  }

  function findReactFooter(label) {
    return [...document.querySelectorAll(".admin-app .mobile-drawer .sidebar-link")]
      .find(button => String(button.textContent || "").trim() === label);
  }

  function close() {
    const drawer = document.getElementById(DRAWER_ID);
    const scrim = document.getElementById(SCRIM_ID);
    drawer?.classList.remove("is-open");
    scrim?.classList.remove("is-open");
    document.body.classList.remove("gm-owner-menu-open");
  }

  function activate(label) {
    const button = findReactNav(label);
    if (button) {
      button.click();
      close();
      return;
    }
    if (label === "Account security" || label === "Sign out") {
      const button2 = findReactFooter(label);
      button2?.click();
      close();
    }
  }

  function buildDrawer() {
    if (document.getElementById(DRAWER_ID)) return document.getElementById(DRAWER_ID);
    const scrim = document.createElement("div");
    scrim.id = SCRIM_ID;
    scrim.addEventListener("click", close);
    const drawer = document.createElement("aside");
    drawer.id = DRAWER_ID;
    drawer.setAttribute("aria-label", "Gym Manager navigation");

    const head = document.createElement("div");
    head.className = "gm-drawer-head";
    const brand = document.createElement("button");
    brand.className = "gm-drawer-brand";
    brand.type = "button";
    const mark = document.createElement("span");
    mark.className = "gm-brand-mark";
    mark.textContent = "AOG";
    const copy = document.createElement("span");
    const title = document.createElement("b");
    title.textContent = "Gym Manager";
    const subtitle = document.createElement("small");
    subtitle.textContent = "Owner portal";
    copy.append(title, subtitle);
    brand.append(mark, copy);
    brand.addEventListener("click", () => activate("Dashboard"));
    const closeButton = document.createElement("button");
    closeButton.className = "gm-drawer-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close menu");
    closeButton.textContent = "×";
    closeButton.addEventListener("click", close);
    head.append(brand, closeButton);

    const nav = document.createElement("nav");
    nav.className = "gm-drawer-nav";
    ITEMS.forEach(([group, items]) => {
      const section = document.createElement("div");
      section.className = "gm-nav-group";
      const label = document.createElement("span");
      label.className = "gm-nav-label";
      label.textContent = group;
      section.appendChild(label);
      items.forEach(([text, target]) => {
        const button = document.createElement("button");
        button.className = "gm-nav-item";
        button.type = "button";
        button.append(icon(target), document.createTextNode(text));
        button.addEventListener("click", () => activate(target));
        section.appendChild(button);
      });
      nav.appendChild(section);
    });

    const footer = document.createElement("div");
    footer.className = "gm-drawer-footer";
    ["Account security", "Sign out"].forEach(text => {
      const button = document.createElement("button");
      button.className = "gm-footer-item";
      button.type = "button";
      button.textContent = text;
      button.addEventListener("click", () => activate(text));
      footer.appendChild(button);
    });

    drawer.append(head, nav, footer);
    document.body.append(scrim, drawer);
    return drawer;
  }

  function open() {
    if (!isOwner()) return;
    installStyle();
    const drawer = buildDrawer();
    requestAnimationFrame(() => {
      drawer.classList.add("is-open");
      document.getElementById(SCRIM_ID)?.classList.add("is-open");
      document.body.classList.add("gm-owner-menu-open");
    });
  }

  function bind() {
    if (!isOwner()) return;
    installStyle();
    const menu = document.querySelector(".admin-app .owner-menu-button");
    if (menu && menu.dataset.gmNativeBound !== "1") {
      menu.dataset.gmNativeBound = "1";
      menu.addEventListener("click", () => setTimeout(open, 0));
    }
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") close();
  });

  const observer = new MutationObserver(bind);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();
