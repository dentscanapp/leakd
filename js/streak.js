
/**
 * Leakd Daily Streak & Check-in
 * Handles the "Tamagotchi" cleaning effect.
 */
(function() {
  'use strict';

  const STREAK_KEY = 'leakd_streak';
  let streak = { count: 0, lastDate: null };

  function load() {
    try {
      const raw = localStorage.getItem(STREAK_KEY);
      if (raw) streak = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load streak', e);
    }
  }

  function save() {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  }

  function getTodayStr() {
    return new Date().toISOString().split('T')[0];
  }

  // Whole-day delta between two YYYY-MM-DD strings, computed in UTC so DST
  // transitions can't perturb the count. (new Date('2026-03-29') - new
  // Date('2026-03-30') in CET would yield 0.96 of a day instead of -1,
  // causing the EU spring-forward Sunday to silently reset users' streaks.)
  function dayDelta(fromStr, toStr) {
    if (!fromStr || !toStr) return 0;
    const [y1, m1, d1] = fromStr.split('-').map(Number);
    const [y2, m2, d2] = toStr.split('-').map(Number);
    const t1 = Date.UTC(y1, m1 - 1, d1);
    const t2 = Date.UTC(y2, m2 - 1, d2);
    return Math.round((t2 - t1) / 86400000);
  }

  function checkIn() {
    const today = getTodayStr();
    if (streak.lastDate === today) return false;

    const diff = streak.lastDate ? dayDelta(streak.lastDate, today) : null;
    if (diff === null) {
      streak.count = 1;
    } else if (diff === 1) {
      streak.count++;
    } else if (diff > 1) {
      streak.count = 1; // Missed at least one day → restart at today.
    }
    // diff <= 0 is impossible because we returned early on same-day; a past
    // lastDate would mean clock-tampering or a restored backup, leave count.

    streak.lastDate = today;
    save();
    return true;
  }

  function getCount() {
    // If more than one calendar day has passed since last check-in, the
    // streak is broken. UTC-based dayDelta() keeps this DST-safe.
    const today = getTodayStr();
    if (streak.lastDate && streak.lastDate !== today) {
      if (dayDelta(streak.lastDate, today) > 1) {
        streak.count = 0;
        save();
      }
    }
    return streak.count;
  }

  function hasCheckedInToday() {
    return streak.lastDate === getTodayStr();
  }

  window.LeakdStreak = {
    load,
    checkIn,
    getCount,
    hasCheckedInToday
  };
})();
