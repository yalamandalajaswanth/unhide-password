// index.js — discovery + lifecycle.
//
// Never gate on detection: we always inject our control. (Suppression of a
// site's own working control is a later, conservative, high-confidence-only
// optimization — never the correctness gate.) Detection is the least reliable
// signal in the system, so we don't depend on it.
(() => {
  const RP = (window.RP = window.RP || {});

  const consider = (el) => {
    if (!RP.isPasswordField(el) || !RP.isUsable(el) || RP.isTracked(el)) return;
    if (el.dataset.rpSuppressed === "1") return; // already decided to stay out
    // High-confidence collision → stay out of the way entirely.
    if (RP.hasOwnRevealControl(el)) {
      el.dataset.rpSuppressed = "1";
      return;
    }
    RP.attach(el);
  };

  // Shadow-DOM-aware scan. Open roots only — closed roots are unreachable.
  // One walk: consider every element, and descend into any open shadow root.
  const scan = (root = document) => {
    root.querySelectorAll?.("*").forEach((el) => {
      consider(el);
      if (el.shadowRoot) scan(el.shadowRoot);
    });
  };

  scan();

  // Catch SPA-injected fields, debounced so a render storm can't become a
  // scan storm (the original prototype bug).
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      scan();
    }, 50);
  }).observe(document.documentElement, { childList: true, subtree: true });

  // A field can also become a password field after load (type set late).
  document.addEventListener("focusin", (e) => consider(e.target), true);
})();
