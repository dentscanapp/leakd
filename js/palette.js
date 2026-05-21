// Leakd — Command palette
// Notion/Linear-style global search + quick action launcher.
// Triggered by Ctrl+K / Cmd+K from anywhere. Fuzzy matches across:
//   • Known service catalog (60+ services — type "net" → "Add Netflix")
//   • App actions (theme, language, currency, all modals)
//   • Existing subscriptions (filter the home list quickly)
//
// The palette never closes the underlying view — it overlays. Enter on a
// result executes it, Escape dismisses, arrow keys navigate.

(function () {
  'use strict';

  let overlay, input, list;
  let results = [];
  let activeIdx = 0;
  let actions = [];
  let isOpen = false;

  function t(key, vars) { return window.LeakdI18n ? window.LeakdI18n.t(key, vars) : key; }

  // Action registry — populated by app.js via register()
  function register(action) {
    // action: { id, label, hint?, icon?, run, keywords? }
    actions.push(action);
  }

  function clearActions() { actions = []; }

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'palette-overlay';
    overlay.innerHTML = `
      <div class="palette">
        <div class="palette-input-wrap">
          <svg class="palette-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="palette-input" id="paletteInput" autocomplete="off">
          <span class="palette-kbd">esc</span>
        </div>
        <div class="palette-results" id="paletteResults"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    input = overlay.querySelector('#paletteInput');
    list = overlay.querySelector('#paletteResults');

    input.addEventListener('input', () => { activeIdx = 0; render(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(results.length - 1, activeIdx + 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(activeIdx); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  }

  // Fuzzy match: each character of query must appear in order in target.
  // Score = -position of last match (earlier = better) + prefix bonus.
  function fuzzy(query, target) {
    if (!query) return 0;
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    if (t === q) return 1000;
    if (t.startsWith(q)) return 500;
    if (t.includes(q)) return 250 - t.indexOf(q);
    let ti = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const idx = t.indexOf(q[qi], ti);
      if (idx === -1) return -1;
      ti = idx + 1;
    }
    return 100 - ti;
  }

  function buildResults() {
    const query = input.value.trim();
    const out = [];

    // 1. App actions
    actions.forEach(a => {
      const score = Math.max(
        fuzzy(query, a.label),
        fuzzy(query, a.id),
        ...(a.keywords || []).map(k => fuzzy(query, k))
      );
      if (score >= 0) out.push({ ...a, score, type: 'action' });
    });

    // 2. Known services — for quick add
    if (window.LeakdImport && window.LeakdImport.KNOWN) {
      window.LeakdImport.KNOWN.forEach(k => {
        const score = fuzzy(query, k.name);
        if (score >= 0) {
          out.push({
            id: 'add-' + k.name.toLowerCase(),
            label: t('palette.addService', { name: k.name }),
            hint: k.cat + ' · ~$' + k.price + '/mo',
            badge: window.LeakdBrands ? window.LeakdBrands.badge(k.name, k.cat) : null,
            score: score - 50, // services scored slightly lower than actions
            type: 'add',
            payload: k,
          });
        }
      });
    }

    // 3. Active subscriptions — for quick edit
    if (window.LeakdState && window.__paletteSubs) {
      window.__paletteSubs.forEach(s => {
        const score = fuzzy(query, s.name);
        if (score >= 0) {
          out.push({
            id: 'edit-' + s.id,
            label: t('palette.editSub', { name: s.name }),
            hint: s.category,
            badge: window.LeakdBrands ? window.LeakdBrands.badge(s.name, s.category) : null,
            score: score - 100,
            type: 'edit',
            payload: s,
          });
        }
      });
    }

    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 12);
  }

  function render() {
    results = buildResults();
    if (results.length === 0) {
      list.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'palette-empty';
      div.textContent = t('palette.noResults');
      list.appendChild(div);
      return;
    }
    list.innerHTML = results.map((r, i) => {
      const active = i === activeIdx ? ' active' : '';
      const iconHtml = r.badge
        ? `<span class="palette-result-icon" style="background:${r.badge.bg};color:${r.badge.fg};">${r.badge.symbol}</span>`
        : `<span class="palette-result-icon palette-icon-generic">${r.type === 'action' ? '⚡' : r.type === 'add' ? '+' : '✎'}</span>`;
      return `<button class="palette-result${active}" data-i="${i}">
        ${iconHtml}
        <span class="palette-result-label">${escape(r.label)}</span>
        ${r.hint ? '<span class="palette-result-hint">' + escape(r.hint) + '</span>' : ''}
      </button>`;
    }).join('');
    list.querySelectorAll('.palette-result').forEach(el => {
      el.addEventListener('click', () => pick(parseInt(el.dataset.i, 10)));
      el.addEventListener('mouseenter', () => { activeIdx = parseInt(el.dataset.i, 10); render(); });
    });
    // Scroll active into view
    const activeEl = list.querySelector('.palette-result.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }

  function escape(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function pick(idx) {
    const r = results[idx];
    if (!r) return;
    close();
    if (r.type === 'action' && r.run) r.run();
    else if (r.type === 'add' && window.__paletteOnAddService) window.__paletteOnAddService(r.payload);
    else if (r.type === 'edit' && window.__paletteOnEditSub) window.__paletteOnEditSub(r.payload);
  }

  function open() {
    if (!overlay) build();
    if (isOpen) return;
    isOpen = true;
    overlay.classList.add('active');
    input.value = '';
    activeIdx = 0;
    input.placeholder = t('palette.placeholder');
    render();
    setTimeout(() => input.focus(), 50);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    if (overlay) overlay.classList.remove('active');
  }

  function toggle() { isOpen ? close() : open(); }

  // Global hotkey: Ctrl+K / Cmd+K
  function initHotkey() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    });
  }

  window.LeakdPalette = { register, clearActions, open, close, toggle, initHotkey };
})();
