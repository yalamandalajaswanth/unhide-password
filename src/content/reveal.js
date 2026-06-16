// reveal.js — THE CRUX.
//
// Reveal a masked field without ever writing `.value`. We strongly prefer a
// CSS-only reveal (no `type` mutation) via `-webkit-text-security: none`...
// BUT Phase 0 testing proved that does NOT work on Chrome/Edge: a password
// input's masking is applied by the UA with `!important`, which outranks our
// author `!important`, so the computed value stays `disc` and the field stays
// masked. See test/harness.html and FINDINGS.md.
//
// So on Blink the primary mechanism is a *guarded type-toggle*. The prototype's
// character-eating bug did NOT come from toggling type — it came from the mirror
// feature writing stale `.value` during render storms, plus an activeElement
// guard that leaked. We cut mirroring, we never write `.value`, and toggling
// `type` preserves the value. The guard never reads document.activeElement.
//
// We keep the CSS path for any engine where it actually unmasks (detected by a
// real functional probe, not CSS.supports — which gives a false positive).
(() => {
  const RP = (window.RP = window.RP || {});

  // Functional probe: can text-security:none actually UNMASK a password input
  // on this engine? CSS.supports returns true even on Chrome (the property is
  // recognized) — useless here. We must observe the computed result.
  RP.supportsTextSecurity = (() => {
    try {
      const probe = document.createElement("input");
      probe.type = "password";
      probe.style.cssText = "position:fixed;left:-9999px;top:-9999px";
      (document.body || document.documentElement).appendChild(probe);
      probe.style.setProperty("-webkit-text-security", "none", "important");
      const works = getComputedStyle(probe).webkitTextSecurity === "none";
      probe.remove();
      return works;
    } catch {
      return false;
    }
  })();

  // --- primary path: CSS, no type/value mutation ---------------------------
  const cssReveal = (f) =>
    f.style.setProperty("-webkit-text-security", "none", "important");
  const cssMask = (f) => f.style.removeProperty("-webkit-text-security");

  // --- fallback path: guarded type-toggle ----------------------------------
  // The data-rp-flipping flag is cleared on a macrotask so the mirror observer's
  // microtask sees it set and ignores our own change. Never read activeElement.
  const flip = (f, type) => {
    f.dataset.rpOrigin = "password";
    f.dataset.rpFlipping = "1";
    try {
      f.type = type;
    } catch {
      f.setAttribute("type", type);
    }
    setTimeout(() => delete f.dataset.rpFlipping, 0);
  };
  const typeReveal = (f) => flip(f, "text");
  const typeMask = (f) => flip(f, "password");

  RP.reveal = (f) => (RP.supportsTextSecurity ? cssReveal(f) : typeReveal(f));
  RP.mask = (f) => (RP.supportsTextSecurity ? cssMask(f) : typeMask(f));

  // Is the field currently showing plaintext — by anyone's doing?
  // Revealed iff the site (or our fallback) flipped type off password, OR our
  // inline CSS reveal is present. We check our own inline style, not computed,
  // to avoid ambiguity about the UA default for password inputs.
  RP.isRevealed = (f) =>
    f.type !== "password" ||
    f.style.getPropertyValue("-webkit-text-security") === "none";
})();
