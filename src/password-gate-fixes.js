const GATE_SELECTOR = ".password-gate";

function hardenPasswordFields(gate) {
  if (!gate || gate.dataset.passwordGateFixed === "1") return;
  gate.dataset.passwordGateFixed = "1";

  const paragraph = gate.querySelector("p");
  if (paragraph) {
    paragraph.textContent = "Your Gym Manager account was created or reset with a temporary password. Create your private password to continue.";
  }

  const form = gate.querySelector("form");
  const fields = form ? Array.from(form.querySelectorAll('input[type="password"]')) : [];
  fields.forEach((input, index) => {
    input.setAttribute("autocomplete", "new-password");
    input.setAttribute("data-lpignore", "true");
    input.setAttribute("data-1p-ignore", "true");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("autocapitalize", "none");

    // Prevent browser/password-manager autofill from putting the temporary
    // password into only the first field and causing a false mismatch.
    input.readOnly = true;
    input.addEventListener("focus", () => {
      input.readOnly = false;
    }, { once: true });

    // Never carry a browser-injected value into the new-password form.
    if (index === 0 && input.value) input.value = "";
  });
}

function check(root = document) {
  const gate = root.querySelector?.(GATE_SELECTOR);
  if (gate) hardenPasswordFields(gate);
  return Boolean(gate);
}

const observer = new MutationObserver(() => {
  const gateVisible = check(document);
  if (gateVisible) {
    const splash = document.getElementById("boot-splash");
    if (splash) {
      splash.classList.add("is-done");
      setTimeout(() => splash.remove(), 250);
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
check(document);
