# Findings

Empirical results from de-risking spikes. Read before changing the reveal mechanism.

## Phase 0 — the `-webkit-text-security` reveal does NOT work on Chrome/Edge

**Status: ruled out as the primary mechanism (2026-06-15), verified in a live Chromium engine via `test/harness.html`.**

The handover's preferred crux was to reveal a password field with
`-webkit-text-security: none` so we'd never touch `type` or `.value`. Tested directly:

| Input | default computed `-webkit-text-security` | after setting `none !important` |
|-------|------------------------------------------|----------------------------------|
| `type=password` | `disc` | **`disc`** (unchanged — still masked) |
| `type=text` | `none` | n/a; setting `disc` → `disc` (works) |

So the property is fully functional on text inputs, but **cannot un-mask a
`type=password` field**: Blink applies password masking with an effective UA
`!important`, and UA-important outranks author-important in the cascade. Our
inline `none !important` loses. Computed stays `disc`; the field stays masked.

`CSS.supports('-webkit-text-security','disc')` returns `true` on Chrome (the
property is *recognized*), which makes it a **false positive** for feature
detection. We instead use a functional probe in `reveal.js` that appends a real
password input, attempts the reveal, and checks the computed result.

### Consequence
On Chrome/Edge (our v1 targets) the primary mechanism is a **guarded type-toggle**
(`type` password↔text). This is *not* the prototype's bug source: that bug came
from the cut mirror feature writing stale `.value` during render storms plus a
leaky `activeElement` guard. Toggling `type` preserves `.value`; we never write
`.value`; the guard never reads `activeElement`. Regression-tested: a 40-char
password typed char-by-char survives reveal/mask intact (see harness).

The CSS path is retained for any engine where the functional probe passes
(Firefox/Safari behave differently and are out of v1 scope).

### Verified working in the spike
- Reveal actually unmasks (type→text); mask restores (type→password); `.value` byte-identical throughout.
- Overlay button anchored by viewport rect: correct inside plain fields, RTL (icon flips left), and **open shadow-DOM** fields.
- Mirror observer syncs `aria-pressed`/label after the type change.

### Open polish (Phase 1)
- A field with a pre-existing trailing icon: ours currently overlaps it; should detect and offset further in.
