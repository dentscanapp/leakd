// Leakd — Share card generator
// Renders a 1080x1350 (Instagram portrait) PNG that shows the user's monthly
// leak in a way that's actually shareable. Output goes through the Web Share
// API where supported, with a download fallback.

(function () {
  'use strict';

  const W = 1080;
  const H = 1350;

  // Dark theme palette (matches app's dark mode)
  const palette = {
    bg: '#0b0b0c',
    bgAlt: '#16161a',
    accent: '#ef4444',
    accentSoft: '#3a1818',
    text: '#fafaf9',
    textDim: '#a8a29e',
    textFaint: '#525252',
    grid: '#262626',
  };

  function money(amount, currency) {
    const cur = currency || '$';
    if (cur === 'Ft') return Math.round(amount).toLocaleString() + ' Ft';
    if (cur === '¥') return cur + Math.round(amount).toLocaleString();
    return cur + Number(amount).toFixed(2);
  }

  function pickTagline(monthly) {
    if (monthly === 0) return 'No leaks — yet';
    if (monthly < 10) return 'Barely a drip';
    if (monthly < 30) return 'A small leak';
    if (monthly < 75) return 'Real money';
    if (monthly < 150) return 'A serious leak';
    if (monthly < 300) return 'Wake-up call';
    return 'How are you still standing';
  }

  // ── Main render ──
  function render(subs, currency) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, W, H);

    // Decorative leak drop
    drawDrop(ctx, W - 140, 140, 120, palette.accent, 0.18);

    // ── Header ──
    ctx.fillStyle = palette.text;
    ctx.font = '700 56px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('leakd', 80, 140);

    ctx.fillStyle = palette.textDim;
    ctx.font = '500 28px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Where my money leaks', 80, 184);

    // ── Big number ──
    const monthly = subs.reduce((sum, s) => sum + toMonthly(s.price, s.cycle), 0);
    const yearly = monthly * 12;

    ctx.fillStyle = palette.textDim;
    ctx.font = '500 28px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Monthly spend', 80, 320);

    ctx.fillStyle = palette.accent;
    ctx.font = '700 180px "DM Mono", "DM Sans", monospace';
    const monthlyText = money(monthly, currency);
    ctx.fillText(monthlyText, 80, 490);

    ctx.fillStyle = palette.textFaint;
    ctx.font = '500 32px "DM Sans", system-ui, sans-serif';
    ctx.fillText(`= ${money(yearly, currency)} per year`, 80, 540);

    // Tagline pill
    const tag = pickTagline(monthly);
    drawPill(ctx, 80, 580, tag, palette.accentSoft, palette.accent);

    // ── Top 5 leaks ──
    ctx.fillStyle = palette.textDim;
    ctx.font = '500 24px "DM Sans", system-ui, sans-serif';
    ctx.fillText('TOP LEAKS', 80, 720);

    const top = [...subs]
      .map(s => ({ ...s, monthly: toMonthly(s.price, s.cycle) }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 5);

    const rowY = 770;
    const rowH = 88;
    const maxMonthly = top.length ? top[0].monthly : 1;

    top.forEach((s, i) => {
      const y = rowY + i * rowH;

      // Row background
      ctx.fillStyle = palette.bgAlt;
      roundRect(ctx, 80, y, W - 160, rowH - 12, 18);
      ctx.fill();

      // Bar
      const barW = (W - 220) * (s.monthly / maxMonthly);
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.18;
      roundRect(ctx, 80, y, barW + 60, rowH - 12, 18);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Name
      ctx.fillStyle = palette.text;
      ctx.font = '600 30px "DM Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      const name = s.name.length > 22 ? s.name.slice(0, 21) + '…' : s.name;
      ctx.fillText(name, 110, y + 50);

      // Amount
      ctx.fillStyle = palette.text;
      ctx.font = '700 30px "DM Mono", "DM Sans", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(money(s.monthly, currency) + '/mo', W - 110, y + 50);
    });

    // Empty row placeholder
    if (top.length === 0) {
      ctx.fillStyle = palette.textFaint;
      ctx.font = '500 26px "DM Sans", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('(no subscriptions tracked yet)', 110, rowY + 50);
    }

    // ── Footer ──
    ctx.fillStyle = palette.textDim;
    ctx.font = '500 26px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${subs.length} subscription${subs.length === 1 ? '' : 's'} tracked`, 80, H - 130);

    ctx.fillStyle = palette.accent;
    ctx.font = '700 32px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('leakd.app', W - 80, H - 130);

    ctx.fillStyle = palette.textFaint;
    ctx.font = '500 22px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Free · No account · Private', W - 80, H - 95);

    return canvas;
  }

  function toMonthly(price, cycle) {
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  function drawDrop(ctx, cx, cy, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.bezierCurveTo(cx + r, cy - r / 2, cx + r, cy + r / 2, cx, cy + r);
    ctx.bezierCurveTo(cx - r, cy + r / 2, cx - r, cy - r / 2, cx, cy - r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawPill(ctx, x, y, text, bg, fg) {
    ctx.font = '600 26px "DM Sans", system-ui, sans-serif';
    const padX = 22, padY = 14;
    const w = ctx.measureText(text).width + padX * 2;
    const h = 26 + padY * 2;
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + padX, y + h / 2);
    ctx.textBaseline = 'alphabetic';
  }

  // ── Public API ──
  async function generate(subs, currency) {
    const canvas = render(subs, currency);
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve({ blob, canvas }), 'image/png', 0.95);
    });
  }

  async function shareOrDownload(subs, currency) {
    const { blob, canvas } = await generate(subs, currency);
    const file = new File([blob], 'my-leakd.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'My subscription leak',
          text: 'Found out where my money goes — built with leakd.app',
        });
        return { method: 'shared' };
      } catch {
        // user cancelled — fall through to download
      }
    }

    // Download fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-leakd.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { method: 'downloaded', canvas };
  }

  window.LeakdShare = { generate, render, shareOrDownload };
})();
