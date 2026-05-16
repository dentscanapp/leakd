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
    'BRL', 'PLN', 'RON', 'CZK', 'SEK', 'NOK', 'DKK', 'TRY', 'IDR', 'THB'
  ];

  let ratesData = {
    base: 'EUR',
    date: '',
    rates: { 
      'EUR': 1,
      'HUF': 395, // Rough fallback to avoid 1:1 disaster before first sync
      'USD': 1.08,
      'GBP': 0.86
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

  // Initialize
  load();

  window.LeakdCurrency = {
    sync,
    convert,
    getSymbol,
    get rates() { return ratesData.rates; },
    get supported() { return SUPPORTED; }
  };
})();
