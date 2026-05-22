// Leakd — Subscription Tracker
// All data stored locally in localStorage. Zero server calls.

(function () {
  'use strict';

  const STORAGE_KEY = 'leakd_subs';
  const SETTINGS_KEY = 'leakd_settings';
  const ONBOARD_KEY = 'leakd_onboarded';
  let subs = [];
  let settings = { currency: '$', currencyCode: 'USD', theme: 'light' };
  let activeCategory = 'all';
  let activeView = 'home';
  let searchTerm = '';
  let editingId = null;
  let importStaged = [];
  let calMonthOffset = 0;
  let insightsFilter = 'all';

  window.LeakdState = settings;

  // Translation helper (works even if i18n hasn't loaded yet)
  const t = (k, vars) => window.LeakdI18n ? window.LeakdI18n.t(k, vars) : k;

  const setEmptyState = (el, className, text) => {
    if (!el) return;
    el.innerHTML = '';
    const div = document.createElement('div');
    div.className = className;
    div.textContent = text;
    el.appendChild(div);
  };

  const catColors = {
    Entertainment: { bg: '#fef2f2', text: '#991b1b', icon: '🎬' },
    Work: { bg: '#eff6ff', text: '#1e40af', icon: '💼' },
    Music: { bg: '#f0fdf4', text: '#166534', icon: '🎵' },
    Fitness: { bg: '#fefce8', text: '#854d0e', icon: '💪' },
    Cloud: { bg: '#f0f9ff', text: '#075985', icon: '☁️' },
    Food: { bg: '#fff7ed', text: '#9a3412', icon: '🍕' },
    News: { bg: '#faf5ff', text: '#6b21a8', icon: '📰' },
    Other: { bg: '#f5f5f4', text: '#44403c', icon: '📦' },
  };
  const catPaletteDark = {
    Entertainment: '#ef4444', Work: '#3b82f6', Music: '#22c55e', Fitness: '#eab308',
    Cloud: '#06b6d4', Food: '#f97316', News: '#a855f7', Other: '#78716c',
  };

  const $ = id => document.getElementById(id);
  const monthlyTotalEl = $('monthlyTotal');
  const yearlyTotalEl = $('yearlyTotal');
  const activeCountEl = $('activeCount');
  const dueSoonEl = $('dueSoon');
  const alertsEl = $('alerts');
  const categoriesEl = $('categories');
  const subListEl = $('subList');
  const emptyStateEl = $('emptyState');
  const modal = $('modal');
  const currencyModal = $('currencyModal');

  async function init() {
    loadData();
    applyTheme();
    if (window.LeakdPro) window.LeakdPro.load();
    if (window.LeakdI18n) {
      await window.LeakdI18n.init();
      window.LeakdI18n.onChange(() => { render(); refreshDynamicLabels(); });
    }
    buildLanguageGrid();
    bindEvents();
    setDefaultDate();
    render();
    refreshDynamicLabels();
    initNotifications();
    refreshProUI();
    if (window.LeakdCurrency) {
      window.LeakdCurrency.sync(subs).then(() => render());
      buildCurrencyDropdown();
    }

    // First-time visit (no settings yet) — auto-pick currency from browser
    // locale BEFORE showing onboarding so the welcome screen is in their
    // native currency. Language was already detected in LeakdI18n.init().
    // If the visitor's country isn't in the COUNTRY_CURRENCY map we silently
    // default to USD instead of prompting — the user can change it later
    // from the Currency menu.
    if (!localStorage.getItem(SETTINGS_KEY)) {
      if (!autoDetectLocale()) defaultCurrencyUsd();
    } else {
      // Currency was set in a previous session. Re-detect when:
      //   • it was explicitly marked as auto-detected (currencyAuto: true)
      //   • OR migrating a legacy user whose currency is USD with no flag
      //     (USD is our silent fallback, so on a Hungarian / German / ...
      //     OS we should upgrade them to HUF / EUR / ... automatically).
      const probablyAuto = settings.currencyAuto === true
        || (settings.currencyAuto === undefined && settings.currencyCode === 'USD');
      if (probablyAuto && window.LeakdLocale) {
        const detected = window.LeakdLocale.detectCurrency();
        if (detected && detected.code !== settings.currencyCode) {
          autoDetectLocale();
        }
      }
    }

    if (!localStorage.getItem(ONBOARD_KEY)) {
      showOnboard();
    }

    handleUrlParams();
    initPalette();
    if (window.LeakdStreak) window.LeakdStreak.load();
    if (window.LeakdShortcuts) window.LeakdShortcuts.init();
    initAutoSync();
  }

  // Auto-sync in the background
  function initAutoSync() {
    if (!window.LeakdSync) return;

    // Auto-unlock sync if there is a cached password in sessionStorage
    const sessionPw = (() => {
      try { return sessionStorage.getItem('leakd_sync_session_pw'); } catch (e) { return null; }
    })();
    if (sessionPw && window.LeakdSync.isEnabled() && !window.LeakdSync.isUnlocked()) {
      window.LeakdSync.unlock(sessionPw).then(() => {
        console.log('[Leakd] Auto-unlocked sync from session cache');
        refreshSyncUI();
        render();
        runQuietSync();
      }).catch(err => {
        console.warn('Auto-unlock failed:', err);
      });
    }

    const runQuietSync = () => {
      if (window.LeakdSync.isEnabled() && window.LeakdSync.isUnlocked()) {
        window.LeakdSync.sync().then(res => {
          if (res && (res.action === 'pulled' || res.action === 'merged-pushed')) {
            // Data has changed locally, reload the db data and re-render
            loadData();
            render();
            refreshDynamicLabels();
            if (window.LeakdCurrency) {
              window.LeakdCurrency.sync(subs).then(() => render());
            }
          }
        }).catch(err => {
          console.warn('Auto-sync background check failed:', err);
        });
      }
    };

    // 1. Run on init (after 3 seconds)
    setTimeout(runQuietSync, 3000);

    // 2. Run when tab comes back into focus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        runQuietSync();
      }
    });

    // 3. Periodic run every 30 seconds
    setInterval(runQuietSync, 30000);
  }

  // ─── Command palette setup ───
  // Registers actions so the user can launch them by typing in Cmd+K.
  // Re-registers on language change to keep labels translated.
  function initPalette() {
    if (!window.LeakdPalette) return;
    window.LeakdPalette.initHotkey();
    refreshPaletteActions();
    if (window.LeakdI18n) window.LeakdI18n.onChange(refreshPaletteActions);

    // Expose helpers the palette calls for add/edit
    window.__paletteOnAddService = (known) => {
      openAdd();
      setTimeout(() => {
        $('subName').value = known.name;
        $('subPrice').value = known.price;
        $('subCategory').value = known.cat;
        $('subPrice').focus();
      }, 150);
    };
    window.__paletteOnEditSub = (sub) => openEdit(sub.id);
  }

  function refreshPaletteActions() {
    if (!window.LeakdPalette) return;
    window.LeakdPalette.clearActions();
    const a = window.LeakdPalette.register;
    a({ id: 'home', label: t('nav.home'), run: () => setView('home'), keywords: ['home', 'start'] });
    a({ id: 'insights', label: t('nav.insights'), run: () => setView('insights'), keywords: ['analysis', 'chart', 'stats'] });
    a({ id: 'add', label: t('modal.add'), run: openAdd, keywords: ['new', 'plus', 'create'] });
    a({ id: 'theme', label: t('menu.theme'), run: openThemeModal, keywords: ['dark', 'light', 'color'] });
    a({ id: 'lang', label: t('menu.language'), run: openLangModal, keywords: ['translate', 'locale'] });
    a({ id: 'currency', label: t('menu.currency'), run: () => { currencyModal.style.display = 'flex'; }, keywords: ['money', 'symbol'] });
    a({ id: 'budgets', label: t('menu.budgets'), run: openBudgetsModal, keywords: ['limit', 'spending'] });
    a({ id: 'income', label: t('menu.income'), run: openIncomeModal, keywords: ['salary', 'ratio'] });
    a({ id: 'goal', label: t('menu.goal'), run: openGoalModal, keywords: ['save', 'target'] });
    a({ id: 'whatif', label: t('menu.whatif'), run: openWhatIfModal, keywords: ['scenario', 'simulate', 'cancel', 'preview'] });
    a({ id: 'compare', label: t('menu.compare'), run: openCompareModal, keywords: ['side', 'versus', 'vs'] });
    a({ id: 'bank', label: t('menu.bank'), run: openBankModal, keywords: ['csv', 'revolut', 'wise', 'statement'] });
    a({ id: 'import', label: t('menu.import'), run: openImportModal, keywords: ['paste', 'bulk'] });
    a({ id: 'export', label: t('menu.export'), run: exportCSV, keywords: ['download', 'csv'] });
    a({ id: 'calendar', label: t('menu.calendar'), run: exportCalendar, keywords: ['ics', 'renewal'] });
    a({ id: 'backup', label: t('menu.backup'), run: openBackupModal, keywords: ['restore', 'sync'] });
    a({ id: 'cancelled', label: t('menu.cancelled'), run: openCancelledModal, keywords: ['killed', 'savings'] });
    a({ id: 'yearend', label: t('menu.yearend'), run: openYearendModal, keywords: ['wrap', 'report'] });
    a({ id: 'pro', label: t('menu.pro'), run: openProModal, keywords: ['upgrade', 'premium'] });
    a({ id: 'notif', label: t('header.notif'), run: openNotifModal, keywords: ['reminder', 'alert'] });
    a({ id: 'tour', label: t('menu.tour'), run: () => window.LeakdTour && window.LeakdTour.restart(), keywords: ['help', 'guide'] });
    a({ id: 'help', label: t('shortcut.title'), run: () => window.LeakdShortcuts && window.LeakdShortcuts.toggleHelp(), keywords: ['keyboard', 'keys', 'shortcuts'] });
    a({ id: 'privacy', label: t('menu.privacy'), run: () => window.open('privacy.html', '_blank'), keywords: ['gdpr', 'policy'] });
    a({ id: 'terms', label: t('menu.terms'), run: () => window.open('terms.html', '_blank'), keywords: ['legal', 'tos'] });
  }

  function buildCurrencyDropdown() {
    const sel = $('subCurrency');
    if (!sel || !window.LeakdCurrency) return;
    sel.innerHTML = window.LeakdCurrency.supported.map(code => {
      return `<option value="${code}">${code} (${window.LeakdCurrency.getSymbol(code)})</option>`;
    }).join('');
  }

  // Keep palette's view of subs fresh
  function updatePaletteSubs() {
    window.__paletteSubs = subs;
  }

  // Silent USD fallback for first-time visitors whose country isn't in the
  // locale map. We never show the currency picker on first load — they can
  // change it from the menu later. We mark it as `currencyAuto` so future
  // page loads can re-attempt detection (in case the user's locale becomes
  // detectable later, e.g. they fixed regional settings or moved networks).
  function defaultCurrencyUsd() {
    settings.currency = '$';
    settings.currencyCode = 'USD';
    settings.currencyAuto = true;
    saveData();
    refreshDynamicLabels();
    render();
  }

  // Auto-detect currency (and confirm language) from browser locale.
  // Idempotent — safe to call repeatedly. Returns true if we successfully
  // picked a currency, false if the picker should still be shown.
  // Language detection happens in LeakdI18n.init() too; this function keeps
  // them in sync if i18n hasn't decided yet.
  function autoDetectLocale() {
    if (!window.LeakdLocale) return false;
    const detected = window.LeakdLocale.detectCurrency();
    if (!detected) return false;

    // Language: only set if not already chosen (don't overwrite explicit choice)
    if (window.LeakdI18n && !localStorage.getItem('leakd_lang')) {
      const detectedLang = window.LeakdLocale.detectLanguage(window.LeakdI18n.SUPPORTED);
      if (detectedLang) {
        window.LeakdI18n.lang = detectedLang;
        localStorage.setItem('leakd_lang', detectedLang);
        document.documentElement.lang = detectedLang;
      }
    }

    settings.currency = detected.symbol;
    settings.currencyCode = detected.code;
    settings.currencyAuto = true;  // mark as auto so re-detect can run again
    saveData();
    refreshDynamicLabels();
    render();

    // Friendly toast: "🌍 Magyar · HUF" — only shown when called interactively
    // (i.e. when SETTINGS_KEY was missing). The toast suppresses itself if
    // called too early (before the toast element exists).
    try {
      const langName = window.LeakdI18n
        ? (window.LeakdI18n.LANGUAGES[window.LeakdI18n.lang] || {}).name
        : null;
      const parts = [];
      if (langName) parts.push(langName);
      parts.push(detected.code);
      toast('🌍 ' + parts.join(' · '));
    } catch { }
    return true;
  }

  function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'insights') setView('insights');
    if (params.get('action') === 'add') setTimeout(openAdd, 200);
    if (params.get('action') === 'import') setTimeout(openImportModal, 200);
    if (params.get('action') === 'yearend') setTimeout(openYearendModal, 200);
    if (params.toString()) history.replaceState({}, '', window.location.pathname);
  }

  function initNotifications() {
    if (!window.LeakdNotify) return;
    window.LeakdNotify.load();
    updateNotifBellState();
    mirrorStateToCache();
    rescheduleNotifications();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.active && reg.active.postMessage({ type: 'check-now' });
      }).catch(() => { });
    }
  }

  function updateNotifBellState() {
    const bell = $('toggleNotif');
    if (!bell || !window.LeakdNotify) return;
    const on = window.LeakdNotify.prefs.enabled && window.LeakdNotify.permission() === 'granted';
    bell.classList.toggle('active', !!on);
  }

  // ─── Data ───

  // IndexedDB fallback — used when localStorage quota is exceeded.
  // IndexedDB has ~50-100MB of space vs localStorage's ~5MB.
  const IDB_NAME = 'leakd_fallback';
  const IDB_STORE = 'kv';
  let idbFallbackActive = false;

  function openIDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    try {
      const db = await openIDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    } catch (e) {
      console.error('IndexedDB write failed', e);
    }
  }

  async function idbGet(key) {
    try {
      const db = await openIDB();
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      return await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
    } catch { return undefined; }
  }

  function loadData() {
    try { const raw = localStorage.getItem(STORAGE_KEY); subs = raw ? JSON.parse(raw) : []; } catch { subs = []; }
    try { const raw = localStorage.getItem(SETTINGS_KEY); if (raw) settings = { ...settings, ...JSON.parse(raw) }; } catch { }

    // If localStorage was empty, check IndexedDB for a fallback copy
    if (subs.length === 0) {
      idbGet(STORAGE_KEY).then(raw => {
        if (raw) {
          try {
            const restored = JSON.parse(raw);
            if (Array.isArray(restored) && restored.length > 0) {
              subs = restored;
              idbFallbackActive = true;
              render();
              toast('♻️ ' + t('error.restoredFromFallback'));
            }
          } catch { }
        }
      });
    }
    if (!settings.currencyCode) {
      idbGet(SETTINGS_KEY).then(raw => {
        if (raw) {
          try { const s = JSON.parse(raw); if (s) { settings = { ...settings, ...s }; window.LeakdState = settings; } } catch { }
        }
      });
    }

    window.LeakdState = settings;
  }

  function saveData() {
    const subsJson = JSON.stringify(subs);
    const settingsJson = JSON.stringify(settings);

    try {
      localStorage.setItem(STORAGE_KEY, subsJson);
      localStorage.setItem(SETTINGS_KEY, settingsJson);
      idbFallbackActive = false;
    } catch (e) {
      console.error('saveData: localStorage full, falling back to IndexedDB', e);
      idbFallbackActive = true;

      // Save to IndexedDB as fallback
      idbSet(STORAGE_KEY, subsJson);
      idbSet(SETTINGS_KEY, settingsJson);

      // Show helpful message with sync CTA for non-Pro users
      if (window.LeakdPro && window.LeakdPro.isPro()) {
        toast('⚠️ ' + t('error.storageFull'));
      } else {
        toast('⚠️ ' + t('error.storageFullUpgrade'));
      }
    }
    window.LeakdState = settings;
    mirrorStateToCache();
    rescheduleNotifications();
    if (window.LeakdHistory) window.LeakdHistory.record(subs);
    updatePaletteSubs();
    // Cloud sync (Pro): debounced push if enabled + unlocked
    if (window.LeakdSync && window.LeakdSync.isEnabled() && window.LeakdSync.isUnlocked()) {
      window.LeakdSync.schedulePush();
    }
  }

  async function mirrorStateToCache() {
    if (!('caches' in window)) return;
    try {
      const prefs = (window.LeakdNotify && window.LeakdNotify.prefs) || {};
      const log = (window.LeakdNotify && window.LeakdNotify.log()) || {};
      const lang = (window.LeakdI18n && window.LeakdI18n.lang) || 'en';
      const snapshot = subs.map(s => ({ ...s, currency: settings.currency }));
      // Pre-localized notification templates for the SW. SW used to only
      // ship en+hu inline; this lets background notifications honour the
      // user's actual language without bloating sw.js.
      const tt = (k) => (window.LeakdI18n ? window.LeakdI18n.t(k) : k);
      const i18n = {
        trialTitle: tt('notif.trial.title'),
        trialBody: tt('notif.trial.body'),
        renewTitle: tt('notif.renew.title'),
        renewBody: tt('notif.renew.body'),
        today: tt('time.today'),
        tomorrow: tt('time.tomorrow'),
        inDays: tt('time.inDays'),
        mo: tt('cycle.mo'),
        yr: tt('cycle.yr'),
        wk: tt('cycle.wk'),
      };
      const payload = { subs: snapshot, prefs, log, lang, i18n, updatedAt: Date.now() };
      const cache = await caches.open('leakd-state');
      await cache.put('state.json', new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      }));
    } catch { }
  }

  function rescheduleNotifications() {
    if (window.LeakdNotify && window.LeakdNotify.prefs.enabled) {
      window.LeakdNotify.schedule(subs.filter(s => !s.paused).map(s => ({ ...s, currency: settings.currency })));
    }
  }

  // ─── Theme ───
  // Three modes: 'light', 'dark', 'auto'. Auto follows the system
  // prefers-color-scheme and updates live if the user flips their OS theme.
  let mediaListener = null;
  function applyTheme() {
    const mode = settings.theme || 'auto';
    let effective = mode;
    if (mode === 'auto') {
      effective = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.style.backgroundColor = effective === 'dark' ? '#0f0f0f' : '#fafaf9';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', effective === 'dark' ? '#0f0f0f' : '#fafaf9');

    // Wire up live system-theme listener only when in auto mode
    if (mode === 'auto' && !mediaListener && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mediaListener = e => {
        if (settings.theme === 'auto') {
          const newEff = e.matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', newEff);
          document.documentElement.style.backgroundColor = newEff === 'dark' ? '#0f0f0f' : '#fafaf9';
          const m = document.querySelector('meta[name="theme-color"]');
          if (m) m.setAttribute('content', newEff === 'dark' ? '#0f0f0f' : '#fafaf9');
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', mediaListener);
      else if (mq.addListener) mq.addListener(mediaListener);
    }
  }
  function toggleTheme() {
    // Simple two-state toggle: just flip between dark and light. (The 'auto'
    // mode is still settable from the theme picker modal.) When the user is
    // currently in 'auto', we resolve the EFFECTIVE current theme first, then
    // flip to the opposite explicit value — so the button always does the
    // visually obvious thing in one click.
    const cur = (settings.theme === 'auto')
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : settings.theme;
    settings.theme = cur === 'dark' ? 'light' : 'dark';
    applyTheme(); saveData();
    refreshDynamicLabels();
  }
  function setThemeMode(mode) {
    settings.theme = mode;
    applyTheme();
    saveData();
    refreshDynamicLabels();
  }

  // ─── Calculations ───
  function toMonthly(price, cycle, currency) {
    if (window.LeakdCurrency) return window.LeakdCurrency.toMonthly(price, cycle, currency);
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }
  function toYearly(price, cycle, currency) {
    if (window.LeakdCurrency) return window.LeakdCurrency.toYearly(price, cycle, currency);
    if (cycle === 'weekly') return price * 52;
    if (cycle === 'monthly') return price * 12;
    return price;
  }
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    // Force local time parsing for YYYY-MM-DD by using slashes
    const target = new Date(dateStr.replace(/-/g, '/'));
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / 86400000);
  }
  function formatPrice(amount, code) {
    const targetCode = code || settings.currencyCode;
    const n = Number(amount);
    const safe = isFinite(n) ? n : 0;
    // Prefer the rich formatter from locale.js
    if (window.LeakdLocale && targetCode) {
      return window.LeakdLocale.formatMoney(safe, targetCode);
    }
    // Legacy fallback
    const s = window.LeakdCurrency ? window.LeakdCurrency.getSymbol(targetCode) : (settings.currency || '$');
    if (targetCode === 'HUF' || s === 'Ft') return Math.round(safe).toLocaleString() + ' Ft';
    if (s === '¥') return s + Math.round(safe).toLocaleString();
    return s + safe.toFixed(2);
  }
  // alternatives.js / brands.js store reference prices in USD. Convert to the
  // user's display currency so suggestions and savings math stay in one unit.
  function fromUsd(amount) {
    if (!window.LeakdCurrency || !settings.currencyCode || settings.currencyCode === 'USD') return amount;
    return window.LeakdCurrency.convert(amount, 'USD', settings.currencyCode);
  }
  function activeSubs() { return subs.filter(s => !s.paused); }
  function dueLabel(days) {
    if (days === 0) return t('time.today');
    if (days === 1) return t('time.tomorrow');
    return t('time.inDays', { n: days });
  }
  function localizedCat(cat) { return t('cat.' + cat) || cat; }

  // ─── Render ───
  function render() {
    if (activeView === 'home') {
      renderStats();
      renderAlerts();
      renderStreak();
      renderCategories();
      renderList();
    } else if (activeView === 'insights') {
      renderInsights();
    }
    const csEl = $('currencySymbol');
    if (csEl) csEl.textContent = settings.currency;
  }

  function refreshDynamicLabels() {
    const cs = $('menuCurrencySub');
    if (cs) cs.textContent = `${settings.currencyCode} (${settings.currency})`;
    const ls = $('menuLanguageSub');
    if (ls && window.LeakdI18n) {
      const lang = window.LeakdI18n.lang;
      const info = window.LeakdI18n.LANGUAGES[lang];
      ls.textContent = info ? `${info.flag} ${info.name}` : lang;
    }
    $('ytdYear').textContent = String(new Date().getFullYear());

    const themeSub = $('menuThemeSub');
    if (themeSub) {
      const mode = settings.theme || 'auto';
      themeSub.textContent = t('theme.' + mode);
    }

    const canSub = $('menuCancelledSub');
    if (canSub && window.LeakdCancelled) {
      const n = window.LeakdCancelled.count();
      if (n > 0) {
        const saved = window.LeakdCancelled.savings();
        canSub.textContent = n + ' · ' + formatPrice(saved) + '/' + t('cycle.mo').replace('/', '');
      } else {
        canSub.textContent = t('menu.cancelledSub');
      }
    }
  }

  function renderStats() {
    let monthly = 0, dueSoonCount = 0;
    activeSubs().forEach(s => {
      monthly += toMonthly(s.price, s.cycle, s.currency);
      if (s.nextDate && daysUntil(s.nextDate) <= 7 && daysUntil(s.nextDate) >= 0) dueSoonCount++;
    });
    animateNumber(monthlyTotalEl, monthly, formatPrice);
    animateNumber(yearlyTotalEl, monthly * 12, formatPrice);
    activeCountEl.textContent = activeSubs().length;
    dueSoonEl.textContent = dueSoonCount;
    monthlyTotalEl.style.color = monthly > 0 ? '' : 'var(--text-3)';

    // Calculate total money owed by friends
    let totalOwed = 0;
    activeSubs().forEach(s => {
      if (s.sharedWith && s.sharedWith > 1 && s.sharedNames) {
        const friendNames = s.sharedNames.split(',')
          .map(name => name.trim())
          .filter(name => name.length > 0);

        const pricePerPerson = s.price / s.sharedWith;
        const totalFriendSlots = s.sharedWith - 1;
        const paidList = Array.isArray(s.sharedPaid) ? s.sharedPaid : [];

        for (let i = 0; i < totalFriendSlots; i++) {
          const defaultLabel = window.LeakdI18n && window.LeakdI18n.lang === 'hu' ? 'Barát' : 'Friend';
          const name = friendNames[i] || `${defaultLabel} ${i + 1}`;
          if (!paidList.includes(name)) {
            totalOwed += toMonthly(pricePerPerson, s.cycle, s.currency);
          }
        }
      }
    });

    const existingBadge = document.querySelector('.stat-owed-badge');
    if (existingBadge) existingBadge.remove();

    if (totalOwed > 0) {
      const badgeHtml = `
        <span class="stat-owed-badge" title="${t('field.splitOwedByFriends') || 'owed by friends'}">
          <span>👥</span>
          <span>+ ${formatPrice(totalOwed)} ${t('field.splitOwed') || 'owed'}</span>
        </span>
      `;
      monthlyTotalEl.insertAdjacentHTML('afterend', badgeHtml);
    }

    // Update leak effect
    if (window.LeakdEffect) {
      const active = activeSubs();
      const rated = active.filter(s => s.rating > 0);
      const avgRating = rated.length ? rated.reduce((sum, s) => sum + s.rating, 0) / rated.length : 5;
      const income = window.LeakdIncome ? window.LeakdIncome.get() : 0;
      window.LeakdEffect.update(monthly, income, avgRating);
    }

    // Sparkline (last 30 days)
    renderSparkline();

    // Forecast widget for next 30 days
    renderForecast();

    // Show search bar once we have several subs
    $('searchBar').style.display = subs.length >= 5 ? 'flex' : 'none';
  }

  function renderForecast() {
    const card = $('forecastCard');
    if (!card || !window.LeakdInsights) return;
    const list = activeSubs();
    if (list.length === 0) { card.style.display = 'none'; return; }
    const fc = window.LeakdInsights.forecast(list, 30);
    if (fc.count === 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    $('forecastLabel').textContent = t('forecast.title', { n: 30 });
    $('forecastTotal').textContent = formatPrice(fc.total);
    $('forecastSub').textContent = t('forecast.total', { total: formatPrice(fc.total), count: fc.count });
  }

  // Count-up animation on stat value updates
  const _lastAnim = new WeakMap();
  function animateNumber(el, target, formatter) {
    const prev = _lastAnim.get(el) ?? 0;
    if (prev === target) {
      el.textContent = formatter(target);
      return;
    }
    _lastAnim.set(el, target);
    const start = performance.now();
    const duration = 600;
    const startVal = prev;
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const val = startVal + (target - startVal) * eased;
      el.textContent = formatter(val);
      if (t < 1 && _lastAnim.get(el) === target) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function renderStreak() {
    const card = $('streakCard');
    if (!card || !window.LeakdStreak) return;

    // Only show if the user has some subscriptions (don't overwhelm on empty app)
    if (subs.length === 0) { card.style.display = 'none'; return; }

    card.style.display = 'flex';
    const count = window.LeakdStreak.getCount();
    const checked = window.LeakdStreak.hasCheckedInToday();

    $('streakCount').textContent = count;
    card.classList.toggle('is-checked', checked);

    const btn = $('streakBtn');
    if (checked) {
      btn.textContent = t('streak.done') || 'Stayed clean today! ✨';
      btn.disabled = true;
      $('streakMsg').textContent = t('streak.msgDone') || 'Great job! See you tomorrow to keep the screen clean.';
    } else {
      btn.textContent = t('streak.btn') || 'I stayed clean!';
      btn.disabled = false;
      $('streakMsg').textContent = t('streak.msg') || 'Did you resist a new subscription today?';
    }
  }

  function renderSparkline() {
    if (!window.LeakdHistory) return;
    const svg = $('sparkline');
    if (!svg) return;
    const points = window.LeakdHistory.recent(30);
    if (points.length < 2) { svg.style.display = 'none'; return; }
    const max = Math.max(...points.map(p => p.monthly), 1);
    const W = 200, H = 40, pad = 2;
    const stepX = (W - pad * 2) / (points.length - 1);
    const pathParts = points.map((p, i) => {
      const x = pad + i * stepX;
      const y = H - pad - (p.monthly / max) * (H - pad * 2);
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    });
    const line = pathParts.join(' ');
    const fillPath = line + ` L ${W - pad},${H} L ${pad},${H} Z`;
    $('sparklinePath').setAttribute('d', line);
    $('sparklineFill').setAttribute('d', fillPath);
    svg.style.display = 'block';
  }

  function renderAlerts() {
    alertsEl.innerHTML = '';

    // Budget warnings — only for Pro users
    if (window.LeakdBudgets && window.LeakdPro && window.LeakdPro.isPro()) {
      const progress = window.LeakdBudgets.computeProgress(activeSubs());
      progress.filter(p => p.status !== 'ok').slice(0, 2).forEach(p => {
        const isOver = p.status === 'over';
        alertsEl.innerHTML += `
          <div class="alert-card ${isOver ? 'alert-danger' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div><strong>${escHtml(localizedCat(p.category))}</strong> · ${t(isOver ? 'budgets.over' : 'budgets.warn')} — ${t('budgets.spent', { spent: formatPrice(p.spent), limit: formatPrice(p.limit) })}</div>
          </div>`;
      });
    }

    subs.forEach(s => {
      if (s.paused) return;
      if (s.isTrial && s.trialEnd) {
        const days = daysUntil(s.trialEnd);
        if (days >= 0 && days <= 3) {
          alertsEl.innerHTML += `
            <div class="alert-card">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div><strong>${escHtml(s.name)}</strong> ${t('time.trialEnds', { when: dueLabel(days) })} — ${formatPrice(s.price, s.currency)}/${t('cycle.' + (s.cycle === 'monthly' ? 'mo' : s.cycle === 'yearly' ? 'yr' : 'wk')).replace('/', '')}.</div>
            </div>`;
        }
      }
      if (s.nextDate && !s.isTrial) {
        const days = daysUntil(s.nextDate);
        if (days >= 0 && days <= 2) {
          alertsEl.innerHTML += `
            <div class="alert-card">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <div><strong>${escHtml(s.name)}</strong> ${formatPrice(s.price, s.currency)} · ${dueLabel(days)}</div>
            </div>`;
        }
      }
    });
  }

  function renderCategories() {
    const cats = {};
    activeSubs().forEach(s => {
      if (!cats[s.category]) cats[s.category] = 0;
      cats[s.category] += toMonthly(s.price, s.cycle, s.currency);
    });
    let totalMonthly = 0;
    activeSubs().forEach(s => totalMonthly += toMonthly(s.price, s.cycle, s.currency));
    let html = `<button class="cat-btn ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">${t('cat.all')} ${subs.length > 0 ? '(' + formatPrice(totalMonthly) + ')' : ''}</button>`;
    Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, amount]) => {
      html += `<button class="cat-btn ${activeCategory === cat ? 'active' : ''}" data-cat="${escHtml(cat)}">${escHtml(localizedCat(cat))} (${formatPrice(amount)})</button>`;
    });
    categoriesEl.innerHTML = html;
    categoriesEl.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => { activeCategory = btn.dataset.cat; render(); });
    });
  }

  function renderList() {
    let filtered = activeCategory === 'all' ? subs : subs.filter(s => s.category === activeCategory);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        localizedCat(s.category).toLowerCase().includes(q) ||
        (Array.isArray(s.tags) && s.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }

    if (filtered.length === 0) {
      emptyStateEl.style.display = 'block';
      if (searchTerm) {
        emptyStateEl.querySelector('p').textContent = t('search.noResults');
        emptyStateEl.querySelector('.empty-sub').textContent = '';
      } else {
        emptyStateEl.querySelector('p').textContent = t('empty.title');
        emptyStateEl.querySelector('.empty-sub').textContent = t('empty.sub');
      }
      subListEl.querySelectorAll('.sub-item').forEach(el => el.remove());
      return;
    }
    emptyStateEl.style.display = 'none';

    const sorted = [...filtered].sort((a, b) => {
      // Paused at the bottom
      if (a.paused !== b.paused) return a.paused ? 1 : -1;
      const da = a.nextDate ? daysUntil(a.nextDate) : 999;
      const db = b.nextDate ? daysUntil(b.nextDate) : 999;
      return da - db;
    });
    let html = '';
    sorted.forEach(s => {
      const days = s.nextDate ? daysUntil(s.nextDate) : null;
      let badge = '';
      if (s.paused) {
        badge = `<span class="sub-badge badge-paused">${t('badge.paused')}</span>`;
      } else if (s.isTrial && s.trialEnd) {
        const td = daysUntil(s.trialEnd);
        if (td >= 0 && td <= 3) badge = `<span class="sub-badge badge-trial">${t('time.trialEnds', { when: dueLabel(td) })}</span>`;
      } else if (s.lastUsed && new Date(s.lastUsed).getTime() < Date.now() - 30 * 86400000) {
        badge = `<span class="sub-badge badge-zombie">${t('badge.zombie')}</span>`;
      } else if (days !== null && days >= 0 && days <= 3) {
        const label = days === 0 ? t('time.dueToday') : days === 1 ? t('time.dueTomorrow') : t('time.dueIn', { n: days });
        badge = `<span class="sub-badge badge-due">${label}</span>`;
      }
      let dateText = '';
      if (s.nextDate) {
        const d = new Date(s.nextDate);
        const lang = window.LeakdI18n ? window.LeakdI18n.lang : 'en';
        dateText = d.toLocaleDateString(lang, { month: 'short', day: 'numeric' });
      }
      const cycleLabel = t('cycle.' + (s.cycle === 'monthly' ? 'mo' : s.cycle === 'yearly' ? 'yr' : 'wk'));
      const iconHtml = window.LeakdBrands
        ? window.LeakdBrands.badgeHtml(s.name, s.category, 42)
        : `<div class="sub-icon" style="background:${(catColors[s.category] || catColors.Other).bg};color:${(catColors[s.category] || catColors.Other).text}">${(catColors[s.category] || catColors.Other).icon}</div>`;
      const notesLine = s.notes && s.notes.trim()
        ? `<div class="sub-notes">${escHtml(s.notes.trim())}</div>`
        : '';
      const tagChips = Array.isArray(s.tags) && s.tags.length
        ? `<div class="sub-tags">${s.tags.slice(0, 4).map(tg => '<span class="sub-tag">' + escHtml(tg) + '</span>').join('')}</div>`
        : '';
      html += `
        <div class="sub-item ${s.paused ? 'is-paused' : ''}" data-id="${s.id}">
          <div class="sub-swipe-bg"><span>${t('btn.delete')}</span></div>
          <div class="sub-item-content">
            ${iconHtml}
            <div class="sub-info">
              <div class="sub-name">${escHtml(s.name)}${s.isBusiness ? ' <span style="font-size: 14px; opacity: 0.8" title="Business expense">💼</span>' : ''}</div>
              <div class="sub-meta">
                <span>${escHtml(localizedCat(s.category))}</span>
                ${dateText ? '<span>·</span><span>' + dateText + '</span>' : ''}
                ${badge}
              </div>
              ${tagChips}
              ${notesLine}
            </div>
            <div class="sub-price">
              <div class="sub-amount">${formatPrice(s.price, s.currency)}</div>
              ${s.currency && s.currency !== settings.currencyCode ? `<div class="sub-amount-converted">≈ ${formatPrice(window.LeakdCurrency.convert(s.price, s.currency, settings.currencyCode))}</div>` : ''}
              <div class="sub-cycle">${cycleLabel}</div>
              ${s.sharedWith && s.sharedWith > 1 ? `
                <div class="sub-share-line" title="${escHtml(t('field.shared'))} ${s.sharedWith}">
                  <span class="sub-share-icon">👥</span>
                  <span>${t('share.yourShare', { amount: formatPrice(s.price / s.sharedWith, s.currency) })}</span>
                </div>` : ''}
            </div>
          </div>
        </div>`;
    });
    subListEl.querySelectorAll('.sub-item').forEach(el => el.remove());
    emptyStateEl.insertAdjacentHTML('beforebegin', html);
    subListEl.querySelectorAll('.sub-item').forEach(el => {
      bindSwipeToDelete(el);
      el.querySelector('.sub-item-content').addEventListener('click', () => {
        if (el.classList.contains('swiping') || el.classList.contains('swiped')) return;
        openEdit(el.dataset.id);
      });
    });
  }

  // Swipe-to-delete: mobile gesture on .sub-item — drag left to reveal delete
  function bindSwipeToDelete(el) {
    const content = el.querySelector('.sub-item-content');
    if (!content) return;
    let startX = 0, currentX = 0, dragging = false, settled = false;
    const THRESHOLD = 100;

    function onStart(x) { startX = x; currentX = 0; dragging = true; settled = false; el.classList.add('swiping'); }
    function onMove(x) {
      if (!dragging) return;
      currentX = Math.min(0, x - startX); // only allow left drag
      if (currentX > -8) return; // ignore tiny moves so taps still work
      content.style.transform = `translateX(${currentX}px)`;
      content.style.transition = 'none';
      el.classList.toggle('swiped-partial', currentX < -20);
    }
    function onEnd() {
      if (!dragging) return;
      dragging = false;
      content.style.transition = '';
      if (currentX < -THRESHOLD) {
        content.style.transform = `translateX(-110px)`;
        el.classList.add('swiped');
        settled = true;
        // Auto-collapse and delete after a short delay if user doesn't tap delete bg
        setTimeout(() => {
          if (el.classList.contains('swiped')) {
            // Show the delete state; the user can tap the red area to confirm
            // or tap anywhere else (handled below) to dismiss.
          }
        }, 0);
      } else {
        content.style.transform = '';
        el.classList.remove('swiped-partial');
      }
      // remove swiping class after transition
      setTimeout(() => { if (!settled) el.classList.remove('swiping'); }, 200);
    }

    // Touch
    content.addEventListener('touchstart', e => onStart(e.touches[0].clientX), { passive: true });
    content.addEventListener('touchmove', e => onMove(e.touches[0].clientX), { passive: true });
    content.addEventListener('touchend', onEnd);
    content.addEventListener('touchcancel', onEnd);

    // The red background = delete target
    const bg = el.querySelector('.sub-swipe-bg');
    if (bg) {
      bg.addEventListener('click', e => {
        e.stopPropagation();
        if (!el.classList.contains('swiped')) return;
        const id = el.dataset.id;
        if (!confirm(t('confirm.deleteSub'))) {
          content.style.transform = '';
          el.classList.remove('swiped', 'swiping', 'swiped-partial');
          return;
        }
        subs = subs.filter(x => x.id !== id);
        saveData();
        render();
      });
    }

    // Tap outside = collapse
    content.addEventListener('click', e => {
      if (el.classList.contains('swiped')) {
        e.stopPropagation();
        content.style.transform = '';
        el.classList.remove('swiped', 'swiping', 'swiped-partial');
      }
    }, true);
  }

  function renderInsights() {
    if (!window.LeakdInsights) return;
    const I = window.LeakdInsights;
    let list = activeSubs();
    if (insightsFilter === 'business') list = list.filter(s => s.isBusiness);
    if (insightsFilter === 'personal') list = list.filter(s => !s.isBusiness);

    const totals = I.totals(list);
    const ytd = I.paidThisYear(list);
    const proj = I.twelveMonthProjection(list);
    const cats = I.byCategory(list);
    const sugs = I.suggestions(list);

    $('ytdValue').textContent = formatPrice(ytd);
    $('ytdYear').textContent = String(new Date().getFullYear());

    const maxBar = Math.max(1, ...proj.map(p => p.amount));
    $('chartBars').innerHTML = proj.map(p => {
      const pct = (p.amount / maxBar) * 100;
      return `<div class="chart-bar-col"><div class="chart-bar" style="height:${pct}%"></div><div class="chart-bar-label">${p.label}</div></div>`;
    }).join('');
    $('chartTotal').textContent = formatPrice(totals.yearly) + ' /' + t('cycle.yr').replace('/', '');

    // Spending trend (historical) — line chart of monthly totals
    renderTrends();

    // Donut chart for category breakdown
    renderDonut(cats, totals.monthly);

    // Income ratio card
    renderIncomeRatio(totals.monthly);

    const breakdown = $('catBreakdown');
    if (cats.length === 0) {
      setEmptyState(breakdown, 'empty-state-mini', t('insights.noData'));
    } else {
      const max = cats[0].monthly;
      breakdown.innerHTML = cats.map(c => {
        const pct = (c.monthly / totals.monthly) * 100;
        const color = catPaletteDark[c.category] || '#78716c';
        return `<div class="cat-bar-row">
          <div class="cat-bar-head">
            <span class="cat-bar-name"><span class="cat-dot" style="background:${color}"></span>${escHtml(localizedCat(c.category))}</span>
            <span class="cat-bar-amount">${formatPrice(c.monthly)}<span class="cat-bar-pct">${pct.toFixed(0)}%</span></span>
          </div>
          <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(c.monthly / max) * 100}%;background:${color}"></div></div>
        </div>`;
      }).join('');
    }

    const sList = $('suggestionsList');
    if (sugs.length === 0) {
      setEmptyState(sList, 'empty-state-mini', list.length ? t('insights.clean') : t('insights.noSubs'));
    } else {
      sList.innerHTML = sugs.slice(0, 6).map(s => `
        <div class="suggestion-card sev-${s.severity}">
          <div class="suggestion-icon">${s.icon}</div>
          <div class="suggestion-body">
            <div class="suggestion-title">${escHtml(s.title)}</div>
            <div class="suggestion-text">${s.body}</div>
          </div>
        </div>
      `).join('');
    }

    // Calendar view
    renderCalendarView();
    // Aggregate lifetime
    renderLifetimeAggregate(list);
    // Bundle suggestions
    renderBundles();
    // Savings goal progress
    renderGoalCard();
    // Health score
    renderHealthCard();
    // Personality
    renderPersonalityCard(list);
    // Benchmarks
    renderBenchCard(list, totals.monthly);

    // Lowest-rated subs (cancellation candidates)
    const lowestCard = $('lowestRatedCard');
    if (lowestCard) {
      const lowest = window.LeakdInsights.lowestRated(list, 3);
      if (lowest.length === 0) {
        lowestCard.style.display = 'none';
      } else {
        lowestCard.style.display = 'block';
        $('lowestRatedList').innerHTML = lowest.map(s => {
          const stars = '★'.repeat(s.rating) + '☆'.repeat(5 - s.rating);
          const iconHtml = window.LeakdBrands ? window.LeakdBrands.badgeHtml(s.name, s.category, 32) : '';
          return `<div class="lowest-row">
            ${iconHtml}
            <div class="lowest-info">
              <div class="lowest-name">${escHtml(s.name)}</div>
              <div class="lowest-stars">${stars}</div>
            </div>
            <div class="lowest-price">${formatPrice(s.monthly)}<span>/${t('cycle.mo').replace('/', '')}</span></div>
          </div>`;
        }).join('');
      }
    }
    // Panic Button visibility
    renderPanicButton(list, totals.monthly);
  }

  function renderPanicButton(list, monthlySpend) {
    const cta = $('panicCta');
    if (!cta) return;

    // Threshold per currency (roughly equivalent to $100)
    const thresholds = {
      '$': 100,
      '€': 100,
      '£': 80,
      'Ft': 40000,
      '¥': 15000,
      '₹': 8000,
      'R$': 500,
      'A$': 150
    };

    const threshold = thresholds[settings.currency] || 100;
    if (monthlySpend >= threshold && list.length > 0) {
      cta.style.display = 'block';
    } else {
      cta.style.display = 'none';
    }
  }

  function openPanicModal() {
    const modal = $('panicModal');
    const list = activeSubs();
    const lowest = window.LeakdInsights.lowestRated(list, 10); // Show up to 10

    const container = $('panicList');
    if (lowest.length === 0) {
      setEmptyState(container, 'empty-state-mini', t('insights.noData'));
    } else {
      container.innerHTML = lowest.map(s => {
        const cancelUrl = window.LeakdImport ? window.LeakdImport.findCancelUrl(s.name) : null;
        const iconHtml = window.LeakdBrands ? window.LeakdBrands.badgeHtml(s.name, s.category, 36) : '';
        const cycleLabel = t('cycle.mo').replace('/', '');

        return `
          <div class="panic-row">
            ${iconHtml}
            <div class="panic-info">
              <div class="panic-name">${escHtml(s.name)}</div>
              <div class="panic-meta">${formatPrice(s.monthly)}/${cycleLabel} · ${'★'.repeat(s.rating)}</div>
            </div>
            ${cancelUrl ? `<a href="${cancelUrl}" target="_blank" rel="noopener" class="btn-panic-cancel">${t('btn.cancelSub')}</a>` : ''}
          </div>
        `;
      }).join('');
    }

    modal.classList.add('active');
    if (window.LeakdActivity) logActivity('panic_triggered', null, { spend: activeSubs().reduce((a, b) => a + toMonthly(b.price, b.cycle, b.currency), 0) });
  }

  function closePanicModal() {
    $('panicModal').classList.remove('active');
  }

  // ─── Calendar view ───
  function renderCalendarView() {
    const card = $('calendarCard');
    if (!card || !window.LeakdCalView) return;
    const list = activeSubs();
    if (list.length === 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    const lang = window.LeakdI18n ? window.LeakdI18n.lang : 'en';
    const grid = window.LeakdCalView.monthGrid(list, calMonthOffset);
    $('calMonthName').textContent = grid.monthName;
    const weekdays = window.LeakdCalView.weekdayLabels(lang);
    let html = '<div class="cal-weekdays">';
    weekdays.forEach(w => { html += `<div class="cal-weekday">${escHtml(w)}</div>`; });
    html += '</div>';
    const weekTotals = grid.weeks.map(week => {
      return week.reduce((sum, cell) => sum + (cell ? cell.total : 0), 0);
    });
    const maxWeekTotal = Math.max(...weekTotals);

    grid.weeks.forEach((week, weekIndex) => {
      const weekTotal = weekTotals[weekIndex];
      let weekClass = 'cal-week';
      if (maxWeekTotal > 0) {
        if (weekTotal === 0) weekClass += ' cal-week-calm';
        else if (weekTotal >= 0.55 * maxWeekTotal) weekClass += ' cal-week-dense';
      }
      html += `<div class="${weekClass}">`;
      week.forEach(cell => {
        if (!cell) {
          html += '<div class="cal-cell cal-cell-empty"></div>';
        } else {
          const cls = 'cal-cell' + (cell.isToday ? ' is-today' : '') + (cell.hasRenewals ? ' has-renewals' : '');
          let cellContentHtml = `<span class="cal-day-num">${cell.day}</span>`;
          if (cell.hasRenewals) {
            const renewals = cell.renewals;
            if (renewals.length === 1) {
              const r = renewals[0];
              const brand = window.LeakdBrands ? window.LeakdBrands.badge(r.name, r.category) : { bg: '#ef4444' };
              const priceText = formatPrice(r.price, r.currency).split('.')[0];
              const shortName = r.name.length > 7 ? r.name.slice(0, 6) + '…' : r.name;
              cellContentHtml += `
                <div class="cal-cell-inner-brand">
                  <span class="cal-brand-dot" style="background: ${brand.bg}"></span>
                  <span class="cal-brand-name">${escHtml(shortName)}</span>
                  <span class="cal-brand-price">${escHtml(priceText)}</span>
                </div>
              `;
            } else {
              const totalText = formatPrice(cell.total).split('.')[0];
              cellContentHtml += `
                <div class="cal-cell-inner-brand">
                  <div class="cal-brand-dots-row">
                    ${renewals.slice(0, 3).map(r => {
                      const brand = window.LeakdBrands ? window.LeakdBrands.badge(r.name, r.category) : { bg: '#ef4444' };
                      return `<span class="cal-brand-dot" style="background: ${brand.bg}"></span>`;
                    }).join('')}
                  </div>
                  <span class="cal-brand-name">${t('calendar.leaks', { count: renewals.length })}</span>
                  <span class="cal-brand-price">${escHtml(totalText)}</span>
                </div>
              `;
            }
          }
          html += `<button class="${cls}" data-day="${cell.day}">${cellContentHtml}</button>`;
        }
      });
      html += '</div>';
    });
    $('calendarGrid').innerHTML = html;
    if (grid.countThisMonth === 0) {
      $('calendarSub').textContent = t('calendar.empty');
    } else {
      $('calendarSub').textContent = t('calendar.thisMonth', {
        count: grid.countThisMonth, total: formatPrice(grid.totalThisMonth),
      });
    }
    $('calDayDetail').style.display = 'none';

    // Bind day clicks
    $('calendarGrid').querySelectorAll('.cal-cell.has-renewals').forEach(btn => {
      btn.addEventListener('click', () => showCalDayDetail(grid, parseInt(btn.dataset.day, 10)));
    });
  }

  function showCalDayDetail(grid, day) {
    // Find renewals for that day
    let renewals = [];
    grid.weeks.forEach(week => {
      week.forEach(cell => {
        if (cell && cell.day === day) renewals = cell.renewals;
      });
    });
    if (!renewals.length) return;
    const detail = $('calDayDetail');
    const dateStr = new Date(grid.year, grid.month, day).toLocaleDateString(
      window.LeakdI18n ? window.LeakdI18n.lang : 'en',
      { month: 'long', day: 'numeric' }
    );
    const key = renewals.length === 1 ? 'calendar.dayDetail' : 'calendar.dayDetailPlural';
    let html = `<div class="cal-detail-head">${t(key, { date: dateStr, count: renewals.length })}</div>`;
    html += '<div class="cal-detail-list">';
    renewals.forEach(r => {
      const iconHtml = window.LeakdBrands ? window.LeakdBrands.badgeHtml(r.name, r.category, 28) : '';
      html += `<div class="cal-detail-row">${iconHtml}<span class="cal-detail-name">${escHtml(r.name)}</span><span class="cal-detail-price">${formatPrice(r.price, r.currency)}</span></div>`;
    });
    html += '</div>';
    detail.innerHTML = html;
    detail.style.display = 'block';
  }

  function renderLifetimeAggregate(subs) {
    const card = $('lifetimeAggCard');
    if (!card || !window.LeakdLifetime) return;
    const total = window.LeakdLifetime.aggregateLifetime(subs);
    if (total <= 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    $('lifetimeAggValue').textContent = formatPrice(total);
  }

  // SVG donut chart for category breakdown
  // Spending trend (historical) — bucket history snapshots into months
  // and render a small SVG line + summary delta. Hidden if there's not
  // enough data (need at least 2 distinct months) so a fresh user
  // doesn't see an empty chart.
  function renderTrends() {
    const card = $('trendsCard');
    if (!card || !window.LeakdHistory) return;
    const points = window.LeakdHistory.load();
    if (!points || points.length === 0) { card.style.display = 'none'; return; }
    // Bucket by YYYY-MM, take LAST snapshot of each month (closest to month-end)
    const byMonth = {};
    for (const p of points) {
      if (!p.date) continue;
      const ym = p.date.slice(0, 7);
      byMonth[ym] = p.monthly;
    }
    const months = Object.keys(byMonth).sort().slice(-6);
    if (months.length < 2) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    const values = months.map(m => byMonth[m]);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    // SVG path through normalized points (viewBox: 320×100, 10px padding)
    const pad = 8, w = 320 - 2 * pad, h = 100 - 2 * pad;
    const step = values.length === 1 ? 0 : w / (values.length - 1);
    const coords = values.map((v, i) => {
      const x = pad + i * step;
      const y = pad + h - ((v - min) / range) * h;
      return [x, y];
    });
    const path = coords.map((c, i) => (i ? 'L' : 'M') + c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(' ');
    const area = path + ` L${pad + w},${pad + h} L${pad},${pad + h} Z`;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ef4444';
    const dots = coords.map((c, i) => {
      const r = i === coords.length - 1 ? 4 : 2.5;
      return `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${r}" fill="${accent}"/>`;
    }).join('');
    $('trendsSvg').innerHTML = `
      <defs>
        <linearGradient id="trendsGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#trendsGrad)"/>
      <path d="${path}" fill="none" stroke="${accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    `;
    // Month labels (localized short month)
    const lang = window.LeakdI18n ? window.LeakdI18n.lang : 'en';
    $('trendsLabels').innerHTML = months.map(m => {
      const [yy, mm] = m.split('-');
      const d = new Date(parseInt(yy, 10), parseInt(mm, 10) - 1, 1);
      return `<span>${d.toLocaleDateString(lang, { month: 'short' })}</span>`;
    }).join('');
    // Summary: delta from first → last month
    const first = values[0], last = values[values.length - 1];
    const delta = last - first;
    const pct = first > 0 ? Math.round((delta / first) * 100) : 0;
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
    const sign = pct > 0 ? '+' : '';
    const sumKey = delta > 0 ? 'trends.up' : delta < 0 ? 'trends.down' : 'trends.flat';
    $('trendsSummary').textContent = t(sumKey, {
      arrow, pct: sign + pct + '%',
      amount: formatPrice(Math.abs(delta))
    });
  }

  function renderDonut(cats, total) {
    const svg = $('donutChart');
    const wrap = $('donutWrap');
    if (!svg || !wrap) return;
    if (cats.length === 0 || total <= 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';
    const cx = 60, cy = 60, r = 48, strokeW = 14;
    const circumference = 2 * Math.PI * r;
    let offset = -Math.PI / 2; // start at top
    let html = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${strokeW}"/>`;
    cats.forEach(c => {
      const pct = c.monthly / total;
      const dash = pct * circumference;
      const gap = circumference - dash;
      const color = catPaletteDark[c.category] || '#78716c';
      // Rotate via stroke-dasharray + transform
      const rot = (offset * 180 / Math.PI);
      html += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${color}" stroke-width="${strokeW}"
        stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
        transform="rotate(${rot} ${cx} ${cy})"></circle>`;
      offset += pct * 2 * Math.PI;
    });
    svg.innerHTML = html;
    $('donutCenterValue').textContent = formatPrice(total);
  }

  function renderIncomeRatio(monthly) {
    const card = $('incomeRatioCard');
    if (!card || !window.LeakdIncome) return;
    const ratio = window.LeakdIncome.ratio(monthly);
    if (ratio == null) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    const pct = Math.min(100, ratio * 100);
    const sentiment = window.LeakdIncome.sentiment(ratio);
    $('ratioFill').style.width = pct + '%';
    $('ratioFill').className = 'ratio-fill sentiment-' + sentiment;
    $('ratioValue').textContent = (ratio * 100).toFixed(1) + '%';
    $('incomeRatioLabel').textContent = t('income.ratio.label');
    const sub = sentiment === 'crisis' ? t('income.ratio.crisis')
      : sentiment === 'high' ? t('income.ratio.high')
        : t('income.ratio.fine');
    $('ratioSentiment').textContent = sub;
    $('ratioSentiment').className = 'ratio-sentiment sentiment-' + sentiment;
  }

  function setView(view) {
    activeView = view;
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById('view' + view.charAt(0).toUpperCase() + view.slice(1)).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    $('addBtn').style.display = view === 'home' ? 'flex' : 'none';
    render();
  }

  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function renderSharedChecklist(optSub) {
    const container = $('subSharedChecklist');
    if (!container) return;

    const priceInput = parseFloat($('subPrice').value) || 0;
    const currency = $('subCurrency').value;
    const sharedRaw = parseInt($('subShared').value, 10);
    const sharedWith = isNaN(sharedRaw) || sharedRaw < 1 ? 1 : Math.min(20, sharedRaw);

    if (sharedWith <= 1) {
      container.innerHTML = '';
      return;
    }

    const friendNamesStr = $('subSharedNames').value || '';
    const friendNames = friendNamesStr.split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    const pricePerPerson = priceInput / sharedWith;

    // Load who has paid already
    let paidList = [];
    if (optSub && Array.isArray(optSub.sharedPaid)) {
      paidList = optSub.sharedPaid;
    } else {
      // Collect current checkboxes that are checked
      paidList = Array.from(container.querySelectorAll('.shared-checklist-item input[type="checkbox"]:checked'))
        .map(el => el.dataset.name);
    }

    let html = '';
    const totalFriendSlots = sharedWith - 1;
    for (let i = 0; i < totalFriendSlots; i++) {
      const defaultLabel = window.LeakdI18n && window.LeakdI18n.lang === 'hu' ? 'Barát' : 'Friend';
      const name = friendNames[i] || `${defaultLabel} ${i + 1}`;
      const isPaid = paidList.includes(name);

      html += `
        <div class="shared-checklist-item">
          <label class="shared-checklist-label">
            <input type="checkbox" data-name="${escHtml(name)}" ${isPaid ? 'checked' : ''}>
            <span class="shared-friend-name">${escHtml(name)}</span>
            <span class="shared-friend-share">(${formatPrice(pricePerPerson, currency)})</span>
          </label>
          <button type="button" class="btn-copy-reminder" data-name="${escHtml(name)}" data-amount="${pricePerPerson}" data-currency="${currency}">
            <span class="copy-icon">💬</span>
            <span class="copy-text">${t('field.splitCopyReminder')}</span>
          </button>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  function copyFriendReminder(friendName, amount, currencyCode) {
    const serviceName = $('subName').value.trim() || 'Leakd';
    const paymentInfo = $('subPaymentInfo').value.trim() || '';

    // Handle Revolut link formatting: revolut.me/username/amount
    let payLink = paymentInfo;
    if (paymentInfo.toLowerCase().startsWith('revolut.me/')) {
      const username = paymentInfo.split('/')[1] || '';
      if (username) {
        const rawAmount = Math.round(amount);
        const formattedLinkVal = currencyCode === 'HUF' ? `${rawAmount}HUF` : rawAmount;
        payLink = `revolut.me/${username.split('?')[0]}/${formattedLinkVal}`;
      }
    } else if (paymentInfo.toLowerCase().startsWith('paypal.me/')) {
      const username = paymentInfo.split('/')[1] || '';
      if (username) {
        payLink = `paypal.me/${username.split('?')[0]}/${amount.toFixed(2)}`;
      }
    }

    const amountFormatted = formatPrice(amount, currencyCode);
    const textTemplate = t('share.reminderText', {
      friend: friendName,
      service: serviceName,
      amount: amountFormatted,
      paymentInfo: payLink || '...'
    });

    navigator.clipboard.writeText(textTemplate).then(() => {
      toast(t('share.reminderCopied') || 'Reminder message copied!');
    }).catch(err => {
      console.error('Could not copy reminder:', err);
      // Fallback for non-secure environments
      try {
        const ta = document.createElement('textarea');
        ta.value = textTemplate;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast(t('share.reminderCopied') || 'Reminder message copied!');
      } catch (e) {
        console.error('Fallback copy failed:', e);
      }
    });
  }

  // ─── Modal ───
  function openAdd() {
    editingId = null;
    $('modalTitle').textContent = t('modal.add');
    $('subName').value = '';
    $('subPrice').value = '';
    $('subCurrency').value = settings.currencyCode || 'EUR';
    $('subCycle').value = 'monthly';
    $('subCategory').value = 'Entertainment';
    $('subCategoryCustom').style.display = 'none';
    $('subCategoryCustom').value = '';
    setDefaultDate();
    $('subTrial').checked = false;
    $('subPaused').checked = false;
    $('subBusiness').checked = false;
    $('subNotes').value = '';
    $('subShared').value = '';
    $('subSharedNames').value = '';
    $('subPaymentInfo').value = '';
    $('subSharedDetails').style.display = 'none';
    $('subSharedChecklist').innerHTML = '';
    $('subTags').value = '';
    $('subLastUsed').value = '';
    setRatingUI(0);
    $('lifetimeCard').style.display = 'none';
    $('playbookCard').style.display = 'none';
    const _altCard = $('altCard'); if (_altCard) _altCard.style.display = 'none';
    $('trialDateWrap').style.display = 'none';
    $('subTrialEnd').value = '';
    $('editId').value = '';
    $('deleteBtn').style.display = 'none';
    $('markCancelledBtn').style.display = 'none';
    $('cancelUrlWrap').style.display = 'none';
    $('trackedSince').style.display = 'none';
    $('presets').style.display = 'flex';
    document.querySelector('.form-divider').style.display = 'flex';
    hideSuggestions();
    modal.classList.add('active');
    setTimeout(() => $('subName').focus(), 100);
  }

  function openEdit(id) {
    const s = subs.find(x => x.id === id);
    if (!s) return;
    editingId = id;
    $('modalTitle').textContent = t('modal.edit');
    $('subName').value = s.name;
    $('subPrice').value = s.price;
    $('subCurrency').value = s.currency || settings.currencyCode || 'EUR';
    $('subCycle').value = s.cycle;

    // Handle custom categories in edit
    const catSelect = $('subCategory');
    const isCustom = !Array.from(catSelect.options).some(opt => opt.value === s.category);
    if (isCustom) {
      catSelect.value = '_new';
      $('subCategoryCustom').value = s.category;
      $('subCategoryCustom').style.display = 'block';
    } else {
      catSelect.value = s.category;
      $('subCategoryCustom').style.display = 'none';
      $('subCategoryCustom').value = '';
    }

    $('subDate').value = s.nextDate || '';
    $('subTrial').checked = s.isTrial || false;
    $('subPaused').checked = s.paused || false;
    $('subBusiness').checked = s.isBusiness || false;
    $('subNotes').value = s.notes || '';
    $('subShared').value = s.sharedWith && s.sharedWith > 1 ? String(s.sharedWith) : '';
    if (s.sharedWith && s.sharedWith > 1) {
      $('subSharedDetails').style.display = 'block';
      $('subSharedNames').value = s.sharedNames || '';
      $('subPaymentInfo').value = s.paymentInfo || '';
      renderSharedChecklist(s);
    } else {
      $('subSharedDetails').style.display = 'none';
      $('subSharedNames').value = '';
      $('subPaymentInfo').value = '';
      $('subSharedChecklist').innerHTML = '';
    }
    $('subTags').value = Array.isArray(s.tags) ? s.tags.join(', ') : (s.tags || '');
    $('subLastUsed').value = s.lastUsed || '';
    setRatingUI(s.rating || 0);
    renderLifetimeCard(s);
    renderAltCard(s);
    renderPlaybookCard(s);
    $('trialDateWrap').style.display = s.isTrial ? 'block' : 'none';
    $('subTrialEnd').value = s.trialEnd || '';
    $('deleteBtn').style.display = 'inline-block';
    // Mark-as-cancelled is now redundant — Delete already routes through
    // the cancelled registry. Keep the element for backwards compat.
    $('markCancelledBtn').style.display = 'none';
    $('presets').style.display = 'none';
    document.querySelector('.form-divider').style.display = 'none';
    hideSuggestions();

    // Cancel URL if we know this service
    const url = window.LeakdImport ? window.LeakdImport.findCancelUrl(s.name) : null;
    if (url) {
      $('cancelUrlWrap').style.display = 'block';
      $('cancelUrlLink').href = url;
    } else {
      $('cancelUrlWrap').style.display = 'none';
    }

    // Tracked-since (if createdAt is known)
    if (s.createdAt) {
      const since = new Date(s.createdAt);
      const months = (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      const years = Math.floor(months / 12);
      const remMonths = Math.floor(months % 12);
      let label;
      if (years === 0 && remMonths === 0) label = t('tracked.months', { n: 0 });
      else if (years === 0) label = t('tracked.months', { n: remMonths });
      else if (remMonths === 0) label = t('tracked.years', { n: years });
      else label = t('tracked.both', { years, months: remMonths });
      $('trackedSince').textContent = t('tracked.since', { when: label });
      $('trackedSince').style.display = 'block';
    } else {
      $('trackedSince').style.display = 'none';
    }

    modal.classList.add('active');
    setTimeout(() => $('subName').focus(), 100);
  }

  function closeModalFn() { modal.classList.remove('active'); editingId = null; }

  function setDefaultDate() {
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    $('subDate').value = now.toISOString().split('T')[0];
  }

  // ─── Activity log: record helper ───
  function logActivity(type, sub, payload) {
    if (window.LeakdActivity) window.LeakdActivity.record(type, sub, payload);
  }

  function saveSub() {
    const name = $('subName').value.trim();
    const price = parseFloat($('subPrice').value);
    const currency = $('subCurrency').value;
    const cycle = $('subCycle').value;
    let category = $('subCategory').value;
    if (category === '_new') {
      category = $('subCategoryCustom').value.trim() || 'Other';
    }
    const nextDate = $('subDate').value;
    const isTrial = $('subTrial').checked;
    const paused = $('subPaused').checked;
    const isBusiness = $('subBusiness').checked;
    const trialEnd = $('subTrialEnd').value;
    const lastUsed = $('subLastUsed').value;
    const notes = $('subNotes').value.trim();
    const rating = parseInt($('subRating').dataset.rating || '0', 10);
    const sharedRaw = parseInt($('subShared').value, 10);
    const sharedWith = isNaN(sharedRaw) || sharedRaw < 1 ? 1 : Math.min(20, sharedRaw);
    const sharedNames = $('subSharedNames').value.trim();
    const paymentInfo = $('subPaymentInfo').value.trim();
    const sharedPaid = Array.from(document.querySelectorAll('.shared-checklist-item input[type="checkbox"]:checked'))
      .map(el => el.dataset.name);
    const tagsRaw = $('subTags').value.trim();
    const tags = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0 && t.length <= 24).slice(0, 8)
      : [];
    if (!name) { $('subName').focus(); return; }
    if (!price || price <= 0) { $('subPrice').focus(); return; }
    if (editingId) {
      const idx = subs.findIndex(x => x.id === editingId);
      if (idx !== -1) {
        const prev = subs[idx];
        const wasPaused = prev.paused;
        // Price-change detection: only when currency stayed the same and the
        // user actually moved the number. Surfaces a toast with the delta %
        // (+/-) so a hike is unmissable, and logs to the activity feed for
        // history.
        const priceChanged = prev.price !== price && prev.currency === currency;
        const priceDelta = priceChanged ? price - prev.price : 0;
        const pctChange = priceChanged && prev.price > 0
          ? Math.round((priceDelta / prev.price) * 100)
          : 0;
        subs[idx] = { ...prev, name, price, currency, cycle, category, nextDate, isTrial, trialEnd, lastUsed, paused, isBusiness, notes, rating, sharedWith, tags, sharedNames, sharedPaid, paymentInfo, updatedAt: Date.now() };
        if (paused && !wasPaused) logActivity('paused', subs[idx]);
        else if (!paused && wasPaused) logActivity('resumed', subs[idx]);
        else logActivity('edited', subs[idx]);
        if (priceChanged) {
          // Separate activity entry so the user can see the price history
          logActivity('priceChange', { ...subs[idx], _prevPrice: prev.price, _delta: priceDelta, _pct: pctChange });
          // Visible toast — up/down emoji makes the direction instant
          const arrow = priceDelta > 0 ? '↑' : '↓';
          const sign = pctChange > 0 ? '+' : '';
          toast(t('toast.priceChange', {
            name: name,
            from: formatPrice(prev.price, currency),
            to: formatPrice(price, currency),
            arrow,
            pct: sign + pctChange + '%',
          }));
        }
      }
    } else {
      const newSub = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name, price, currency, cycle, category, nextDate, isTrial, trialEnd, lastUsed, paused, isBusiness, notes, rating, sharedWith, tags,
        sharedNames, sharedPaid, paymentInfo,
        createdAt: new Date().toISOString(),
        updatedAt: Date.now()
      };
      subs.push(newSub);
      logActivity('added', newSub);
    }
    saveData();
    closeModalFn();
    if (window.LeakdCurrency) {
      window.LeakdCurrency.sync(subs).then(() => render());
    } else {
      render();
    }
  }

  function deleteSub() {
    if (!editingId) return;
    if (!confirm(t('confirm.deleteSub'))) return;
    const target = subs.find(x => x.id === editingId);
    // Soft-delete: route through the cancelled registry so the user can
    // find it again (and so cancellation savings are tracked). The user
    // can permanently purge from the Cancelled view via the × button.
    if (target && window.LeakdCancelled) {
      window.LeakdCancelled.add(target);
      console.log('[Leakd] soft-deleted to cancelled:', target.name);
    }
    subs = subs.filter(x => x.id !== editingId);
    if (target) logActivity('deleted', target);
    saveData();
    closeModalFn();
    render();
    toast(t('toast.subCancelled'));
  }

  function markAsCancelled() {
    if (!editingId) return;
    if (!confirm(t('confirm.markCancelled'))) return;
    const sub = subs.find(x => x.id === editingId);
    if (!sub) return;
    if (window.LeakdCancelled) window.LeakdCancelled.add(sub);
    subs = subs.filter(x => x.id !== editingId);
    logActivity('cancelled', sub);
    saveData();
    closeModalFn();
    render();
    toast(t('toast.subCancelled'));
  }

  // ─── Cancelled subs modal ───
  function openCancelledModal() {
    renderCancelledList();
    $('cancelledModal').classList.add('active');
  }
  function closeCancelledModal() { $('cancelledModal').classList.remove('active'); }

  function renderCancelledList() {
    if (!window.LeakdCancelled) return;
    const list = window.LeakdCancelled.all();
    const hero = $('cancelledHero');
    const emptyEl = $('cancelledEmpty');
    const listEl = $('cancelledList');
    const shareBtn = $('cancelledShareBtn');

    if (list.length === 0) {
      hero.style.display = 'none';
      emptyEl.style.display = 'block';
      listEl.innerHTML = '';
      return;
    }
    emptyEl.style.display = 'none';
    hero.style.display = 'block';

    const lifetime = window.LeakdCancelled.lifetimeSavings();
    const monthly = window.LeakdCancelled.savings();
    const killed = window.LeakdCancelled.count();

    animateCounter($('cancelledLifetimeBig'), lifetime, formatPrice);
    $('cancelledSavings').textContent = formatPrice(monthly) + '/' + t('cycle.mo').replace('/', '');
    $('cancelledKilled').textContent = killed;
    $('cancelledThisYear').textContent = (killed === 1
      ? t('cancelled.subsKilledOne')
      : t('cancelled.subsKilled'));
    if (shareBtn) shareBtn.style.display = lifetime >= 1 ? 'block' : 'none';

    const now = Date.now();
    const lang = window.LeakdI18n ? window.LeakdI18n.lang : 'en';

    listEl.innerHTML = list
      .sort((a, b) => new Date(b.cancelledAt) - new Date(a.cancelledAt))
      .map((s, i) => {
        const date = s.cancelledAt
          ? new Date(s.cancelledAt).toLocaleDateString(lang, { year: 'numeric', month: 'short' })
          : '—';
        const lifetimeForSub = window.LeakdCancelled.lifetimePerSub(s, now);
        const stagger = Math.min(i * 40, 600); // cap the cascade so 30+ tombstones don't crawl
        return `<div class="tombstone" data-id="${s.id}" style="animation-delay:${stagger}ms">
          <div class="tombstone-rip">R · I · P</div>
          <div class="tombstone-name" title="${escHtml(s.name)}">${escHtml(s.name)}</div>
          <div class="tombstone-date">${escHtml(date)}</div>
          <div class="tombstone-saved">+${formatPrice(lifetimeForSub)}</div>
          <div class="tombstone-saved-lbl">${escHtml(t('cancelled.savedSoFar'))}</div>
          <div class="tombstone-actions">
            <button data-action="restore" title="${escHtml(t('cancelled.restoreBtn'))}">↺</button>
            <button data-action="purge" title="${escHtml(t('cancelled.purgeBtn'))}">×</button>
          </div>
        </div>`;
      }).join('');

    listEl.querySelectorAll('.tombstone').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-action="restore"]').addEventListener('click', () => restoreCancelled(id));
      row.querySelector('[data-action="purge"]').addEventListener('click', () => purgeCancelled(id));
    });
  }

  // Counts the big hero number from its current value up to `target` over
  // ~700ms. Reusing the same element rebinds, so re-opens replay the count.
  function animateCounter(el, target, formatter) {
    if (!el) return;
    const fmt = formatter || (n => String(Math.round(n)));
    const dur = 700;
    const start = performance.now();
    const from = 0;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (target - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function shareGraveyard() {
    if (!window.LeakdCancelled) return;
    const lifetime = window.LeakdCancelled.lifetimeSavings();
    const killed = window.LeakdCancelled.count();
    if (killed === 0) return;
    const text = t('cancelled.shareMsg', {
      amount: formatPrice(lifetime),
      n: killed,
    });
    const data = { title: 'Leakd', text, url: 'https://leakd.app' };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch { }
    }
    try {
      await navigator.clipboard.writeText(text + ' https://leakd.app');
      toast(t('toast.linkCopied'));
    } catch {
      toast(text);
    }
  }

  function restoreCancelled(id) {
    if (!window.LeakdCancelled) return;
    if (!confirm(t('cancelled.confirmRestore'))) return;
    const restored = window.LeakdCancelled.restore(id);
    if (!restored) return;
    subs.push(restored);
    logActivity('restored', restored);
    saveData();
    renderCancelledList();
    render();
    toast(t('toast.subRestored'));
  }

  function purgeCancelled(id) {
    if (!window.LeakdCancelled) return;
    if (!confirm(t('cancelled.confirmPurge'))) return;
    window.LeakdCancelled.remove(id);
    renderCancelledList();
    refreshDynamicLabels();
  }

  // ─── Theme picker modal ───
  function openThemeModal() {
    const m = $('themeModal');
    m.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === (settings.theme || 'auto'));
    });
    m.classList.add('active');
  }
  function closeThemeModal() { $('themeModal').classList.remove('active'); }

  // ─── Star rating ───
  function setRatingUI(value) {
    const wrap = $('subRating');
    if (!wrap) return;
    wrap.dataset.rating = String(value || 0);
    wrap.querySelectorAll('.star').forEach((star, idx) => {
      star.classList.toggle('filled', idx < value);
    });
  }

  // ─── Lifetime cost card ───
  // Shows in edit modal: total paid so far + projection + investment alt.
  function renderLifetimeCard(sub) {
    const card = $('lifetimeCard');
    if (!card || !window.LeakdLifetime || !sub.createdAt) {
      if (card) card.style.display = 'none';
      return;
    }
    const r = window.LeakdLifetime.report(sub, 7);
    if (!r.lifetime) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    $('lifetimeValue').textContent = formatPrice(r.lifetime.totalPaid);
    const lang = window.LeakdI18n ? window.LeakdI18n.lang : 'en';
    const dateStr = r.lifetime.startDate.toLocaleDateString(lang, { month: 'short', year: 'numeric' });
    $('lifetimeSince').textContent = t('lifetime.since', { date: dateStr });
    $('lifetimeNext5y').textContent = formatPrice(r.next5y);
    $('lifetimeNext10y').textContent = formatPrice(r.next10y);
    $('lifetimeInvest5y').textContent = formatPrice(r.invested5y);
    $('lifetimeInvest10y').textContent = formatPrice(r.invested10y);
    const inf10y = $('lifetimeInflated10y');
    const inf10m = $('lifetimeInflated10yMonthly');
    if (inf10y) inf10y.textContent = formatPrice(r.inflated10yTotal);
    if (inf10m) inf10m.textContent = formatPrice(r.inflated10yMonthly);
  }

  // ─── Cheaper alternatives card ───
  function renderAltCard(sub) {
    const card = $('altCard');
    if (!card || !window.LeakdAlternatives) { if (card) card.style.display = 'none'; return; }
    const alts = window.LeakdAlternatives.findAlternatives(sub.name);
    if (!alts || alts.length === 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    const currentMonthly = toMonthly(sub.price, sub.cycle, sub.currency);
    const trAlt = (window.LeakdAlternatives && window.LeakdAlternatives.tr) || (s => s);
    $('altList').innerHTML = alts.map(alt => {
      const isFree = alt.price === 0;
      const altPriceLocal = fromUsd(alt.price);
      const savings = currentMonthly - altPriceLocal;
      const badgeText = isFree ? t('alt.free') : (savings > 0 ? t('alt.cheaper', { amount: formatPrice(savings) }) : '');
      const badgeCls = isFree ? 'alt-free' : 'alt-cheaper';
      return `<div class="alt-row">
        <div class="alt-row-main">
          <div class="alt-row-name">${escHtml(trAlt(alt.name))} ${badgeText ? '<span class="alt-badge ' + badgeCls + '">' + badgeText + '</span>' : ''}</div>
          <div class="alt-row-why">${escHtml(trAlt(alt.why))}</div>
        </div>
        <div class="alt-row-price">${formatPrice(altPriceLocal)}<span>/${t('cycle.mo').replace('/', '')}</span></div>
      </div>`;
    }).join('');
  }

  // ─── Cancellation playbook card ───
  function renderPlaybookCard(sub) {
    const card = $('playbookCard');
    if (!card || !window.LeakdImport) { if (card) card.style.display = 'none'; return; }
    const pb = window.LeakdImport.findPlaybook(sub.name);
    if (!pb) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    const diffEl = $('playbookDiff');
    diffEl.textContent = t('playbook.diff' + pb.difficulty.charAt(0).toUpperCase() + pb.difficulty.slice(1));
    diffEl.className = 'playbook-diff diff-' + pb.difficulty;
    $('playbookTime').textContent = t('playbook.time', { n: pb.minutes });
    const trStep = (window.LeakdImport && window.LeakdImport.trStep) || (s => s);
    $('playbookSteps').innerHTML = pb.steps.map(s => `<li>${escHtml(trStep(s))}</li>`).join('');
  }

  function applyPreset(btn) {
    $('subName').value = btn.dataset.name;
    $('subPrice').value = btn.dataset.price;
    $('subCurrency').value = btn.dataset.currency || settings.currencyCode || 'EUR';
    $('subCategory').value = btn.dataset.cat;
    $('subCycle').value = 'monthly';
  }

  function setCurrency(btn) {
    settings.currency = btn.dataset.currency;
    settings.currencyCode = btn.dataset.code;
    settings.currencyAuto = false;  // explicit user choice — never auto-overwrite
    saveData();
    currencyModal.style.display = 'none';
    refreshDynamicLabels();
    render();
  }

  // ─── Autocomplete in the Name field ───
  function fromPreset(amount, presetCurrency) {
    const from = presetCurrency || 'USD';
    if (!window.LeakdCurrency || !settings.currencyCode || from === settings.currencyCode) return amount;
    return window.LeakdCurrency.convert(amount, from, settings.currencyCode);
  }

  function onNameInput() {
    const q = $('subName').value.trim();
    if (q.length < 1 || !window.LeakdBrands) { hideSuggestions(); return; }
    const items = window.LeakdBrands.suggestions(q, 5);
    if (items.length === 0) { hideSuggestions(); return; }
    const box = $('suggestBox');
    box.innerHTML = items.map((it, i) => {
      const b = it.badge;
      const fontSize = b.symbol.length > 2 ? '12px' : '15px';
      return `<button type="button" class="suggest-item" data-i="${i}">
        <span class="suggest-icon" style="background:${b.bg};color:${b.fg};font-size:${fontSize}">${escHtml(b.symbol)}</span>
        <span class="suggest-name">${escHtml(it.name)}</span>
        <span class="suggest-price">${formatPrice(fromPreset(it.price, it.currency))}<span>/${t('cycle.mo').replace('/', '')}</span></span>
      </button>`;
    }).join('');
    box.style.display = 'block';
    box.querySelectorAll('.suggest-item').forEach(btn => {
      btn.addEventListener('click', () => applySuggestion(items[parseInt(btn.dataset.i, 10)]));
    });
  }

  function hideSuggestions() {
    const box = $('suggestBox');
    if (box) box.style.display = 'none';
  }

  function applySuggestion(item) {
    $('subName').value = item.name;
    const localPrice = fromPreset(item.price, item.currency);
    $('subPrice').value = settings.currencyCode === 'HUF' ? Math.round(localPrice) : Number(localPrice.toFixed(2));
    $('subCategory').value = item.category;
    $('subCycle').value = 'monthly';
    hideSuggestions();
    $('subPrice').focus();
  }

  function exportCSV() {
    if (subs.length === 0) { toast(t('toast.nothing')); return; }
    const headers = ['Name', 'Price', 'Currency', 'Cycle', 'Category', 'Next Payment', 'Is Trial', 'Trial End', 'Paused', 'Notes', 'Tags', 'Monthly Cost', 'Yearly Cost'];
    const rows = subs.map(s => [
      s.name, s.price, s.currency || settings.currencyCode, s.cycle, s.category,
      s.nextDate || '', s.isTrial ? 'Yes' : 'No', s.trialEnd || '',
      s.paused ? 'Yes' : 'No', s.notes || '',
      Array.isArray(s.tags) ? s.tags.join('; ') : '',
      toMonthly(s.price, s.cycle, s.currency).toFixed(2), toYearly(s.price, s.cycle, s.currency).toFixed(2)
    ]);
    let csv = headers.join(',') + '\n';
    rows.forEach(r => { csv += r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',') + '\n'; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leakd-subscriptions.csv'; a.click();
    URL.revokeObjectURL(url);
    toast(t('toast.exported', { n: subs.length }));
  }

  // ─── Notifications ───
  function openNotifModal() {
    const N = window.LeakdNotify;
    if (!N) return;
    const m = $('notifModal');
    const perm = N.permission();
    $('notifPermState').textContent =
      perm === 'granted' ? t('notif.allowed') :
        perm === 'denied' ? t('notif.blocked') :
          perm === 'unsupported' ? t('notif.unsupported') : t('notif.notSet');
    $('notifEnabled').checked = !!N.prefs.enabled;
    $('notifDays').value = String(N.prefs.daysBefore);
    $('notifTrialDays').value = String(N.prefs.trialDaysBefore);
    const denied = perm === 'denied' || perm === 'unsupported';
    $('notifEnabled').disabled = denied;
    $('notifTestBtn').disabled = denied;
    $('notifDeniedHint').style.display = perm === 'denied' ? 'block' : 'none';
    m.classList.add('active');
  }
  function closeNotifModal() { $('notifModal').classList.remove('active'); }
  async function saveNotifPrefs() {
    const N = window.LeakdNotify;
    if (!N) return;
    const wantEnabled = $('notifEnabled').checked;
    if (wantEnabled && N.permission() !== 'granted') {
      const res = await N.requestPermission();
      if (res !== 'granted') { $('notifEnabled').checked = false; openNotifModal(); return; }
    }
    N.save({
      enabled: wantEnabled,
      daysBefore: parseInt($('notifDays').value, 10) || 3,
      trialDaysBefore: parseInt($('notifTrialDays').value, 10) || 1,
    });
    mirrorStateToCache();
    rescheduleNotifications();
    updateNotifBellState();
    closeNotifModal();
    toast(wantEnabled ? t('notif.on') : t('notif.off'));
  }
  async function testNotification() {
    const N = window.LeakdNotify;
    if (!N) return;
    if (N.permission() !== 'granted') {
      const r = await N.requestPermission();
      if (r !== 'granted') { openNotifModal(); return; }
    }
    await N.test();
  }

  // ─── Pro ───
  function openProModal() {
    const P = window.LeakdPro;
    if (!P) return;
    const m = $('proModal');
    const active = P.isPro();
    $('proStateActive').style.display = active ? 'block' : 'none';
    $('proStateInactive').style.display = active ? 'none' : 'block';
    if (active) {
      const plan = P.state.plan || 'pro';
      $('proPlanDisplay').textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    }
    m.classList.add('active');
  }
  function closeProModal() { $('proModal').classList.remove('active'); }
  async function buyPro(skuId) {
    const P = window.LeakdPro;
    const btnId = skuId === 'pro_yearly' ? 'proBuyYearlyBtn' : 'proBuyMonthlyBtn';
    const btn = $(btnId);
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = t('pro.verifying');

    let result;
    try {
      result = await P.purchase(skuId);
    } catch (e) {
      console.error('buyPro failed', e);
      result = { ok: false, code: 'CLIENT_EXCEPTION', error: String(e && e.message || e) };
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }

    if (result.ok) {
      refreshProUI();
      openProModal();
      toast(t('pro.activated'));
      if (window.LeakdConfetti) window.LeakdConfetti.burst();
      return;
    }

    if (result.code === 'USER_CANCELLED') {
      return; // User backed out of the Play sheet on purpose — no nag.
    }

    // Always surface the error. alert() is more reliable on Android WebView
    // than the in-page toast (which can be missed if the Play sheet stole focus).
    const msg = (result.error || t('pro.err.generic') || 'Purchase failed.')
      + (result.code ? '\n\n[' + result.code + ']' : '');
    try { alert(msg); } catch { toast(result.error || 'Purchase failed.'); }
  }

  async function showProDiagnostics() {
    const P = window.LeakdPro;
    if (!P || typeof P.diagnose !== 'function') {
      alert('Diagnostics unavailable.');
      return;
    }
    try {
      const d = await P.diagnose();
      const lines = [
        'Leakd — Google Play Billing diagnostics',
        '─────────────────────────────',
        'Standalone (PWA/TWA):        ' + d.standalone,
        'UA contains "TWA":           ' + d.uaTwa,
        'getDigitalGoodsService:      ' + d.hasGetDigitalGoodsService,
        'PaymentRequest available:    ' + d.hasPaymentRequest,
        'Service status:              ' + (d.serviceCode || 'n/a'),
      ];
      if (d.serviceDetail) lines.push('Service detail:              ' + d.serviceDetail);
      if (d.skuFound) lines.push('SKUs found in Play Console:  ' + (d.skuFound.join(', ') || '(none)'));
      if (d.skuMissing && d.skuMissing.length) lines.push('SKUs MISSING:                ' + d.skuMissing.join(', '));
      if (d.skuLookupError) lines.push('SKU lookup error:            ' + d.skuLookupError);
      lines.push('');
      lines.push('Expected SKU IDs: ' + d.skus.MONTHLY + ', ' + d.skus.YEARLY);
      alert(lines.join('\n'));
    } catch (e) {
      alert('Diagnostics failed: ' + (e && e.message || e));
    }
  }
  function refreshProUI() {
    const P = window.LeakdPro;
    if (!P) return;
    const active = P.isPro();
    // $('proPill').style.display = active ? 'inline-flex' : 'none';
    // $('menuProLabel').textContent = active ? t('menu.proOn') : t('menu.pro');
    // $('menuProSub').textContent = active ? t('menu.proOnSub') : t('menu.proSub');
  }

  // ─── Menu ───
  function openMenuModal() { $('menuModal').classList.add('active'); }
  function closeMenuModal() { $('menuModal').classList.remove('active'); }

  // ─── Language picker ───
  function buildLanguageGrid() {
    const grid = $('langGrid');
    if (!grid || !window.LeakdI18n) return;
    const I = window.LeakdI18n;
    grid.innerHTML = I.SUPPORTED.map(code => {
      const info = I.LANGUAGES[code];
      const active = code === I.lang ? 'active' : '';
      return `<button class="lang-btn ${active}" data-lang="${code}"><span class="lang-flag">${info.flag}</span><span>${info.name}</span></button>`;
    }).join('');
    grid.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        I.setLang(btn.dataset.lang);
        buildLanguageGrid();
        closeLangModal();
        refreshDynamicLabels();
        refreshProUI();
        toast(I.LANGUAGES[btn.dataset.lang].name);
      });
    });
  }
  function openLangModal() { buildLanguageGrid(); $('langModal').classList.add('active'); }
  function closeLangModal() { $('langModal').classList.remove('active'); }

  // ─── Import ───
  function openImportModal() {
    $('importText').value = '';
    $('importPreview').style.display = 'none';
    $('confirmImportBtn').disabled = true;
    $('confirmImportBtn').textContent = t('bank.selectToImport');
    importStaged = [];
    $('importModal').classList.add('active');
  }
  function closeImportModal() { $('importModal').classList.remove('active'); }

  function previewImport() {
    const text = $('importText').value.trim();
    if (!text || !window.LeakdImport) { $('importPreview').style.display = 'none'; return; }
    const parsed = window.LeakdImport.parseText(text);
    importStaged = parsed;
    const list = $('importPreviewList');
    if (parsed.length === 0) {
      $('importPreview').style.display = 'block';
      $('importPreviewTitle').textContent = t('import.found', { count: 0 });
      setEmptyState(list, 'empty-state-mini', t('import.nothingFound'));
      $('confirmImportBtn').disabled = true;
      $('confirmImportBtn').textContent = t('bank.selectToImport');
      return;
    }
    list.innerHTML = parsed.map(p => {
      const iconHtml = window.LeakdBrands
        ? window.LeakdBrands.badgeHtml(p.name, p.category, 34)
        : `<div class="sub-icon" style="background:${(catColors[p.category] || catColors.Other).bg};color:${(catColors[p.category] || catColors.Other).text}">${(catColors[p.category] || catColors.Other).icon}</div>`;
      return `<div class="import-row">
        ${iconHtml}
        <div class="import-row-info">
          <div class="import-row-name">${escHtml(p.name)} ${p.matched ? '<span class="import-tag">' + t('import.detected') + '</span>' : ''}</div>
          <div class="import-row-meta">${escHtml(localizedCat(p.category))} · ${t('cycle.' + p.cycle)}</div>
        </div>
        <div class="import-row-price">${formatPrice(p.price, p.currency)}<span>${t('cycle.' + (p.cycle === 'monthly' ? 'mo' : p.cycle === 'yearly' ? 'yr' : 'wk'))}</span></div>
      </div>`;
    }).join('');
    $('importPreview').style.display = 'block';
    $('importPreviewTitle').textContent = t('import.found', { count: parsed.length });
    $('confirmImportBtn').disabled = false;
    $('confirmImportBtn').textContent = t('import.confirm', { count: parsed.length });
  }

  function confirmImport() {
    if (importStaged.length === 0) return;
    const count = importStaged.length;
    importStaged.forEach(p => {
      subs.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: p.name, price: p.price, cycle: p.cycle, category: p.category,
        currency: p.currency || settings.currencyCode,
        nextDate: p.nextDate || nextMonthIso(),
        isTrial: false, trialEnd: '', paused: false, notes: '',
        createdAt: new Date().toISOString()
      });
    });
    logActivity('imported', null, { count });
    saveData();
    closeImportModal();
    render();
    toast(t('import.imported', { count }));
    importStaged = [];
  }

  function nextMonthIso() {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  }

  function loadImportCSV(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (!window.LeakdImport) return;
      const rows = window.LeakdImport.parseCSV(text);
      if (rows.length === 0) {
        $('importText').value = text;
        previewImport();
        return;
      }
      importStaged = rows.map(r => ({ ...r, matched: false }));
      const list = $('importPreviewList');
      list.innerHTML = importStaged.map(p => {
        const c = catColors[p.category] || catColors.Other;
        return `<div class="import-row">
          <div class="sub-icon" style="background:${c.bg};color:${c.text}">${c.icon}</div>
          <div class="import-row-info">
            <div class="import-row-name">${escHtml(p.name)}</div>
            <div class="import-row-meta">${escHtml(localizedCat(p.category))} · ${escHtml(t('cycle.' + p.cycle))}</div>
          </div>
          <div class="import-row-price">${formatPrice(p.price, p.currency)}<span>${t('cycle.' + (p.cycle === 'monthly' ? 'mo' : p.cycle === 'yearly' ? 'yr' : 'wk'))}</span></div>
        </div>`;
      }).join('');
      $('importPreview').style.display = 'block';
      $('importPreviewTitle').textContent = t('import.found', { count: importStaged.length });
      $('confirmImportBtn').disabled = false;
      $('confirmImportBtn').textContent = t('import.confirm', { count: importStaged.length });
    };
    reader.readAsText(file);
  }

  function fillImportExample() {
    $('importText').value = [
      'Netflix 15.99', 'Spotify 10.99', 'ChatGPT Plus 20',
      'iCloud+ 2.99', 'Notion 10/mo', 'Adobe yearly 599', 'Gym 49',
    ].join('\n');
    previewImport();
  }

  // ─── Income ───
  function openIncomeModal() {
    if (!window.LeakdIncome) return;
    $('incomeCurrencySymbol').textContent = settings.currency;
    $('incomeAmount').value = window.LeakdIncome.get() || '';
    $('incomeModal').classList.add('active');
    setTimeout(() => $('incomeAmount').focus(), 100);
  }
  function closeIncomeModal() { $('incomeModal').classList.remove('active'); }
  function saveIncome() {
    if (!window.LeakdIncome) return;
    const v = parseFloat($('incomeAmount').value);
    window.LeakdIncome.set(isNaN(v) ? 0 : v);
    closeIncomeModal();
    render();
    toast(t('toast.incomeSaved'));
  }
  function clearIncome() {
    if (!window.LeakdIncome) return;
    window.LeakdIncome.clear();
    $('incomeAmount').value = '';
    closeIncomeModal();
    render();
  }

  // ─── Demo data injection ───
  // Populates 8 realistic subscriptions so the user can experience the app
  // without entering anything. Wipes existing subs first (we only show this
  // option when the user is empty anyway).
  function injectDemoData() {
    const today = new Date();
    const dateOffset = (days) => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    };
    const createdOffset = (monthsAgo) => {
      const d = new Date(today);
      d.setMonth(d.getMonth() - monthsAgo);
      return d.toISOString();
    };
    const demoSubs = [
      { name: 'Netflix', price: 15.99, cycle: 'monthly', category: 'Entertainment', nextDate: dateOffset(12), rating: 4, monthsBack: 18 },
      { name: 'Spotify', price: 10.99, cycle: 'monthly', category: 'Music', nextDate: dateOffset(5), rating: 5, monthsBack: 24 },
      { name: 'ChatGPT Plus', price: 20.00, cycle: 'monthly', category: 'Work', nextDate: dateOffset(18), rating: 5, monthsBack: 8 },
      { name: 'Adobe CC', price: 54.99, cycle: 'monthly', category: 'Work', nextDate: dateOffset(2), rating: 2, monthsBack: 14 },
      { name: 'iCloud+', price: 2.99, cycle: 'monthly', category: 'Cloud', nextDate: dateOffset(7), rating: 4, monthsBack: 36 },
      { name: 'YouTube Premium', price: 13.99, cycle: 'monthly', category: 'Entertainment', nextDate: dateOffset(22), rating: 3, monthsBack: 6 },
      { name: 'GitHub Copilot', price: 10.00, cycle: 'monthly', category: 'Work', nextDate: dateOffset(9), rating: 5, monthsBack: 4 },
      { name: 'Notion', price: 10.00, cycle: 'monthly', category: 'Work', nextDate: dateOffset(15), rating: 4, monthsBack: 12 },
    ];
    demoSubs.forEach(d => {
      subs.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: d.name,
        price: settings.currencyCode === 'HUF' ? Math.round(fromUsd(d.price)) : Number(fromUsd(d.price).toFixed(2)),
        cycle: d.cycle,
        category: d.category,
        currency: settings.currencyCode,
        nextDate: d.nextDate, isTrial: false, trialEnd: '', paused: false,
        notes: '', rating: d.rating, sharedWith: 1,
        createdAt: createdOffset(d.monthsBack),
      });
    });
    saveData();
    render();
    toast(t('demo.injected'));
  }

  // ─── Subscription health score ───
  function renderHealthCard() {
    const card = $('healthCard');
    if (!card || !window.LeakdHealth) return;
    const result = window.LeakdHealth.compute(activeSubs());
    if (!result || result.score == null) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    const gradeEl = $('healthGrade');
    gradeEl.textContent = result.grade;
    gradeEl.className = 'health-grade grade-' + result.grade.toLowerCase();
    $('healthScore').textContent = t('health.scoreOf', { score: result.score });
    $('healthAdvice').textContent = t(window.LeakdHealth.adviceKey(result));
  }

  // ─── Spending personality ───
  function renderPersonalityCard(list) {
    const card = $('personalityCard');
    if (!card || !window.LeakdPersonality) return;
    if (list.length === 0) { card.style.display = 'none'; return; }
    const result = window.LeakdPersonality.classify(list);
    if (!result) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    $('personalityIcon').textContent = result.icon;
    $('personalityLabel').textContent = t(result.labelKey);
    $('personalityTag').textContent = t(result.taglineKey);
  }

  // ─── Public benchmarks ───
  function renderBenchCard(list, monthly) {
    const card = $('benchCard');
    if (!card || !window.LeakdBenchmarks) return;
    if (list.length === 0) { card.style.display = 'none'; return; }
    const cmp = window.LeakdBenchmarks.compare(monthly, list.length);
    if (!cmp) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    $('benchExpected').textContent = t('bench.expected', {
      count: list.length,
      expected: formatPrice(cmp.expected),
    });
    const verdictKey = cmp.verdict === 'lower' ? 'bench.lower'
      : cmp.verdict === 'average' ? 'bench.average'
        : cmp.verdict === 'higher' ? 'bench.higher'
          : 'bench.muchHigher';
    const verdictEl = $('benchVerdict');
    verdictEl.textContent = t(verdictKey);
    verdictEl.className = 'bench-verdict verdict-' + cmp.verdict;
    $('benchPercentile').textContent = t('bench.percentile', { pct: cmp.percentile });
  }

  // ─── Activity log modal ───
  function openActivityModal() {
    if (!window.LeakdActivity) return;
    renderActivityList();
    $('activityModal').classList.add('active');
  }
  function closeActivityModal() { $('activityModal').classList.remove('active'); }

  function renderActivityList() {
    const list = $('activityList');
    if (!window.LeakdActivity) return;
    const days = window.LeakdActivity.byDay();
    if (days.length === 0) {
      setEmptyState(list, 'empty-state-mini', t('activity.empty'));
      return;
    }
    const lang = window.LeakdI18n ? window.LeakdI18n.lang : 'en';
    let html = '';
    days.slice(0, 30).forEach(d => {
      const date = new Date(d.day);
      const dateStr = date.toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric' });
      html += `<div class="activity-day"><div class="activity-day-label">${dateStr}</div>`;
      d.events.forEach(e => {
        const time = new Date(e.ts).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
        const iconMap = {
          added: '＋', edited: '✎', cancelled: '✂',
          paused: '⏸', resumed: '▶', restored: '↺',
          deleted: '✕', imported: '⤓',
        };
        const colorClass = 'event-' + e.type;
        const text = e.type === 'imported'
          ? t('activity.imported', { n: (e.payload && e.payload.count) || 0 })
          : t('activity.' + e.type, { name: e.name || '—' });
        html += `<div class="activity-row">
          <span class="activity-icon ${colorClass}">${iconMap[e.type] || '·'}</span>
          <span class="activity-text">${escHtml(text)}</span>
          <span class="activity-time">${time}</span>
        </div>`;
      });
      html += '</div>';
    });
    list.innerHTML = html;
  }

  // ─── Side-by-side compare ───
  let compareSet = new Set();

  function openCompareModal() {
    if (!window.LeakdCompare) return;
    compareSet = new Set();
    renderCompareModal();
    $('compareModal').classList.add('active');
  }
  function closeCompareModal() {
    $('compareModal').classList.remove('active');
    compareSet = new Set();
  }

  function renderCompareModal() {
    const active = activeSubs();
    const pickList = $('comparePickList');
    const promptEl = $('comparePickPrompt');
    const gridWrap = $('compareGridWrap');

    if (active.length < 2) {
      setEmptyState(pickList, 'empty-state-mini', t('compare.minPrompt'));
      promptEl.style.display = 'none';
      gridWrap.style.display = 'none';
      return;
    }

    promptEl.style.display = 'block';
    promptEl.textContent = t('compare.pickPrompt');

    pickList.innerHTML = active.map(s => {
      const sel = compareSet.has(s.id);
      const iconHtml = window.LeakdBrands ? window.LeakdBrands.badgeHtml(s.name, s.category, 28) : '';
      return `<button class="compare-pick${sel ? ' selected' : ''}" data-id="${s.id}">
        ${iconHtml}
        <span class="compare-pick-name">${escHtml(s.name)}</span>
        <span class="compare-pick-check">${sel ? '✓' : ''}</span>
      </button>`;
    }).join('');

    pickList.querySelectorAll('.compare-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (compareSet.has(id)) compareSet.delete(id);
        else if (compareSet.size < 3) compareSet.add(id);
        renderCompareModal();
      });
    });

    // Render comparison grid if at least 2 picked
    if (compareSet.size >= 2) {
      const picked = active.filter(s => compareSet.has(s.id));
      const rows = window.LeakdCompare.build(picked);
      const W = window.LeakdCompare.worstIndex;

      const metricRow = (labelKey, getValue, metric) => {
        const worstIdx = W(rows, metric);
        const cells = rows.map((r, i) => {
          const val = getValue(r);
          const isWorst = i === worstIdx;
          return `<td class="${isWorst ? 'compare-worst' : ''}">${val}</td>`;
        }).join('');
        return `<tr><th>${t(labelKey)}</th>${cells}</tr>`;
      };

      const diffLabel = (d) => t('compare.diff.' + d);
      const ratingStars = (n) => n == null ? `<span class="compare-na">${t('compare.notRated')}</span>` : '★'.repeat(n) + '<span class="compare-na">' + '☆'.repeat(5 - n) + '</span>';

      const headerCells = rows.map(r => {
        const iconHtml = window.LeakdBrands ? window.LeakdBrands.badgeHtml(r.name, r.category, 28) : '';
        return `<th class="compare-head">${iconHtml}<span>${escHtml(r.name)}</span></th>`;
      }).join('');

      gridWrap.innerHTML = `<div class="compare-grid"><table>
        <thead><tr><th></th>${headerCells}</tr></thead>
        <tbody>
          ${metricRow('compare.monthly', r => formatPrice(r.monthly), 'monthly')}
          ${metricRow('compare.yearly', r => formatPrice(r.yearly), 'yearly')}
          ${metricRow('compare.lifetime', r => formatPrice(r.lifetimePaid), 'lifetimePaid')}
          ${metricRow('compare.rating', r => ratingStars(r.rating), 'rating')}
          ${metricRow('compare.cancelDiff', r => diffLabel(r.cancelDifficulty) + (r.cancelMinutes ? ' · ' + t('compare.minutesAbbr', { n: r.cancelMinutes }) : ''), 'cancelDifficulty')}
          ${metricRow('compare.alternatives', r => t('compare.altCountN', { n: r.altCount }), null)}
        </tbody>
      </table></div>`;
      gridWrap.style.display = 'block';
    } else {
      gridWrap.style.display = 'none';
    }
  }

  // ─── What-If calculator ───
  // Lets the user simulate "what if I cancelled these subs?" without actually
  // committing. Tap-to-toggle in a modal, totals update live as the user
  // explores. Doesn't touch real data — closing the modal discards the
  // scenario state. Acts as a Pro conversion driver: "you'd save $X/yr".
  let whatifSet = new Set();

  function openWhatIfModal() {
    if (!window.LeakdWhatIf) return;
    whatifSet = new Set();
    renderWhatIfModal();
    $('whatifModal').classList.add('active');
  }
  function closeWhatIfModal() {
    $('whatifModal').classList.remove('active');
    whatifSet = new Set();
  }

  function renderWhatIfModal() {
    if (!window.LeakdWhatIf) return;
    const active = activeSubs();
    const listEl = $('whatifList');
    const heroEl = $('whatifHero');

    if (active.length === 0) {
      setEmptyState(listEl, 'empty-state-mini', t('whatif.empty'));
      heroEl.style.display = 'none';
      return;
    }

    const result = window.LeakdWhatIf.compute(active, [...whatifSet]);
    heroEl.style.display = 'block';
    $('whatifSavings').textContent = '−' + formatPrice(result.monthlySavings);
    $('whatifSavingsSub').textContent = t('whatif.summarySavings', {
      monthly: formatPrice(result.monthlySavings),
      yearly: formatPrice(result.yearlySavings),
    });
    if (result.cancelledCount > 0) {
      $('whatifInvestNote').textContent = t('whatif.investedNote', {
        y5: formatPrice(result.investedAlt5y),
        y10: formatPrice(result.investedAlt10y),
      });
      $('whatifInvestNote').style.display = 'block';
    } else {
      $('whatifInvestNote').style.display = 'none';
    }

    // Sort: not-selected first (so user can find candidates easily)
    const sorted = [...active].sort((a, b) => {
      const aSel = whatifSet.has(a.id) ? 1 : 0;
      const bSel = whatifSet.has(b.id) ? 1 : 0;
      if (aSel !== bSel) return aSel - bSel;
      return toMonthly(b.price, b.cycle, b.currency) - toMonthly(a.price, a.cycle, a.currency);
    });

    listEl.innerHTML = sorted.map(s => {
      const sel = whatifSet.has(s.id);
      const iconHtml = window.LeakdBrands ? window.LeakdBrands.badgeHtml(s.name, s.category, 32) : '';
      const monthly = toMonthly(s.price, s.cycle, s.currency);
      return `<button class="whatif-row${sel ? ' whatif-selected' : ''}" data-id="${s.id}">
        ${iconHtml}
        <div class="whatif-info">
          <div class="whatif-name">${escHtml(s.name)}</div>
          <div class="whatif-meta">${formatPrice(s.price, s.currency)}/${t('cycle.' + (s.cycle === 'monthly' ? 'mo' : s.cycle === 'yearly' ? 'yr' : 'wk')).replace('/', '')}</div>
        </div>
        <div class="whatif-check">${sel ? '✓' : '○'}</div>
      </button>`;
    }).join('');

    listEl.querySelectorAll('.whatif-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        if (whatifSet.has(id)) whatifSet.delete(id);
        else whatifSet.add(id);
        renderWhatIfModal();
      });
    });
  }

  function whatifSuggest() {
    if (!window.LeakdWhatIf) return;
    const ids = window.LeakdWhatIf.suggestCancellations(activeSubs(), 5);
    whatifSet = new Set(ids);
    renderWhatIfModal();
  }
  function whatifClear() {
    whatifSet = new Set();
    renderWhatIfModal();
  }

  // ─── Bank statement import ───
  let bankSuggestions = [];

  // ─── Business Tax Report modal (Pro) ───
  function openTaxReportModal() {
    if (!window.LeakdTaxReport) return;
    const sum = window.LeakdTaxReport.preview(activeSubs());
    const hasItems = sum.count > 0;
    $('taxEmpty').style.display = hasItems ? 'none' : 'block';
    $('taxSummary').style.display = hasItems ? 'block' : 'none';
    $('downloadTaxPdfBtn').disabled = !hasItems;
    $('downloadTaxCsvBtn').disabled = !hasItems;
    if (hasItems) {
      $('taxPreviewCount').textContent = String(sum.count);
      $('taxPreviewYtd').textContent = formatPrice(sum.ytd);
      $('taxPreviewYear').textContent = formatPrice(sum.totalYearly);
    }
    $('taxReportModal').classList.add('active');
  }
  function closeTaxReportModal() { $('taxReportModal').classList.remove('active'); }

  function openBankModal() {
    $('bankResult').style.display = 'none';
    $('bankError').style.display = 'none';
    $('confirmBankBtn').disabled = true;
    $('confirmBankBtn').textContent = t('bank.selectToImport');
    bankSuggestions = [];
    $('bankModal').classList.add('active');
  }
  function closeBankModal() { $('bankModal').classList.remove('active'); }

  function loadBankFile(file) {
    // CSV-only. Excel was tried but added complexity (lazy-loading SheetJS,
    // 250KB vendor file, encoding issues) for marginal benefit since every
    // bank that exports XLSX also exports CSV. If the user only has Excel,
    // they can use File → Save As → CSV UTF-8 in Excel.
    //
    // Read as bytes then decode with encoding auto-detection: modern bank
    // exports are UTF-8, but older Excel-saved CSVs are often Windows-1252.
    // Reading 1252 bytes as UTF-8 produces mojibake ("KezdÃ©s dÃ¡tuma")
    // that won't match any localized column name.
    file.arrayBuffer().then(buf => {
      processBankCsvText(decodeCsvBytes(new Uint8Array(buf)));
    }).catch(() => {
      $('bankError').textContent = t('bank.errorColumns');
      $('bankError').style.display = 'block';
    });
  }

  function decodeCsvBytes(bytes) {
    // Strip UTF-8/UTF-16 BOMs
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      bytes = bytes.subarray(3);
    } else if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    } else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    }
    // Try strict UTF-8 — throws if any sequence is invalid
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      // Fallback to Windows-1252 (Excel's classic CSV default in Europe)
      return new TextDecoder('windows-1252').decode(bytes);
    }
  }

  function processBankCsvText(csvText) {
    if (!window.LeakdBankParse) return;
    const result = window.LeakdBankParse.parseStatement(csvText);
    if (result.error === 'missing-columns') {
      $('bankError').textContent = t('bank.errorColumns');
      $('bankError').style.display = 'block';
      $('bankResult').style.display = 'none';
      return;
    }
    $('bankError').style.display = 'none';
    $('bankResult').style.display = 'block';
    $('bankFormatPill').textContent = t('bank.formatDetected', { name: result.format.name });

    const subList = result.suggestions;
    bankSuggestions = subList.map(s => ({ ...s, selected: true }));

    if (subList.length === 0) {
      $('bankFound').textContent = t('bank.noRecurring');
      $('bankSuggestionList').innerHTML = '';
      $('confirmBankBtn').disabled = true;
      $('confirmBankBtn').textContent = t('bank.selectToImport');
      return;
    }

    $('bankFound').textContent = t('bank.foundRecurring', { count: subList.length });
    const lang = window.LeakdI18n ? window.LeakdI18n.lang : 'en';
    $('bankSuggestionList').innerHTML = bankSuggestions.map((s, i) => {
      const iconHtml = window.LeakdBrands ? window.LeakdBrands.badgeHtml(s.displayName, s.category, 32) : '';
      const lastDate = s.lastSeen.toLocaleDateString(lang, { month: 'short', day: 'numeric' });
      const conf = Math.round(s.confidence * 100);
      return `<label class="bank-row">
          <input type="checkbox" data-i="${i}" checked>
          ${iconHtml}
          <div class="bank-row-info">
            <div class="bank-row-name">${escHtml(s.displayName)}</div>
            <div class="bank-row-meta">${t('bank.confidence', { n: s.occurrences, confidence: conf })} · ${t('bank.lastSeen', { when: lastDate })}</div>
          </div>
          <div class="bank-row-price">${formatPrice(s.price, s.currency)}<span>/${t('cycle.' + (s.cycle === 'monthly' ? 'mo' : s.cycle === 'yearly' ? 'yr' : 'wk')).replace('/', '')}</span></div>
        </label>`;
    }).join('');

    $('bankSuggestionList').querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        bankSuggestions[parseInt(cb.dataset.i, 10)].selected = cb.checked;
        updateBankConfirm();
      });
    });
    updateBankConfirm();
  }

  function updateBankConfirm() {
    const selected = bankSuggestions.filter(s => s.selected).length;
    $('confirmBankBtn').disabled = selected === 0;
    // When nothing is selected, "Import 0" / "0 importálása" reads as
    // a confusing instruction. Show a hint to pick at least one row.
    $('confirmBankBtn').textContent = selected === 0
      ? t('bank.selectToImport')
      : t('bank.importSelected', { count: selected });
  }

  function confirmBankImport() {
    const selected = bankSuggestions.filter(s => s.selected);
    if (selected.length === 0) return;
    selected.forEach(s => {
      subs.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: s.displayName,
        price: s.price,
        currency: s.currency || settings.currencyCode || 'EUR',
        cycle: s.cycle,
        category: s.category,
        nextDate: nextMonthIso(),
        isTrial: false, trialEnd: '', paused: false, notes: '', rating: 0,
        sharedWith: 1,
        createdAt: new Date().toISOString(),
      });
    });
    saveData();
    closeBankModal();
    render();
    toast(t('bank.parsed', { count: selected.length }));
  }

  // ─── Savings goal ───
  function openGoalModal() {
    if (!window.LeakdGoals) return;
    $('goalCurrencySymbol').textContent = window.LeakdCurrency ? window.LeakdCurrency.getSymbol(settings.currencyCode) : settings.currency;
    const current = window.LeakdGoals.load();
    if (current) {
      $('goalName').value = current.name || '';
      $('goalAmount').value = current.target;
      $('goalClearBtn').style.display = 'inline-block';
      const prog = window.LeakdGoals.progress();
      if (prog) {
        $('goalProgressBlock').style.display = 'block';
        $('goalModalFill').style.width = Math.min(100, prog.pct) + '%';
        $('goalModalText').textContent = t('goal.progress', {
          saved: formatPrice(prog.saved),
          target: formatPrice(prog.target),
        });
      }
    } else {
      $('goalName').value = '';
      // Pre-fill a sensible default so the user can just hit Save. The
      // placeholder used to show "500" which looked like a real value,
      // confusing users who tapped Save and got rejected on an empty input.
      $('goalAmount').value = '500';
      $('goalClearBtn').style.display = 'none';
      $('goalProgressBlock').style.display = 'none';
    }
    $('goalModal').classList.add('active');
    setTimeout(() => $('goalName').focus(), 100);
  }
  function closeGoalModal() { $('goalModal').classList.remove('active'); }

  function saveGoal() {
    if (!window.LeakdGoals) return;
    const name = $('goalName').value.trim();
    const amt = parseFloat($('goalAmount').value);
    if (!amt || amt <= 0) { $('goalAmount').focus(); return; }
    window.LeakdGoals.set(amt, name);
    closeGoalModal();
    render();
    toast(t('toast.goalSaved'));
  }

  function clearGoal() {
    if (!window.LeakdGoals) return;
    window.LeakdGoals.clear();
    closeGoalModal();
    render();
    toast(t('toast.goalCleared'));
  }

  function renderGoalCard() {
    const card = $('goalCard');
    if (!card || !window.LeakdGoals) return;
    const prog = window.LeakdGoals.progress();
    if (!prog) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    if ($('goalTitleDisplay')) $('goalTitleDisplay').textContent = prog.goal.name || t('goal.title');
    if ($('goalTargetDisplay')) $('goalTargetDisplay').textContent = formatPrice(prog.target);

    $('goalProgressFill').style.width = Math.min(100, prog.pct) + '%';
    if (prog.complete) {
      $('goalProgressText').textContent = t('goal.complete');
    } else {
      $('goalProgressText').textContent = t('goal.progress', {
        saved: formatPrice(prog.saved),
        target: formatPrice(prog.target),
      });
    }

    // Piggy Bank Estimate
    const est = window.LeakdGoals.estimate(subs);
    const estEl = $('goalEstimate');
    if (est && !prog.complete) {
      estEl.style.display = 'block';
      estEl.innerHTML = t('goal.estimate', {
        count: est.lowRatedCount,
        months: est.monthsNeeded,
        savings: formatPrice(est.monthlySavings)
      });
    } else {
      estEl.style.display = 'none';
    }

    // Check milestone (toast it + confetti)
    const ms = window.LeakdGoals.checkMilestone();
    if (ms != null) {
      setTimeout(() => {
        toast(t('goal.milestone', { pct: ms }));
        if (window.LeakdConfetti) window.LeakdConfetti.burst();
      }, 600);
    }
  }

  // ─── Bundles ───
  function renderBundles() {
    const card = $('bundlesCard');
    if (!card || !window.LeakdBundles) return;
    const recs = window.LeakdBundles.detect(subs);
    if (recs.length === 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    $('bundlesList').innerHTML = recs.slice(0, 3).map(r => {
      const names = r.matchedSubs.map(s => escHtml(s.name)).join(', ');
      return `<div class="bundle-card">
        <div class="bundle-head">
          <div class="bundle-title">${escHtml(r.bundle.name)}</div>
          <div class="bundle-save">${t('bundles.saves', { amount: formatPrice(r.yearlySavings) })}</div>
        </div>
        <div class="bundle-stats">
          <span>${t('bundles.now', { amount: formatPrice(r.currentMonthly) })}</span>
          <span>→</span>
          <span class="bundle-stat-new">${t('bundles.bundle', { amount: formatPrice(r.bundleMonthly) })}</span>
        </div>
        <div class="bundle-replaces">${t('bundles.replaces', { names })}</div>
        <div class="bundle-note">${escHtml(r.bundle.note || '')}</div>
      </div>`;
    }).join('');
  }

  // ─── Backup & Restore ───
  function openBackupModal() { $('backupModal').classList.add('active'); }
  function closeBackupModal() { $('backupModal').classList.remove('active'); }
  function downloadBackup() {
    if (!window.LeakdBackup) return;
    window.LeakdBackup.download();
    toast(t('backup.exported'));
  }
  async function restoreBackup(file) {
    if (!file || !window.LeakdBackup) return;
    if (!confirm(t('backup.confirmImport'))) return;
    const ok = await window.LeakdBackup.restoreFromFile(file);
    if (!ok) { toast(t('backup.invalidFile')); return; }
    toast(t('backup.imported'));
    setTimeout(() => location.reload(), 700);
  }

  // ─── Cloud Sync (Pro) ───
  function openSyncModal() {
    const S = window.LeakdSync;
    const isPro = window.LeakdPro && window.LeakdPro.isPro();
    $('syncProLock').style.display = isPro ? 'none' : 'block';
    if (!isPro || !S) {
      $('syncStatusCard').style.display = 'none';
      $('syncSetupStep').style.display = 'none';
      $('syncUnlockStep').style.display = 'none';
      $('syncPrimaryBtn').style.display = 'none';
      $('syncDisableBtn').style.display = 'none';
    } else {
      $('syncStatusCard').style.display = '';
      refreshSyncUI();
    }
    $('syncError').style.display = 'none';
    $('syncError').textContent = '';
    $('syncPasswordInput').value = '';
    $('syncPasswordConfirm').value = '';
    $('syncStrengthWrapper').style.display = 'none';
    $('syncModal').classList.add('active');
  }
  function closeSyncModal() { $('syncModal').classList.remove('active'); }

  function refreshSyncUI() {
    const S = window.LeakdSync;
    if (!S) return;
    const st = S.status();
    const dot = $('syncDot');
    const txt = $('syncStatusText');
    const last = $('syncLastText');
    const setup = $('syncSetupStep');
    const unlock = $('syncUnlockStep');
    const primary = $('syncPrimaryBtn');
    const disable = $('syncDisableBtn');

    dot.className = 'sync-dot';
    if (!st.enabled) {
      txt.textContent = t('sync.statusDisabled');
      last.textContent = '';
      // First-time setup: ask for master password
      setup.style.display = '';
      unlock.style.display = 'none';
      primary.style.display = '';
      primary.textContent = t('sync.enable');
      disable.style.display = 'none';
      $('cancelSyncBtn').textContent = t('btn.cancel');
    } else if (!st.unlocked) {
      dot.classList.add('locked');
      txt.textContent = t('sync.statusLocked');
      last.textContent = '';
      // Returning device or after page reload: ask to unlock
      setup.style.display = 'none';
      unlock.style.display = '';
      primary.style.display = '';
      primary.textContent = t('sync.unlock');
      disable.style.display = '';
      $('cancelSyncBtn').textContent = t('btn.cancel');
    } else {
      dot.classList.add('active');
      txt.textContent = t('sync.statusActive');
      last.textContent = st.lastSync
        ? t('sync.lastSync', { when: new Date(st.lastSync).toLocaleString(window.LeakdI18n ? window.LeakdI18n.lang : 'en') })
        : t('sync.neverSynced');
      setup.style.display = 'none';
      unlock.style.display = 'none';
      primary.style.display = '';
      primary.textContent = t('sync.syncNow');
      disable.style.display = '';
      $('cancelSyncBtn').textContent = t('btn.done');
    }
  }

  function showSyncError(code) {
    const map = {
      WRONG_PASSWORD: t('sync.errWrongPw'),
      PASSWORD_TOO_SHORT: t('sync.errPwShort'),
      OFFLINE: t('sync.errOffline'),
      NO_CLIENT_ID: t('sync.errNotConfigured'),
      OAUTH_FAILED: t('sync.errOauth'),
      LOCKED: t('sync.errLocked'),
      SYNC_REQUIRES_PRO: t('sync.errPro'),
      GIS_LOAD_FAILED: t('sync.errGisLoad'),
    };
    const el = $('syncError');
    el.textContent = map[code] || t('sync.errGeneric', { code });
    el.style.display = '';
  }

  function checkPasswordStrength(pw) {
    if (!pw) return null;
    if (pw.length < 4) {
      return { score: 0, label: 'sync.pwStrength.tooShort', color: '#ef4444', pct: 15 };
    }

    let score = 0;
    if (pw.length >= 8) score += 1;
    if (pw.length >= 12) score += 1;

    const hasLower = /[a-z]/.test(pw);
    const hasUpper = /[A-Z]/.test(pw);
    const hasDigit = /[0-9]/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);

    let types = 0;
    if (hasLower) types++;
    if (hasUpper) types++;
    if (hasDigit) types++;
    if (hasSpecial) types++;

    if (types >= 2) score += 1;
    if (types >= 4) score += 1;

    const isRepeated = /^(.)\1+$/.test(pw);
    const isSequential = "abcdefghijklmnopqrstuvwxyz01234567890".indexOf(pw.toLowerCase()) !== -1 ||
      "9876543210zyxwvutsrqponmlkjihgfedcba".indexOf(pw.toLowerCase()) !== -1;

    if (isRepeated || isSequential) {
      score = Math.max(0, score - 2);
    }

    const levels = [
      { score: 0, label: 'sync.pwStrength.weak', color: '#ef4444', pct: 25 },
      { score: 1, label: 'sync.pwStrength.weak', color: '#f97316', pct: 40 },
      { score: 2, label: 'sync.pwStrength.fair', color: '#eab308', pct: 60 },
      { score: 3, label: 'sync.pwStrength.strong', color: '#22c55e', pct: 80 },
      { score: 4, label: 'sync.pwStrength.excellent', color: '#10b981', pct: 100 }
    ];

    return levels[score];
  }

  function updateSyncPasswordStrengthUI() {
    const pw = $('syncPasswordInput').value;
    const wrapper = $('syncStrengthWrapper');
    const fill = $('syncStrengthFill');
    const label = $('syncStrengthLabel');
    if (!pw) {
      wrapper.style.display = 'none';
      return;
    }
    wrapper.style.display = 'block';
    const strength = checkPasswordStrength(pw);
    fill.style.width = strength.pct + '%';
    fill.style.backgroundColor = strength.color;
    label.textContent = t(strength.label);
    label.style.color = strength.color;
  }

  async function onSyncPrimary() {
    const S = window.LeakdSync;
    if (!S) return;
    const st = S.status();
    const btn = $('syncPrimaryBtn');
    const oldLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('pro.verifying');
    $('syncError').style.display = 'none';
    try {
      if (!st.enabled) {
        // Enable flow: create password (or unlock if salt exists), sign in, first sync
        if (!st.hasSalt) {
          const pw = $('syncPasswordInput').value;
          const confirm = $('syncPasswordConfirm').value;
          if (pw !== confirm) { showSyncError('WRONG_PASSWORD'); return; }
        }

        await S.signIn();
        const pw = $('syncPasswordInput').value;
        await S.unlockAndVerifyAgainstRemote(pw);

        S.setEnabled(true);
        const r = await S.sync();
        toast(r.action === 'pulled' ? t('sync.pulledOk') : t('sync.pushedOk'));
      } else if (!st.unlocked) {
        // Unlock flow
        const pw = $('syncUnlockInput').value;
        await S.unlockAndVerifyAgainstRemote(pw);
        await S.sync();
        toast(t('sync.unlockedOk'));
      } else {
        // Active → manual sync
        const r = await S.sync();
        toast(r.action === 'pulled' ? t('sync.pulledOk') : t('sync.pushedOk'));
        if (r.action === 'pulled') {
          // Local data changed underneath us — full reload to re-render
          setTimeout(() => location.reload(), 600);
        }
      }
      refreshSyncUI();
    } catch (e) {
      console.error('sync flow error', e);
      showSyncError(e.code || ('GENERIC: ' + (e.message || e)));
    } finally {
      btn.disabled = false;
      btn.textContent = oldLabel;
    }
  }

  async function disableSync() {
    const S = window.LeakdSync;
    if (!S) return;
    if (!confirm(t('sync.confirmDisable'))) return;
    // Offer to also wipe the encrypted blob from the user's Google Drive
    // appDataFolder. Without this the file stays in their Drive forever,
    // even though we've cleared every local trace — a GDPR rough edge.
    let deletedRemote = false;
    if (confirm(t('sync.confirmDeleteRemote'))) {
      try {
        const r = await S.deleteRemoteFile();
        if (r && r.ok) {
          deletedRemote = r.deleted;
        } else {
          toast(t('sync.deleteRemoteFailed'));
        }
      } catch (e) {
        console.warn('Remote delete failed', e);
        toast(t('sync.deleteRemoteFailed'));
      }
    }
    S.lock();
    S.signOut();
    S.setEnabled(false);
    toast(t(deletedRemote ? 'sync.disabledAndWiped' : 'sync.disabledOk'));
    refreshSyncUI();
  }

  // ─── Budgets ───
  let editingBudgetCat = null;

  function openBudgetsModal() {
    if (window.LeakdPro && !window.LeakdPro.isPro()) {
      $('budgetsProLock').style.display = 'block';
    } else {
      $('budgetsProLock').style.display = 'none';
    }
    renderBudgetsList();
    $('budgetsModal').classList.add('active');
  }
  function closeBudgetsModal() { $('budgetsModal').classList.remove('active'); }

  function renderBudgetsList() {
    const list = $('budgetsList');
    if (!window.LeakdBudgets) return;
    const all = window.LeakdBudgets.all();
    const cats = ['Entertainment', 'Work', 'Music', 'Fitness', 'Cloud', 'Food', 'News', 'Other'];
    const progress = window.LeakdBudgets.computeProgress(activeSubs());
    const progMap = {};
    progress.forEach(p => { progMap[p.category] = p; });
    const proLocked = window.LeakdPro && !window.LeakdPro.isPro();

    list.innerHTML = cats.map(cat => {
      const p = progMap[cat];
      const limit = all[cat];
      const spent = activeSubs()
        .filter(s => s.category === cat)
        .reduce((sum, s) => sum + toMonthly(s.price, s.cycle, s.currency), 0);
      if (!limit) {
        return `<button class="budget-row ${proLocked ? 'is-locked' : ''}" data-cat="${escHtml(cat)}">
          <span class="budget-row-cat">${escHtml(localizedCat(cat))}</span>
          <span class="budget-row-meta">${formatPrice(spent)} · <span class="budget-row-add">+ ${t('budgets.setLimit')}</span></span>
        </button>`;
      }
      const pct = Math.min(100, (spent / limit) * 100);
      const status = p ? p.status : 'ok';
      return `<button class="budget-row ${proLocked ? 'is-locked' : ''}" data-cat="${escHtml(cat)}">
        <div class="budget-row-head">
          <span class="budget-row-cat">${escHtml(localizedCat(cat))}</span>
          <span class="budget-row-amount status-${status}">${formatPrice(spent)} / ${formatPrice(limit)}</span>
        </div>
        <div class="budget-row-track"><div class="budget-row-fill status-${status}" style="width:${pct}%"></div></div>
      </button>`;
    }).join('');

    list.querySelectorAll('.budget-row').forEach(btn => {
      btn.addEventListener('click', () => {
        if (proLocked) { closeBudgetsModal(); openProModal(); return; }
        openBudgetSetter(btn.dataset.cat);
      });
    });
  }

  function openBudgetSetter(cat) {
    editingBudgetCat = cat;
    $('budgetCategory').value = cat;
    $('budgetSetterTitle').textContent = localizedCat(cat);
    $('budgetCurrencySymbol').textContent = settings.currency;
    const existing = window.LeakdBudgets.getBudget(cat);
    // Pre-fill the existing limit so the user can see and confirm the current
    // value without retyping it. If there's no limit yet, pre-fill a sensible
    // default (50) — same approach used for the Savings Goal modal — so the
    // placeholder '50' is never confused for a real saved value.
    $('budgetAmount').value = existing != null ? existing : '50';
    $('budgetClearBtn').style.display = existing != null ? 'inline-block' : 'none';
    $('budgetSetterModal').classList.add('active');
    // Auto-select the value so the user can immediately overtype it.
    setTimeout(() => { const el = $('budgetAmount'); el.focus(); el.select(); }, 100);
  }
  function closeBudgetSetter() { $('budgetSetterModal').classList.remove('active'); editingBudgetCat = null; }

  function saveBudget() {
    if (!editingBudgetCat) return;
    const amount = parseFloat($('budgetAmount').value);
    // isNaN covers both empty string and non-numeric input; amount <= 0 rejects zeros.
    if (isNaN(amount) || amount <= 0) {
      const el = $('budgetAmount');
      el.focus();
      el.select();
      // Brief shake animation to signal the error without a disruptive alert.
      el.classList.add('input-shake');
      setTimeout(() => el.classList.remove('input-shake'), 400);
      return;
    }
    window.LeakdBudgets.setBudget(editingBudgetCat, amount);
    closeBudgetSetter();
    renderBudgetsList();
    render();
    toast(t('toast.budgetSaved'));
  }

  function clearBudget() {
    if (!editingBudgetCat) return;
    window.LeakdBudgets.setBudget(editingBudgetCat, null);
    closeBudgetSetter();
    renderBudgetsList();
    render();
    toast(t('toast.budgetCleared'));
  }

  // ─── Calendar export ───
  function exportCalendar() {
    if (!window.LeakdCalendar) return;
    const eligible = activeSubs().filter(s => s.nextDate);
    if (eligible.length === 0) { toast(t('cal.noDates')); return; }
    const ok = window.LeakdCalendar.download(activeSubs(), settings.currency);
    if (ok) toast(t('cal.exported'));
  }

  // ─── Year-end report ───
  function openYearendModal() {
    if (window.LeakdPro && !window.LeakdPro.isPro()) {
      openProModal();
      return;
    }
    if (!window.LeakdYearEnd) return;
    const report = window.LeakdYearEnd.computeReport(activeSubs());
    $('yearendTitle').textContent = t('yearend.title', { year: report.year });

    if (report.activeCount === 0 || report.totalPaid === 0) {
      $('yearendBody').style.display = 'none';
      $('yearendEmpty').style.display = 'block';
      $('yearendShareBtn').style.display = 'none';
    } else {
      $('yearendBody').style.display = 'block';
      $('yearendEmpty').style.display = 'none';
      $('yearendShareBtn').style.display = 'inline-block';
      $('yearendTotal').textContent = formatPrice(report.totalPaid);
      $('yearendTopName').textContent = report.topName || '—';
      $('yearendTopAmount').textContent = formatPrice(report.topAmount);
      $('yearendTopCat').textContent = report.topCategory ? localizedCat(report.topCategory) : '—';
      $('yearendTopCatAmount').textContent = formatPrice(report.topCategoryAmount);
      $('yearendSubCount').textContent = t('yearend.subCount', { count: report.activeCount });
    }
    $('yearendModal').classList.add('active');
  }
  function closeYearendModal() { $('yearendModal').classList.remove('active'); }
  async function shareYearend() {
    // Close yearend first so the share modal isn't stuck behind it (same
    // z-index → users couldn't see the share card).
    closeYearendModal();
    await openShareCard();
  }

  // ─── Share card ───
  async function openShareCard() {
    if (activeSubs().length === 0) { toast(t('share.addFirst')); return; }
    if (!window.LeakdShare) return;
    $('shareModal').classList.add('active');
    const canvas = $('shareCanvas');
    const drawn = window.LeakdShare.render(activeSubs(), settings.currency);
    canvas.width = drawn.width;
    canvas.height = drawn.height;
    canvas.getContext('2d').drawImage(drawn, 0, 0);
  }
  function closeShareModal() { $('shareModal').classList.remove('active'); }
  async function downloadShare() {
    if (!window.LeakdShare) return;
    const { blob } = await window.LeakdShare.generate(activeSubs(), settings.currency);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'my-leakd.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t('share.saved'));
  }
  async function shareNow() {
    if (!window.LeakdShare) return;
    const result = await window.LeakdShare.shareOrDownload(activeSubs(), settings.currency);
    if (result.method === 'downloaded') toast(t('share.savedDevice'));
  }

  async function shareLeakdLink() {
    const data = { title: 'Leakd', text: t('app.tagline'), url: 'https://leakd.app' };
    if (navigator.share) { try { await navigator.share(data); return; } catch { } }
    try { await navigator.clipboard.writeText('https://leakd.app'); toast(t('toast.linkCopied')); }
    catch { toast('https://leakd.app'); }
  }

  function resetAll() {
    if (!confirm(t('reset.confirm1'))) return;
    if (!confirm(t('reset.confirm2'))) return;
    ['leakd_subs', 'leakd_settings', 'leakd_notif_prefs', 'leakd_notif_log', 'leakd_pro', 'leakd_onboarded', 'leakd_lang', 'leakd_budgets', 'leakd_history', 'leakd_income', 'leakd_cancelled', 'leakd_goal', 'leakd_tour_done', 'leakd_activity', 'leakd_rates', 'leakd_streak', 'leakd_sync_meta', 'leakd_sync_salt', 'leakd_sync_enabled', 'leakd_terms_accepted', 'leakd_sync_session_pw']
      .forEach(k => localStorage.removeItem(k));
    try { sessionStorage.clear(); } catch (e) { }
    location.reload();
  }

  // ─── Search ───
  function onSearch() {
    searchTerm = $('searchInput').value.trim();
    $('searchClear').style.display = searchTerm ? 'flex' : 'none';
    render();
  }
  function clearSearch() {
    searchTerm = '';
    $('searchInput').value = '';
    $('searchClear').style.display = 'none';
    render();
  }

  // ─── Toast ───
  let toastTimer;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ─── Onboarding ───
  function showOnboard() { $('onboard').style.display = 'flex'; setOnboardStep(1); }
  function setOnboardStep(n) {
    document.querySelectorAll('.onboard-step').forEach(el => {
      el.style.display = parseInt(el.dataset.step, 10) === n ? 'block' : 'none';
    });
  }
  function finishOnboard() {
    localStorage.setItem(ONBOARD_KEY, '1');
    $('onboard').style.display = 'none';
    if (!localStorage.getItem(SETTINGS_KEY)) {
      // Same silent USD fallback as init() — never prompt with a picker
      // automatically; the user can switch from the Currency menu.
      if (!autoDetectLocale()) defaultCurrencyUsd();
    }
    // Kick off the interactive tour after a beat — only the first time
    if (window.LeakdTour && !window.LeakdTour.isDone()) {
      setTimeout(() => window.LeakdTour.start(), 600);
    }
  }

  // ─── Events ───
  function bindEvents() {
    $('addBtn').addEventListener('click', openAdd);
    $('closeModal').addEventListener('click', closeModalFn);
    $('cancelBtn').addEventListener('click', closeModalFn);
    $('markUsedTodayBtn').addEventListener('click', () => {
      $('subLastUsed').value = new Date().toISOString().split('T')[0];
    });
    $('saveBtn').addEventListener('click', saveSub);
    $('deleteBtn').addEventListener('click', deleteSub);
    $('toggleTheme').addEventListener('click', toggleTheme);

    $('toggleNotif').addEventListener('click', openNotifModal);
    $('closeNotifModal').addEventListener('click', closeNotifModal);
    $('cancelNotifBtn').addEventListener('click', closeNotifModal);
    $('saveNotifBtn').addEventListener('click', saveNotifPrefs);
    $('notifTestBtn').addEventListener('click', testNotification);
    $('notifModal').addEventListener('click', e => { if (e.target === $('notifModal')) closeNotifModal(); });

    $('openMenu').addEventListener('click', openMenuModal);
    $('closeMenuModal').addEventListener('click', closeMenuModal);
    $('menuModal').addEventListener('click', e => { if (e.target === $('menuModal')) closeMenuModal(); });
    // $('menuPro').addEventListener('click', () => { closeMenuModal(); openProModal(); });
    $('menuYearend').addEventListener('click', () => { closeMenuModal(); openYearendModal(); });
    $('menuImport').addEventListener('click', () => { closeMenuModal(); openImportModal(); });
    $('menuExport').addEventListener('click', () => { closeMenuModal(); exportCSV(); });
    $('menuPdf').addEventListener('click', () => {
      closeMenuModal();
      if (window.LeakdPro && !window.LeakdPro.isPro()) { openProModal(); return; }
      let list = activeSubs();
      if (insightsFilter === 'business') list = list.filter(s => s.isBusiness);
      if (insightsFilter === 'personal') list = list.filter(s => !s.isBusiness);
      if (window.LeakdPdf) window.LeakdPdf.generate(list, window.LeakdInsights.totals(list));
    });
    // ── Business Tax Report (Pro) — opens a modal showing a quick summary
    //    of every isBusiness sub, with PDF + CSV download buttons ─────────
    $('menuTaxReport').addEventListener('click', () => {
      closeMenuModal();
      if (window.LeakdPro && !window.LeakdPro.isPro()) { openProModal(); return; }
      openTaxReportModal();
    });
    $('closeTaxReportModal').addEventListener('click', closeTaxReportModal);
    $('cancelTaxReportBtn').addEventListener('click', closeTaxReportModal);
    $('taxReportModal').addEventListener('click', e => { if (e.target === $('taxReportModal')) closeTaxReportModal(); });
    $('downloadTaxPdfBtn').addEventListener('click', () => {
      if (window.LeakdTaxReport) window.LeakdTaxReport.generatePDF(activeSubs());
    });
    $('downloadTaxCsvBtn').addEventListener('click', () => {
      if (window.LeakdTaxReport) window.LeakdTaxReport.generateCSV(activeSubs());
      toast(t('toast.exported', { n: window.LeakdTaxReport ? window.LeakdTaxReport.preview(activeSubs()).count : 0 }));
    });
    $('menuCalendar').addEventListener('click', () => { closeMenuModal(); exportCalendar(); });
    $('menuBudgets').addEventListener('click', () => { closeMenuModal(); openBudgetsModal(); });
    $('menuCancelled').addEventListener('click', () => { closeMenuModal(); openCancelledModal(); });
    $('closeCancelledModal').addEventListener('click', closeCancelledModal);
    $('cancelledCloseBtn').addEventListener('click', closeCancelledModal);
    $('cancelledModal').addEventListener('click', e => { if (e.target === $('cancelledModal')) closeCancelledModal(); });
    const cancelledShareBtn = $('cancelledShareBtn');
    if (cancelledShareBtn) cancelledShareBtn.addEventListener('click', shareGraveyard);

    $('menuTheme').addEventListener('click', () => { closeMenuModal(); openThemeModal(); });
    $('closeThemeModal').addEventListener('click', closeThemeModal);
    $('themeModal').addEventListener('click', e => { if (e.target === $('themeModal')) closeThemeModal(); });
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setThemeMode(btn.dataset.theme);
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b === btn));
        closeThemeModal();
      });
    });

    $('markCancelledBtn').addEventListener('click', markAsCancelled);

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--text-muted)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--bg)';
        btn.style.color = 'var(--text)';
        insightsFilter = btn.dataset.filter;
        renderInsights();
      });
    });

    // Calendar nav
    $('calPrev').addEventListener('click', () => { calMonthOffset--; renderCalendarView(); });
    $('calNext').addEventListener('click', () => { calMonthOffset++; renderCalendarView(); });

    // Star rating clicks
    document.querySelectorAll('#subRating .star').forEach(star => {
      star.addEventListener('click', () => setRatingUI(parseInt(star.dataset.v, 10)));
    });
    $('subRatingClear').addEventListener('click', () => setRatingUI(0));
    $('closeBudgetsModal').addEventListener('click', closeBudgetsModal);
    $('budgetsCloseBtn').addEventListener('click', closeBudgetsModal);
    $('budgetsModal').addEventListener('click', e => { if (e.target === $('budgetsModal')) closeBudgetsModal(); });
    $('closeBudgetSetterModal').addEventListener('click', closeBudgetSetter);
    $('cancelBudgetBtn').addEventListener('click', closeBudgetSetter);
    $('saveBudgetBtn').addEventListener('click', saveBudget);
    $('budgetClearBtn').addEventListener('click', clearBudget);
    $('budgetSetterModal').addEventListener('click', e => { if (e.target === $('budgetSetterModal')) closeBudgetSetter(); });

    $('menuBackup').addEventListener('click', () => { closeMenuModal(); openBackupModal(); });

    // Email reminders (Pro) — opens Pro modal if not Pro, otherwise a quick info toast
    // until the dedicated email-reminder modal UI is built.
    $('menuEmailRem').addEventListener('click', () => {
      closeMenuModal();
      if (window.LeakdPro && !window.LeakdPro.isPro()) { openProModal(); return; }
      toast(t('emailrem.title') + ' — ' + t('emailrem.langNote', {
        lang: (window.LeakdI18n && window.LeakdI18n.LANGUAGES[window.LeakdI18n.lang] || {}).name || window.LeakdI18n.lang
      }));
    });

    // Cloud sync (Pro)
    $('menuSync').addEventListener('click', () => { closeMenuModal(); openSyncModal(); });
    $('closeSyncModal').addEventListener('click', closeSyncModal);
    $('cancelSyncBtn').addEventListener('click', closeSyncModal);
    $('syncModal').addEventListener('click', e => { if (e.target === $('syncModal')) closeSyncModal(); });
    $('syncPrimaryBtn').addEventListener('click', onSyncPrimary);
    $('syncDisableBtn').addEventListener('click', disableSync);
    $('syncProUpgrade').addEventListener('click', () => { closeSyncModal(); openProModal(); });
    $('syncPasswordInput').addEventListener('input', updateSyncPasswordStrengthUI);

    // Bank import
    $('menuBank').addEventListener('click', () => { closeMenuModal(); openBankModal(); });
    $('closeBankModal').addEventListener('click', closeBankModal);
    $('cancelBankBtn').addEventListener('click', closeBankModal);
    $('bankModal').addEventListener('click', e => { if (e.target === $('bankModal')) closeBankModal(); });
    $('bankUploadBtn').addEventListener('click', () => $('bankFileInput').click());
    $('bankFileInput').addEventListener('change', e => { if (e.target.files[0]) loadBankFile(e.target.files[0]); });
    $('confirmBankBtn').addEventListener('click', confirmBankImport);

    // Demo data button (in empty state)
    const demoBtn = $('emptyDemoBtn');
    if (demoBtn) demoBtn.addEventListener('click', injectDemoData);

    // Compare
    $('menuCompare').addEventListener('click', () => { closeMenuModal(); openCompareModal(); });
    $('closeCompareModal').addEventListener('click', closeCompareModal);
    $('compareCloseBtn').addEventListener('click', closeCompareModal);
    $('compareModal').addEventListener('click', e => { if (e.target === $('compareModal')) closeCompareModal(); });

    // What-if calculator
    $('menuWhatIf').addEventListener('click', () => { closeMenuModal(); openWhatIfModal(); });
    $('closeWhatIfModal').addEventListener('click', closeWhatIfModal);
    $('whatifCloseBtn').addEventListener('click', closeWhatIfModal);
    $('whatifSuggestBtn').addEventListener('click', whatifSuggest);
    $('whatifClearBtn').addEventListener('click', whatifClear);
    $('whatifModal').addEventListener('click', e => { if (e.target === $('whatifModal')) closeWhatIfModal(); });

    // Activity log
    $('menuActivity').addEventListener('click', () => { closeMenuModal(); openActivityModal(); });
    $('closeActivityModal').addEventListener('click', closeActivityModal);
    $('activityCloseBtn').addEventListener('click', closeActivityModal);
    $('activityModal').addEventListener('click', e => { if (e.target === $('activityModal')) closeActivityModal(); });

    // Tour replay
    $('menuTour').addEventListener('click', () => {
      closeMenuModal();
      if (window.LeakdTour) setTimeout(() => window.LeakdTour.restart(), 200);
    });

    // Savings goal
    $('menuGoal').addEventListener('click', () => { closeMenuModal(); openGoalModal(); });
    $('closeGoalModal').addEventListener('click', closeGoalModal);
    $('cancelGoalBtn').addEventListener('click', closeGoalModal);
    $('saveGoalBtn').addEventListener('click', saveGoal);
    $('goalClearBtn').addEventListener('click', clearGoal);
    $('goalModal').addEventListener('click', e => { if (e.target === $('goalModal')) closeGoalModal(); });
    $('closeBackupModal').addEventListener('click', closeBackupModal);
    $('cancelBackupBtn').addEventListener('click', closeBackupModal);
    $('backupModal').addEventListener('click', e => { if (e.target === $('backupModal')) closeBackupModal(); });
    $('backupExportBtn').addEventListener('click', downloadBackup);
    $('backupImportBtn').addEventListener('click', () => $('backupImportInput').click());
    $('backupImportInput').addEventListener('change', e => { if (e.target.files[0]) restoreBackup(e.target.files[0]); });
    $('menuLanguage').addEventListener('click', () => { closeMenuModal(); openLangModal(); });
    $('menuCurrency').addEventListener('click', () => { closeMenuModal(); currencyModal.style.display = 'flex'; });
    $('menuShare').addEventListener('click', () => { closeMenuModal(); shareLeakdLink(); });
    $('menuReset').addEventListener('click', () => { closeMenuModal(); resetAll(); });

    $('closeLangModal').addEventListener('click', closeLangModal);
    $('langModal').addEventListener('click', e => { if (e.target === $('langModal')) closeLangModal(); });

    $('closeProModal').addEventListener('click', closeProModal);
    $('proModal').addEventListener('click', e => { if (e.target === $('proModal')) closeProModal(); });
    $('proBuyMonthlyBtn').addEventListener('click', () => buyPro('pro_monthly'));
    $('proBuyYearlyBtn').addEventListener('click', () => buyPro('pro_yearly'));
    const proDiagBtn = $('proDiagBtn');
    if (proDiagBtn) proDiagBtn.addEventListener('click', showProDiagnostics);
    $('proCloseActiveBtn').addEventListener('click', closeProModal);

    const streakBtn = $('streakBtn');
    if (streakBtn) {
      streakBtn.addEventListener('click', () => {
        if (!window.LeakdStreak) return;
        if (window.LeakdStreak.checkIn()) {
          if (window.LeakdConfetti) window.LeakdConfetti.burst();
          render();
          toast(t('toast.streakUpdated') || 'Streak updated! 🔥');
        }
      });
    }

    $('closeImportModal').addEventListener('click', closeImportModal);
    $('cancelImportBtn').addEventListener('click', closeImportModal);
    $('importModal').addEventListener('click', e => { if (e.target === $('importModal')) closeImportModal(); });
    $('importText').addEventListener('input', previewImport);
    $('importExampleBtn').addEventListener('click', fillImportExample);
    $('importCSVBtn').addEventListener('click', () => $('importCSVInput').click());
    $('importCSVInput').addEventListener('change', e => { if (e.target.files[0]) loadImportCSV(e.target.files[0]); });
    $('confirmImportBtn').addEventListener('click', confirmImport);
    $('emptyImportBtn').addEventListener('click', openImportModal);

    $('shareCardBtn').addEventListener('click', openShareCard);
    $('closeShareModal').addEventListener('click', closeShareModal);
    $('shareModal').addEventListener('click', e => { if (e.target === $('shareModal')) closeShareModal(); });
    $('downloadShareBtn').addEventListener('click', downloadShare);
    $('shareNowBtn').addEventListener('click', shareNow);

    $('closeYearendModal').addEventListener('click', closeYearendModal);
    $('yearendCloseBtn').addEventListener('click', closeYearendModal);
    $('yearendShareBtn').addEventListener('click', shareYearend);
    $('yearendModal').addEventListener('click', e => { if (e.target === $('yearendModal')) closeYearendModal(); });

    $('panicBtn').addEventListener('click', openPanicModal);
    $('closePanicModal').addEventListener('click', closePanicModal);
    $('panicDoneBtn').addEventListener('click', closePanicModal);
    $('panicModal').addEventListener('click', e => { if (e.target === $('panicModal')) closePanicModal(); });

    $('searchInput').addEventListener('input', onSearch);
    $('searchClear').addEventListener('click', clearSearch);

    $('subShared').addEventListener('input', function () {
      const val = parseInt(this.value, 10);
      if (!isNaN(val) && val > 1) {
        $('subSharedDetails').style.display = 'block';
        renderSharedChecklist();
      } else {
        $('subSharedDetails').style.display = 'none';
        $('subSharedChecklist').innerHTML = '';
      }
    });

    $('subSharedNames').addEventListener('input', function () {
      renderSharedChecklist();
    });

    $('subPrice').addEventListener('input', () => {
      if (parseInt($('subShared').value, 10) > 1) {
        renderSharedChecklist();
      }
    });

    $('subCurrency').addEventListener('change', () => {
      if (parseInt($('subShared').value, 10) > 1) {
        renderSharedChecklist();
      }
    });

    $('subSharedChecklist').addEventListener('click', function (e) {
      const btn = e.target.closest('.btn-copy-reminder');
      if (btn) {
        e.preventDefault();
        const name = btn.dataset.name;
        const amount = parseFloat(btn.dataset.amount);
        const currency = btn.dataset.currency;
        copyFriendReminder(name, amount, currency);
      }
    });

    $('subTrial').addEventListener('change', function () {
      $('trialDateWrap').style.display = this.checked ? 'block' : 'none';
    });

    $('subCategory').addEventListener('change', function () {
      if (this.value === '_new') {
        if (window.LeakdPro && !window.LeakdPro.isPro()) {
          this.value = 'Other';
          openProModal();
          return;
        }
        $('subCategoryCustom').style.display = 'block';
        $('subCategoryCustom').focus();
      } else {
        $('subCategoryCustom').style.display = 'none';
      }
    });

    // Name field autocomplete
    $('subName').addEventListener('input', onNameInput);
    $('subName').addEventListener('blur', () => setTimeout(hideSuggestions, 150));
    $('subName').addEventListener('focus', onNameInput);

    // Income
    $('menuIncome').addEventListener('click', () => { closeMenuModal(); openIncomeModal(); });
    $('closeIncomeModal').addEventListener('click', closeIncomeModal);
    $('cancelIncomeBtn').addEventListener('click', closeIncomeModal);
    $('saveIncomeBtn').addEventListener('click', saveIncome);
    $('incomeClearBtn').addEventListener('click', clearIncome);
    $('incomeModal').addEventListener('click', e => { if (e.target === $('incomeModal')) closeIncomeModal(); });
    document.querySelectorAll('.preset').forEach(btn => btn.addEventListener('click', () => applyPreset(btn)));
    document.querySelectorAll('.currency-btn').forEach(btn => btn.addEventListener('click', () => setCurrency(btn)));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));

    document.querySelectorAll('[data-onboard-next]').forEach(btn => {
      btn.addEventListener('click', () => {
        const step = parseInt(btn.closest('.onboard-step').dataset.step, 10);
        // On step 1, persist the user's explicit acceptance of the Terms +
        // Privacy Policy with a timestamp and the current app version.
        // This is the audit trail required for the ÁSZF to be enforceable
        // (Hungarian consumer law) and the GDPR consent record (Art. 7(1)).
        if (step === 1) {
          const cb = $('onboardAcceptTerms');
          if (cb && cb.checked) {
            localStorage.setItem('leakd_terms_accepted', JSON.stringify({
              acceptedAt: new Date().toISOString(),
              version: window.LeakdVersion || 'unknown',
              terms: 'terms.html',
              privacy: 'privacy.html',
            }));
          }
        }
        if (step < 3) setOnboardStep(step + 1); else finishOnboard();
      });
    });
    // Gate the step-1 Next button on the legal-acceptance checkbox.
    const acceptCb = $('onboardAcceptTerms');
    const step1Next = $('onboardStep1Next');
    if (acceptCb && step1Next) {
      acceptCb.addEventListener('change', () => { step1Next.disabled = !acceptCb.checked; });
    }
    document.querySelectorAll('[data-onboard-skip]').forEach(btn => btn.addEventListener('click', finishOnboard));
    $('onboardEnableNotif').addEventListener('click', async () => {
      const N = window.LeakdNotify;
      if (N) {
        const r = await N.requestPermission();
        if (r === 'granted') { N.save({ enabled: true }); updateNotifBellState(); }
      }
      finishOnboard();
    });

    modal.addEventListener('click', e => { if (e.target === modal) closeModalFn(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (modal.classList.contains('active')) closeModalFn();
        else if ($('proModal').classList.contains('active')) closeProModal();
        else if ($('importModal').classList.contains('active')) closeImportModal();
        else if ($('shareModal').classList.contains('active')) closeShareModal();
        else if ($('notifModal').classList.contains('active')) closeNotifModal();
        else if ($('menuModal').classList.contains('active')) closeMenuModal();
        else if ($('langModal').classList.contains('active')) closeLangModal();
        else if ($('yearendModal').classList.contains('active')) closeYearendModal();
        else if ($('backupModal').classList.contains('active')) closeBackupModal();
        else if ($('budgetSetterModal').classList.contains('active')) closeBudgetSetter();
        else if ($('budgetsModal').classList.contains('active')) closeBudgetsModal();
        else if ($('incomeModal').classList.contains('active')) closeIncomeModal();
        else if ($('cancelledModal').classList.contains('active')) closeCancelledModal();
        else if ($('themeModal').classList.contains('active')) closeThemeModal();
        else if ($('bankModal').classList.contains('active')) closeBankModal();
        else if ($('goalModal').classList.contains('active')) closeGoalModal();
        else if ($('activityModal').classList.contains('active')) closeActivityModal();
        else if ($('whatifModal').classList.contains('active')) closeWhatIfModal();
        else if ($('panicModal').classList.contains('active')) closePanicModal();
        else if ($('compareModal').classList.contains('active')) closeCompareModal();
      }
      if (e.key === 'Enter' && modal.classList.contains('active')) saveSub();
    });
  }

  // ─── Modal focus management (a11y) ───
  // Globally watches every .modal-overlay for the `active` class. On open
  // we stash the previously-focused element and trap Tab inside the modal;
  // on close we restore focus. Centralized so all 20+ openX/closeX paths
  // get a11y for free without per-modal wiring.
  (function modalA11y() {
    const handlers = new Map();
    let lastFocused = null;
    const isFocusable = el => !el.disabled && el.offsetParent !== null && el.tabIndex !== -1;
    function trap(e, modal) {
      if (e.key !== 'Tab') return;
      const items = Array.from(modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(isFocusable);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.attributeName !== 'class') continue;
        const el = m.target;
        if (!el.classList || !el.classList.contains('modal-overlay')) continue;
        const isOpen = el.classList.contains('active');
        if (isOpen && !handlers.has(el)) {
          lastFocused = document.activeElement;
          const h = e => trap(e, el);
          el.addEventListener('keydown', h);
          handlers.set(el, h);
        } else if (!isOpen && handlers.has(el)) {
          el.removeEventListener('keydown', handlers.get(el));
          handlers.delete(el);
          if (lastFocused && typeof lastFocused.focus === 'function') {
            try { lastFocused.focus({ preventScroll: true }); } catch { }
          }
        }
      }
    });
    document.querySelectorAll('.modal-overlay').forEach(el =>
      obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    );
  })();

  init();
})();
