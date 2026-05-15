// Leakd — Subscription health score
// Computes a single A-F grade based on multiple signals. The goal: give the
// user a one-glance answer to "am I doing well with my subs?". Compared to
// competitors who only show raw numbers, this is opinionated guidance.
//
// Scoring (out of 100):
//   • Income ratio (0-30 pts): 0% = 30, 5% = 25, 10% = 18, 15% = 8, >20% = 0
//   • Average rating of subs with ratings (0-20 pts): avg 5 = 20, 1 = 0
//   • Cancelled-this-year count (0-15 pts): each cancel + 3 pts up to 15
//   • Budget compliance (0-15 pts): all budgets ok = 15, any over = 0
//   • Trial alertness (0-10 pts): no trials about to renew unnoticed = 10
//   • Goal progress (0-10 pts): proportional to % of goal hit
//
// Total 100 → grade map:
//   A (90-100), B (75-89), C (60-74), D (40-59), F (<40)

(function () {
  'use strict';

  function toMonthly(price, cycle) {
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  function activeSubs(subs) { return subs.filter(s => !s.paused); }

  function scoreIncomeRatio(subs) {
    if (!window.LeakdIncome) return null;
    const income = window.LeakdIncome.get();
    if (!income || income <= 0) return null; // can't score without income
    const monthly = activeSubs(subs).reduce((sum, s) => sum + toMonthly(s.price, s.cycle), 0);
    const ratio = monthly / income;
    if (ratio <= 0.02) return 30;
    if (ratio <= 0.05) return 25;
    if (ratio <= 0.10) return 18;
    if (ratio <= 0.15) return 8;
    return 0;
  }

  function scoreRatings(subs) {
    const rated = activeSubs(subs).filter(s => typeof s.rating === 'number' && s.rating > 0);
    if (rated.length === 0) return null;
    const avg = rated.reduce((sum, s) => sum + s.rating, 0) / rated.length;
    // Linear: rating 5 = 20pts, 1 = 0pts
    return Math.round(((avg - 1) / 4) * 20);
  }

  function scoreCancellations() {
    if (!window.LeakdCancelled) return null;
    const n = window.LeakdCancelled.thisYearCount();
    return Math.min(15, n * 3);
  }

  function scoreBudgets(subs) {
    if (!window.LeakdBudgets) return null;
    const all = window.LeakdBudgets.all();
    if (Object.keys(all).length === 0) return null;
    const progress = window.LeakdBudgets.computeProgress(activeSubs(subs));
    if (progress.some(p => p.status === 'over')) return 0;
    if (progress.some(p => p.status === 'warn')) return 8;
    return 15;
  }

  function scoreTrials(subs) {
    // No trials about to auto-renew = good
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let badTrials = 0;
    activeSubs(subs).forEach(s => {
      if (s.isTrial && s.trialEnd) {
        const d = new Date(s.trialEnd);
        d.setHours(0, 0, 0, 0);
        const days = Math.ceil((d - now) / 86400000);
        if (days >= 0 && days <= 2) badTrials++; // close to auto-renew
      }
    });
    return badTrials === 0 ? 10 : 0;
  }

  function scoreGoal() {
    if (!window.LeakdGoals) return null;
    const prog = window.LeakdGoals.progress();
    if (!prog) return null;
    return Math.min(10, Math.round((prog.pct / 100) * 10));
  }

  // Compute score with weighted average over what we CAN measure.
  // If income is not set, we drop that dimension and rescale.
  function compute(subs) {
    const list = subs || [];
    const components = {
      income: scoreIncomeRatio(list),
      rating: scoreRatings(list),
      cancel: scoreCancellations(),
      budget: scoreBudgets(list),
      trial: scoreTrials(list),
      goal: scoreGoal(),
    };
    const weights = { income: 30, rating: 20, cancel: 15, budget: 15, trial: 10, goal: 10 };

    let earned = 0, possible = 0;
    Object.keys(components).forEach(k => {
      if (components[k] != null) {
        earned += components[k];
        possible += weights[k];
      }
    });
    // If we have zero measurable dimensions yet, return neutral
    if (possible === 0) return { score: null, grade: '—', components, possible };

    const score = Math.round((earned / possible) * 100);
    let grade;
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 40) grade = 'D';
    else grade = 'F';

    return { score, grade, components, possible };
  }

  // Simple advice text key based on which component is the weakest
  function adviceKey(result) {
    if (!result || result.score == null) return 'health.adviceEmpty';
    const c = result.components;
    if (c.trial === 0) return 'health.adviceTrial';
    if (c.budget === 0) return 'health.adviceBudget';
    if (c.income != null && c.income <= 8) return 'health.adviceIncome';
    if (c.rating != null && c.rating <= 8) return 'health.adviceRating';
    if (result.score >= 85) return 'health.advicePerfect';
    return 'health.adviceGeneral';
  }

  window.LeakdHealth = { compute, adviceKey };
})();
