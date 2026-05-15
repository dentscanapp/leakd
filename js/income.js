// Leakd — Income & savings ratio (Pro)
// Optional: user enters monthly net income, app shows what percentage of it
// goes to subscriptions. We never call this "savings" definitively — we don't
// know the user's other expenses — but the ratio is the most useful single
// number a subscription tracker can surface.

(function () {
  'use strict';

  const KEY = 'leakd_income';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : { monthly: 0 };
    } catch { return { monthly: 0 }; }
  }

  function save(income) {
    localStorage.setItem(KEY, JSON.stringify(income));
  }

  function set(monthly) {
    const m = parseFloat(monthly);
    save({ monthly: isNaN(m) || m < 0 ? 0 : m });
  }

  function get() { return load().monthly; }

  function clear() { localStorage.removeItem(KEY); }

  // ratio: 0-1 (or > 1 if subs exceed income, lol)
  function ratio(monthlySubs) {
    const inc = get();
    if (!inc || inc <= 0) return null;
    return monthlySubs / inc;
  }

  // Sentiment: 'fine' < 5%, 'high' 5-15%, 'crisis' > 15%
  function sentiment(r) {
    if (r == null) return null;
    if (r >= 0.15) return 'crisis';
    if (r >= 0.05) return 'high';
    return 'fine';
  }

  window.LeakdIncome = { get, set, load, save, clear, ratio, sentiment };
})();
