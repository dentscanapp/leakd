// Leakd — Locale & currency auto-detection
// Reads the browser locale (navigator.languages, falling back to Intl) and
// maps the country code to a sensible currency. Used on first launch so the
// user lands in a fully-configured app — Hungarian visitors get HUF + magyar,
// Germans get EUR + Deutsch, Brazilians get BRL + Português, etc.
//
// Detection priority:
//   1. navigator.languages (ordered preference, e.g. ["hu-HU","en-US"])
//   2. navigator.language single string
//   3. Intl.DateTimeFormat().resolvedOptions().locale
//
// We never overwrite an existing user choice — app.js only consults this
// module when there's no leakd_settings entry yet.

(function () {
  'use strict';

  // Country code (ISO 3166-1 alpha-2) → currency. Eurozone uses EUR.
  // Each entry: { code: ISO 4217 currency code, symbol: display glyph }.
  const COUNTRY_CURRENCY = {
    // Eurozone (Croatia joined 2023, Bulgaria stays BGN until at least 2026)
    AT: 'EUR', BE: 'EUR', CY: 'EUR', DE: 'EUR', EE: 'EUR', ES: 'EUR',
    FI: 'EUR', FR: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR',
    LU: 'EUR', LV: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SI: 'EUR',
    SK: 'EUR', HR: 'EUR',
    // Americas
    US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'USD',
    // Europe non-EUR
    GB: 'GBP', UK: 'GBP',
    CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', IS: 'EUR',
    PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN',
    RU: 'RUB', UA: 'UAH', BY: 'USD',
    // Asia-Pacific
    AU: 'AUD', NZ: 'NZD',
    JP: 'JPY', KR: 'KRW', CN: 'CNY', TW: 'CNY', HK: 'HKD', SG: 'SGD',
    IN: 'INR',
    TH: 'THB', PH: 'PHP', ID: 'IDR', VN: 'VND', MY: 'USD',
    // Middle East / Africa
    TR: 'TRY',
    ZA: 'ZAR',
    AE: 'AED',
  };

  // Currency metadata: how to display and format.
  // position: 'before' = "$10.00", 'after' = "10 Ft"
  // decimals: 2 (most), 0 (HUF, JPY, KRW)
  const CURRENCY_META = {
    USD: { symbol: '$',   position: 'before', decimals: 2 },
    EUR: { symbol: '€',   position: 'before', decimals: 2 },
    GBP: { symbol: '£',   position: 'before', decimals: 2 },
    HUF: { symbol: 'Ft',  position: 'after',  decimals: 0 },
    JPY: { symbol: '¥',   position: 'before', decimals: 0 },
    INR: { symbol: '₹',   position: 'before', decimals: 2 },
    BRL: { symbol: 'R$',  position: 'before', decimals: 2 },
    AUD: { symbol: 'A$',  position: 'before', decimals: 2 },
    CAD: { symbol: 'C$',  position: 'before', decimals: 2 },
    NZD: { symbol: 'NZ$', position: 'before', decimals: 2 },
    CHF: { symbol: 'CHF', position: 'before', decimals: 2, space: true },
    SEK: { symbol: 'kr',  position: 'after',  decimals: 0 },
    NOK: { symbol: 'kr',  position: 'after',  decimals: 0 },
    DKK: { symbol: 'kr',  position: 'after',  decimals: 2 },
    PLN: { symbol: 'zł',  position: 'after',  decimals: 2 },
    CZK: { symbol: 'Kč',  position: 'after',  decimals: 0 },
    CNY: { symbol: '¥',   position: 'before', decimals: 2 },
    KRW: { symbol: '₩',   position: 'before', decimals: 0 },
    HKD: { symbol: 'HK$', position: 'before', decimals: 2 },
    SGD: { symbol: 'S$',  position: 'before', decimals: 2 },
    MXN: { symbol: 'Mex$',position: 'before', decimals: 2 },
    TRY: { symbol: '₺',   position: 'before', decimals: 2 },
    ZAR: { symbol: 'R',   position: 'before', decimals: 2 },
    AED: { symbol: 'AED', position: 'before', decimals: 2, space: true },
    RUB: { symbol: '₽',   position: 'after',  decimals: 0 },
    RON: { symbol: 'lei', position: 'after',  decimals: 2 },
    BGN: { symbol: 'лв',  position: 'after',  decimals: 2, space: true },
    UAH: { symbol: '₴',   position: 'before', decimals: 2 },
    THB: { symbol: '฿',   position: 'before', decimals: 2 },
    PHP: { symbol: '₱',   position: 'before', decimals: 2 },
    IDR: { symbol: 'Rp',  position: 'before', decimals: 0, space: true },
    VND: { symbol: '₫',   position: 'after',  decimals: 0 },
  };

  // Default language for each country, so we can also auto-pick a language
  // when the user is in a country we cover but their browser lang is
  // something obscure. Same priority as currency.
  // Only languages we actually support (28 codes) appear as values.
  const COUNTRY_LANG = {
    // Europe — Eurozone + neighbours
    AT: 'de', BE: 'nl', CY: 'el', DE: 'de', EE: 'en', ES: 'es',
    FI: 'en', FR: 'fr', GR: 'el', IE: 'en', IT: 'it', LT: 'en',
    LU: 'fr', LV: 'en', MT: 'en', NL: 'nl', PT: 'pt', SI: 'en',
    SK: 'sk', HR: 'hr',
    GB: 'en', UK: 'en',
    CH: 'de', SE: 'sv', NO: 'sv', DK: 'en', IS: 'en',
    PL: 'pl', CZ: 'cs', HU: 'hu', RO: 'ro', BG: 'bg',
    RU: 'ru', UA: 'uk', BY: 'ru',
    // Americas
    US: 'en', CA: 'en', MX: 'es', BR: 'pt', AR: 'es',
    // Asia-Pacific
    AU: 'en', NZ: 'en',
    JP: 'ja', KR: 'ko', CN: 'zh', TW: 'zh', HK: 'zh', SG: 'en',
    IN: 'hi', TH: 'th', PH: 'fil', ID: 'id', VN: 'vi', MY: 'en',
    // Middle East / Africa
    TR: 'tr', ZA: 'en', AE: 'en',
  };

  function getBrowserLocales() {
    const out = [];
    if (navigator.languages && navigator.languages.length) out.push(...navigator.languages);
    if (navigator.language) out.push(navigator.language);
    try {
      const intl = Intl.DateTimeFormat().resolvedOptions().locale;
      if (intl) out.push(intl);
    } catch {}
    return out;
  }

  // Same list but with the OS regional locale FIRST. Used for *country*
  // detection because the OS region (Intl) reflects where the user actually
  // is — even if their browser UI is in a different language. The plain
  // `getBrowserLocales()` order is still right for *language* detection.
  function getCountryLocales() {
    const out = [];
    try {
      const intl = Intl.DateTimeFormat().resolvedOptions().locale;
      if (intl) out.push(intl);
    } catch {}
    if (navigator.languages && navigator.languages.length) out.push(...navigator.languages);
    if (navigator.language) out.push(navigator.language);
    return out;
  }

  function detectCountry() {
    // Try OS regional locale first (Intl) — it's the most reliable signal
    // of where the user actually is, even if their browser is in English.
    // Then fall back to navigator.languages.
    for (const raw of getCountryLocales()) {
      const m = String(raw).match(/[-_]([A-Z]{2})\b/i);
      if (m) {
        const cc = m[1].toUpperCase();
        if (COUNTRY_CURRENCY[cc] || COUNTRY_LANG[cc]) return cc;
      }
    }
    return null;
  }

  function detectCurrency() {
    const cc = detectCountry();
    if (!cc) return null;
    const code = COUNTRY_CURRENCY[cc];
    if (!code) return null;
    const meta = CURRENCY_META[code];
    if (!meta) return null;
    return { code, symbol: meta.symbol, country: cc, meta };
  }

  function detectLanguage(supported) {
    // First try direct browser language tags
    for (const raw of getBrowserLocales()) {
      const lang = String(raw).toLowerCase().split(/[-_]/)[0];
      if (supported.includes(lang)) return lang;
    }
    // Fall back to country → language mapping
    const cc = detectCountry();
    if (cc && COUNTRY_LANG[cc] && supported.includes(COUNTRY_LANG[cc])) {
      return COUNTRY_LANG[cc];
    }
    return null;
  }

  function formatMoney(amount, currencyCode) {
    const meta = CURRENCY_META[currencyCode] || CURRENCY_META.USD;
    const lang = (window.LeakdI18n && window.LeakdI18n.lang) || undefined;
    const safe = (typeof amount === 'number' && isFinite(amount)) ? amount : 0;
    const num = meta.decimals === 0
      ? Math.round(safe).toLocaleString(lang)
      : safe.toLocaleString(lang, { minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals });
    const space = meta.space ? ' ' : '';
    return meta.position === 'after'
      ? num + ' ' + meta.symbol
      : meta.symbol + space + num;
  }

  function metaForCode(code) { return CURRENCY_META[code] || null; }

  window.LeakdLocale = {
    detectCountry,
    detectCurrency,
    detectLanguage,
    formatMoney,
    metaForCode,
    COUNTRY_CURRENCY,
    COUNTRY_LANG,
    CURRENCY_META,
  };
})();
