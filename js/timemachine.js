// Leakd — Subscription Time Machine
// A scrubbable timeline of your cumulative subscription spend, with a parallel
// "if you'd invested instead" ghost line that visibly diverges as compounding
// kicks in. Drag the scrubber to travel through time; the future portion is a
// projection (your current active subs kept running). Ends in a shareable card.
//
// All math is local. The invested line is a month-by-month compounded
// simulation of the exact same contributions you spent on subscriptions.

(function () {
  'use strict';

  function toMonthly(price, cycle, currency) {
    if (window.LeakdCurrency) return window.LeakdCurrency.toMonthly(price, cycle, currency);
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  function monthFloor(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function monthsBetween(a, b) {
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  }

  // ── Build the timeline ──
  // Returns monthly points from the earliest subscription start (or 12 months
  // back if there's no history) through 5 years into the future. Each point
  // carries cumulative paid and the compounded "invested instead" balance.
  function buildTimeline(subs, annualReturnPct) {
    const rate = (annualReturnPct == null ? 7 : annualReturnPct) / 100 / 12;
    const active = (subs || []).filter(s => s && !s.paused);
    const now = new Date();

    let start = null;
    active.forEach(s => {
      if (s.createdAt) {
        const d = new Date(s.createdAt);
        if (!isNaN(d) && (!start || d < start)) start = d;
      }
    });
    // No (or barely any) history → anchor a year back so the past axis isn't empty.
    if (!start || (now - start) < 1000 * 60 * 60 * 24 * 60) {
      start = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    }
    start = monthFloor(start);
    const end = new Date(now.getFullYear() + 5, now.getMonth(), 1); // 5-year projection
    const total = Math.max(1, monthsBetween(start, end));
    const nowIndex = Math.max(0, Math.min(total, monthsBetween(start, monthFloor(now))));

    // Pre-compute each sub's first contributing month.
    const subStarts = active.map(s => {
      const d = s.createdAt ? new Date(s.createdAt) : now;
      return { monthly: toMonthly(s.price, s.cycle, s.currency) || 0, from: monthFloor(isNaN(d) ? now : d) };
    });

    const points = [];
    let paid = 0, invested = 0;
    for (let i = 0; i <= total; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      let contrib = 0;
      for (const ss of subStarts) {
        if (d >= ss.from) contrib += ss.monthly;
      }
      paid += contrib;
      invested = invested * (1 + rate) + contrib;
      points.push({ index: i, date: d, paid, invested, projected: i > nowIndex });
    }

    return {
      points,
      start,
      end,
      now,
      nowIndex,
      total,
      monthlyNow: subStarts.reduce((sum, ss) => sum + (ss.from <= monthFloor(now) ? ss.monthly : 0), 0),
      paidNow: points[nowIndex] ? points[nowIndex].paid : 0,
      investedNow: points[nowIndex] ? points[nowIndex].invested : 0,
    };
  }

  // ── Chart renderer ──
  // Draws both lines onto a 2D context within the given box. `scrubIndex` adds
  // a vertical marker + dots. Past is solid, the projected future is faded.
  function drawChart(ctx, tl, scrubIndex, box, theme) {
    const { x, y, w, h } = box;
    const pts = tl.points;
    const n = pts.length;
    if (n < 2) return;

    const maxVal = Math.max(
      1,
      pts[n - 1].invested,
      pts[n - 1].paid
    );

    const px = (i) => x + (w * i) / (n - 1);
    const py = (v) => y + h - (h * (v / maxVal));

    // Grid: horizontal quarters
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (let g = 0; g <= 4; g++) {
      const gy = y + (h * g) / 4;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

    // Year ticks on the X axis
    ctx.fillStyle = theme.textFaint;
    ctx.font = `${theme.tickFont}px "DM Mono", "DM Sans", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let lastYear = null;
    for (let i = 0; i < n; i++) {
      const yr = pts[i].date.getFullYear();
      if (yr !== lastYear && pts[i].date.getMonth() === 0) {
        lastYear = yr;
        ctx.fillStyle = theme.grid;
        ctx.beginPath();
        ctx.moveTo(px(i), y);
        ctx.lineTo(px(i), y + h);
        ctx.stroke();
        ctx.fillStyle = theme.textFaint;
        ctx.fillText(String(yr), px(i), y + h + theme.tickGap);
      }
    }

    // "Now" divider
    const nowX = px(tl.nowIndex);
    ctx.strokeStyle = theme.nowLine;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(nowX, y);
    ctx.lineTo(nowX, y + h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Helper to stroke a line over [0..n), with the projected tail faded/dashed.
    function strokeLine(getV, color, lineWidth, fade) {
      // Solid past
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let i = 0; i <= tl.nowIndex; i++) {
        const X = px(i), Y = py(getV(pts[i]));
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
      // Faded/dashed future
      ctx.globalAlpha = fade;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (let i = tl.nowIndex; i < n; i++) {
        const X = px(i), Y = py(getV(pts[i]));
        if (i === tl.nowIndex) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }

    // Filled area under the paid line (past only)
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, theme.fillTop);
    grad.addColorStop(1, theme.fillBottom);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px(0), y + h);
    for (let i = 0; i <= tl.nowIndex; i++) ctx.lineTo(px(i), py(pts[i].paid));
    ctx.lineTo(px(tl.nowIndex), y + h);
    ctx.closePath();
    ctx.fill();

    // Invested ghost line (behind), then paid line (front)
    strokeLine(p => p.invested, theme.invested, theme.lineW, 0.45);
    strokeLine(p => p.paid, theme.paid, theme.lineW, 0.5);

    // Scrub marker
    if (scrubIndex != null && scrubIndex >= 0 && scrubIndex < n) {
      const sx = px(scrubIndex);
      ctx.strokeStyle = theme.marker;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx, y + h);
      ctx.stroke();
      ctx.setLineDash([]);
      // Dots
      const dot = (v, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, py(v), theme.dotR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = theme.bg;
        ctx.lineWidth = 2;
        ctx.stroke();
      };
      dot(pts[scrubIndex].invested, theme.invested);
      dot(pts[scrubIndex].paid, theme.paid);
    }
  }

  function darkTheme(scale) {
    const s = scale || 1;
    return {
      bg: '#0b0b0c',
      grid: 'rgba(255,255,255,0.07)',
      nowLine: 'rgba(255,255,255,0.22)',
      paid: '#ef4444',
      invested: '#34d399',
      marker: 'rgba(255,255,255,0.8)',
      fillTop: 'rgba(239,68,68,0.22)',
      fillBottom: 'rgba(239,68,68,0.0)',
      textFaint: '#6b7280',
      lineW: 2.5 * s,
      dotR: 4 * s,
      tickFont: 11 * s,
      tickGap: 6 * s,
    };
  }

  // Word-wrap (space languages) or char-wrap (CJK) text onto the canvas.
  // Returns the y just past the last drawn line.
  function wrapText(ctx, text, x, y, maxW, lineH) {
    const str = String(text);
    const hasSpaces = str.indexOf(' ') !== -1;
    const tokens = hasSpaces ? str.split(' ') : str.split('');
    const sep = hasSpaces ? ' ' : '';
    let line = '';
    for (let i = 0; i < tokens.length; i++) {
      const test = line ? line + sep + tokens[i] : tokens[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        line = tokens[i];
        y += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y);
    return y + lineH;
  }

  // ── Shareable portrait card (1080x1350) ──
  function renderShareCard(tl, fmt, tr) {
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const T = darkTheme(1);

    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, W, H);

    // Header
    ctx.fillStyle = '#fafaf9';
    ctx.font = '700 56px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Leakd', 80, 130);
    ctx.fillStyle = T.textFaint;
    ctx.font = '500 30px "DM Sans", system-ui, sans-serif';
    ctx.fillText(tr('tm.shareHeadline'), 80, 184);

    // Chart
    drawChart(ctx, tl, null, { x: 80, y: 240, w: W - 160, h: 520 }, darkTheme(1.6));

    // Legend
    let ly = 820;
    const legend = (color, label, val) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(96, ly - 10, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fafaf9';
      ctx.font = '600 32px "DM Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, 124, ly);
      ctx.fillStyle = color;
      ctx.font = '700 36px "DM Mono", "DM Sans", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val, W - 80, ly);
      ly += 70;
    };
    legend(T.paid, tr('tm.paidLabel'), fmt(tl.paidNow));
    legend(T.invested, tr('tm.investedLabel'), fmt(tl.investedNow));

    // Gap headline
    const gap = Math.max(0, tl.investedNow - tl.paidNow);
    ctx.fillStyle = T.textFaint;
    ctx.font = '500 30px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(tr('tm.lostLabel'), 80, 1000);
    ctx.fillStyle = '#34d399';
    // Shrink the figure if it would run past the safe width.
    let gapFont = 96;
    const gapText = fmt(gap);
    ctx.font = `700 ${gapFont}px "DM Mono", "DM Sans", monospace`;
    while (ctx.measureText(gapText).width > W - 160 && gapFont > 48) {
      gapFont -= 6;
      ctx.font = `700 ${gapFont}px "DM Mono", "DM Sans", monospace`;
    }
    ctx.fillText(gapText, 80, 1090);

    // Note — wrapped so it never collides with the figure or overflows the edge.
    ctx.fillStyle = T.textFaint;
    ctx.font = '400 22px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    wrapText(ctx, tr('tm.investNote'), 80, 1215, W - 160, 30);

    // Footer
    ctx.fillStyle = T.paid;
    ctx.font = '700 30px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('leakd.app', W - 80, H - 60);

    return canvas;
  }

  async function shareCard(tl, fmt, tr) {
    const canvas = renderShareCard(tl, fmt, tr);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.95));
    const file = new File([blob], 'leakd-time-machine.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: tr('tm.title'), text: tr('tm.shareSub') });
        return { method: 'shared' };
      } catch { /* cancelled → download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leakd-time-machine.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { method: 'downloaded' };
  }

  window.LeakdTimeMachine = { buildTimeline, drawChart, darkTheme, renderShareCard, shareCard };
})();
