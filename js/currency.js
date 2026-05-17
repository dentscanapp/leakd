// Leakd — Currency & Exchange Rates
// Offline-first, privacy-focused currency conversion.
// Rates are fetched once a day and cached in localStorage.

(function () {
  'use strict';

  const STORAGE_KEY = 'leakd_rates';
  const API_URL = 'https://api.frankfurter.app/latest';
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  // Common currencies supported by Frankfurter + basic list
  const SUPPORTED = [
    'USD', 'EUR', 'HUF', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'INR',
    'BRL', 'PLN', 'RON', 'CZK', 'SEK', 'NOK', 'DKK', 'TRY', 'IDR', 'THB',
    'BGN', 'UAH', 'PHP', 'VND', 'KRW', 'MXN', 'HKD', 'SGD', 'NZD', 'ZAR', 'AED', 'RUB'
  ];

  // Rough EUR-based fallback rates so the app behaves sensibly before the
  // Frankfurter API responds (or when it's blocked, e.g. CORS on GH Pages).
  // Numbers are deliberately approximate — they're replaced by live rates
  // as soon as a sync succeeds.
  let ratesData = {
    base: 'EUR',
    date: '',
    rates: {
      EUR: 1,
      USD: 1.08, GBP: 0.86, JPY: 162, CHF: 0.95, CAD: 1.48,
      AUD: 1.65, NZD: 1.80, CNY: 7.85, INR: 90, BRL: 5.5,
      HUF: 395, PLN: 4.30, RON: 4.97, CZK: 25.2, SEK: 11.3,
      NOK: 11.6, DKK: 7.46, TRY: 38, IDR: 17500, THB: 39,
      BGN: 1.96, UAH: 45, PHP: 62, VND: 27500, KRW: 1500,
      MXN: 22, HKD: 8.45, SGD: 1.45, ZAR: 20, AED: 3.97, RUB: 100,
    },
    updatedAt: 0
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.rates) ratesData = parsed;
      }
    } catch (e) {
      console.warn('Currency load failed', e);
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ratesData));
  }

  async function sync(subs, force = false) {
    const now = Date.now();
    // Only sync if cache is old or missing
    if (!force && ratesData.updatedAt && (now - ratesData.updatedAt < CACHE_DURATION)) {
      return;
    }

    // Privacy-first: only fetch if the user actually has a sub that needs conversion
    if (!force && Array.isArray(subs)) {
      const needsConversion = subs.some(s => s.currency && s.currency !== (window.LeakdState && window.LeakdState.currencyCode));
      if (!needsConversion) return;
    }

    try {
      // Frankfurter base is EUR by default
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      
      ratesData = {
        base: data.base || 'EUR',
        date: data.date,
        rates: { ...data.rates, [data.base]: 1 },
        updatedAt: now
      };
      save();
      console.log('Currency rates synced', ratesData.date);
    } catch (e) {
      console.error('Currency sync failed', e);
    }
  }

  /**
   * Convert amount from one currency to another.
   * If rates are missing, returns the original amount.
   */
  function convert(amount, from, to) {
    if (!from || !to || from === to) return amount;
    if (!ratesData.rates[from] || !ratesData.rates[to]) return amount;

    // Convert to EUR first (base), then to target
    const inBase = amount / ratesData.rates[from];
    return inBase * ratesData.rates[to];
  }

  /**
   * Get the symbol for a currency code.
   */
  function getSymbol(code) {
    const symbols = {
      USD: '$', EUR: '€', HUF: 'Ft', GBP: '£', JPY: '¥', CHF: 'CHF',
      CAD: '$', AUD: '$', CNY: '¥', INR: '₹', BRL: 'R$', PLN: 'zł',
      RON: 'lei', CZK: 'Kč', SEK: 'kr', NOK: 'kr', DKK: 'kr',
      TRY: '₺', IDR: 'Rp', THB: '฿'
    };
    return symbols[code] || code;
  }

  function toMonthly(price, cycle, currency) {
    let p = price;
    if (currency && window.LeakdCurrency && window.LeakdState) {
      p = window.LeakdCurrency.convert(price, currency, window.LeakdState.currencyCode);
    }
    if (cycle === 'weekly') return p * 4.33;
    if (cycle === 'yearly') return p / 12;
    return p;
  }

  function toYearly(price, cycle, currency) {
    let p = price;
    if (currency && window.LeakdCurrency && window.LeakdState) {
      p = window.LeakdCurrency.convert(price, currency, window.LeakdState.currencyCode);
    }
    if (cycle === 'weekly') return p * 52;
    if (cycle === 'monthly') return p * 12;
    return p;
  }

  // Initialize
  load();

  window.LeakdCurrency = {
    sync,
    convert,
    getSymbol,
    toMonthly,
    toYearly,
    get rates() { return ratesData.rates; },
    get supported() { return SUPPORTED; }
  };
})();
