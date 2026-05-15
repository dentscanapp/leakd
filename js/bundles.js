// Leakd — Smart bundle detector
// Goes beyond the simple "you have 2 music subs" duplicate suggestion.
// Knows about real-world streaming/service bundles and tells the user
// "you have these 3 separate subs — bundle X costs $Y, saves $Z/mo".
//
// Bundle data is curated, hardcoded — no API needed. Add new bundles by
// editing BUNDLES below.

(function () {
  'use strict';

  // Each bundle: list of regex matchers for the services it replaces,
  // plus the bundle's own name and price.
  const BUNDLES = [
    {
      id: 'disney-bundle',
      name: 'Disney Bundle (Disney+ / Hulu / ESPN+)',
      price: 14.99,
      cycle: 'monthly',
      replaces: [/disney\+?/i, /hulu/i, /espn\+?/i],
      requireAtLeast: 2,
      region: 'US',
      note: "If you're paying for any 2 of Disney+, Hulu, or ESPN+ separately, the bundle is cheaper.",
    },
    {
      id: 'apple-one-individual',
      name: 'Apple One Individual',
      price: 19.95,
      cycle: 'monthly',
      replaces: [/apple\s*music/i, /apple\s*tv\+?/i, /apple\s*arcade/i, /icloud/i, /apple\s*fitness/i],
      requireAtLeast: 2,
      region: 'global',
      note: 'Apple Music + Apple TV+ + iCloud+ (50GB) + Arcade for the price of two of them separately.',
    },
    {
      id: 'apple-one-family',
      name: 'Apple One Family',
      price: 25.95,
      cycle: 'monthly',
      replaces: [/apple\s*music/i, /apple\s*tv\+?/i, /apple\s*arcade/i, /icloud/i, /apple\s*fitness/i],
      requireAtLeast: 3,
      familyPlan: true,
      region: 'global',
      note: 'Same as Individual but for up to 6 people via Family Sharing. Worth it if 2+ people in your household use Apple services.',
    },
    {
      id: 'google-one-premium',
      name: 'Google One Premium',
      price: 9.99,
      cycle: 'monthly',
      replaces: [/google\s*one/i, /youtube\s*premium/i, /youtube\s*music/i],
      requireAtLeast: 2,
      region: 'global',
      note: 'Bundles Google One storage with YouTube Premium in some regions.',
    },
    {
      id: 'amazon-prime',
      name: 'Amazon Prime (all-in)',
      price: 14.99,
      cycle: 'monthly',
      replaces: [/prime\s*video|amazon\s*prime/i],
      requireAtLeast: 1,
      region: 'global',
      note: 'Includes Prime Video + free shipping + Prime Music + Prime Reading. If you already pay for any of them individually, Prime saves.',
    },
    {
      id: 'ms365-family',
      name: 'Microsoft 365 Family',
      price: 9.99,
      cycle: 'monthly',
      replaces: [/microsoft\s*365|office\s*365/i, /onedrive/i],
      requireAtLeast: 1,
      familyPlan: true,
      region: 'global',
      note: 'Office + 1TB OneDrive per person, up to 6 people. Same price for one or six users.',
    },
    {
      id: 'spotify-family',
      name: 'Spotify Family',
      price: 16.99,
      cycle: 'monthly',
      replaces: [/spotify/i],
      requireAtLeast: 1,
      familyPlan: true,
      region: 'global',
      note: 'Spotify Premium for up to 6 family members. If you and your partner both have separate Premium ($10.99 × 2 = $21.98), Family saves $5/mo.',
    },
    {
      id: 'nyt-all-access',
      name: 'NYT All Access',
      price: 25.00,
      cycle: 'monthly',
      replaces: [/nytimes|nyt|new\s*york\s*times/i, /the\s*athletic/i, /wirecutter/i, /nyt\s*cooking/i, /nyt\s*games/i],
      requireAtLeast: 2,
      region: 'global',
      note: 'Bundles News + Games + Cooking + The Athletic + Wirecutter. Cheaper than buying any 2 separately.',
    },
  ];

  function toMonthly(price, cycle) {
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  // For each known bundle, check if the user's active subs overlap enough
  // to make the bundle worthwhile. Returns recommendations with savings.
  function detect(subs) {
    const active = subs.filter(s => !s.paused);
    const recommendations = [];

    for (const bundle of BUNDLES) {
      const matched = active.filter(s =>
        bundle.replaces.some(re => re.test(s.name))
      );
      if (matched.length < bundle.requireAtLeast) continue;

      const currentTotal = matched.reduce((sum, s) => sum + toMonthly(s.price, s.cycle), 0);
      const bundleMonthly = toMonthly(bundle.price, bundle.cycle);
      const monthlySavings = currentTotal - bundleMonthly;
      if (monthlySavings <= 0.5) continue; // Don't recommend if savings is trivial

      recommendations.push({
        bundle,
        matchedSubs: matched,
        currentMonthly: currentTotal,
        bundleMonthly,
        monthlySavings,
        yearlySavings: monthlySavings * 12,
      });
    }

    recommendations.sort((a, b) => b.yearlySavings - a.yearlySavings);
    return recommendations;
  }

  window.LeakdBundles = { detect, BUNDLES };
})();
