// Leakd — Spending history snapshots
// Every time the subscription list materially changes (add / edit / delete /
// pause), we append a snapshot { date, monthly, count } to a rolling buffer
// in localStorage. This gives us a real trend line on the home sparkline
// and the insights chart — without needing a server to remember anything.

(function () {
  'use strict';

  const STORAGE_KEY = 'leakd_history';
  const MAX_POINTS = 365; // keep at most one year of daily snapshots

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function save(points) {
    if (points.length > MAX_POINTS) points = points.slice(-MAX_POINTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(points));
  }

  function toMonthly(price, cycle, currency) {
    if (window.LeakdCurrency) return window.LeakdCurrency.toMonthly(price, cycle, currency);
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  function totals(subs) {
    let monthly = 0, count = 0;
    subs.forEach(s => {
      if (s.paused) return;
      monthly += toMonthly(s.price, s.cycle, s.currency);
      count++;
    });
    return { monthly, count };
  }

  // Record a snapshot. If we already have one for today, update it.
  function record(subs) {
    const { monthly, count } = totals(subs);
    const today = new Date().toISOString().split('T')[0];
    const points = load();
    if (points.length && points[points.length - 1].date === today) {
      points[points.length - 1] = { date: today, monthly, count };
    } else {
      points.push({ date: today, monthly, count });
    }
    save(points);
  }

  // For the sparkline: return last N points (most recent at the end).
  // If we have fewer than N, pad with the earliest known value so the line
  // doesn't look erratic.
  function recent(n) {
    const points = load();
    if (points.length === 0) return [];
    if (points.length >= n) return points.slice(-n);
    const first = points[0].monthly;
    const pad = Array.from({ length: n - points.length }, () => ({
      date: '', monthly: first, count: points[0].count
    }));
    return [...pad, ...points];
  }

  function clear() { localStorage.removeItem(STORAGE_KEY); }

  window.LeakdHistory = { load, record, recent, totals, clear, MAX_POINTS };
})();
