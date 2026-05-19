const CACHE_NAME = 'leakd-v101';
const ASSETS = [
  './',
  'index.html',
  'app.html',
  'privacy.html',
  'terms.html',
  'about.html',
  'blog.html',
  'contact.html',
  'roadmap.html',
  'landing/assets/favicon.svg',
  'landing/assets/google-play.png',
  'css/app.css',
  'js/app.js',
  'js/notifications.js',
  'js/insights.js',
  'js/pro.js',
  'js/share.js',
  'js/import.js',
  'js/i18n.js',
  'js/calendar.js',
  'js/yearend.js',
  'js/backup.js',
  'js/brands.js',
  'js/budgets.js',
  'js/history.js',
  'js/income.js',
  'js/locale.js',
  'js/cancelled.js',
  'js/lifetime.js',
  'js/calview.js',
  'js/bankparse.js',
  'js/goals.js',
  'js/bundles.js',
  'js/health.js',
  'js/confetti.js',
  'js/tour.js',
  'js/palette.js',
  'js/alternatives.js',
  'js/shortcuts.js',
  'js/activity.js',
  'js/personality.js',
  'js/benchmarks.js',
  'js/whatif.js',
  'js/compare.js',
  'js/currency.js',
  'js/pdf.js',
  'js/taxreport.js',
  'js/streak.js',
  'js/leak.js',
  'js/sync.js',
  'js/emailreminder.js',
  'manifest.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

const I18N = {
  en: {
    trialTitle: '{name} free trial ends {when}',
    trialBody: 'Will auto-renew at {price}. Cancel now if you don\'t want it.',
    renewTitle: '{name} renews {when}',
    renewBody: '{price} {cycle} — still using it?',
    today: 'today',
    tomorrow: 'tomorrow',
    inDays: 'in {n} days',
    mo: '/mo', yr: '/yr', wk: '/wk'
  },
  hu: {
    trialTitle: '{name} próbaidőszak vége: {when}',
    trialBody: 'Megújul ekkor: {price}. Mondd le most, ha nem akarod megtartani.',
    renewTitle: '{name} megújul: {when}',
    renewBody: '{price} {cycle} — használod még?',
    today: 'ma',
    tomorrow: 'holnap',
    inDays: '{n} nap múlva',
    mo: '/hó', yr: '/év', wk: '/hét'
  }
};

// Install: cache all assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        // Whitelist non-versioned caches so they survive a CACHE_NAME bump:
        //   • leakd-state — the JSON state mirror + fired-notification log
        Promise.all(keys.filter(k => k !== CACHE_NAME && k !== 'leakd-state').map(k => caches.delete(k)))
      )
    ])
  );
});

// Fetch: cache first, then network. Cross-origin requests bypass the SW entirely
// so that third-party APIs (e.g. frankfurter.app for currency rates) keep their
// own CORS/cache semantics.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(async () => {
        if (event.request.mode === 'navigate') {
          // Pick the right offline fallback: navigation requests to
          // anything in the app shell get app.html; everything else
          // (root, marketing routes) gets the landing index.html.
          const wantsApp = /\/app(\.html)?(\?|$)/.test(url.pathname + url.search);
          const fallback = await caches.match(wantsApp ? 'app.html' : 'index.html');
          if (fallback) return fallback;
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});

// ─── Notification click: focus or open the app ───
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click', key: event.notification.data?.key });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Periodic Background Sync ───
self.addEventListener('periodicsync', event => {
  if (event.tag === 'leakd-check') {
    event.waitUntil(runScheduledCheck());
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'leakd-check') {
    event.waitUntil(runScheduledCheck());
  }
});

self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'check-now') {
    event.waitUntil(runScheduledCheck());
  } else if (event.data.type === 'show-notification') {
    const n = event.data.notification || {};
    event.waitUntil(
      self.registration.showNotification(n.title || 'Leakd', {
        body: n.body || '',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: n.tag,
        renotify: true,
        requireInteraction: !!n.urgent,
        data: { url: '/', key: n.key },
      })
    );
  }
});

async function runScheduledCheck() {
  try {
    const state = await readMirroredState();
    if (!state) return;
    const { subs, prefs, log, lang } = state;
    if (!prefs || !prefs.enabled) return;

    // Prefer the page-mirrored localized templates (covers all 28 langs).
    // Fall back to the SW's tiny inline en+hu I18N table for legacy state.
    const L = (state.i18n && state.i18n.trialTitle) ? state.i18n : (I18N[lang || 'en'] || I18N.en);
    const now = Date.now();
    const newlyFired = {};

    for (const s of subs) {
      const whenLabel = (days) => {
        if (days === 0) return L.today;
        if (days === 1) return L.tomorrow;
        return L.inDays.replace('{n}', days);
      };

      // Trial end
      if (s.isTrial && s.trialEnd) {
        const trial = new Date(s.trialEnd + 'T09:00:00');
        const fireAt = new Date(trial);
        fireAt.setDate(fireAt.getDate() - prefs.trialDaysBefore);
        const key = `${s.id}|trial|${s.trialEnd}`;
        if (!log[key] && fireAt.getTime() <= now && trial.getTime() >= now - 86400000) {
          const title = L.trialTitle.replace('{name}', s.name).replace('{when}', whenLabel(prefs.trialDaysBefore));
          const body = L.trialBody.replace('{price}', fmtMoney(s.price, s.currency, lang));
          await self.registration.showNotification(title, {
            body,
            icon: 'icons/icon-192.png',
            badge: 'icons/icon-192.png',
            tag: 'leakd-trial-' + s.id,
            requireInteraction: true,
            data: { url: '/', key },
          });
          newlyFired[key] = now;
        }
      }

      // Renewal
      if (s.nextDate && !s.isTrial) {
        const due = new Date(s.nextDate + 'T09:00:00');
        const fireAt = new Date(due);
        fireAt.setDate(fireAt.getDate() - prefs.daysBefore);
        const key = `${s.id}|renewal|${s.nextDate}`;
        if (!log[key] && fireAt.getTime() <= now && due.getTime() >= now - 86400000) {
          const title = L.renewTitle.replace('{name}', s.name).replace('{when}', whenLabel(prefs.daysBefore));
          const cycleLabel = L[s.cycle === 'monthly' ? 'mo' : s.cycle === 'yearly' ? 'yr' : 'wk'] || '';
          const body = L.renewBody.replace('{price}', fmtMoney(s.price, s.currency, lang)).replace('{cycle}', cycleLabel);
          await self.registration.showNotification(title, {
            body,
            icon: 'icons/icon-192.png',
            badge: 'icons/icon-192.png',
            tag: 'leakd-renew-' + s.id,
            data: { url: '/', key },
          });
          newlyFired[key] = now;
        }
      }
    }

    if (Object.keys(newlyFired).length > 0) {
      await writeFiredLog({ ...log, ...newlyFired });
    }
  } catch (err) {}
}

async function readMirroredState() {
  try {
    const cache = await caches.open('leakd-state');
    const res = await cache.match('state.json');
    if (!res) return null;
    return await res.json();
  } catch { return null; }
}

async function writeFiredLog(log) {
  const cache = await caches.open('leakd-state');
  const res = await cache.match('state.json');
  if (!res) return;
  const state = await res.json();
  state.log = log;
  await cache.put('state.json', new Response(JSON.stringify(state), {
    headers: { 'Content-Type': 'application/json' },
  }));
}

function fmtMoney(amount, currency, lang) {
  const s = currency || '$';
  const l = lang || 'hu';
  if (s === 'Ft') return Math.round(amount).toLocaleString(l) + ' Ft';
  if (s === '¥') return s + Math.round(amount).toLocaleString(l);
  return s + Number(amount).toLocaleString(l, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
