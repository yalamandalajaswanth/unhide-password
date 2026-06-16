# Reveal — show password where sites won't let you

A Manifest V3 browser extension (Chrome/Edge) that adds an accessible show/hide
toggle to password fields on sites that don't provide one — Workday, many banks,
and enterprise SaaS being the motivating offenders.

One job, done carefully:

- **Default masked.** Reveal is always user-initiated.
- **Never writes `.value`.** Revealing can't corrupt or shrink your typed password.
- **Observe-and-reflect.** If a site has its own control, our icon mirrors the
  field's live state instead of fighting it.
- **Works on hard sites.** Shadow-DOM web components (Workday-class apps) and
  SPA-injected fields are first-class targets, not afterthoughts.
- **Local-only.** Zero network, zero telemetry, no remote code.

This is a learning/portfolio project. The interesting part isn't "show password"
(the Web Store has a dozen) — it's doing it *correctly* on the sites where the
naive `type`-toggle extensions break.

## Status

Early. Phase 0 (the technical crux) is done and de-risked — see
[FINDINGS.md](FINDINGS.md). Remaining work is tracked in the phase plan.

## How the reveal works (and the one surprise)

The plan was to reveal via CSS (`-webkit-text-security: none`) and never touch
`type`. **Phase 0 testing proved that doesn't work on Chrome/Edge** — the UA
masks password inputs with a precedence our CSS can't beat. So the primary
mechanism is a **guarded type-toggle** that still never writes `.value`. Full
write-up in [FINDINGS.md](FINDINGS.md).

## Try the spike (no install)

```sh
cd unhide-password
python3 -m http.server 8753
# open http://localhost:8753/test/harness.html
```

The harness loads the content scripts directly and runs the crux self-check
(visible in the black log strip at the bottom). It covers plain + confirm
fields, a field with a pre-existing icon, RTL, SPA-injected fields, and an open
shadow root.

## Load as an extension

`chrome://extensions` → enable Developer mode → **Load unpacked** → select the
`unhide-password/` folder.

## Architecture

```
src/content/
  field.js    is-this-a-real-visible-password-field heuristic (no per-site lists)
  reveal.js   the crux: functional probe + guarded type-toggle (+ CSS path where it works)
  mirror.js   observe-and-reflect: icon follows the field's live masked state
  overlay.js  fixed layer; accessible <button> anchored by viewport rect
  index.js    shadow-DOM-aware discovery + debounced SPA observer
```

## Non-goals (deliberately cut)

- Auto-mirroring into confirm fields (defeats the confirm field's purpose).
- Stripping client-side validation (security-negative, and a store-review liability).
- Any always-on global unmasking. Reveal is user-initiated, always.
