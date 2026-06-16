// overlay.js — put an accessible control on an input we don't own.
//
// Inputs can't have children, so we anchor an absolutely-positioned <button> by
// the field's viewport rect inside one fixed-position layer. Anchoring by rect
// (not DOM nesting) sidesteps overflow clipping AND shadow DOM in one move:
// getBoundingClientRect reports viewport coords across shadow boundaries.
(() => {
  const RP = (window.RP = window.RP || {});
  const Z = 2147483647;
  const PAD = 30; // right-padding so masked text can't run under the icon

  const icons = {
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.6 10.6 0 0 1 12 19c-6.5 0-10-7-10-7a18.4 18.4 0 0 1 5.06-5.94M9.9 4.24A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></svg>',
  };

  const tracked = new Map(); // field -> button
  let layer = null;

  // Positioning: a requestAnimationFrame loop GATED by visibility. The loop runs
  // only while at least one tracked field is on screen, and fully stops when
  // none are — so it's drift-free under any layout shift without burning CPU in
  // background/scrolled-away tabs. (Event-driven repositioning missed layout
  // shifts that fired no scroll/resize, which is what made the icon drift.)
  const visible = new Set(); // fields currently intersecting the viewport
  let io = null; // IntersectionObserver gating the loop
  let rafId = 0;

  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement("div");
    layer.className = "rp-layer";
    Object.assign(layer.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "0",
      height: "0",
      zIndex: String(Z),
      pointerEvents: "none",
    });
    (document.body || document.documentElement).appendChild(layer);
    return layer;
  }

  function makeButton(field) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rp-toggle";
    btn.tabIndex = 0;
    btn.style.pointerEvents = "auto";
    // mousedown default would steal focus from the field; prevent it.
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      RP.toggle(field, btn);
    });
    return btn;
  }

  // Width (px) of any non-reveal control already sitting in the field's trailing
  // inner edge (a clear "×", a validation tick, etc.). We offset our icon to its
  // left rather than stacking on top of it. (A trailing control that IS a reveal
  // toggle gets the field SUPPRESSED upstream, so it never reaches here.)
  function trailingObstacle(field) {
    const fr = field.getBoundingClientRect();
    const rtl = getComputedStyle(field).direction === "rtl";
    let edge = 0; // how far in from the trailing edge the obstacle reaches
    const scope = field.parentElement;
    if (!scope) return 0;
    for (const el of scope.querySelectorAll("*")) {
      if (el === field || el.classList.contains("rp-toggle")) continue;
      if (el.querySelector("input")) continue; // skip wrappers, want leaf controls
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.width > fr.width * 0.6) continue;
      const vOverlap = r.top < fr.bottom - 4 && r.bottom > fr.top + 4;
      if (!vOverlap) continue;
      // Is it in the trailing third of the field?
      const inTrailing = rtl
        ? r.left < fr.left + fr.width * 0.33
        : r.right > fr.right - fr.width * 0.33;
      if (!inTrailing) continue;
      const reach = rtl ? r.right - fr.left : fr.right - r.left;
      edge = Math.max(edge, reach);
    }
    return Math.min(edge, fr.width * 0.5);
  }

  // --- field padding (restored on teardown) --------------------------------
  function padField(field) {
    const cs = getComputedStyle(field);
    const side = cs.direction === "rtl" ? "paddingLeft" : "paddingRight";
    const need = PAD + (Number(field.dataset.rpInset) || 0);
    if ((parseFloat(cs[side]) || 0) >= need) return; // already roomy enough
    field.dataset.rpPadSide = side;
    field.dataset.rpPadOrig = field.style[side] || "";
    field.style[side] = need + "px";
  }
  function unpadField(field) {
    const side = field.dataset.rpPadSide;
    if (side) field.style[side] = field.dataset.rpPadOrig || "";
    delete field.dataset.rpPadSide;
    delete field.dataset.rpPadOrig;
  }

  function position(field, btn) {
    const r = field.getBoundingClientRect();
    const offscreen =
      r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth;
    if (!RP.isUsable(field) || offscreen) {
      btn.style.display = "none";
      return;
    }
    btn.style.display = "";
    const cs = getComputedStyle(field);
    const size = Math.min(Math.max(r.height - 8, 16), 28);
    const rtl = cs.direction === "rtl";
    const inset = (Number(field.dataset.rpInset) || 0) + 6; // clear any trailing control
    Object.assign(btn.style, {
      position: "absolute",
      width: size + "px",
      height: size + "px",
      top: r.top + (r.height - size) / 2 + "px",
      left: (rtl ? r.left + inset : r.right - size - inset) + "px",
      borderRadius: cs.borderRadius,
    });
  }

  function loop() {
    for (const field of visible) {
      if (!field.isConnected) {
        RP.detach(field);
        continue;
      }
      position(field, tracked.get(field));
    }
    rafId = visible.size ? requestAnimationFrame(loop) : 0;
  }
  function ensureLoop() {
    if (!rafId && visible.size) rafId = requestAnimationFrame(loop);
  }

  function startObserver() {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else {
          visible.delete(e.target);
          const b = tracked.get(e.target);
          if (b) b.style.display = "none";
        }
      }
      ensureLoop();
    });
  }
  function stopObserver() {
    io?.disconnect();
    io = null;
    visible.clear();
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // --- public API ----------------------------------------------------------
  RP.syncButton = (btn, revealed) => {
    btn.setAttribute("aria-pressed", String(revealed));
    btn.setAttribute("aria-label", revealed ? "Hide password" : "Show password");
    btn.title = revealed ? "Hide password" : "Show password";
    btn.innerHTML = revealed ? icons.eyeOff : icons.eye;
  };

  RP.toggle = (field, btn) => {
    const nowRevealed = !RP.isRevealed(field);
    if (nowRevealed) RP.reveal(field);
    else RP.mask(field);
    RP.syncButton(btn, nowRevealed);
  };

  RP.attach = (field) => {
    if (tracked.has(field)) return;
    ensureLayer();
    const btn = makeButton(field);
    layer.appendChild(btn);
    tracked.set(field, btn);
    if (tracked.size === 1) startObserver();
    field.dataset.rpInset = String(Math.round(trailingObstacle(field)));
    padField(field);
    position(field, btn);
    io.observe(field);
    RP.startMirror(field, btn);
  };

  RP.detach = (field) => {
    const btn = tracked.get(field);
    if (!btn) return;
    btn.remove();
    tracked.delete(field);
    visible.delete(field);
    io?.unobserve(field);
    unpadField(field);
    delete field.dataset.rpInset;
    RP.mask(field); // leave the field as we found it: masked
    RP.stopMirror(field);
    if (tracked.size === 0) stopObserver();
  };

  RP.isTracked = (field) => tracked.has(field);
})();
