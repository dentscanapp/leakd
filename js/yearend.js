// Leakd — Year-end report
// Computes the user's year-in-subscriptions and renders a Spotify-Wrapped-style
// modal. Also exposes a "shareable card" version via canvas.

(function () {
  'use strict';

  function toMonthly(price, cycle) {
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  // For the report, count what's been paid in the current calendar year
  // (or projected for the rest of the year). Uses the user's `createdAt`
  // as the earliest possible start, capped at Jan 1.
  function computeReport(subs, year) {
    year = year || new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
    const now = new Date();
    const cap = now < yearEnd ? now : yearEnd;

    let totalPaid = 0;
    const byName = {};
    const byCategory = {};
    let activeCount = 0;

    subs.forEach(s => {
      if (s.paused) return;
      const created = s.createdAt ? new Date(s.createdAt) : yearStart;
      const start = created < yearStart ? yearStart : created;
      if (start > cap) return;
      const monthsActive = Math.max(0, (cap - start) / (1000 * 60 * 60 * 24 * 30.44));
      const paid = toMonthly(s.price, s.cycle) * monthsActive;
      totalPaid += paid;
      byName[s.name] = (byName[s.name] || 0) + paid;
      byCategory[s.category] = (byCategory[s.category] || 0) + paid;
      activeCount++;
    });

    const top = Object.entries(byName).sort((a, b) => b[1] - a[1])[0];
    const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    return {
      year,
      totalPaid,
      activeCount,
      topName: top ? top[0] : null,
      topAmount: top ? top[1] : 0,
      topCategory: topCat ? topCat[0] : null,
      topCategoryAmount: topCat ? topCat[1] : 0,
      byCategory,
    };
  }

  window.LeakdYearEnd = { computeReport };
})();
