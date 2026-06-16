// mirror.js — observe-and-reflect.
//
// Our icon mirrors the field's live masked state. If the site has its own
// control and the user clicks it, we observe the change and update our icon —
// graceful coexistence, no desync, and it removes most of the need to detect
// the site's control at all.
(() => {
  const RP = (window.RP = window.RP || {});
  const observers = new WeakMap();

  RP.startMirror = (field, btn) => {
    RP.syncButton(btn, RP.isRevealed(field)); // reflect initial state

    const obs = new MutationObserver(() => {
      if (field.dataset.rpFlipping === "1") return; // ignore our own fallback flip
      RP.syncButton(btn, RP.isRevealed(field));
    });
    // `type` catches a site toggling its own control; `style`/`class` catch
    // CSS-driven reveals. Our own writes don't loop: syncButton never mutates
    // the field, it only updates the button.
    obs.observe(field, {
      attributes: true,
      attributeFilter: ["type", "style", "class"],
    });
    observers.set(field, obs);
  };

  RP.stopMirror = (field) => {
    observers.get(field)?.disconnect();
    observers.delete(field);
  };
})();
