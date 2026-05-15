// Leakd — Public benchmarks
// Hardcoded statistics about what "typical" subscription users spend.
// Lets us tell the user "you spend X — that's in the top Y% of trackers"
// without needing a server. Numbers come from a mix of:
//   • Various 2024 consumer surveys (CNET, Bankrate, C+R Research)
//   • Industry reports on streaming, AI tool adoption, etc.
//   • Our editorial judgement where data is mushy
//
// Refresh annually as new survey data drops.

(function () {
  'use strict';

  // Average monthly subscription spend, USD, by number of active subs
  // Source: synthesized from C+R Research 2024 + Bankrate 2024
  const BY_COUNT = [
    { count: 1, avgMonthly: 12 },
    { count: 2, avgMonthly: 23 },
    { count: 3, avgMonthly: 38 },
    { count: 4, avgMonthly: 56 },
    { count: 5, avgMonthly: 78 },
    { count: 6, avgMonthly: 103 },
    { count: 7, avgMonthly: 132 },
    { count: 8, avgMonthly: 162 },
    { count: 10, avgMonthly: 219 },
    { count: 12, avgMonthly: 268 },
    { count: 15, avgMonthly: 332 },
  ];

  // Distribution of monthly subscription spend (USD) — what percentile is X?
  // Synthesized: most people pay $50-150/mo, with a long tail.
  const PERCENTILES = [
    { spend: 25,  pct: 10 },
    { spend: 50,  pct: 25 },
    { spend: 80,  pct: 40 },
    { spend: 120, pct: 55 },
    { spend: 160, pct: 68 },
    { spend: 220, pct: 80 },
    { spend: 300, pct: 90 },
    { spend: 450, pct: 97 },
  ];

  function expectedFor(count) {
    if (count <= 0) return 0;
    // Find nearest two and interpolate
    for (let i = 0; i < BY_COUNT.length - 1; i++) {
      if (count >= BY_COUNT[i].count && count <= BY_COUNT[i + 1].count) {
        const a = BY_COUNT[i], b = BY_COUNT[i + 1];
        const f = (count - a.count) / (b.count - a.count);
        return a.avgMonthly + (b.avgMonthly - a.avgMonthly) * f;
      }
    }
    return BY_COUNT[BY_COUNT.length - 1].avgMonthly;
  }

  function percentileFor(spend) {
    if (spend <= 0) return 0;
    if (spend <= PERCENTILES[0].spend) return PERCENTILES[0].pct;
    for (let i = 0; i < PERCENTILES.length - 1; i++) {
      if (spend >= PERCENTILES[i].spend && spend <= PERCENTILES[i + 1].spend) {
        const a = PERCENTILES[i], b = PERCENTILES[i + 1];
        const f = (spend - a.spend) / (b.spend - a.spend);
        return Math.round(a.pct + (b.pct - a.pct) * f);
      }
    }
    return 99;
  }

  function compare(monthly, subCount) {
    if (subCount <= 0) return null;
    const expected = expectedFor(subCount);
    const percentile = percentileFor(monthly);
    // Verdict: how does user compare to the average for their sub count?
    const ratio = monthly / expected;
    let verdict;
    if (ratio < 0.7) verdict = 'lower'; // good
    else if (ratio < 1.1) verdict = 'average';
    else if (ratio < 1.5) verdict = 'higher';
    else verdict = 'much-higher'; // bad
    return { expected, percentile, ratio, verdict };
  }

  window.LeakdBenchmarks = { compare, expectedFor, percentileFor, BY_COUNT, PERCENTILES };
})();
