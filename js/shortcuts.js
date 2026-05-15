// Leakd — Keyboard shortcuts + help overlay
// Press `?` to open the cheat sheet. All shortcuts work globally except
// when typing in an input/textarea (we respect text focus).

(function () {
  'use strict';

  // [key (display)], i18n key, run fn
  const SHORTCUTS = [
    { keys: ['?'],              labelKey: 'shortcut.help',     run: () => toggleHelp() },
    { keys: ['Ctrl', 'K'],      labelKey: 'shortcut.palette',  run: () => window.LeakdPalette && window.LeakdPalette.open() },
    { keys: ['N'],              labelKey: 'shortcut.add',      run: () => clickIfExists('addBtn') },
    { keys: ['/'],              labelKey: 'shortcut.search',   run: () => focusIfExists('searchInput') },
    { keys: ['H'],              labelKey: 'shortcut.home',     run: () => clickNav('home') },
    { keys: ['I'],              labelKey: 'shortcut.insights', run: () => clickNav('insights') },
    { keys: ['T'],              labelKey: 'shortcut.theme',    run: () => clickIfExists('toggleTheme') },
    { keys: ['M'],              labelKey: 'shortcut.menu',     run: () => clickIfExists('openMenu') },
    { keys: ['Esc'],            labelKey: 'shortcut.close',    run: () => closeAnyModal() },
  ];

  let helpOverlay = null;
  let helpOpen = false;

  function t(key) { return window.LeakdI18n ? window.LeakdI18n.t(key) : key; }

  function clickIfExists(id) {
    const el = document.getElementById(id);
    if (el) el.click();
  }
  function focusIfExists(id) {
    const el = document.getElementById(id);
    if (el) el.focus();
  }
  function clickNav(view) {
    const el = document.querySelector('.nav-btn[data-view="' + view + '"]');
    if (el) el.click();
  }
  function closeAnyModal() {
    document.querySelectorAll('.modal-overlay.active').forEach(el => el.classList.remove('active'));
  }

  function buildHelp() {
    helpOverlay = document.createElement('div');
    helpOverlay.className = 'shortcuts-overlay';
    helpOverlay.innerHTML = `
      <div class="shortcuts-card">
        <div class="shortcuts-header">
          <h2 id="shortcutsTitle"></h2>
          <button class="btn-icon" id="shortcutsClose">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="shortcuts-list" id="shortcutsList"></div>
      </div>
    `;
    document.body.appendChild(helpOverlay);
    helpOverlay.addEventListener('click', e => {
      if (e.target === helpOverlay) toggleHelp();
    });
    helpOverlay.querySelector('#shortcutsClose').addEventListener('click', toggleHelp);
  }

  function renderHelp() {
    helpOverlay.querySelector('#shortcutsTitle').textContent = t('shortcut.title');
    helpOverlay.querySelector('#shortcutsList').innerHTML = SHORTCUTS.map(s => `
      <div class="shortcut-row">
        <div class="shortcut-keys">
          ${s.keys.map(k => '<kbd>' + k + '</kbd>').join('<span class="kbd-plus">+</span>')}
        </div>
        <div class="shortcut-label">${t(s.labelKey)}</div>
      </div>
    `).join('');
  }

  function toggleHelp() {
    if (!helpOverlay) buildHelp();
    helpOpen = !helpOpen;
    if (helpOpen) { renderHelp(); helpOverlay.classList.add('active'); }
    else helpOverlay.classList.remove('active');
  }

  function shouldIgnore(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (e.target && e.target.isContentEditable) return true;
    return false;
  }

  function init() {
    document.addEventListener('keydown', e => {
      // Always allow Esc (closes things)
      if (e.key === 'Escape' && helpOpen) { toggleHelp(); return; }
      // Ctrl+K is handled by palette.js
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') return;
      if (shouldIgnore(e)) return;
      // Single-key shortcuts
      if (e.key === '?') { e.preventDefault(); toggleHelp(); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); clickIfExists('addBtn'); }
      else if (e.key === '/') { e.preventDefault(); focusIfExists('searchInput'); }
      else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); clickNav('home'); }
      else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); clickNav('insights'); }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); clickIfExists('toggleTheme'); }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); clickIfExists('openMenu'); }
    });
  }

  window.LeakdShortcuts = { init, toggleHelp, SHORTCUTS };
})();
