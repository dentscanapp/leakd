// Leakd — Visual calendar view of renewals
// A real month grid where each day with a renewal gets a colored dot.
// Click a day to see what renews. Nobody else's subscription tracker
// shows you the month at a glance — they just list "due in 3 days".

(function () {
  'use strict';

  function toMonthly(price, cycle) {
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  // Build month data: array of weeks, each containing day cells with
  // metadata about which subs renew on that day.
  // monthOffset: 0 = current month, +1 = next, -1 = previous, etc.
  function monthGrid(subs, monthOffset) {
    monthOffset = monthOffset || 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const month = today.getMonth() + monthOffset;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    // Week starts on Monday (ISO standard, fits European users)
    let weekStart = firstDay.getDay() - 1;
    if (weekStart < 0) weekStart = 6; // Sunday → end of week

    // Project all sub renewals across this month
    const dayMap = {}; // dayNum → array of subs
    subs.forEach(s => {
      if (s.paused || !s.nextDate) return;
      let next = new Date(s.nextDate);
      next.setHours(0, 0, 0, 0);
      // Walk back if next renewal is in the future beyond this month
      while (next > lastDay) {
        if (s.cycle === 'monthly') next = new Date(next.getFullYear(), next.getMonth() - 1, next.getDate());
        else if (s.cycle === 'weekly') next = new Date(next.getTime() - 7 * 86400000);
        else if (s.cycle === 'yearly') next = new Date(next.getFullYear() - 1, next.getMonth(), next.getDate());
        else break;
      }
      // Walk forward through this month
      while (next <= lastDay) {
        if (next >= firstDay) {
          const day = next.getDate();
          if (!dayMap[day]) dayMap[day] = [];
          dayMap[day].push({ id: s.id, name: s.name, price: s.price, cycle: s.cycle, category: s.category });
        }
        if (s.cycle === 'monthly') next = new Date(next.getFullYear(), next.getMonth() + 1, next.getDate());
        else if (s.cycle === 'weekly') next = new Date(next.getTime() + 7 * 86400000);
        else if (s.cycle === 'yearly') next = new Date(next.getFullYear() + 1, next.getMonth(), next.getDate());
        else break;
      }
    });

    // Build the grid
    const weeks = [];
    let week = [];
    // Empty cells before the first day
    for (let i = 0; i < weekStart; i++) week.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = date.getTime() === today.getTime();
      const renewals = dayMap[day] || [];
      const total = renewals.reduce((sum, r) => sum + toMonthly(r.price, r.cycle) * (r.cycle === 'monthly' ? 1 : r.cycle === 'weekly' ? 7/30.44 : 1/12), 0);
      week.push({
        day,
        isToday,
        renewals,
        total: renewals.reduce((sum, r) => sum + r.price, 0),
        hasRenewals: renewals.length > 0,
      });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    return {
      year,
      month,
      monthName: firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      weeks,
      totalThisMonth: Object.values(dayMap).flat().reduce((sum, r) => sum + r.price, 0),
      countThisMonth: Object.values(dayMap).flat().length,
    };
  }

  // Get weekday labels in user's locale, starting Monday
  function weekdayLabels(lang) {
    const labels = [];
    // 2024-01-01 was a Monday; we use that reference
    const monday = new Date(2024, 0, 1);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      labels.push(d.toLocaleDateString(lang || 'en', { weekday: 'short' }));
    }
    return labels;
  }

  window.LeakdCalView = { monthGrid, weekdayLabels };
})();
