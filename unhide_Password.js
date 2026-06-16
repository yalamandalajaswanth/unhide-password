// ==UserScript==
// @name         Password Field Helper
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Always show password fields as text and auto-fill the confirm field. Paste- and Bitwarden-friendly.
// @author        you
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CONFIRM_HINTS = [
        'confirm', 'confirmation', 'repeat', 'reenter', 're-enter', 're_enter',
        'verify', 'retype', 're-type', 'again', 'match',
        'password2', 'pass2', 'pwd2', 'cpassword', 'cpwd',
        'confirmpassword', 'passwordconfirm'
    ];

    // ---- helpers ------------------------------------------------------------

    const fieldText = (el) =>
        `${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.autocomplete || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();

    const isConfirmField = (el) => CONFIRM_HINTS.some((h) => fieldText(el).includes(h));

    // Skip a password manager's injected UI so we don't fight Bitwarden/1Password.
    const isUsable = (el) => {
        if (!el || el.disabled) return false;
        if (el.closest('[data-bwignore],[data-bwautofill],[data-1p-ignore],[aria-hidden="true"]')) return false;
        return true;
    };

    const isPwField = (el) =>
        el.tagName === 'INPUT' && (el.type === 'password' || el.dataset.pwhRevealed === '1');

    // Set value in a way React/Vue/Angular notice.
    const setValue = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
        if (setter) setter.call(el, value); else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // ---- reveal (without eating keystrokes) ---------------------------------

    const reveal = (el) => {
        if (el.type === 'text') { el.dataset.pwhRevealed = '1'; return; }
        el.dataset.pwhRevealing = '1';
        try { el.type = 'text'; } catch (_) { el.setAttribute('type', 'text'); }
        el.dataset.pwhRevealed = '1';
        setTimeout(() => { delete el.dataset.pwhRevealing; }, 0); // ignore our own change
    };

    // Re-reveal ONLY if the site flips a field back to password, never while the
    // user is typing in it (that was eating characters), and never for our own change.
    const guardType = (el) => {
        if (el.dataset.pwhGuarded === '1') return;
        el.dataset.pwhGuarded = '1';
        new MutationObserver(() => {
            if (el.dataset.pwhRevealing === '1') return;     // our own flip
            if (document.activeElement === el) return;       // don't disturb typing
            if (el.getAttribute('type') === 'password') reveal(el);
        }).observe(el, { attributes: true, attributeFilter: ['type'] });
    };

    // ---- optional: let weak passwords through (delete this block if unwanted) -
    const stripRestrictions = (el) => {
        ['minlength', 'maxlength', 'pattern', 'required'].forEach((a) => el.removeAttribute(a));
        try { el.setCustomValidity(''); } catch (_) {}
    };

    // ---- mirror source -> confirm -------------------------------------------

    let mirroring = false;

    const collect = () => Array.from(document.querySelectorAll('input')).filter(isPwField).filter(isUsable);

    // The PRIMARY field is the one you type your password into: the first
    // password field that is NOT a confirm field.
    const getPrimary = (fields) => fields.find((f) => !isConfirmField(f)) || null;

    // Mirroring flows ONE way only: out of the field that fired the event, and
    // only when that field is the primary. We only ever WRITE into confirm
    // fields. Therefore the field you are typing in can never be a write target,
    // so it can never be shrunk or clobbered by this script.
    const mirror = (e) => {
        if (mirroring) return;
        const src = e && e.target;
        if (!src || !isPwField(src)) return;

        const fields = collect();
        const primary = getPrimary(fields);
        if (!primary || src !== primary) return;        // only mirror FROM the primary field

        const targets = fields.filter((t) => t !== primary && isConfirmField(t));
        if (!targets.length) return;                     // no confirm field -> never write anywhere

        mirroring = true;
        try {
            for (const t of targets) {
                if (t.matches && t.matches(':focus')) continue; // don't fight a confirm field you're editing
                if (t.value !== primary.value) setValue(t, primary.value);
            }
        } finally {
            mirroring = false;
        }
    };

    // ---- wiring -------------------------------------------------------------

    const wireField = (el) => {
        if (!isUsable(el)) return;
        stripRestrictions(el);
        reveal(el);
        guardType(el);
        if (el.dataset.pwhWired === '1') return;
        el.dataset.pwhWired = '1';
        el.addEventListener('input', mirror);   // fires on typing AND paste
    };

    const wireUp = () => collect().forEach(wireField);
    // NOTE: wireUp does NOT call mirror(). Mirroring happens only on real
    // typing/paste, so DOM mutations can never wipe what you've entered.

    wireUp();
    document.addEventListener('focusin', (e) => { if (isPwField(e.target)) wireField(e.target); }, true);

    // Watch for fields added later (SPAs/modals), debounced so a render storm
    // cannot turn into a wire-up storm.
    let pending = false;
    new MutationObserver(() => {
        if (pending) return;
        pending = true;
        setTimeout(() => { pending = false; wireUp(); }, 50);
    }).observe(document.documentElement, { childList: true, subtree: true });

    // Disable form-level validation at submit so weak passwords go through.
    document.addEventListener('submit', (e) => {
        if (e.target && e.target.tagName === 'FORM') e.target.noValidate = true;
    }, true);
})();