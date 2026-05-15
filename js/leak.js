
/**
 * Leakd Visual Effect
 * Ties the "leak" liquid level to monthly spending.
 */
(function() {
  'use strict';

  let overlay = null;
  let wave = null;

  function init() {
    if (document.getElementById('leak-overlay')) return;

    overlay = document.createElement('div');
    overlay.id = 'leak-overlay';
    
    // Using an SVG wave for a more organic feel
    overlay.innerHTML = `
      <div class="leak-liquid">
        <svg class="leak-wave" viewBox="0 0 120 28" preserveAspectRatio="none">
          <defs>
            <linearGradient id="leak-grad" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stop-color="rgba(239, 68, 68, 0)" />
              <stop offset="100%" stop-color="rgba(239, 68, 68, 0.4)" />
            </linearGradient>
          </defs>
          <path d="M0 15 C 30 5, 45 25, 60 15 C 75 5, 90 25, 120 15 L 120 28 L 0 28 Z" fill="url(#leak-grad)" />
        </svg>
        <div class="leak-fill"></div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  /**
   * Update the leak level based on monthly spend.
   * @param {number} monthlySpend Total monthly cost
   * @param {number} income Optional income to calculate percentage
   * @param {number} avgRating Optional average rating (1-5) to affect color/toxicity
   */
  function update(monthlySpend, income = 0, avgRating = 5) {
    if (!overlay) init();

    // Calculate percentage. 
    // If income is set, use % of income. 
    // If not, use a default threshold (e.g., 100,000 HUF or $300)
    let pct = 0;
    if (income > 0) {
      pct = (monthlySpend / income) * 100;
    } else {
      // Default scaling: 100% height at 150,000 HUF / $400
      const threshold = window.LeakdState && window.LeakdState.currency === 'Ft' ? 150000 : 400;
      pct = (monthlySpend / threshold) * 100;
    }

    // Cap it at 90% so it doesn't cover the header
    pct = Math.min(90, pct);
    
    // If no spend, hide it
    if (monthlySpend <= 0) pct = 0;

    const liquid = overlay.querySelector('.leak-liquid');
    liquid.style.height = `${pct}%`;

    // Adjust "toxicity" based on rating
    // Low rating (1-2) = more vibrant/alarming red
    // High rating (4-5) = more subtle/ink-like
    const intensity = (6 - avgRating) / 5; // 0.2 to 1.0
    const opacity = 0.1 + (intensity * 0.4);
    overlay.style.setProperty('--leak-opacity', opacity);
    
    // Change color slightly if it's "bad" spending
    if (avgRating < 3 && monthlySpend > 0) {
      overlay.style.setProperty('--leak-color', 'rgba(239, 68, 68, 1)'); // Bright red
    } else {
      overlay.style.setProperty('--leak-color', 'rgba(220, 38, 38, 1)'); // Deeper crimson
    }
  }

  window.LeakdEffect = { update };
})();
