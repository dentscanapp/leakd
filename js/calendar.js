// Leakd — .ics calendar export
// Generates a standards-compliant iCalendar file with one VEVENT per
// subscription's next renewal date. The user can subscribe to it from
// any calendar app (Google, Apple, Outlook) to see renewals alongside
// their normal calendar.

(function () {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function formatDate(dateStr) {
    // YYYY-MM-DD → YYYYMMDD
    return dateStr.replace(/-/g, '');
  }

  function nowStamp() {
    const d = new Date();
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) + 'T' +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) + 'Z'
    );
  }

  function escapeICS(str) {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  function fold(line) {
    // RFC 5545: lines over 75 octets must be folded
    if (line.length <= 75) return line;
    const out = [];
    let i = 0;
    while (i < line.length) {
      out.push(i === 0 ? line.slice(i, i + 75) : ' ' + line.slice(i, i + 74));
      i += i === 0 ? 75 : 74;
    }
    return out.join('\r\n');
  }

  // Build one event for a subscription's next renewal, plus optional
  // recurrence (so the calendar shows future renewals too).
  function buildEvent(s, currency) {
    if (!s.nextDate) return null;
    if (s.paused) return null;

    const date = formatDate(s.nextDate);
    const summary = `${s.name} renews — ${currency}${s.price}`;
    const description = `Subscription tracked via Leakd. ${s.category}. Auto-renews ${s.cycle}.`;

    let rrule = '';
    if (s.cycle === 'monthly') rrule = 'RRULE:FREQ=MONTHLY';
    else if (s.cycle === 'yearly') rrule = 'RRULE:FREQ=YEARLY';
    else if (s.cycle === 'weekly') rrule = 'RRULE:FREQ=WEEKLY';

    const lines = [
      'BEGIN:VEVENT',
      'UID:' + s.id + '@leakd.app',
      'DTSTAMP:' + nowStamp(),
      'DTSTART;VALUE=DATE:' + date,
      'DTEND;VALUE=DATE:' + date,
      'SUMMARY:' + escapeICS(summary),
      'DESCRIPTION:' + escapeICS(description),
      'CATEGORIES:' + escapeICS(s.category),
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
    ];
    if (rrule) lines.push(rrule);

    // Reminder 1 day before
    lines.push(
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + escapeICS(summary),
      'END:VALARM',
      'END:VEVENT'
    );

    return lines.map(fold).join('\r\n');
  }

  function buildCalendar(subs, currency) {
    const events = subs.map(s => buildEvent(s, currency || '$')).filter(Boolean);
    if (events.length === 0) return null;
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Leakd//Subscription Tracker//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Leakd Subscriptions',
      'X-WR-TIMEZONE:UTC',
      'X-WR-CALDESC:Renewal dates for your tracked subscriptions',
    ];
    lines.push(...events);
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function download(subs, currency) {
    const ics = buildCalendar(subs, currency);
    if (!ics) return false;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leakd-renewals.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  window.LeakdCalendar = { buildCalendar, download };
})();
