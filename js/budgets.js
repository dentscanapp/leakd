// Leakd — Category budgets
// Set a monthly spending limit per category. When the user is approaching or
// over the limit we show a banner on the home view and (if notifications are
// enabled) a one-time push. This is the first "Pro" feature that's actually
// implemented end-to-end; we still gate it via LeakdPro.isPro() so the
// promise from the upgrade modal lines up with reality.

(function () {
  'use strict';

  const STORAGE_KEY = 'leakd_budgets';

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }

  function save(budgets) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budgets));
  }

  function setBudget(category, amount) {
    const b = load();
    if (amount == null || amount <= 0) {
      delete b[category];
    } else {
      b[category] = Number(amount);
    }
    save(b);
  }

  function getBudget(category) {
    const b = load();
    return b[category] || null;
  }

  function all() { return load(); }

  // Compute spend per category. Returns array sorted with over-budget first.
  function computeProgress(subs) {
    const budgets = load();
    const byCat = {};
    subs.forEach(s => {
      if (s.paused) return;
      const m = toMonthly(s.price, s.cycle, s.currency);
      byCat[s.category] = (byCat[s.category] || 0) + m;
    });

    const result = [];
    Object.keys(budgets).forEach(cat => {
      const limit = budgets[cat];
      const spent = byCat[cat] || 0;
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      const status = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
      result.push({ category: cat, limit, spent, pct, status });
    });

    return result.sort((a, b) => {
      const rank = { over: 0, warn: 1, ok: 2 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return b.pct - a.pct;
    });
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

  // Reset all budgets (used by reset-all-data)
  function clear() { localStorage.removeItem(STORAGE_KEY); }

  window.LeakdBudgets = { load, save, setBudget, getBudget, all, computeProgress, clear };
})();
