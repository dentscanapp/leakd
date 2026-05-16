// Leakd — Spending personality
// Classifies the user into one of N archetypes based on subscription patterns.
// Pure function over the current sub list + cancelled history + budgets.
// Returns the dominant archetype plus a secondary trait if applicable.
//
// Archetypes prioritized so the MOST distinguishing pattern wins:
//   1. The Quiet Cutter (3+ cancellations this year) — celebrate the wins
//   2. Bundle Master (currently using a known bundle service like Apple One)
//   3. Streaming Junkie (3+ Entertainment subs)
//   4. AI Hoarder (2+ AI tools)
//   5. Productivity Stack (5+ Work subs)
//   6. Music Snob (2+ Music subs)
//   7. Subscription Spiraler (10+ active subs)
//   8. Healthy Minimalist (3 or fewer total, mostly rated high)
//   9. The Forgotten (1+ subs older than 12 months, never used)
//  10. Just Getting Started (default if no pattern fits)

(function () {
  'use strict';

  function toMonthly(price, cycle, currency) {
    if (window.LeakdCurrency) return window.LeakdCurrency.toMonthly(price, cycle, currency);
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  const ARCHETYPES = [
    {
      id: 'quietCutter',
      icon: '✂️',
      labelKey: 'personality.quietCutter',
      taglineKey: 'personality.quietCutterTag',
      test: (ctx) => ctx.cancelThisYear >= 3,
    },
    {
      id: 'bundleMaster',
      icon: '🎁',
      labelKey: 'personality.bundleMaster',
      taglineKey: 'personality.bundleMasterTag',
      test: (ctx) => ctx.hasBundle,
    },
    {
      id: 'streamingJunkie',
      icon: '🎬',
      labelKey: 'personality.streamingJunkie',
      taglineKey: 'personality.streamingJunkieTag',
      test: (ctx) => ctx.byCat.Entertainment >= 3,
    },
    {
      id: 'aiHoarder',
      icon: '🤖',
      labelKey: 'personality.aiHoarder',
      taglineKey: 'personality.aiHoarderTag',
      test: (ctx) => ctx.aiCount >= 2,
    },
    {
      id: 'productivityStack',
      icon: '💼',
      labelKey: 'personality.productivityStack',
      taglineKey: 'personality.productivityStackTag',
      test: (ctx) => ctx.byCat.Work >= 5,
    },
    {
      id: 'musicSnob',
      icon: '🎵',
      labelKey: 'personality.musicSnob',
      taglineKey: 'personality.musicSnobTag',
      test: (ctx) => ctx.byCat.Music >= 2,
    },
    {
      id: 'spiraler',
      icon: '🌀',
      labelKey: 'personality.spiraler',
      taglineKey: 'personality.spiralerTag',
      test: (ctx) => ctx.total >= 10,
    },
    {
      id: 'minimalist',
      icon: '🧘',
      labelKey: 'personality.minimalist',
      taglineKey: 'personality.minimalistTag',
      test: (ctx) => ctx.total <= 3 && ctx.total > 0 && ctx.avgRating >= 4,
    },
    {
      id: 'forgotten',
      icon: '👻',
      labelKey: 'personality.forgotten',
      taglineKey: 'personality.forgottenTag',
      test: (ctx) => ctx.oldUnratedCount >= 1 && ctx.total >= 2,
    },
    {
      id: 'starting',
      icon: '🌱',
      labelKey: 'personality.starting',
      taglineKey: 'personality.startingTag',
      test: () => true, // catch-all
    },
  ];

  const AI_SERVICE_RE = /chatgpt|openai|claude|gemini|bard|perplexity|copilot|midjourney|runway|elevenlabs/i;
  const BUNDLE_NAMES_RE = /apple one|disney bundle|microsoft 365 family|spotify family|nyt all access|google one premium/i;

  function classify(subs) {
    const active = (subs || []).filter(s => !s.paused);
    const byCat = { Entertainment: 0, Work: 0, Music: 0, Fitness: 0, Cloud: 0, Food: 0, News: 0, Other: 0 };
    let total = 0, monthly = 0, ratedSum = 0, ratedCount = 0;
    let aiCount = 0, hasBundle = false, oldUnratedCount = 0;
    const now = Date.now();
    const yearAgo = now - 365 * 86400000;

    active.forEach(s => {
      total++;
      monthly += toMonthly(s.price, s.cycle, s.currency);
      if (byCat[s.category] !== undefined) byCat[s.category]++;
      if (typeof s.rating === 'number' && s.rating > 0) {
        ratedSum += s.rating; ratedCount++;
      }
      if (AI_SERVICE_RE.test(s.name)) aiCount++;
      if (BUNDLE_NAMES_RE.test(s.name)) hasBundle = true;
      if (s.createdAt && new Date(s.createdAt).getTime() < yearAgo && (!s.rating || s.rating === 0)) {
        oldUnratedCount++;
      }
    });

    const avgRating = ratedCount > 0 ? ratedSum / ratedCount : 0;
    const cancelThisYear = window.LeakdCancelled ? window.LeakdCancelled.thisYearCount() : 0;
    const ctx = { total, monthly, byCat, avgRating, aiCount, hasBundle, oldUnratedCount, cancelThisYear };

    for (const arch of ARCHETYPES) {
      if (arch.test(ctx)) return { ...arch, ctx };
    }
    return ARCHETYPES[ARCHETYPES.length - 1];
  }

  window.LeakdPersonality = { classify, ARCHETYPES };
})();
