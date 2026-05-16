// Leakd — Side-by-side subscription comparison
// Pick 2-3 subscriptions, see them in a compact comparison grid: monthly
// price, yearly cost, lifetime spent, rating, cancellation difficulty,
// known alternatives count. Helps the user decide which to cut when
// multiple subs feel equally cuttable.

(function () {
  'use strict';

  function toMonthly(price, cycle) {
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  function toYearly(price, cycle) {
    if (cycle === 'weekly') return price * 52;
    if (cycle === 'monthly') return price * 12;
    return price;
  }

  // Build comparable metrics for each sub. Caller picks the columns.
  function build(subs) {
    return subs.map(s => {
      const monthly = toMonthly(s.price, s.cycle);
      const yearly = toYearly(s.price, s.cycle);
      let lifetimePaid = 0;
      if (window.LeakdLifetime) {
        const lt = window.LeakdLifetime.lifetime(s);
        if (lt) lifetimePaid = lt.totalPaid;
      }
      const playbook = window.LeakdImport && window.LeakdImport.findPlaybook
        ? window.LeakdImport.findPlaybook(s.name)
        : null;
      const altCount = window.LeakdAlternatives && window.LeakdAlternatives.findAlternatives
        ? window.LeakdAlternatives.findAlternatives(s.name).length
        : 0;
      return {
        id: s.id,
        name: s.name,
        category: s.category,
        rating: typeof s.rating === 'number' && s.rating > 0 ? s.rating : null,
        monthly,
        yearly,
        lifetimePaid,
        cancelDifficulty: playbook ? playbook.difficulty : 'unknown',
        cancelMinutes: playbook ? playbook.minutes : null,
        altCount,
        paused: !!s.paused,
        sub: s,
      };
    });
  }

  // Identify "worst" column per metric — used for highlighting.
  // For monthly/yearly/lifetimePaid: higher = worse (more cost).
  // For rating: lower = worse.
  // For cancelDifficulty: hard > medium > easy.
  function worstIndex(rows, metric) {
    if (!rows.length) return -1;
    let worstIdx = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], w = rows[worstIdx];
      if (metric === 'rating') {
        const rv = r.rating == null ? 99 : r.rating;
        const wv = w.rating == null ? 99 : w.rating;
        if (rv < wv) worstIdx = i;
      } else if (metric === 'cancelDifficulty') {
        const ord = { unknown: 0, easy: 1, medium: 2, hard: 3 };
        if ((ord[r.cancelDifficulty] || 0) > (ord[w.cancelDifficulty] || 0)) worstIdx = i;
      } else {
        if (r[metric] > w[metric]) worstIdx = i;
      }
    }
    return worstIdx;
  }

  window.LeakdCompare = { build, worstIndex };
})();
