// Leakd — Savings goals
// User sets a goal ("save $500 by canceling subs in 2026"), we track progress
// against the cancelled-subs registry's lifetime savings. Milestone alerts at
// 25/50/75/100% — each hit gets celebrated with a toast and a flag stored so
// we don't congratulate the same milestone twice.

(function () {
  'use strict';

  const KEY = 'leakd_goal';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function save(goal) {
    localStorage.setItem(KEY, JSON.stringify(goal));
  }

  // Create or update the active goal.
  // target: total amount the user wants to save annually (or by deadline).
  // deadline: ISO date string (optional — defaults to end of current year).
  function set(targetAmount, deadlineISO) {
    if (!targetAmount || targetAmount <= 0) {
      localStorage.removeItem(KEY);
      return null;
    }
    const goal = {
      target: Number(targetAmount),
      deadline: deadlineISO || new Date(new Date().getFullYear(), 11, 31).toISOString(),
      createdAt: new Date().toISOString(),
      milestones: { 25: false, 50: false, 75: false, 100: false },
    };
    save(goal);
    return goal;
  }

  function clear() { localStorage.removeItem(KEY); }

  // Compute current progress against the goal.
  // We use TWO data sources for "saved so far":
  //   1. LeakdCancelled.savings() — total monthly savings × months elapsed since cancellation
  //   2. (future) any explicit "saved" entries the user logs
  function progress() {
    const goal = load();
    if (!goal) return null;
    let savedTotal = 0;
    if (window.LeakdCancelled) {
      // For each cancelled sub, compute saved-since-cancellation
      const list = window.LeakdCancelled.all();
      list.forEach(s => {
        if (!s.cancelledAt) return;
        const monthsSince = Math.max(0, (Date.now() - new Date(s.cancelledAt).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
        savedTotal += (s.monthlyAtCancel || 0) * monthsSince;
      });
    }
    const pct = Math.min(100, (savedTotal / goal.target) * 100);
    return {
      goal,
      saved: savedTotal,
      target: goal.target,
      pct,
      remaining: Math.max(0, goal.target - savedTotal),
      complete: pct >= 100,
    };
  }

  // Returns any newly-crossed milestone (25/50/75/100) since last check.
  // Marks it as celebrated so we don't fire again.
  function checkMilestone() {
    const goal = load();
    if (!goal) return null;
    const p = progress();
    if (!p) return null;
    const thresholds = [25, 50, 75, 100];
    for (const t of thresholds) {
      if (p.pct >= t && !goal.milestones[t]) {
        goal.milestones[t] = true;
        save(goal);
        return t;
      }
    }
    return null;
  }

  window.LeakdGoals = { set, clear, load, progress, checkMilestone };
})();
