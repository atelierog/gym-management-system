import { supabase } from "./lib/supabase.js";

/*
 * Gym Manager — role-aware password contract.
 *
 * Member/Trainer permanent passwords:
 *   - minimum 6 characters
 *   - no forced special-character/complexity rule
 *
 * Gym Owner/Admin keeps the existing stronger policy.
 *
 * Temporary Member/Trainer passwords remain system-generated and strong
 * enough for the admin-create-user/admin-reset-user-password Edge Functions.
 */
const SHORT_MIN = 6;
const TEMP_LEN = 8;

let role = null;
let ready = false;

function isMemberTrainer() {
  return role === "member" || role === "trainer";
}

async function loadRole() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role || null;
  } catch {}
  ready = true;
  applyAll();
}

function nativeSetValue(input, value) {
  if (!input) return;
  const proto = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(input, String(value));
  else input.value = String(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function randomInt(max) {
  const bytes = new Uint32Array(1);
  try {
    crypto.getRandomValues(bytes);
    return bytes[0] % max;
  } catch {
    return Math.floor(Math.random() * max);
  }
}

function shuffle(values) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function randomTempPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%";
  const all = upper + lower + digits + special;
  const chars = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    special[randomInt(special.length)]
  ];
  while (chars.length < TEMP_LEN) chars.push(all[randomInt(all.length)]);
  return shuffle(chars).join("");
}

function isStrongTemporaryPassword(value) {
  const s = String(value || "");
  return s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s);
}

function isCreateMemberOrTrainerForm(form) {
  const modal = form?.closest?.(".modal");
  if (!modal) return false;
  const title = String(modal.querySelector(".modal-head h3")?.textContent || "").trim().toLowerCase();
  return /register member|add member|add trainer|register trainer|create trainer|create member/.test(title);
}

function repairTemporaryPassword(form) {
  if (!form || !isCreateMemberOrTrainerForm(form)) return;
  const input = form.querySelector('input[name="password"]');
  if (!input) return;

  // owner-fixes.js currently creates an 8-character value without a special
  // character. Replace only values that do not satisfy the server contract.
  // This keeps the password system-generated; the owner never types it.
  if (!isStrongTemporaryPassword(input.value)) {
    nativeSetValue(input, randomTempPassword());
  }
  input.readOnly = true;
  input.minLength = TEMP_LEN;
  input.setAttribute("autocomplete", "new-password");
  input.setAttribute("aria-label", "Automatically generated temporary password");

  const label = input.closest("label");
  if (label) {
    const text = [...label.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
    if (text) text.textContent = "Temporary password";
  }
}

function applyGate(gate) {
  if (!ready || !isMemberTrainer() || !gate) return;
  const form = gate.querySelector("form");
  if (!form) return;

  form.querySelectorAll('input[type="password"]').forEach(input => {
    input.minLength = SHORT_MIN;
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

function setGateMessage(gate, message, error = false) {
  let box = gate.querySelector(".gm-password-policy-message");
  if (!box) {
    box = document.createElement("div");
    box.className = "gm-password-policy-message";
    const form = gate.querySelector("form");
    form?.prepend(box);
  }
  box.textContent = message;
  box.style.cssText = `margin:8px 0 12px;padding:10px 12px;border-radius:10px;font-size:12px;font-weight:650;${error ? "background:#fff1f3;color:#8f1639;border:1px solid #f3c2cc;" : "background:#ecfdf3;color:#067647;border:1px solid #abefc6;"}`;
}

async function completeShortPasswordChange(gate, form) {
  const fields = [...form.querySelectorAll('input[type="password"]')];
  const password = fields[0]?.value || "";
  const confirm = fields[1]?.value || "";

  if (password.length < SHORT_MIN) {
    setGateMessage(gate, `Password must be at least ${SHORT_MIN} characters.`, true);
    return;
  }
  if (password !== confirm) {
    setGateMessage(gate, "Passwords do not match.", true);
    return;
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    setGateMessage(gate, error.message || "Could not update your password.", true);
    return;
  }

  const { error: completeError } = await supabase.functions.invoke("complete-password-change", { body: {} });
  if (completeError) {
    setGateMessage(gate, completeError.message || "Password changed, but the first-login step could not be completed.", true);
    return;
  }

  setGateMessage(gate, "Password changed successfully. Opening Gym Manager…");
  setTimeout(() => window.location.reload(), 450);
}

function installSubmitBridge() {
  document.addEventListener("submit", event => {
    if (!ready || !isMemberTrainer()) return;
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    const gate = form?.closest?.(".password-gate");
    if (!gate) return;

    const fields = [...form.querySelectorAll('input[type="password"]')];
    const password = fields[0]?.value || "";

    // For 6–7 character member/trainer passwords, bypass the old 8-character
    // React validation and use the same Supabase/Auth completion path directly.
    // 8+ character passwords continue through the existing application flow.
    if (password.length >= SHORT_MIN && password.length < 8) {
      event.preventDefault();
      event.stopImmediatePropagation();
      completeShortPasswordChange(gate, form).catch(error => {
        setGateMessage(gate, error?.message || "Could not update your password.", true);
      });
    }
  }, true);
}

function applyAll() {
  if (!ready) return;
  if (isMemberTrainer()) {
    document.querySelectorAll(".password-gate").forEach(applyGate);
  }
  if (isOwnerPortal()) {
    document.querySelectorAll(".admin-app .modal form.form").forEach(repairTemporaryPassword);
  }
}

function isOwnerPortal() {
  return !!document.querySelector(".admin-app");
}

const observer = new MutationObserver(() => {
  // Run after the other Owner Portal repair observers so the server-compliant
  // generated temporary password wins if another repair layer touched the form.
  setTimeout(applyAll, 0);
});

observer.observe(document.documentElement, { childList: true, subtree: true });
installSubmitBridge();
loadRole();
