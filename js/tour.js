// Leakd — Interactive onboarding tour
// First-time guided tour that highlights the main features via tooltip
// overlays. Uses a fullscreen dim layer with a "spotlight" cut-out around
// the focused element, plus a tooltip card with copy and next/skip buttons.
//
// Triggered automatically after the 3-step onboarding finishes (only if
// the tour has never run). Can also be re-triggered manually from Settings
// later (we'll wire that up too).

(function () {
  'use strict';

  const KEY = 'leakd_tour_done';

  // Steps reference DOM elements by ID, with copy keys from i18n.
  // 'placement' is an optional hint for where the tooltip card should sit
  // relative to the target ('bottom' by default).
  const STEPS = [
    { target: '#monthlyTotal', titleKey: 'tour.s1.title', bodyKey: 'tour.s1.body', placement: 'bottom' },
    { target: '#addBtn',       titleKey: 'tour.s2.title', bodyKey: 'tour.s2.body', placement: 'top' },
    { target: '.nav-btn[data-view="insights"]', titleKey: 'tour.s3.title', bodyKey: 'tour.s3.body', placement: 'top' },
    { target: '#openMenu',     titleKey: 'tour.s4.title', bodyKey: 'tour.s4.body', placement: 'bottom' },
  ];

  let current = -1;
  let overlay, spotlight, card;

  function isDone() { return localStorage.getItem(KEY) === '1'; }
  function markDone() { localStorage.setItem(KEY, '1'); }
  function reset() { localStorage.removeItem(KEY); }

  function t(key) {
    return window.LeakdI18n ? window.LeakdI18n.t(key) : key;
  }

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.innerHTML = `
      <div class="tour-spotlight"></div>
      <div class="tour-card">
        <div class="tour-progress" id="tourProgress"></div>
        <h3 class="tour-title" id="tourTitle"></h3>
        <p class="tour-body" id="tourBody"></p>
        <div class="tour-actions">
          <button class="tour-skip" id="tourSkip"></button>
          <button class="tour-next" id="tourNext"></button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    spotlight = overlay.querySelector('.tour-spotlight');
    card = overlay.querySelector('.tour-card');

    overlay.querySelector('#tourSkip').addEventListener('click', skip);
    overlay.querySelector('#tourNext').addEventListener('click', next);
    // Click outside card → next as well (forgiving UX)
    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target === spotlight) next();
    });
  }

  function show(stepIdx) {
    if (!overlay) build();
    current = stepIdx;
    const step = STEPS[stepIdx];
    if (!step) return finish();

    const target = document.querySelector(step.target);
    if (!target) {
      // Element not present yet — skip this step
      return next();
    }

    const rect = target.getBoundingClientRect();
    const pad = 8;
    spotlight.style.top = (rect.top - pad) + 'px';
    spotlight.style.left = (rect.left - pad) + 'px';
    spotlight.style.width = (rect.width + pad * 2) + 'px';
    spotlight.style.height = (rect.height + pad * 2) + 'px';

    // Tooltip placement
    const placement = step.placement || 'bottom';
    const vw = window.innerWidth;
    const cardWidth = Math.min(340, vw - 32);
    card.style.width = cardWidth + 'px';
    // Approximate card height for placement math
    card.style.left = Math.max(16, Math.min(vw - cardWidth - 16, rect.left + rect.width / 2 - cardWidth / 2)) + 'px';
    if (placement === 'top') {
      card.style.top = Math.max(16, rect.top - 180) + 'px';
    } else {
      card.style.top = (rect.bottom + 20) + 'px';
    }

    overlay.querySelector('#tourProgress').textContent = (stepIdx + 1) + ' / ' + STEPS.length;
    overlay.querySelector('#tourTitle').textContent = t(step.titleKey);
    overlay.querySelector('#tourBody').textContent = t(step.bodyKey);
    overlay.querySelector('#tourSkip').textContent = t('tour.skip');
    overlay.querySelector('#tourNext').textContent = stepIdx === STEPS.length - 1 ? t('tour.done') : t('tour.next');

    requestAnimationFrame(() => overlay.classList.add('active'));
  }

  function next() {
    if (current >= STEPS.length - 1) return finish();
    show(current + 1);
  }

  function skip() { finish(); }

  function finish() {
    if (overlay) overlay.classList.remove('active');
    markDone();
    setTimeout(() => {
      if (overlay) { overlay.remove(); overlay = null; }
    }, 300);
  }

  function start() {
    if (isDone()) return;
    show(0);
  }

  // Manually restart (from settings)
  function restart() {
    reset();
    show(0);
  }

  window.LeakdTour = { start, restart, isDone, reset };
})();
