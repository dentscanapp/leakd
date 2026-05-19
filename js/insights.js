// Leakd — Insights engine
// Pure functions that take the subs array and compute the analytics the
// Insights view renders. No DOM access here — the view layer reads these
// results and templates them.

(function () {
  'use strict';

  const t = (k, vars) => window.LeakdI18n ? window.LeakdI18n.t(k, vars) : k;

  // HTML-escape any user-controlled string before it goes into a t() param
  // that lands in innerHTML. Server-side equivalent of htmlspecialchars().
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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

  // ── Spend buckets ──
  function totals(subs) {
    let monthly = 0;
    (subs || []).forEach(s => {
      if (!s || typeof s.price !== 'number' || !isFinite(s.price)) return;
      const m = toMonthly(s.price, s.cycle, s.currency);
      if (isFinite(m)) monthly += m;
    });
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
    (subs || []).forEach(s => {
      if (!s || typeof s.price !== 'number' || !isFinite(s.price)) return;
      const m = toMonthly(s.price, s.cycle, s.currency);
      if (!isFinite(m)) return;
      const cat = s.category || 'Other';
      if (!map[cat]) map[cat] = { category: cat, monthly: 0, count: 0, subs: [] };
      map[cat].monthly += m;
      map[cat].count += 1;
      map[cat].subs.push(s);
    });
    return Object.values(map).sort((a, b) => b.monthly - a.monthly);
  }

  // ── Top N spenders ──
  function topSpenders(subs, n = 5) {
    return [...subs]
      .map(s => ({ ...s, monthly: toMonthly(s.price, s.cycle, s.currency) }))
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
          toMonthly(s.price, s.cycle, s.currency) < toMonthly(m.price, m.cycle, m.currency) ? s : m
        );
        const savings = matches
          .filter(s => s.id !== cheapest.id)
          .reduce((sum, s) => sum + toYearly(s.price, s.cycle, s.currency), 0);
        if (savings > 0) {
          out.push({
            id: 'dup-' + cat,
            severity: 'high',
            icon: '⚠️',
            title: t('sug.dup.title', { count: matches.length, cat: esc((window.LeakdI18n ? window.LeakdI18n.t('cat.' + cat) : cat).toLowerCase()) }),
            body: t('sug.dup.body', { names: esc(matches.map(s => s.name).join(', ')), savings: money(savings) }),
            savingsYearly: savings,
          });
        }
      }
    });

    // 2. Monthly → yearly arbitrage (most services give 15-20% off yearly)
    subs.forEach(s => {
      const monthlyVal = toMonthly(s.price, s.cycle, s.currency);
      if (s.cycle === 'monthly' && monthlyVal >= 5) {
        const yearlyEstimate = toYearly(s.price, s.cycle, s.currency) * 0.83; // ~17% savings typical
        const savings = toYearly(s.price, s.cycle, s.currency) - yearlyEstimate;
        out.push({
          id: 'yearly-' + s.id,
          severity: 'medium',
          icon: '💡',
          title: t('sug.yearly.title', { name: esc(s.name) }),
          body: t('sug.yearly.body', { savings: money(savings) }),
          savingsYearly: savings,
        });
      }
    });

    // 3. Expensive single subs (>$30/mo)
    subs.forEach(s => {
      const m = toMonthly(s.price, s.cycle, s.currency);
      if (m >= 30) {
        out.push({
          id: 'expensive-' + s.id,
          severity: 'medium',
          icon: '💸',
          title: t('sug.expensive.title', { name: esc(s.name) }),
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
            title: t('sug.trial.title', { name: esc(s.name), when: when }),
            body: t('sug.trial.body', { price: money(s.price, s.currency) + cycleLabel }),
            savingsYearly: toYearly(s.price, s.cycle, s.currency),
          });
        }
      }
    });

    // 5. Zombie detection — not used for 30+ days
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    subs.forEach(s => {
      if (s.lastUsed && new Date(s.lastUsed).getTime() < thirtyDaysAgo && !s.paused) {
        const m = toMonthly(s.price, s.cycle, s.currency);
        out.push({
          id: 'zombie-' + s.id,
          severity: 'high',
          icon: '🧟',
          title: t('sug.zombie.title', { name: esc(s.name) }),
          body: t('sug.zombie.body', { monthly: money(m) }),
          savingsYearly: toYearly(s.price, s.cycle, s.currency),
        });
      }
    });
    
    // 6. "Set and forget" — subs you added long ago without recent edits
    const sixMonthsAgo = Date.now() - 180 * 86400000;
    subs.forEach(s => {
      if (s.createdAt && new Date(s.createdAt).getTime() < sixMonthsAgo && toMonthly(s.price, s.cycle, s.currency) >= 5) {
        const rating = s.rating || 0;
        if (rating < 3) {
          out.push({
            id: 'old-' + s.id,
            severity: 'low',
            icon: '🕰️',
            title: t('sug.old.title', { name: esc(s.name) }),
            body: t('sug.old.body', { paid: money(toMonthly(s.price, s.cycle, s.currency) * 6) }),
            savingsYearly: 0,
          });
        }
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
    if (!dateStr) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr.replace(/-/g, '/'));
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / 86400000);
  }

  function money(amount, code) {
    const targetCode = code || (window.LeakdState && window.LeakdState.currencyCode);
    if (window.LeakdLocale && targetCode) {
      return window.LeakdLocale.formatMoney(amount, targetCode);
    }
    const s = window.LeakdCurrency ? window.LeakdCurrency.getSymbol(targetCode) : ((window.LeakdState && window.LeakdState.currency) || '$');
    if (targetCode === 'HUF' || s === 'Ft') return Math.round(amount).toLocaleString() + ' Ft';
    if (s === '¥') return s + Math.round(amount).toLocaleString();
    return s + Number(amount).toFixed(2);
  }

  // ── Year-to-date paid ──
  function paidThisYear(subs) {
    const now = new Date();
    const monthsElapsed = now.getMonth() + (now.getDate() / 30.44);
    let total = 0;
    subs.forEach(s => { total += toMonthly(s.price, s.cycle, s.currency) * monthsElapsed; });
    return total;
  }

  // ── 12-month projection bar chart data ──

  // Explicit short month names for reliable localization.
  // The Intl/toLocaleDateString API is unreliable in some environments
  // (file:// protocol, minimal ICU builds) so we hardcode the most
  // common languages. Unknown languages fall back to Intl.
  const SHORT_MONTHS = {
    en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    hu: ['jan.','feb.','már.','ápr.','máj.','jún.','júl.','aug.','szept.','okt.','nov.','dec.'],
    de: ['Jan.','Feb.','Mär.','Apr.','Mai','Jun.','Jul.','Aug.','Sep.','Okt.','Nov.','Dez.'],
    es: ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sept.','oct.','nov.','dic.'],
    fr: ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'],
    it: ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'],
    pt: ['jan.','fev.','mar.','abr.','mai.','jun.','jul.','ago.','set.','out.','nov.','dez.'],
    nl: ['jan.','feb.','mrt.','apr.','mei','jun.','jul.','aug.','sep.','okt.','nov.','dec.'],
    pl: ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'],
    cs: ['led','úno','bře','dub','kvě','čvn','čvc','srp','zář','říj','lis','pro'],
    sk: ['jan','feb','mar','apr','máj','jún','júl','aug','sep','okt','nov','dec'],
    ro: ['ian.','feb.','mar.','apr.','mai','iun.','iul.','aug.','sept.','oct.','nov.','dec.'],
    sv: ['jan.','feb.','mars','apr.','maj','juni','juli','aug.','sep.','okt.','nov.','dec.'],
    ja: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    ko: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    zh: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    ru: ['янв.','фев.','мар.','апр.','май','июн.','июл.','авг.','сен.','окт.','ноя.','дек.'],
    tr: ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],
    uk: ['січ.','лют.','бер.','кві.','тра.','чер.','лип.','сер.','вер.','жов.','лис.','гру.'],
    hr: ['sij','vlj','ožu','tra','svi','lip','srp','kol','ruj','lis','stu','pro'],
    bg: ['яну','фев','мар','апр','май','юни','юли','авг','сеп','окт','ное','дек'],
    el: ['Ιαν','Φεβ','Μάρ','Απρ','Μάι','Ιού','Ιού','Αύγ','Σεπ','Οκτ','Νοέ','Δεκ'],
    hi: ['जन','फर','मार्च','अप्रैल','मई','जून','जुल','अग','सित','अक्टू','नव','दिस'],
    th: ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'],
    vi: ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'],
    id: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
    fil: ['Ene','Peb','Mar','Abr','May','Hun','Hul','Ago','Set','Okt','Nob','Dis'],
    ca: ['gen.','feb.','març','abr.','maig','juny','jul.','ag.','set.','oct.','nov.','des.'],
  };

  function shortMonthLabel(monthIndex, lang) {
    const table = SHORT_MONTHS[lang];
    if (table) return table[monthIndex];
    // Fallback for any language not in the table
    try {
      const d = new Date(2000, monthIndex, 1);
      return d.toLocaleDateString(lang, { month: 'short' });
    } catch { return SHORT_MONTHS.en[monthIndex]; }
  }

  function twelveMonthProjection(subs) {
    const monthly = totals(subs).monthly;
    const result = [];
    const now = new Date();
    const lang = (window.LeakdI18n && window.LeakdI18n.lang) || 'en';
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push({
        label: shortMonthLabel(d.getMonth(), lang),
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
            price: s.price, cycle: s.cycle, currency: s.currency,
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
    const total = renewals.reduce((sum, r) => sum + toMonthly(r.price, 'monthly', r.currency), 0);
    return { total, count: renewals.length, renewals, days };
  }

  // ── Lowest-rated subs ── (helps user spot cancellation candidates)
  function lowestRated(subs, limit) {
    return subs
      .filter(s => !s.paused && typeof s.rating === 'number' && s.rating > 0)
      .map(s => ({ ...s, monthly: toMonthly(s.price, s.cycle, s.currency) }))
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
