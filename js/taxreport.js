// Leakd — Business Expense & Tax Reporter (Pro)
// Generates a printable PDF + accountant-friendly CSV from every sub
// flagged as `isBusiness: true`. Built on the same print-window pattern
// as pdf.js so it works offline with no PDF library dependency.
//
// What it reports
// ───────────────
//   • Total deductible expense (YTD + projected annual)
//   • Per-category breakdown
//   • Itemised table: service, category, billing cycle, monthly cost,
//                     annual cost, currency, vendor, notes
//   • If a sub is shared (sharedWith > 1), the user's actual share is
//     used as the deductible amount (full cost / sharedWith)
//
// The user (or their accountant) decides what's actually deductible per
// their jurisdiction; we just provide a clean record of flagged business
// subs in a layout that prints well.

(function () {
  'use strict';

  const t = (k, vars) => window.LeakdI18n ? window.LeakdI18n.t(k, vars) : k;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

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

  // Locale-aware money formatter (uses LeakdLocale if available)
  function fmt(amount, code) {
    const settings = window.LeakdState || {};
    const target = code || settings.currencyCode || 'USD';
    if (window.LeakdLocale && typeof window.LeakdLocale.formatMoney === 'function') {
      try { return window.LeakdLocale.formatMoney(amount, target); } catch {}
    }
    if (window.LeakdCurrency) {
      const sym = window.LeakdCurrency.getSymbol(target);
      if (target === 'HUF' || sym === 'Ft') return Math.round(amount).toLocaleString() + ' Ft';
      if (sym === '¥') return sym + Math.round(amount).toLocaleString();
      return sym + Number(amount).toFixed(2);
    }
    return '$' + Number(amount).toFixed(2);
  }

  // ── Compute report rows ─────────────────────────────────────
  // Each row's amount is the user's *actual* portion (split by sharedWith).
  // Currency conversion stays in the original currency — the accountant
  // can handle conversion on their side per local tax rules.
  function buildRows(subs) {
    const businessSubs = (subs || []).filter(s => s && s.isBusiness && !s.paused);
    return businessSubs.map(s => {
      const split = (s.sharedWith && s.sharedWith > 1) ? s.sharedWith : 1;
      const myPrice = s.price / split;
      const myMonthly = toMonthly(myPrice, s.cycle);
      const myYearly = toYearly(myPrice, s.cycle);
      // Try to find vendor cancel URL via LeakdImport (best-effort)
      let vendorUrl = '';
      if (window.LeakdImport && typeof window.LeakdImport.findCancelUrl === 'function') {
        vendorUrl = window.LeakdImport.findCancelUrl(s.name) || '';
      }
      return {
        id: s.id,
        name: s.name,
        category: s.category || 'Other',
        cycle: s.cycle,
        currency: s.currency || '',
        price: s.price,
        sharedWith: split,
        myPrice,
        myMonthly,
        myYearly,
        notes: s.notes || '',
        vendorUrl,
        createdAt: s.createdAt || '',
      };
    });
  }

  function summarize(rows) {
    const totalMonthly = rows.reduce((sum, r) => sum + r.myMonthly, 0);
    const totalYearly = rows.reduce((sum, r) => sum + r.myYearly, 0);
    // YTD: monthly × elapsed months of the tax year
    const now = new Date();
    const monthsElapsed = now.getMonth() + (now.getDate() / 30.44);
    const ytd = totalMonthly * monthsElapsed;
    // Group by category
    const byCategory = {};
    for (const r of rows) {
      byCategory[r.category] = (byCategory[r.category] || 0) + r.myYearly;
    }
    return { totalMonthly, totalYearly, ytd, byCategory, count: rows.length };
  }

  // ── PDF (print window) ──────────────────────────────────────
  function generatePDF(subs) {
    if (window.LeakdPro && !window.LeakdPro.isPro()) {
      if (typeof openProModal === 'function') openProModal();
      return;
    }
    const rows = buildRows(subs);
    if (rows.length === 0) {
      alert(t('tax.empty'));
      return;
    }
    const sum = summarize(rows);
    const lang = window.LeakdI18n ? window.LeakdI18n.lang : 'en';
    const year = new Date().getFullYear();

    const win = window.open('', '_blank');
    if (!win) {
      alert(t('toast.popupBlocked') || 'Please allow popups to print the report.');
      return;
    }

    const catRows = Object.entries(sum.byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => {
        const localized = window.LeakdI18n ? window.LeakdI18n.t('cat.' + cat) : cat;
        return `<tr><td>${esc(localized || cat)}</td><td class="num">${esc(fmt(amount))}</td></tr>`;
      })
      .join('');

    const itemRows = rows.map(r => {
      const cycleLabel = t('cycle.' + (r.cycle === 'monthly' ? 'mo' : r.cycle === 'yearly' ? 'yr' : 'wk')).replace('/', '');
      const localCat = window.LeakdI18n ? window.LeakdI18n.t('cat.' + r.category) : r.category;
      const splitNote = r.sharedWith > 1 ? ` <span class="shared">(1/${r.sharedWith})</span>` : '';
      const vendorCell = r.vendorUrl ? `<a href="${esc(r.vendorUrl)}" rel="noopener">${esc(new URL(r.vendorUrl).hostname.replace(/^www\./, ''))}</a>` : '';
      return `
        <tr>
          <td><strong>${esc(r.name)}</strong>${splitNote}</td>
          <td>${esc(localCat || r.category)}</td>
          <td>${esc(cycleLabel)}</td>
          <td class="num">${esc(fmt(r.myMonthly, r.currency))}</td>
          <td class="num"><strong>${esc(fmt(r.myYearly, r.currency))}</strong></td>
          <td>${vendorCell}</td>
          <td>${esc(r.notes)}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
  <meta charset="utf-8">
  <title>Leakd — ${esc(t('tax.title'))} ${year}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; margin: 36px 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 26px 0 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
    .header { border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 24px; }
    .meta { font-size: 11px; color: #555; }
    .summary { display: flex; gap: 24px; margin: 20px 0 12px; }
    .summary-box { flex: 1; background: #f6f6f4; padding: 14px 16px; border-radius: 6px; }
    .summary-label { font-size: 10px; text-transform: uppercase; color: #777; font-weight: 700; margin-bottom: 6px; }
    .summary-val { font-size: 22px; font-weight: 700; color: #111; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 9px 10px; border-bottom: 1.5px solid #000; font-weight: 700; background: #fafaf9; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .shared { color: #b45309; font-size: 11px; }
    .disclaimer { margin-top: 24px; padding: 12px 14px; background: #fffbeb; border-left: 3px solid #d97706; font-size: 11px; color: #78350f; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 14px; }
    a { color: #1d4ed8; text-decoration: none; }
    @media print { body { margin: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${esc(t('tax.title'))} — ${year}</h1>
    <div class="meta">${esc(t('tax.generatedBy', { date: new Date().toLocaleDateString(lang) }))}</div>
  </div>

  <div class="summary">
    <div class="summary-box">
      <div class="summary-label">${esc(t('tax.ytd'))}</div>
      <div class="summary-val">${esc(fmt(sum.ytd))}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">${esc(t('tax.projectedYear'))}</div>
      <div class="summary-val">${esc(fmt(sum.totalYearly))}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">${esc(t('tax.itemCount'))}</div>
      <div class="summary-val">${sum.count}</div>
    </div>
  </div>

  <h2>${esc(t('tax.sectionByCategory'))}</h2>
  <table>
    <thead><tr><th>${esc(t('tax.colCategory'))}</th><th class="num">${esc(t('tax.colYearly'))}</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>

  <h2>${esc(t('tax.sectionItemised'))}</h2>
  <table>
    <thead>
      <tr>
        <th>${esc(t('tax.colService'))}</th>
        <th>${esc(t('tax.colCategory'))}</th>
        <th>${esc(t('tax.colBilling'))}</th>
        <th class="num">${esc(t('tax.colMonthly'))}</th>
        <th class="num">${esc(t('tax.colYearly'))}</th>
        <th>${esc(t('tax.colVendor'))}</th>
        <th>${esc(t('tax.colNotes'))}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="disclaimer">${esc(t('tax.disclaimer'))}</div>
  <div class="footer">${esc(t('tax.footer'))}</div>

  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  // ── CSV (accountant-friendly) ───────────────────────────────
  function generateCSV(subs) {
    if (window.LeakdPro && !window.LeakdPro.isPro()) {
      if (typeof openProModal === 'function') openProModal();
      return;
    }
    const rows = buildRows(subs);
    if (rows.length === 0) {
      alert(t('tax.empty'));
      return;
    }
    // Escape a single CSV cell — quote it and double any inner quotes
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const header = [
      'Service', 'Category', 'Billing Cycle', 'Currency',
      'Full Price', 'Shared With', 'My Price',
      'My Monthly', 'My Yearly',
      'Vendor URL', 'Notes', 'Sub ID', 'Created'
    ].map(q).join(',');
    // Legal disclaimer as a leading `#`-comment row. Most CSV importers
    // (Python csv with comment.char, PostgreSQL COPY, R read.csv) treat
    // lines starting with `#` as comments; Excel and Google Sheets render
    // it as a single cell in row 1 — still safe, still readable.
    const disclaimer = t('tax.disclaimer').replace(/[\r\n]+/g, ' ');
    const lines = [
      '# ' + disclaimer,
      header,
    ];
    for (const r of rows) {
      lines.push([
        r.name, r.category, r.cycle, r.currency,
        Number(r.price).toFixed(2),
        r.sharedWith,
        Number(r.myPrice).toFixed(2),
        Number(r.myMonthly).toFixed(2),
        Number(r.myYearly).toFixed(2),
        r.vendorUrl, r.notes, r.id, r.createdAt
      ].map(q).join(','));
    }
    // UTF-8 BOM so Excel opens accented chars correctly
    const csv = '﻿' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leakd-tax-report-${new Date().getFullYear()}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  // ── Public summary for the modal preview ────────────────────
  function preview(subs) {
    const rows = buildRows(subs);
    if (rows.length === 0) return { count: 0, ytd: 0, totalYearly: 0, totalMonthly: 0, byCategory: {} };
    return summarize(rows);
  }

  window.LeakdTaxReport = {
    generatePDF,
    generateCSV,
    preview,
    buildRows,
    summarize,
  };
})();
