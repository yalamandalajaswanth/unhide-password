// field.js — "is this a real, visible, user-facing password field?"
//
// Deliberately a general heuristic. No password-manager-specific attributes,
// no per-site database — the prototype hardcoded Bitwarden/1Password selectors
// and that was removed as brittle and unmaintainable.
(() => {
  const RP = (window.RP = window.RP || {});

  // A field we attach to is either a live password input, or one our type-toggle
  // fallback has temporarily flipped to text (marked with data-rp-origin).
  RP.isPasswordField = (el) =>
    el instanceof HTMLInputElement &&
    (el.type === "password" || el.dataset.rpOrigin === "password");

  // Visible + interactive enough that a human would actually type into it.
  RP.isUsable = (el) => {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.closest('[aria-hidden="true"]')) return false;

    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false; // zero-size / sliver / off-layout

    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0")
      return false;

    return true;
  };
})();
