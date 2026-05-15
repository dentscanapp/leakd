
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

  function checkIn() {
    const today = getTodayStr();
    if (streak.lastDate === today) return false;

    // If it's the next day, increment. If we missed a day, reset or keep?
    // Let's be generous: if it's the next day, increment. 
    // If it's more than 1 day later, we could reset, but let's keep it 
    // simple for now: if not today, it's a new check-in.
    
    const last = streak.lastDate ? new Date(streak.lastDate) : null;
    const now = new Date(today);
    
    if (last) {
      const diff = (now - last) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak.count++;
      } else if (diff > 1) {
        streak.count = 1; // Reset streak but count this day
      } else {
        // Same day or past, handled by the first check
      }
    } else {
      streak.count = 1;
    }

    streak.lastDate = today;
    save();
    return true;
  }

  function getCount() {
    // Check if we missed the streak (more than 24h since last check-in)
    const today = getTodayStr();
    if (streak.lastDate && streak.lastDate !== today) {
      const last = new Date(streak.lastDate);
      const now = new Date(today);
      const diff = (now - last) / (1000 * 60 * 60 * 24);
      if (diff > 1) {
        streak.count = 0; // Missed a day
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
