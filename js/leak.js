/**
 * Leakd Interactive Fluid Effect
 * Liquid level ties to monthly spending with realistic 2D canvas physics,
 * overlapping transparent waves, hover ripples, and floating spent-cash bubbles.
 */
(function() {
  'use strict';

  let overlay = null;
  let canvas = null;
  let ctx = null;
  let animationFrameId = null;

  // Simulation variables
  let targetPct = 0;
  let currentPct = 0;
  let leakOpacity = 0.2;
  let avgRating = 5;

  // Wave physics
  let phases = [0, 0, 0];
  const waveSpeeds = [0.012, -0.018, 0.025];
  const waveAmplitudes = [12, 18, 8];
  const waveFrequencies = [0.008, 0.005, 0.012];

  // Mouse interaction
  const mouse = { x: -1000, y: -1000, active: false, radius: 120 };
  
  // Floating bubble particles
  const particles = [];
  const maxParticles = 4; // Minimalist bubble limit (extremely subtle)

  function init() {
    if (document.getElementById('leak-overlay')) return;

    overlay = document.createElement('div');
    overlay.id = 'leak-overlay';
    
    // Add canvas element
    canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    overlay.appendChild(canvas);

    document.body.appendChild(overlay);

    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Track mouse
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Start simulation loop
    loop();
  }

  function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }

  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  }

  function handleMouseLeave() {
    mouse.active = false;
  }

  function spawnParticle(w, h) {
    if (particles.length >= maxParticles) return;
    particles.push({
      x: Math.random() * w,
      y: h + 10,
      size: 1 + Math.random() * 3, // 1px to 4px
      speedY: 0.5 + Math.random() * (avgRating < 3 ? 1.5 : 0.8), // Toxic bubbles rise faster!
      wobbleSpeed: 0.02 + Math.random() * 0.05,
      wobbleRange: 1 + Math.random() * 4,
      wobblePhase: Math.random() * Math.PI * 2,
      opacity: 0.3 + Math.random() * 0.6
    });
  }

  function loop() {
    animationFrameId = requestAnimationFrame(loop);
    render();
  }

  function render() {
    if (!canvas || !ctx) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, w, h);

    if (targetPct <= 0) {
      currentPct += (0 - currentPct) * 0.08;
      if (currentPct < 0.1) {
        currentPct = 0;
        particles.length = 0;
        ctx.clearRect(0, 0, w, h);
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        return;
      }
    } else {
      // Smoothly animate liquid height to target percentage
      currentPct += (targetPct - currentPct) * 0.05;
    }

    // Determine water level Y coordinate
    const targetY = h - (h * (currentPct / 100));

    // Spawn bubbles rising from bottom (minimalist, extremely rare accent)
    if (currentPct > 0 && Math.random() < (avgRating < 3 ? 0.02 : 0.005)) {
      spawnParticle(w, h);
    }

    // Draw 3 overlapping waves
    const opacities = [0.35, 0.55, 1.0];
    const intensities = [0.4, 0.7, 1.0];

    for (let i = 0; i < 3; i++) {
      phases[i] += waveSpeeds[i];
      ctx.beginPath();
      
      // Starting point
      ctx.moveTo(0, h);

      for (let x = 0; x <= w; x += 5) {
        // Base sine wave height
        let waveY = targetY + Math.sin(x * waveFrequencies[i] + phases[i]) * waveAmplitudes[i] * (currentPct / 100);

        // Mouse interaction displacement
        if (mouse.active) {
          const dx = x - mouse.x;
          const dy = waveY - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < mouse.radius) {
            // Push wave down near mouse
            const force = (1 - dist / mouse.radius) * 22;
            waveY += force;
          }
        }

        ctx.lineTo(x, waveY);
      }

      ctx.lineTo(w, h);
      ctx.closePath();

      // Rich metallic gradient fill for waves
      const grad = ctx.createLinearGradient(0, targetY - 20, 0, h);
      
      // Extract RGB colors to mix with variable opacity
      let rgb = '220, 38, 38'; // Deeper crimson
      if (avgRating < 3) {
        rgb = '239, 68, 68'; // Bright toxic red
      }
      
      grad.addColorStop(0, `rgba(${rgb}, ${leakOpacity * intensities[i] * opacities[i]})`);
      grad.addColorStop(1, `rgba(${rgb}, ${leakOpacity * intensities[i] * 0.05})`);

      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Draw active neon bubbles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.y -= p.speedY;
      p.wobblePhase += p.wobbleSpeed;
      const currentX = p.x + Math.sin(p.wobblePhase) * p.wobbleRange;

      // Fade out near surface
      const distanceToSurface = p.y - targetY;
      let alpha = p.opacity;
      if (distanceToSurface < 60) {
        alpha = p.opacity * (distanceToSurface / 60);
      }

      // If particle goes above surface or top of screen, destroy it
      if (p.y < targetY || p.y < 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(currentX, p.y, p.size, 0, Math.PI * 2);
      
      // Neon glow for toxic particles, clean glow for standard
      ctx.fillStyle = avgRating < 3 ? `rgba(239, 68, 68, ${alpha})` : `rgba(251, 113, 133, ${alpha})`;
      ctx.shadowColor = avgRating < 3 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(251, 113, 133, 0.5)';
      ctx.shadowBlur = 6;
      ctx.fill();
    }
    ctx.shadowBlur = 0; // reset shadow
  }

  /**
   * Update the leak level based on monthly spend.
   * @param {number} monthlySpend Total monthly cost
   * @param {number} income Optional income to calculate percentage
   * @param {number} rRating Optional average rating (1-5) to affect color/toxicity
   */
  function update(monthlySpend, income = 0, rRating = 5) {
    if (!overlay) init();

    avgRating = rRating;

    // Calculate percentage.
    let pct = 0;
    if (income > 0) {
      pct = (monthlySpend / income) * 100;
    } else {
      const threshold = window.LeakdState && window.LeakdState.currency === 'Ft' ? 150000 : 400;
      pct = (monthlySpend / threshold) * 100;
    }

    // Cap it at 90% so it doesn't cover the header
    pct = Math.min(90, pct);
    
    // Apply streak discount
    if (window.LeakdStreak) {
      const streakCount = window.LeakdStreak.getCount();
      pct = Math.max(0, pct - streakCount);
    }

    // If no spend, hide it
    if (monthlySpend <= 0) pct = 0;

    targetPct = pct;

    // Adjust opacity
    const intensity = (6 - avgRating) / 5; // 0.2 to 1.0
    leakOpacity = 0.15 + (intensity * 0.45);

    // Wake up loop if it is asleep and there is a target percentage
    if (targetPct > 0 && !animationFrameId) {
      loop();
    }
  }

  window.LeakdEffect = { update };
})();
