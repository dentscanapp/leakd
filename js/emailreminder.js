// Leakd — Pro email-reminder client
// ────────────────────────────────────
// Registers (and cancels) renewal-day email reminders with the Cloudflare
// Worker at https://reminders.leakd.app. Strictly Pro-gated — every public
// method short-circuits with PRO_REQUIRED if LeakdPro.isPro() is false.
//
// Frontend payload contract (matches Worker):
//   POST → { email, itemName, expiryDate: 'YYYY-MM-DD', lang }
//   DELETE → { email, itemName, expiryDate }
//
// The user's current app language is captured automatically from
// LeakdI18n.lang (falling back to navigator.language → 'en').
//
// Wire-up: call register({...}) when the user saves a sub with email
// reminders on; call unregister({...}) when they delete / move the date.

(function () {
  'use strict';

  const ENDPOINT = 'https://reminders.leakd.app';
  const FETCH_TIMEOUT_MS = 15_000;

  // ── Helpers ─────────────────────────────────────────────────
  function currentLang() {
    if (typeof window !== 'undefined') {
      if (window.LeakdI18n && typeof window.LeakdI18n.lang === 'string') {
        return window.LeakdI18n.lang;
      }
      if (window.navigator && window.navigator.language) {
        return String(window.navigator.language).toLowerCase().split(/[-_]/)[0];
      }
    }
    return 'en';
  }

  function isPro() {
    return !!(typeof window !== 'undefined'
      && window.LeakdPro
      && typeof window.LeakdPro.isPro === 'function'
      && window.LeakdPro.isPro());
  }

  function validEmail(s) {
    return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }
  function validIsoDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  /** AbortController-backed fetch with a hard timeout. */
  async function fetchWithTimeout(url, opts, timeoutMs) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs || FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
    } finally {
      clearTimeout(id);
    }
  }

  /** Make a typed Error with a `code` property so callers can switch on it. */
  function err(code, detail) {
    const e = new Error(detail ? code + ':' + detail : code);
    e.code = code;
    return e;
  }

  // ── Core POST/DELETE ────────────────────────────────────────
  async function postReminder(method, payload) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw err('OFFLINE');
    }
    let res;
    try {
      res = await fetchWithTimeout(ENDPOINT, {
        method,
        mode: 'cors',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw err('TIMEOUT');
      throw err('NETWORK', e && e.message);
    }
    let body = null;
    try { body = await res.json(); } catch { /* not all errors have JSON */ }
    if (!res.ok) {
      const code = (body && body.error) || ('HTTP_' + res.status);
      throw err(code);
    }
    return body || { ok: true };
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Schedule a one-shot renewal email.
   * @param {{ email: string, itemName: string, expiryDate: string, lang?: string }} opts
   * @returns {Promise<{ ok: true, key?: string }>}
   * @throws Error with .code in:
   *   PRO_REQUIRED, INVALID_EMAIL, INVALID_ITEM_NAME, INVALID_DATE,
   *   OFFLINE, TIMEOUT, NETWORK, HTTP_4xx/5xx, FORBIDDEN_ORIGIN
   */
  async function register(opts) {
    if (!isPro()) throw err('PRO_REQUIRED');
    if (!opts || typeof opts !== 'object') throw err('INVALID_BODY');
    const { email, itemName, expiryDate } = opts;
    if (!validEmail(email)) throw err('INVALID_EMAIL');
    if (!itemName || typeof itemName !== 'string' || itemName.length > 200) throw err('INVALID_ITEM_NAME');
    if (!validIsoDate(expiryDate)) throw err('INVALID_DATE');

    const lang = (typeof opts.lang === 'string' && opts.lang.length <= 8) ? opts.lang : currentLang();
    return await postReminder('POST', { email, itemName, expiryDate, lang });
  }

  /**
   * Cancel a previously-registered reminder (e.g. sub deleted, date moved).
   * Same identity tuple as register(): { email, itemName, expiryDate }.
   * Safe to call even if nothing was registered — Worker treats as no-op.
   */
  async function unregister(opts) {
    if (!isPro()) throw err('PRO_REQUIRED');
    if (!opts || typeof opts !== 'object') throw err('INVALID_BODY');
    const { email, itemName, expiryDate } = opts;
    if (!validEmail(email)) throw err('INVALID_EMAIL');
    if (!itemName || typeof itemName !== 'string') throw err('INVALID_ITEM_NAME');
    if (!validIsoDate(expiryDate)) throw err('INVALID_DATE');
    return await postReminder('DELETE', { email, itemName, expiryDate });
  }

  /** Lightweight gate so the UI can decide whether to show the email field. */
  function available() {
    return isPro();
  }

  if (typeof window !== 'undefined') {
    window.LeakdEmailReminder = {
      register,
      unregister,
      available,
      // Exposed for tests
      _currentLang: currentLang,
      ENDPOINT,
    };
  }
})();
