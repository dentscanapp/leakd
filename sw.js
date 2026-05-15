const CACHE_NAME = 'leakd-v18';
const ASSETS = [
  '/',
  '/index.html',
  '/privacy.html',
  '/terms.html',
  '/css/app.css',
  '/js/app.js',
  '/js/notifications.js',
  '/js/insights.js',
  '/js/pro.js',
  '/js/share.js',
  '/js/import.js',
  '/js/i18n.js',
  '/js/calendar.js',
  '/js/yearend.js',
  '/js/backup.js',
  '/js/brands.js',
  '/js/budgets.js',
  '/js/history.js',
  '/js/income.js',
  '/js/locale.js',
  '/js/cancelled.js',
  '/js/lifetime.js',
  '/js/calview.js',
  '/js/bankparse.js',
  '/js/goals.js',
  '/js/bundles.js',
  '/js/health.js',
  '/js/confetti.js',
  '/js/tour.js',
  '/js/palette.js',
  '/js/alternatives.js',
  '/js/shortcuts.js',
  '/js/activity.js',
  '/js/personality.js',
  '/js/benchmarks.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache first, then network
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
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

// ─── Periodic Background Sync: re-evaluate subs and fire due notifications ───
// Works on Chrome/Edge when the PWA is installed and permission was granted.
self.addEventListener('periodicsync', event => {
  if (event.tag === 'leakd-check') {
    event.waitUntil(runScheduledCheck());
  }
});

// One-shot sync fallback (broader support than periodicSync)
self.addEventListener('sync', event => {
  if (event.tag === 'leakd-check') {
    event.waitUntil(runScheduledCheck());
  }
});

// ─── Manual ping from the page: "check now and fire any due notifications" ───
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

// ─── Core: read the same localStorage state the page uses, compute due events ───
// Service workers can't access localStorage, so the page mirrors subs into the
// Cache API as a JSON "virtual file" the SW can read. See app.js: mirrorState().
async function runScheduledCheck() {
  try {
    const state = await readMirroredState();
    if (!state) return;
    const { subs, prefs, log } = state;
    if (!prefs || !prefs.enabled) return;

    const now = Date.now();
    const newlyFired = {};

    for (const s of subs) {
      // Trial end
      if (s.isTrial && s.trialEnd) {
        const trial = new Date(s.trialEnd + 'T09:00:00');
        const fireAt = new Date(trial);
        fireAt.setDate(fireAt.getDate() - prefs.trialDaysBefore);
        const key = `${s.id}|trial|${s.trialEnd}`;
        if (!log[key] && fireAt.getTime() <= now && trial.getTime() >= now - 86400000) {
          await self.registration.showNotification(
            `${s.name} free trial ends ${prefs.trialDaysBefore === 0 ? 'today' : prefs.trialDaysBefore === 1 ? 'tomorrow' : 'in ' + prefs.trialDaysBefore + ' days'}`,
            {
              body: `Will auto-renew at ${fmtMoney(s.price, s.currency)}. Cancel now if you don't want it.`,
              icon: 'icons/icon-192.png',
              badge: 'icons/icon-192.png',
              tag: 'leakd-trial-' + s.id,
              requireInteraction: true,
              data: { url: '/', key },
            }
          );
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
          const dayLabel = prefs.daysBefore === 0 ? 'today' : prefs.daysBefore === 1 ? 'tomorrow' : 'in ' + prefs.daysBefore + ' days';
          await self.registration.showNotification(
            `${s.name} renews ${dayLabel}`,
            {
              body: `${fmtMoney(s.price, s.currency)} ${s.cycle === 'monthly' ? '/mo' : s.cycle === 'yearly' ? '/yr' : '/wk'} — still using it?`,
              icon: 'icons/icon-192.png',
              badge: 'icons/icon-192.png',
              tag: 'leakd-renew-' + s.id,
              data: { url: '/', key },
            }
          );
          newlyFired[key] = now;
        }
      }
    }

    if (Object.keys(newlyFired).length > 0) {
      await writeFiredLog({ ...log, ...newlyFired });
    }
  } catch (err) {
    // Silent: background sync should never throw
  }
}

async function readMirroredState() {
  try {
    const cache = await caches.open('leakd-state');
    const res = await cache.match('/state.json');
    if (!res) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function writeFiredLog(log) {
  const cache = await caches.open('leakd-state');
  const res = await cache.match('/state.json');
  if (!res) return;
  const state = await res.json();
  state.log = log;
  await cache.put('/state.json', new Response(JSON.stringify(state), {
    headers: { 'Content-Type': 'application/json' },
  }));
}

function fmtMoney(amount, currency) {
  const s = currency || '$';
  if (s === 'Ft') return Math.round(amount).toLocaleString() + ' Ft';
  if (s === '¥') return s + Math.round(amount).toLocaleString();
  return s + Number(amount).toFixed(2);
}
