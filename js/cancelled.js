// Leakd — Cancelled subscriptions registry
// When the user "cancels" a subscription (vs. hard-deleting it), we move it
// here with a cancellation date. The home list no longer shows it, totals
// drop, but the cancelled archive remembers what they used to pay so we can
// celebrate the wins: "You've cancelled 4 subs this year, saving $187/mo".
//
// This is the most emotionally rewarding signal a sub-tracker can give —
// validation that the user actually killed a leak.

(function () {
  'use strict';

  const KEY = 'leakd_cancelled';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function toMonthly(price, cycle) {
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  // Move a subscription to the cancelled registry.
  function add(sub) {
    const list = load();
    list.push({
      ...sub,
      cancelledAt: new Date().toISOString(),
      monthlyAtCancel: toMonthly(sub.price, sub.cycle),
    });
    save(list);
  }

  // Permanently remove from registry (purge)
  function remove(id) {
    save(load().filter(s => s.id !== id));
  }

  // Restore a cancelled sub — caller is responsible for re-inserting it into
  // the active list. Here we just remove the cancelled record.
  function restore(id) {
    const list = load();
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return null;
    const rec = list[idx];
    list.splice(idx, 1);
    save(list);
    const restored = { ...rec };
    delete restored.cancelledAt;
    delete restored.monthlyAtCancel;
    return restored;
  }

  function all() { return load(); }
  function count() { return load().length; }

  // Total monthly savings from cancellations within the last N days
  // (default: all-time).
  function savings(sinceDays) {
    const list = load();
    let cutoff = 0;
    if (sinceDays && sinceDays > 0) cutoff = Date.now() - sinceDays * 86400000;
    let monthly = 0;
    list.forEach(s => {
      if (s.cancelledAt && new Date(s.cancelledAt).getTime() >= cutoff) {
        monthly += s.monthlyAtCancel || toMonthly(s.price, s.cycle);
      }
    });
    return monthly;
  }

  // Cancellations this calendar year
  function thisYearCount() {
    const year = new Date().getFullYear();
    return load().filter(s => {
      if (!s.cancelledAt) return false;
      return new Date(s.cancelledAt).getFullYear() === year;
    }).length;
  }

  function thisYearSavings() {
    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1).getTime();
    return savings((Date.now() - yearStart) / 86400000);
  }

  function clear() { localStorage.removeItem(KEY); }

  window.LeakdCancelled = {
    add, remove, restore, all, count, savings, thisYearCount, thisYearSavings, clear,
  };
})();
