// Leakd — Activity log
// Records every meaningful change to the subscription list: add, edit,
// cancel, pause, resume, delete, restore. Powers a "history" view where
// the user can see their full journey with subs, and a richer year-end
// report. All stored locally — no events ever leave the device.
//
// Storage shape: array of { ts, type, name, payload? }
// Keep at most MAX events to bound localStorage growth.

(function () {
  'use strict';

  const KEY = 'leakd_activity';
  const MAX = 500; // ~6 months of typical usage

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function save(events) {
    if (events.length > MAX) events = events.slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(events));
  }

  // Record a new event. type is one of: 'added','edited','cancelled',
  // 'paused','resumed','restored','deleted','imported'
  function record(type, sub, payload) {
    const events = load();
    events.push({
      ts: Date.now(),
      type,
      name: sub && sub.name ? sub.name : '',
      category: sub && sub.category ? sub.category : '',
      payload: payload || null,
    });
    save(events);
  }

  function all() { return load(); }

  // Events grouped by day, newest day first. Each day has an array of events.
  function byDay() {
    const events = load();
    const map = {};
    events.forEach(e => {
      const d = new Date(e.ts);
      const day = d.toISOString().split('T')[0];
      if (!map[day]) map[day] = [];
      map[day].push(e);
    });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, list]) => ({ day, events: list.reverse() }));
  }

  // Count events of given type within last N days
  function countSince(type, daysBack) {
    const cutoff = Date.now() - daysBack * 86400000;
    return load().filter(e => e.type === type && e.ts >= cutoff).length;
  }

  // Most active day of week (0=Sunday)
  function busiestWeekday() {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    load().forEach(e => {
      if (e.type === 'added') counts[new Date(e.ts).getDay()]++;
    });
    let max = 0, idx = -1;
    counts.forEach((c, i) => { if (c > max) { max = c; idx = i; } });
    return max > 0 ? idx : null;
  }

  function clear() { localStorage.removeItem(KEY); }

  window.LeakdActivity = { record, all, byDay, countSince, busiestWeekday, clear };
})();
