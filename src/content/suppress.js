// suppress.js — high-confidence collision suppression.
//
// Policy (from the handover): NEVER gate injection on detection. Default to
// injecting. Suppress ONLY when we're highly confident the field already has a
// working reveal control — because the two errors are asymmetric: a duplicate
// icon is a minor wart, but suppressing a field that actually needed us is a
// silent failure on exactly the sites we exist for.
//
// "High confidence" = a nearby interactive element whose accessible name says,
// in plain language, that it toggles password visibility. Icon-only controls
// with no accessible name are deliberately NOT enough to suppress — we'd rather
// show a possibly-redundant icon than skip a field.
(() => {
  const RP = (window.RP = window.RP || {});

  const accName = (el) =>
    [
      el.getAttribute("aria-label"),
      el.getAttribute("title"),
      el.getAttribute("alt"),
      el.value,
      // text content, but only if it's short (a real label, not a paragraph)
      el.textContent && el.textContent.length < 40 ? el.textContent : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  const TOGGLE = /\b(show|hide|reveal|unmask|mask|view|toggle|display)\b/;
  const SECRET = /\b(password|passcode|pwd|pword|pass)\b/;

  const looksLikeRevealControl = (el) => {
    const name = accName(el);
    if (TOGGLE.test(name) && SECRET.test(name)) return true;
    // a checkbox whose <label> says "show password"
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      const lbl = (el.labels?.[0]?.textContent || "").toLowerCase();
      if (TOGGLE.test(lbl) && SECRET.test(lbl)) return true;
    }
    return false;
  };

  RP.hasOwnRevealControl = (field) => {
    const fr = field.getBoundingClientRect();
    // Search a few ancestors up — a reveal control usually lives in the field's
    // own wrapper, not across the whole form.
    let scope = field;
    for (let depth = 0; depth < 3 && (scope = scope.parentElement); depth++) {
      const cands = scope.querySelectorAll(
        'button, [role="button"], a[href], input[type="checkbox"], label'
      );
      for (const c of cands) {
        if (c === field || c.contains(field)) continue;
        // Must be physically near THIS field, not some other password row.
        const cr = c.getBoundingClientRect();
        const near =
          cr.left < fr.right + 12 &&
          cr.right > fr.left - 12 &&
          cr.top < fr.bottom + 12 &&
          cr.bottom > fr.top - 12;
        if (!near) continue;
        if (looksLikeRevealControl(c)) return true;
      }
    }
    return false;
  };
})();
