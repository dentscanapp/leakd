// Leakd — Local push notification scheduler
// Uses the Notifications API + Service Worker. No server, no push subscription.
// Notifications fire from the SW so they appear even after the tab is closed
// (as long as the browser keeps the SW alive, which is best-effort by spec).

(function () {
  'use strict';

  const PREFS_KEY = 'leakd_notif_prefs';
  const LOG_KEY = 'leakd_notif_log';

  const defaults = {
    enabled: false,
    daysBefore: 3,
    trialDaysBefore: 1,
    dailyDigest: false,
    dailyDigestHour: 9,
  };

  const t = (k, vars) => window.LeakdI18n ? window.LeakdI18n.t(k, vars) : k;
  function whenLabel(days) {
    if (days === 0) return t('time.today');
    if (days === 1) return t('time.tomorrow');
    return t('time.inDays', { n: days });
  }
  function cycleLabel(cycle) {
    if (cycle === 'monthly') return t('cycle.mo');
    if (cycle === 'yearly')  return t('cycle.yr');
    return t('cycle.wk');
  }

  const Notify = {
    prefs: { ...defaults },
    timers: [],

    load() {
      try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) this.prefs = { ...defaults, ...JSON.parse(raw) };
      } catch {}
      return this.prefs;
    },

    save(patch) {
      this.prefs = { ...this.prefs, ...patch };
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    },

    supported() {
      return 'Notification' in window && 'serviceWorker' in navigator;
    },

    permission() {
      return this.supported() ? Notification.permission : 'unsupported';
    },

    async requestPermission() {
      if (!this.supported()) return 'unsupported';
      if (Notification.permission === 'granted') return 'granted';
      if (Notification.permission === 'denied') return 'denied';
      try {
        const result = await Notification.requestPermission();
        return result;
      } catch {
        return 'denied';
      }
    },

    // ── Per-event log (so we don't double-notify) ──
    log() {
      try { return JSON.parse(localStorage.getItem(LOG_KEY) || '{}'); }
      catch { return {}; }
    },

    saveLog(log) {
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    },

    markFired(key) {
      const log = this.log();
      log[key] = Date.now();
      this.saveLog(log);
    },

    hasFired(key) {
      return !!this.log()[key];
    },

    // Build event keys for de-duplication
    eventKey(sub, kind, dateStr) {
      return `${sub.id}|${kind}|${dateStr}`;
    },

    // ── Compute scheduled events ──
    // Each event: { when: Date, title, body, tag, key }
    buildEvents(subs) {
      const events = [];
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      subs.forEach(s => {
        // Trial end alert
        if (s.isTrial && s.trialEnd) {
          const trial = new Date(s.trialEnd + 'T09:00:00');
          const fireAt = new Date(trial);
          fireAt.setDate(fireAt.getDate() - this.prefs.trialDaysBefore);
          const key = this.eventKey(s, 'trial', s.trialEnd);
          events.push({
            when: fireAt,
            title: t('notif.trial.title', { name: s.name, when: whenLabel(this.prefs.trialDaysBefore) }),
            body: t('notif.trial.body', { price: formatMoney(s.price, s.currency) }),
            tag: 'leakd-trial-' + s.id,
            key,
            urgent: true,
          });
        }

        // Renewal payment alert
        if (s.nextDate && !s.isTrial) {
          const due = new Date(s.nextDate + 'T09:00:00');
          const fireAt = new Date(due);
          fireAt.setDate(fireAt.getDate() - this.prefs.daysBefore);
          const key = this.eventKey(s, 'renewal', s.nextDate);
          events.push({
            when: fireAt,
            title: t('notif.renew.title', { name: s.name, when: whenLabel(this.prefs.daysBefore) }),
            body: t('notif.renew.body', { price: formatMoney(s.price, s.currency), cycle: cycleLabel(s.cycle) }),
            tag: 'leakd-renew-' + s.id,
            key,
            urgent: false,
          });
        }
      });

      return events.filter(e => {
        // Skip already fired
        if (this.hasFired(e.key)) return false;
        // Skip far past (more than 1 day stale)
        if (e.when.getTime() < todayStart.getTime() - 86400000) return false;
        return true;
      });
    },

    // ── Fire a notification immediately via SW ──
    async fire(event) {
      if (this.permission() !== 'granted') return false;
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(event.title, {
          body: event.body,
          icon: 'icons/icon-192.png',
          badge: 'icons/icon-192.png',
          tag: event.tag,
          renotify: true,
          requireInteraction: !!event.urgent,
          data: { url: '/', key: event.key },
        });
        this.markFired(event.key);
        return true;
      } catch (err) {
        console.warn('Leakd: notification failed', err);
        return false;
      }
    },

    // ── Schedule all upcoming events ──
    schedule(subs) {
      this.clear();
      if (!this.prefs.enabled || this.permission() !== 'granted') return;

      const events = this.buildEvents(subs);
      const now = Date.now();

      events.forEach(e => {
        const delay = e.when.getTime() - now;

        if (delay <= 0) {
          // Catch-up: fire missed notifications now
          this.fire(e);
        } else if (delay < 24 * 60 * 60 * 1000) {
          // Within 24h → schedule via setTimeout (only works while tab is open
          // or SW is alive). For true background, we rely on Periodic Sync below.
          const t = setTimeout(() => this.fire(e), delay);
          this.timers.push(t);
        }
        // Events farther than 24h are checked on next app open / sync
      });

      // Ask SW to register Periodic Background Sync if available
      this.registerPeriodicSync();
    },

    clear() {
      this.timers.forEach(t => clearTimeout(t));
      this.timers = [];
    },

    // ── Periodic Background Sync (Chrome / Edge / installed PWA) ──
    async registerPeriodicSync() {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (!('periodicSync' in reg)) return;
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (status.state !== 'granted') return;
        await reg.periodicSync.register('leakd-check', {
          minInterval: 12 * 60 * 60 * 1000, // 12h
        });
      } catch {
        // Not supported in this browser — fine
      }
    },

    // ── Test notification (used by the UI to verify it works) ──
    async test() {
      if (this.permission() !== 'granted') {
        const p = await this.requestPermission();
        if (p !== 'granted') return false;
      }
      return this.fire({
        title: t('notif.test.title'),
        body: t('notif.test.body'),
        tag: 'leakd-test',
        key: 'test-' + Date.now(),
        urgent: false,
      });
    },
  };

  // ── Helper: formatMoney accepts both ISO codes (USD, EUR, HUF…) and raw
  //   symbols ($, €, Ft). Delegates to LeakdLocale when available for proper
  //   locale-aware formatting; otherwise falls back to a sane default.
  function formatMoney(amount, currency) {
    const a = Number(amount);
    if (!isFinite(a)) return String(currency || '');
    if (window.LeakdLocale && typeof window.LeakdLocale.formatMoney === 'function') {
      try { return window.LeakdLocale.formatMoney(a, currency); } catch {}
    }
    const c = currency || '$';
    // ISO code → look up symbol via LeakdCurrency if available
    if (/^[A-Z]{3}$/.test(c) && window.LeakdCurrency && window.LeakdCurrency.symbolFor) {
      const sym = window.LeakdCurrency.symbolFor(c) || c + ' ';
      if (c === 'HUF') return Math.round(a).toLocaleString() + ' Ft';
      if (c === 'JPY' || c === 'KRW') return sym + Math.round(a).toLocaleString();
      return sym + a.toFixed(2);
    }
    if (c === 'Ft') return Math.round(a).toLocaleString() + ' Ft';
    if (c === '¥')  return c + Math.round(a).toLocaleString();
    return c + a.toFixed(2);
  }

  // Expose
  window.LeakdNotify = Notify;
})();
