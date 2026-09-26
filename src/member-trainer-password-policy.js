import { supabase } from "./lib/supabase.js";

/* Member + Trainer password policy.
 * Gym Owner/Admin keeps the normal password policy.
 * Member/Trainer permanent passwords are intentionally short and mobile-friendly.
 */
const SHORT_MIN = 6;
let allowed = false;
let ready = false;

async function loadRole() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    allowed = profile?.role === "member" || profile?.role === "trainer";
  } catch {}
  ready = true;
  apply();
}

function applyGate(gate) {
  if (!allowed || !gate) return;
  const form = gate.querySelector("form");
  if (!form) return;
  form.querySelectorAll('input[type="password"]').forEach(input => {
    input.minLength = SHORT_MIN;
    input.removeAttribute("minlength");
    input.setAttribute("minlength", String(SHORT_MIN));
    input.setAttribute("autocomplete", "new-password");
  });

  const help = gate.querySelector("p");
  if (help && !help.dataset.shortPasswordCopy) {
    help.textContent = "Choose a short password you can easily remember. Minimum 6 characters.";
    help.dataset.shortPasswordCopy = "1";
  }

  const note = gate.querySelector(".gm-short-password-note");
  if (!note) {
    const el = document.createElement("div");
    el.className = "gm-short-password-note";
    el.textContent = "Member & Trainer password · 6 characters minimum";
    el.style.cssText = "margin:8px 0 12px;color:#667085;font-size:12px;font-weight:600;";
    form.prepend(el);
  }
}

function apply() {
  if (!ready || !allowed) return;
  document.querySelectorAll(".password-gate").forEach(applyGate);
}

const observer = new MutationObserver(apply);
observer.observe(document.documentElement, { childList: true, subtree: true });

loadRole();
