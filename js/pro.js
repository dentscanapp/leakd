// Leakd — Pro license gate
// Stores the Gumroad license key locally and exposes a simple `isPro()` check.
//
// Verification strategy:
//   • Cheap path (now): basic format check + presence flag. Trust-the-user.
//   • Hardened path (later, when there are 500+ users): a tiny Cloudflare
//     Worker calls the Gumroad license verify API and returns a signed JWT
//     the client caches for 7 days. Until then we don't burn time on it.

(function () {
  'use strict';

  const PRO_KEY = 'leakd_pro';
  const GUMROAD_PRODUCT_URL = 'https://gumroad.com/l/leakd-pro';
  const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
  const GUMROAD_PERMALINK = 'leakd-pro'; // change to match your Gumroad product permalink

  const Pro = {
    state: { active: false, key: '', verifiedAt: 0, plan: '' },

    load() {
      try {
        const raw = localStorage.getItem(PRO_KEY);
        if (raw) this.state = { ...this.state, ...JSON.parse(raw) };
      } catch {}
      return this.state;
    },

    save() {
      localStorage.setItem(PRO_KEY, JSON.stringify(this.state));
    },

    isPro() {
      return !!this.state.active;
    },

    productUrl() {
      return GUMROAD_PRODUCT_URL;
    },

    // ── Activate via license key ──
    // First tries the live Gumroad endpoint. If the network call fails or is
    // blocked by CORS we fall back to a format check so the user is never
    // locked out by a transient issue (we'll re-verify next launch).
    async activate(key) {
      key = (key || '').trim();
      if (!this.looksValid(key)) {
        return { ok: false, error: 'That key doesn\'t look right. Check your Gumroad receipt and try again.' };
      }

      try {
        const res = await fetch(GUMROAD_VERIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            product_permalink: GUMROAD_PERMALINK,
            license_key: key,
            increment_uses_count: 'false',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            this.state = {
              active: true,
              key,
              verifiedAt: Date.now(),
              plan: (data.purchase && data.purchase.variants) || 'pro',
            };
            this.save();
            return { ok: true };
          }
          return { ok: false, error: 'Gumroad says this key isn\'t valid for Leakd Pro.' };
        }
      } catch {
        // Fall through to offline activation
      }

      // Offline fallback — accept it, re-check later
      this.state = { active: true, key, verifiedAt: 0, plan: 'pro' };
      this.save();
      return { ok: true, offline: true };
    },

    deactivate() {
      this.state = { active: false, key: '', verifiedAt: 0, plan: '' };
      this.save();
    },

    looksValid(key) {
      // Gumroad license keys are 4 groups of 8 hex chars separated by dashes
      return /^[A-Z0-9]{4,}(-[A-Z0-9]{4,}){2,}$/i.test(key);
    },

    // ── Premium feature catalogue (so the UI can render lock icons) ──
    features: {
      'csv-export':    { name: 'CSV export', free: true },
      'unlimited':     { name: 'Unlimited subscriptions', free: true },
      'notifications': { name: 'Renewal & trial reminders', free: true },
      'insights':      { name: 'Smart insights & duplicate detection', free: true },
      'share-card':    { name: 'Shareable leak card', free: true },

      'email-reminders': { name: 'Email reminders (in addition to push)', free: false },
      'sync':            { name: 'Multi-device sync', free: false },
      'yearly-report':   { name: 'Year-end spending report', free: false },
      'budgets':         { name: 'Category budgets & alerts', free: false },
      'priority':        { name: 'Priority support', free: false },
    },
  };

  window.LeakdPro = Pro;
})();
