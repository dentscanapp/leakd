// Leakd — Lifetime cost & investment alternative
// The single most emotionally devastating thing a subscription tracker can do:
// show the user exactly how much one specific subscription has cost them
// over its lifetime, and what that money would have been worth if invested
// instead at a modest market return.
//
// Nobody else does this. It's the killer feature for the "should I cancel?"
// moment — abstract money becomes concrete: "Netflix has cost you $815. Had
// you invested those payments at 7%, you'd have $1,124 now."

(function () {
  'use strict';

  function toMonthly(price, cycle) {
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  // ── Lifetime paid so far ──
  // Uses createdAt as the start date. Returns months elapsed, total paid,
  // and a friendly "human" duration string.
  function lifetime(sub) {
    if (!sub || !sub.createdAt) return null;
    const start = new Date(sub.createdAt);
    const now = new Date();
    const months = Math.max(0, (now - start) / (1000 * 60 * 60 * 24 * 30.44));
    const monthly = toMonthly(sub.price, sub.cycle);
    const totalPaid = monthly * months;
    return {
      months,
      monthly,
      totalPaid,
      startDate: start,
    };
  }

  // ── Future projection if user keeps paying ──
  // Years can be 1, 3, 5, 10. Returns the cumulative cost.
  function futureCost(sub, years) {
    const m = toMonthly(sub.price, sub.cycle);
    return m * 12 * years;
  }

  // ── "What if you invested instead?" calculator ──
  // Compound monthly contribution at the given annual return rate.
  // Formula: FV = P * ((1 + r)^n - 1) / r
  //   where P = monthly payment, r = monthly rate, n = number of months
  // Default 7% annual return ≈ historical S&P 500 long-term real return.
  function investmentAlternative(sub, years, annualReturnPct) {
    const monthly = toMonthly(sub.price, sub.cycle);
    const n = years * 12;
    const r = (annualReturnPct || 7) / 100 / 12;
    if (r === 0) return monthly * n;
    return monthly * ((Math.pow(1 + r, n) - 1) / r);
  }

  // ── Inflation projection ──
  // Most subscriptions raise prices by 3-7% annually. Netflix went from
  // $7.99 → $15.99 in 10 years (7% annual). We project at 5% as a balanced
  // estimate so the user sees the future cost of "just $10/month".
  function projectedPriceAfter(sub, years, annualRaisePct) {
    const r = (annualRaisePct == null ? 5 : annualRaisePct) / 100;
    const monthly = toMonthly(sub.price, sub.cycle);
    return monthly * Math.pow(1 + r, years);
  }

  // Total cost over N years assuming `annualRaisePct` price growth per year.
  // This is the geometric series sum: m * 12 * ((1+r)^n - 1) / r
  function inflatedFutureCost(sub, years, annualRaisePct) {
    const r = (annualRaisePct == null ? 5 : annualRaisePct) / 100;
    const monthly = toMonthly(sub.price, sub.cycle);
    if (r === 0) return monthly * 12 * years;
    return monthly * 12 * ((Math.pow(1 + r, years) - 1) / r);
  }

  // ── Full report for the UI ──
  function report(sub, annualReturnPct) {
    const lt = lifetime(sub);
    const monthly = toMonthly(sub.price, sub.cycle);
    return {
      lifetime: lt,
      monthly,
      next1y: monthly * 12,
      next5y: monthly * 12 * 5,
      next10y: monthly * 12 * 10,
      invested5y: investmentAlternative(sub, 5, annualReturnPct),
      invested10y: investmentAlternative(sub, 10, annualReturnPct),
      // Inflation (5% annual price hikes — typical SaaS rate)
      inflated10yMonthly: projectedPriceAfter(sub, 10, 5),
      inflated10yTotal: inflatedFutureCost(sub, 10, 5),
    };
  }

  // ── Total lifetime paid across ALL subs (for insights view) ──
  function aggregateLifetime(subs) {
    let total = 0;
    subs.forEach(s => {
      if (s.paused) return;
      const lt = lifetime(s);
      if (lt) total += lt.totalPaid;
    });
    return total;
  }

  window.LeakdLifetime = {
    lifetime, futureCost, investmentAlternative, report, aggregateLifetime,
    projectedPriceAfter, inflatedFutureCost,
  };
})();
