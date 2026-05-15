// Leakd — Confetti animation
// CSS-only confetti burst for celebrations (goal milestones, etc.). No deps.
// Spawns ~50 colored particles that fall + rotate + fade over ~2 seconds.

(function () {
  'use strict';

  const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

  function burst() {
    const wrap = document.createElement('div');
    wrap.className = 'confetti-wrap';
    document.body.appendChild(wrap);

    const count = 60;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'confetti-piece';
      const left = Math.random() * 100;
      const delay = Math.random() * 0.4;
      const dur = 1.4 + Math.random() * 0.9;
      const rot = Math.random() * 360;
      const horiz = (Math.random() - 0.5) * 200;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const size = 6 + Math.random() * 6;
      const shape = Math.random() > 0.5 ? '50%' : '2px';
      p.style.cssText = `
        left:${left}%;
        background:${color};
        width:${size}px;
        height:${size * 1.6}px;
        border-radius:${shape};
        animation: confetti-fall ${dur}s cubic-bezier(0.2, 0.6, 0.4, 1) ${delay}s forwards;
        --horiz:${horiz}px;
        --rot:${rot}deg;
      `;
      wrap.appendChild(p);
    }

    setTimeout(() => wrap.remove(), 3000);
  }

  window.LeakdConfetti = { burst };
})();
