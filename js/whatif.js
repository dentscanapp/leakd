// Leakd — What-If scenario calculator
// "Tap to mark as cancelled (in scenario)" → live preview of how the totals
// change. Doesn't commit anything; lets the user explore "what would happen
// if I cut these 3 subs?" before actually doing it. Great for Pro conversion
// — once the user sees "you'd save $340/year", motivation to cancel spikes.

(function () {
  'use strict';

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

  // Given the current sub list + a set of "scenario-cancelled" IDs, return
  // the deltas. Caller computes the current totals separately and applies
  // these to produce the after-scenario values.
  function compute(subs, scenarioCancelledIds) {
    const cancelledSet = new Set(scenarioCancelledIds || []);
    const active = subs.filter(s => !s.paused);

    let currentMonthly = 0, scenarioMonthly = 0;
    let lifetimeIfKept5y = 0, lifetimeIfKept10y = 0;
    let investedAlt5y = 0, investedAlt10y = 0;
    let cancelledItems = [];

    active.forEach(s => {
      const m = toMonthly(s.price, s.cycle, s.currency);
      currentMonthly += m;
      if (cancelledSet.has(s.id)) {
        cancelledItems.push({ ...s, monthly: m, yearly: toYearly(s.price, s.cycle, s.currency) });
        // Investment alternative (7% annual, monthly compounding) — same math as lifetime.js
        const r = 0.07 / 12;
        const fv5 = m * ((Math.pow(1 + r, 60) - 1) / r);
        const fv10 = m * ((Math.pow(1 + r, 120) - 1) / r);
        investedAlt5y += fv5;
        investedAlt10y += fv10;
        lifetimeIfKept5y += m * 12 * 5;
        lifetimeIfKept10y += m * 12 * 10;
      } else {
        scenarioMonthly += m;
      }
    });

    const monthlySavings = currentMonthly - scenarioMonthly;
    const yearlySavings = monthlySavings * 12;

    return {
      currentMonthly,
      scenarioMonthly,
      monthlySavings,
      yearlySavings,
      cancelledItems,
      cancelledCount: cancelledItems.length,
      lifetimeIfKept5y,
      lifetimeIfKept10y,
      investedAlt5y,
      investedAlt10y,
    };
  }

  // Suggest the "best to cancel" — by rating asc, monthly desc.
  // Returns at most N candidates the user could check off to start with.
  function suggestCancellations(subs, n) {
    n = n || 5;
    return subs
      .filter(s => !s.paused)
      .map(s => ({
        ...s,
        monthly: toMonthly(s.price, s.cycle, s.currency),
        // score: low rating = high cancel score, expensive = higher score
        score: ((typeof s.rating === 'number' && s.rating > 0) ? (6 - s.rating) : 3) * 10
             + toMonthly(s.price, s.cycle, s.currency),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .map(s => s.id);
  }

  window.LeakdWhatIf = { compute, suggestCancellations };
})();
