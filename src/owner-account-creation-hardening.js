import { supabase } from "./lib/supabase.js";

/*
 * Gym Manager — Owner Portal account-creation hardening.
 *
 * This is intentionally small and temporary while the Owner Portal is being
 * consolidated. It makes the UI use the same transactional ID allocator as
 * admin-create-user and enforces the Owner Portal's required contact fields.
 */

function nativeSetValue(input, value) {
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, String(value));
  else input.value = String(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function roleForForm(form) {
  const title = String(form.closest(".modal")?.querySelector(".modal-head h3")?.textContent || "").toLowerCase();
  if (/trainer/.test(title)) return "trainer";
  if (/member/.test(title)) return "member";
  return null;
}

function makeIdHint(input) {
  if (!input?.parentElement || input.parentElement.querySelector(".gm-account-id-hint")) return;
  const hint = document.createElement("small");
  hint.className = "gm-account-id-hint";
  hint.textContent = "Generated automatically and reserved safely for this registration.";
  hint.style.cssText = "display:block;margin-top:4px;color:#98a2b3;font-size:10px;line-height:1.35;";
  input.parentElement.appendChild(hint);
}

async function prepareForm(form) {
  if (!form || form.dataset.gmAccountPrepared === "1") return;
  const role = roleForForm(form);
  if (!role) return;

  form.dataset.gmAccountPrepared = "1";

  const email = form.querySelector('input[name="email"]');
  const phone = form.querySelector('input[name="phone"]');
  const loginId = form.querySelector('input[name="login_id"]');

  // Owner Portal contract: contact details are required for both account types.
  if (email) {
    email.required = true;
    email.setAttribute("aria-required", "true");
    email.setAttribute("autocomplete", "email");
    email.placeholder = "name@example.com";
  }
  if (phone) {
    phone.required = true;
    phone.setAttribute("aria-required", "true");
    phone.setAttribute("autocomplete", "tel");
  }

  if (!loginId) return;

  loginId.required = false;
  loginId.readOnly = true;
  loginId.classList.add("auto-id-field");
  loginId.setAttribute("aria-label", `Automatically generated ${role} ID`);
  loginId.setAttribute("autocomplete", "off");
  makeIdHint(loginId);

  try {
    const { data, error } = await supabase.rpc("allocate_login_id", { p_role: role });
    if (!error && data) {
      nativeSetValue(loginId, data);
      loginId.dataset.gmAllocatedId = String(data);
    }
  } catch {}
}

function scan() {
  document.querySelectorAll(".admin-app .modal form.form").forEach(form => {
    prepareForm(form);
  });
}

const observer = new MutationObserver(() => setTimeout(scan, 0));
observer.observe(document.documentElement, { childList: true, subtree: true });
scan();
