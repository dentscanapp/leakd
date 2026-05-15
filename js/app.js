// Leakd — Subscription Tracker
// All data stored locally in localStorage. Zero server calls.

(function() {
  'use strict';

  // ─── State ───
  const STORAGE_KEY = 'leakd_subs';
  const SETTINGS_KEY = 'leakd_settings';
  let subs = [];
  let settings = { currency: '$', currencyCode: 'USD', theme: 'light' };
  let activeCategory = 'all';
  let editingId = null;

  // ─── Category Colors ───
  const catColors = {
    Entertainment: { bg: '#fef2f2', text: '#991b1b', icon: '🎬' },
    Work:          { bg: '#eff6ff', text: '#1e40af', icon: '💼' },
    Music:         { bg: '#f0fdf4', text: '#166534', icon: '🎵' },
    Fitness:       { bg: '#fefce8', text: '#854d0e', icon: '💪' },
    Cloud:         { bg: '#f0f9ff', text: '#075985', icon: '☁️' },
    Food:          { bg: '#fff7ed', text: '#9a3412', icon: '🍕' },
    News:          { bg: '#faf5ff', text: '#6b21a8', icon: '📰' },
    Other:         { bg: '#f5f5f4', text: '#44403c', icon: '📦' },
  };

  // ─── DOM ───
  const $ = id => document.getElementById(id);
  const monthlyTotalEl = $('monthlyTotal');
  const yearlyTotalEl = $('yearlyTotal');
  const activeCountEl = $('activeCount');
  const dueSoonEl = $('dueSoon');
  const alertsEl = $('alerts');
  const categoriesEl = $('categories');
  const subListEl = $('subList');
  const emptyStateEl = $('emptyState');
  const bottomActionsEl = $('bottomActions');
  const modal = $('modal');
  const currencyModal = $('currencyModal');

  // ─── Init ───
  function init() {
    loadData();
    applyTheme();
    render();
    bindEvents();
    setDefaultDate();

    // Show currency picker on first visit
    if (!localStorage.getItem(SETTINGS_KEY)) {
      currencyModal.style.display = 'flex';
    }
  }

  // ─── Data ───
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      subs = raw ? JSON.parse(raw) : [];
    } catch { subs = []; }
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) settings = { ...settings, ...JSON.parse(raw) };
    } catch {}
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  // ─── Theme ───
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }

  function toggleTheme() {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveData();
  }

  // ─── Calculations ───
  function toMonthly(price, cycle) {
    if (cycle === 'weekly') return price * 4.33;
    if (cycle === 'yearly') return price / 12;
    return price;
  }

  function toYearly(price, cycle) {
    if (cycle === 'weekly') return price * 52;
    if (cycle === 'monthly') return price * 12;
    return price;
  }

  function daysUntil(dateStr) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - now) / 86400000);
  }

  function formatPrice(amount) {
    const s = settings.currency;
    if (s === 'Ft') return Math.round(amount).toLocaleString() + ' Ft';
    if (s === '¥') return s + Math.round(amount).toLocaleString();
    return s + amount.toFixed(2);
  }

  // ─── Render ───
  function render() {
    renderStats();
    renderAlerts();
    renderCategories();
    renderList();
    $('currencySymbol').textContent = settings.currency;
  }

  function renderStats() {
    let monthly = 0, dueSoonCount = 0;
    subs.forEach(s => {
      monthly += toMonthly(s.price, s.cycle);
      if (s.nextDate && daysUntil(s.nextDate) <= 7 && daysUntil(s.nextDate) >= 0) dueSoonCount++;
    });
    monthlyTotalEl.textContent = formatPrice(monthly);
    yearlyTotalEl.textContent = formatPrice(monthly * 12);
    activeCountEl.textContent = subs.length;
    dueSoonEl.textContent = dueSoonCount;

    // Color code monthly if high
    monthlyTotalEl.style.color = monthly > 0 ? '' : 'var(--text-3)';
  }

  function renderAlerts() {
    alertsEl.innerHTML = '';
    const now = new Date();

    subs.forEach(s => {
      // Trial ending alert
      if (s.isTrial && s.trialEnd) {
        const days = daysUntil(s.trialEnd);
        if (days >= 0 && days <= 3) {
          alertsEl.innerHTML += `
            <div class="alert-card">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div><strong>${s.name}</strong> free trial ends ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days'}! Will auto-renew at ${formatPrice(s.price)}/${s.cycle === 'monthly' ? 'mo' : s.cycle === 'yearly' ? 'yr' : 'wk'}.</div>
            </div>`;
        }
      }

      // Payment due alert
      if (s.nextDate) {
        const days = daysUntil(s.nextDate);
        if (days >= 0 && days <= 2 && !(s.isTrial && s.trialEnd)) {
          alertsEl.innerHTML += `
            <div class="alert-card">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <div><strong>${s.name}</strong> payment of ${formatPrice(s.price)} due ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days'}.</div>
            </div>`;
        }
      }
    });
  }

  function renderCategories() {
    const cats = {};
    subs.forEach(s => {
      if (!cats[s.category]) cats[s.category] = 0;
      cats[s.category] += toMonthly(s.price, s.cycle);
    });

    let totalMonthly = 0;
    subs.forEach(s => totalMonthly += toMonthly(s.price, s.cycle));

    let html = `<button class="cat-btn ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">All ${subs.length > 0 ? '(' + formatPrice(totalMonthly) + ')' : ''}</button>`;

    Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, amount]) => {
        html += `<button class="cat-btn ${activeCategory === cat ? 'active' : ''}" data-cat="${cat}">${cat} (${formatPrice(amount)})</button>`;
      });

    categoriesEl.innerHTML = html;

    // Rebind
    categoriesEl.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCategory = btn.dataset.cat;
        render();
      });
    });
  }

  function renderList() {
    const filtered = activeCategory === 'all' ? subs : subs.filter(s => s.category === activeCategory);

    if (filtered.length === 0) {
      emptyStateEl.style.display = 'block';
      bottomActionsEl.style.display = 'none';
      // Remove all sub-items but keep empty state
      subListEl.querySelectorAll('.sub-item').forEach(el => el.remove());
      return;
    }

    emptyStateEl.style.display = 'none';
    bottomActionsEl.style.display = 'flex';

    // Sort: due soonest first
    const sorted = [...filtered].sort((a, b) => {
      const da = a.nextDate ? daysUntil(a.nextDate) : 999;
      const db = b.nextDate ? daysUntil(b.nextDate) : 999;
      return da - db;
    });

    let html = '';
    sorted.forEach(s => {
      const c = catColors[s.category] || catColors.Other;
      const days = s.nextDate ? daysUntil(s.nextDate) : null;
      const initial = s.name.charAt(0).toUpperCase();

      let badge = '';
      if (s.isTrial && s.trialEnd) {
        const td = daysUntil(s.trialEnd);
        if (td >= 0 && td <= 3) badge = `<span class="sub-badge badge-trial">Trial ends ${td === 0 ? 'today' : td === 1 ? 'tomorrow' : 'in ' + td + 'd'}</span>`;
      } else if (days !== null && days >= 0 && days <= 3) {
        badge = `<span class="sub-badge badge-due">${days === 0 ? 'Due today' : days === 1 ? 'Tomorrow' : 'In ' + days + 'd'}</span>`;
      }

      let dateText = '';
      if (s.nextDate) {
        const d = new Date(s.nextDate);
        dateText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      const cycleLabel = s.cycle === 'monthly' ? '/mo' : s.cycle === 'yearly' ? '/yr' : '/wk';

      html += `
        <div class="sub-item" data-id="${s.id}">
          <div class="sub-icon" style="background:${c.bg};color:${c.text}">${c.icon}</div>
          <div class="sub-info">
            <div class="sub-name">${escHtml(s.name)}</div>
            <div class="sub-meta">
              <span>${s.category}</span>
              ${dateText ? '<span>·</span><span>' + dateText + '</span>' : ''}
              ${badge}
            </div>
          </div>
          <div class="sub-price">
            <div class="sub-amount">${formatPrice(s.price)}</div>
            <div class="sub-cycle">${cycleLabel}</div>
          </div>
        </div>`;
    });

    // Keep empty state in DOM but hidden
    const existingItems = subListEl.querySelectorAll('.sub-item');
    existingItems.forEach(el => el.remove());
    emptyStateEl.insertAdjacentHTML('beforebegin', html);

    // Bind clicks
    subListEl.querySelectorAll('.sub-item').forEach(el => {
      el.addEventListener('click', () => openEdit(el.dataset.id));
    });
  }

  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── Modal ───
  function openAdd() {
    editingId = null;
    $('modalTitle').textContent = 'Add subscription';
    $('subName').value = '';
    $('subPrice').value = '';
    $('subCycle').value = 'monthly';
    $('subCategory').value = 'Entertainment';
    setDefaultDate();
    $('subTrial').checked = false;
    $('trialDateWrap').style.display = 'none';
    $('subTrialEnd').value = '';
    $('editId').value = '';
    $('deleteBtn').style.display = 'none';
    $('presets').style.display = 'flex';
    document.querySelector('.form-divider').style.display = 'flex';
    modal.classList.add('active');
    setTimeout(() => $('subName').focus(), 100);
  }

  function openEdit(id) {
    const s = subs.find(x => x.id === id);
    if (!s) return;
    editingId = id;
    $('modalTitle').textContent = 'Edit subscription';
    $('subName').value = s.name;
    $('subPrice').value = s.price;
    $('subCycle').value = s.cycle;
    $('subCategory').value = s.category;
    $('subDate').value = s.nextDate || '';
    $('subTrial').checked = s.isTrial || false;
    $('trialDateWrap').style.display = s.isTrial ? 'block' : 'none';
    $('subTrialEnd').value = s.trialEnd || '';
    $('deleteBtn').style.display = 'inline-block';
    $('presets').style.display = 'none';
    document.querySelector('.form-divider').style.display = 'none';
    modal.classList.add('active');
    setTimeout(() => $('subName').focus(), 100);
  }

  function closeModalFn() {
    modal.classList.remove('active');
    editingId = null;
  }

  function setDefaultDate() {
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    $('subDate').value = now.toISOString().split('T')[0];
  }

  function saveSub() {
    const name = $('subName').value.trim();
    const price = parseFloat($('subPrice').value);
    const cycle = $('subCycle').value;
    const category = $('subCategory').value;
    const nextDate = $('subDate').value;
    const isTrial = $('subTrial').checked;
    const trialEnd = $('subTrialEnd').value;

    if (!name) { $('subName').focus(); return; }
    if (!price || price <= 0) { $('subPrice').focus(); return; }

    if (editingId) {
      const idx = subs.findIndex(x => x.id === editingId);
      if (idx !== -1) {
        subs[idx] = { ...subs[idx], name, price, cycle, category, nextDate, isTrial, trialEnd };
      }
    } else {
      subs.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name, price, cycle, category, nextDate, isTrial, trialEnd,
        createdAt: new Date().toISOString()
      });
    }

    saveData();
    closeModalFn();
    render();
  }

  function deleteSub() {
    if (!editingId) return;
    if (!confirm('Delete this subscription?')) return;
    subs = subs.filter(x => x.id !== editingId);
    saveData();
    closeModalFn();
    render();
  }

  // ─── Presets ───
  function applyPreset(btn) {
    $('subName').value = btn.dataset.name;
    $('subPrice').value = btn.dataset.price;
    $('subCategory').value = btn.dataset.cat;
    $('subCycle').value = 'monthly';
  }

  // ─── Currency ───
  function setCurrency(btn) {
    settings.currency = btn.dataset.currency;
    settings.currencyCode = btn.dataset.code;
    saveData();
    currencyModal.style.display = 'none';
    render();
  }

  // ─── Export CSV ───
  function exportCSV() {
    if (subs.length === 0) return;
    const headers = ['Name', 'Price', 'Currency', 'Cycle', 'Category', 'Next Payment', 'Is Trial', 'Trial End', 'Monthly Cost', 'Yearly Cost'];
    const rows = subs.map(s => [
      s.name,
      s.price,
      settings.currencyCode,
      s.cycle,
      s.category,
      s.nextDate || '',
      s.isTrial ? 'Yes' : 'No',
      s.trialEnd || '',
      toMonthly(s.price, s.cycle).toFixed(2),
      toYearly(s.price, s.cycle).toFixed(2)
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
      csv += r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leakd-subscriptions.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Events ───
  function bindEvents() {
    $('addBtn').addEventListener('click', openAdd);
    $('closeModal').addEventListener('click', closeModalFn);
    $('cancelBtn').addEventListener('click', closeModalFn);
    $('saveBtn').addEventListener('click', saveSub);
    $('deleteBtn').addEventListener('click', deleteSub);
    $('toggleTheme').addEventListener('click', toggleTheme);
    $('exportBtn').addEventListener('click', exportCSV);

    $('subTrial').addEventListener('change', function() {
      $('trialDateWrap').style.display = this.checked ? 'block' : 'none';
    });

    // Presets
    document.querySelectorAll('.preset').forEach(btn => {
      btn.addEventListener('click', () => applyPreset(btn));
    });

    // Currency
    document.querySelectorAll('.currency-btn').forEach(btn => {
      btn.addEventListener('click', () => setCurrency(btn));
    });

    // Close modal on overlay click
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModalFn();
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModalFn();
      if (e.key === 'Enter' && modal.classList.contains('active')) saveSub();
    });
  }

  // ─── Start ───
  init();
})();
