// Leakd — Insights engine
// Pure functions that take the subs array and compute the analytics the
// Insights view renders. No DOM access here — the view layer reads these
// results and templates them.

(function () {
  'use strict';

  const t = (k, vars) => window.LeakdI18n ? window.LeakdI18n.t(k, vars) : k;

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

  // ── Spend buckets ──
  function totals(subs) {
    let monthly = 0;
    subs.forEach(s => { monthly += toMonthly(s.price, s.cycle); });
    return {
      monthly,
      yearly: monthly * 12,
      daily: monthly / 30.44,
      perMinute: (monthly / 30.44 / 24 / 60),
    };
  }

  // ── Category breakdown ──
  function byCategory(subs) {
    const map = {};
    subs.forEach(s => {
      const m = toMonthly(s.price, s.cycle);
      if (!map[s.category]) map[s.category] = { category: s.category, monthly: 0, count: 0, subs: [] };
      map[s.category].monthly += m;
      map[s.category].count += 1;
      map[s.category].subs.push(s);
    });
    return Object.values(map).sort((a, b) => b.monthly - a.monthly);
  }

  // ── Top N spenders ──
  function topSpenders(subs, n = 5) {
    return [...subs]
      .map(s => ({ ...s, monthly: toMonthly(s.price, s.cycle) }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, n);
  }

  // ── Smart suggestions ──
  // Each suggestion: { id, severity: 'high'|'medium'|'low', icon, title, body, savingsYearly }
  function suggestions(subs) {
    const out = [];
    if (subs.length === 0) return out;

    // 1. Duplicate detection — multiple subs in same category
    const dupCategories = ['Music', 'Entertainment', 'Cloud', 'News'];
    dupCategories.forEach(cat => {
      const matches = subs.filter(s => s.category === cat);
      if (matches.length >= 2) {
        const cheapest = matches.reduce((m, s) =>
          toMonthly(s.price, s.cycle) < toMonthly(m.price, m.cycle) ? s : m
        );
        const savings = matches
          .filter(s => s.id !== cheapest.id)
          .reduce((sum, s) => sum + toYearly(s.price, s.cycle), 0);
        if (savings > 0) {
          out.push({
            id: 'dup-' + cat,
            severity: 'high',
            icon: '⚠️',
            title: t('sug.dup.title', { count: matches.length, cat: (window.LeakdI18n ? window.LeakdI18n.t('cat.' + cat) : cat).toLowerCase() }),
            body: t('sug.dup.body', { names: matches.map(s => s.name).join(', '), savings: money(savings) }),
            savingsYearly: savings,
          });
        }
      }
    });

    // 2. Monthly → yearly arbitrage (most services give 15-20% off yearly)
    subs.forEach(s => {
      if (s.cycle === 'monthly' && toMonthly(s.price, s.cycle) >= 5) {
        const yearlyEstimate = toYearly(s.price, s.cycle) * 0.83; // ~17% savings typical
        const savings = toYearly(s.price, s.cycle) - yearlyEstimate;
        out.push({
          id: 'yearly-' + s.id,
          severity: 'medium',
          icon: '💡',
          title: t('sug.yearly.title', { name: s.name }),
          body: t('sug.yearly.body', { savings: money(savings) }),
          savingsYearly: savings,
        });
      }
    });

    // 3. Expensive single subs (>$30/mo)
    subs.forEach(s => {
      const m = toMonthly(s.price, s.cycle);
      if (m >= 30) {
        out.push({
          id: 'expensive-' + s.id,
          severity: 'medium',
          icon: '💸',
          title: t('sug.expensive.title', { name: s.name }),
          body: t('sug.expensive.body', { monthly: money(m), yearly: money(m * 12) }),
          savingsYearly: m * 12,
        });
      }
    });

    // 4. Trial about to auto-renew (within 3 days)
    subs.forEach(s => {
      if (s.isTrial && s.trialEnd) {
        const d = daysUntil(s.trialEnd);
        if (d >= 0 && d <= 3) {
          const when = d === 0 ? t('time.today') : d === 1 ? t('time.tomorrow') : t('time.inDays', { n: d });
          const cycleLabel = s.cycle === 'monthly' ? t('cycle.mo') : s.cycle === 'yearly' ? t('cycle.yr') : t('cycle.wk');
          out.push({
            id: 'trial-' + s.id,
            severity: 'high',
            icon: '⏰',
            title: t('sug.trial.title', { name: s.name, when: when }),
            body: t('sug.trial.body', { price: money(s.price) + cycleLabel }),
            savingsYearly: toYearly(s.price, s.cycle),
          });
        }
      }
    });

    // 5. "Set and forget" — subs you added long ago without recent edits
    const sixMonthsAgo = Date.now() - 180 * 86400000;
    subs.forEach(s => {
      if (s.createdAt && new Date(s.createdAt).getTime() < sixMonthsAgo && toMonthly(s.price, s.cycle) >= 5) {
        out.push({
          id: 'old-' + s.id,
          severity: 'low',
          icon: '👀',
          title: t('sug.old.title', { name: s.name }),
          body: t('sug.old.body', { paid: money(toMonthly(s.price, s.cycle) * 6) }),
          savingsYearly: 0,
        });
      }
    });

    // Sort: high severity first, then by savings
    const severityRank = { high: 0, medium: 1, low: 2 };
    out.sort((a, b) => {
      if (severityRank[a.severity] !== severityRank[b.severity]) {
        return severityRank[a.severity] - severityRank[b.severity];
      }
      return b.savingsYearly - a.savingsYearly;
    });

    return out;
  }

  // ── Helpers ──
  function daysUntil(dateStr) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const t = new Date(dateStr);
    t.setHours(0, 0, 0, 0);
    return Math.ceil((t - now) / 86400000);
  }

  function money(amount) {
    const cur = (window.LeakdState && window.LeakdState.currency) || '$';
    if (cur === 'Ft') return Math.round(amount).toLocaleString() + ' Ft';
    if (cur === '¥') return cur + Math.round(amount).toLocaleString();
    return cur + Number(amount).toFixed(2);
  }

  // ── Year-to-date paid ──
  function paidThisYear(subs) {
    const now = new Date();
    const monthsElapsed = now.getMonth() + (now.getDate() / 30.44);
    let total = 0;
    subs.forEach(s => { total += toMonthly(s.price, s.cycle) * monthsElapsed; });
    return total;
  }

  // ── 12-month projection bar chart data ──
  function twelveMonthProjection(subs) {
    const monthly = totals(subs).monthly;
    const result = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push({
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        amount: monthly,
      });
    }
    return result;
  }

  // ── 30-day forecast ──
  // Returns the renewals that will fire in the next N days, with the total
  // amount and a per-day breakdown for any charting we want later.
  function forecast(subs, days) {
    days = days || 30;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const horizon = new Date(now.getTime() + days * 86400000);
    const renewals = [];
    subs.forEach(s => {
      if (s.paused) return;
      if (!s.nextDate) return;
      let next = new Date(s.nextDate);
      next.setHours(0, 0, 0, 0);
      // For monthly/weekly subs we project multiple renewals into the window
      while (next <= horizon) {
        if (next >= now) {
          renewals.push({
            id: s.id, name: s.name, category: s.category,
            price: s.price, cycle: s.cycle,
            date: next.toISOString().split('T')[0],
          });
        }
        if (s.cycle === 'monthly') next = new Date(next.getFullYear(), next.getMonth() + 1, next.getDate());
        else if (s.cycle === 'weekly') next = new Date(next.getTime() + 7 * 86400000);
        else if (s.cycle === 'yearly') next = new Date(next.getFullYear() + 1, next.getMonth(), next.getDate());
        else break;
      }
    });
    renewals.sort((a, b) => a.date.localeCompare(b.date));
    const total = renewals.reduce((sum, r) => sum + r.price, 0);
    return { total, count: renewals.length, renewals, days };
  }

  // ── Lowest-rated subs ── (helps user spot cancellation candidates)
  function lowestRated(subs, limit) {
    return subs
      .filter(s => !s.paused && typeof s.rating === 'number' && s.rating > 0)
      .map(s => ({ ...s, monthly: toMonthly(s.price, s.cycle) }))
      .sort((a, b) => a.rating - b.rating || b.monthly - a.monthly)
      .slice(0, limit || 3);
  }

  window.LeakdInsights = {
    totals,
    byCategory,
    topSpenders,
    suggestions,
    paidThisYear,
    twelveMonthProjection,
    forecast,
    lowestRated,
    toMonthly,
    toYearly,
  };
})();
