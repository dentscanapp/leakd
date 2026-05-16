// Leakd — Bank statement smart parser
// The privacy-first answer to Rocket Money's "we read your bank" pitch.
// User uploads a CSV statement from Revolut/Wise/N26/PayPal/Chase/etc.,
// we parse it entirely in the browser, never upload anywhere, and detect
// recurring charges that look like subscriptions.
//
// Detection heuristic: a merchant with 2+ charges in 12 months at similar
// amounts (±15%) on roughly monthly/weekly/yearly intervals is a likely
// subscription. We surface these as suggestions; user confirms which to add.

(function () {
  'use strict';

  // Known CSV format profiles. Each has a fingerprint and column mapping.
  // Adding a new bank = a small entry here.
  const FORMATS = [
    {
      id: 'revolut',
      name: 'Revolut',
      fingerprint: /(Type,Product,Started Date|Date,Description,Paid Out|Date completed.*Description.*Amount)/i,
      cols: { date: ['Started Date', 'Date completed (UTC)', 'Date'], desc: ['Description'], amount: ['Amount', 'Paid Out (GBP)'], currency: ['Currency'] },
    },
    {
      id: 'wise',
      name: 'Wise (TransferWise)',
      fingerprint: /TransferWise|Wise ID|TW\d+/i,
      cols: { date: ['Date'], desc: ['Description', 'Payee Name', 'Merchant'], amount: ['Amount', 'Source amount'], currency: ['Source currency', 'Currency'] },
    },
    {
      id: 'n26',
      name: 'N26',
      fingerprint: /N26|"Booking Date","Value Date","Partner Name"/i,
      cols: { date: ['Booking Date', 'Value Date', 'Date'], desc: ['Partner Name', 'Payment Reference', 'Description'], amount: ['Amount (EUR)', 'Amount'], currency: [] },
    },
    {
      id: 'paypal',
      name: 'PayPal',
      // PayPal exports have a distinctive column trio: Time + Time Zone + Gross
      // (quoted or unquoted), or just contain the word "PayPal".
      fingerprint: /PayPal|"?Date"?,\s*"?Time"?,\s*"?Time Zone"?|"?Gross"?,\s*"?Fee"?,\s*"?Net"?/i,
      cols: { date: ['Date'], desc: ['Name', 'Item Title', 'Subject'], amount: ['Net', 'Gross', 'Amount'], currency: ['Currency'] },
    },
    {
      id: 'chase',
      name: 'Chase',
      fingerprint: /Chase|"Transaction Date","Post Date","Description","Category"/i,
      cols: { date: ['Transaction Date', 'Post Date'], desc: ['Description'], amount: ['Amount'], currency: [] },
    },
    {
      id: 'amex',
      name: 'American Express',
      fingerprint: /American Express|"Date","Description","Amount","Extended Details"/i,
      cols: { date: ['Date'], desc: ['Description'], amount: ['Amount'], currency: [] },
    },
    {
      id: 'generic',
      name: 'Generic CSV',
      fingerprint: /.*/, // fallback
      cols: { date: ['date', 'Date', 'DATE', 'transaction date'], desc: ['description', 'Description', 'merchant', 'name', 'payee'], amount: ['amount', 'Amount', 'value'], currency: ['currency', 'Currency'] },
    },
  ];

  function detectFormat(headerLine, sample) {
    const combined = headerLine + '\n' + sample;
    for (const fmt of FORMATS) {
      if (fmt.id === 'generic') continue;
      if (fmt.fingerprint.test(combined)) return fmt;
    }
    return FORMATS.find(f => f.id === 'generic');
  }

  // Split a CSV line respecting quoted fields
  function splitCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  function findColIndex(header, candidates) {
    for (const cand of candidates) {
      const idx = header.findIndex(h => h.toLowerCase() === cand.toLowerCase());
      if (idx !== -1) return idx;
    }
    // Fuzzy: try contains
    for (const cand of candidates) {
      const idx = header.findIndex(h => h.toLowerCase().includes(cand.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  // Normalize merchant name for grouping. Strips trailing dates/IDs/locations
  // so "NETFLIX*COM 23/05" and "NETFLIX*COM 24/06" merge into one merchant.
  function normalizeMerchant(raw) {
    let s = String(raw).trim();
    // Strip trailing dates dd/mm or dd.mm or dd-mm
    s = s.replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g, '');
    // Strip transaction IDs (long alphanumerics)
    s = s.replace(/\b[A-Z0-9]{8,}\b/g, '');
    // Strip city names in caps at the end (heuristic: 3+ caps letters at end)
    s = s.replace(/\s+[A-Z]{3,}\s*$/, '');
    // Strip common bank-junk prefixes
    s = s.replace(/^(POS\s+|VISA\s+|CARD\s+PURCHASE\s+|PAYPAL\s*\*?)/i, '');
    // Strip multiple spaces, asterisks, hashes
    s = s.replace(/[*#]/g, ' ').replace(/\s+/g, ' ').trim();
    // Uppercase first part as canonical form
    const parts = s.split(' ').slice(0, 3);
    return parts.join(' ').toUpperCase();
  }

  function parseAmount(raw) {
    if (raw == null) return 0;
    let s = String(raw).replace(/[\s ]/g, '');
    // Negative? (debit) — we want positive amounts of money leaving the account
    const neg = s.startsWith('-') || s.startsWith('(');
    s = s.replace(/^[-(]/, '').replace(/[)]$/, '');
    // Remove currency symbols
    s = s.replace(/[$€£¥₹₽₺₩]|HUF|USD|EUR|GBP|JPY|Ft|kr|zł|Kč/g, '');
    // Handle European comma decimal
    if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
    else if (s.match(/\.\d{3}/) && s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // 1.234,56 → 1234.56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, ''); // thousand separators
    }
    const n = parseFloat(s);
    return neg ? -n : (isNaN(n) ? 0 : n);
  }

  function parseDate(raw) {
    if (!raw) return null;
    // Try ISO first
    const iso = new Date(raw);
    if (!isNaN(iso.getTime()) && iso.getFullYear() > 2000) return iso;
    // Try DD/MM/YYYY and MM/DD/YYYY and YYYY-MM-DD
    const m1 = raw.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (m1) {
      let [_, d, m, y] = m1;
      if (y.length === 2) y = '20' + y;
      // Heuristic: if first part > 12, it's DD/MM
      const day = parseInt(d, 10), mon = parseInt(m, 10);
      let dt;
      if (day > 12) dt = new Date(parseInt(y, 10), mon - 1, day);
      else if (mon > 12) dt = new Date(parseInt(y, 10), day - 1, mon);
      else dt = new Date(parseInt(y, 10), mon - 1, day); // default DD/MM (Europe)
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  }

  // Main entry point
  function parseStatement(csvText) {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { format: null, transactions: [], suggestions: [] };

    // Find the header line — usually first, but PayPal etc. may have preamble
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].split(',').length >= 3 && /date/i.test(lines[i])) { headerIdx = i; break; }
    }
    const header = splitCsvLine(lines[headerIdx]).map(h => h.replace(/^"|"$/g, ''));
    const fmt = detectFormat(lines[headerIdx], lines.slice(headerIdx + 1, headerIdx + 3).join('\n'));

    const dateIdx = findColIndex(header, fmt.cols.date);
    const descIdx = findColIndex(header, fmt.cols.desc);
    const amountIdx = findColIndex(header, fmt.cols.amount);
    const currIdx = findColIndex(header, fmt.cols.currency);

    if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
      return { format: fmt, transactions: [], suggestions: [], error: 'missing-columns', columnsFound: { dateIdx, descIdx, amountIdx } };
    }

    const transactions = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i]);
      if (cells.length < 2) continue;
      const date = parseDate(cells[dateIdx]);
      const desc = cells[descIdx];
      const amount = parseAmount(cells[amountIdx]);
      const currency = currIdx !== -1 ? cells[currIdx] : null;
      if (!date || !desc || amount === 0) continue;
      // We only care about debits (money leaving)
      if (amount > 0) continue;
      transactions.push({
        date,
        merchant: normalizeMerchant(desc),
        rawDesc: desc,
        amount: Math.abs(amount),
        currency,
      });
    }

    // Group by merchant and detect recurring patterns
    const byMerchant = {};
    transactions.forEach(t => {
      if (!byMerchant[t.merchant]) byMerchant[t.merchant] = [];
      byMerchant[t.merchant].push(t);
    });

    const suggestions = [];
    Object.entries(byMerchant).forEach(([merchant, txns]) => {
      if (txns.length < 2) return; // need at least 2 to detect recurrence
      txns.sort((a, b) => a.date - b.date);
      // Are amounts roughly the same? (within ±15% of median)
      const amounts = txns.map(t => t.amount).sort((a, b) => a - b);
      const median = amounts[Math.floor(amounts.length / 2)];
      const close = amounts.filter(a => Math.abs(a - median) / median <= 0.15);
      if (close.length < 2) return;
      const avgAmount = close.reduce((s, a) => s + a, 0) / close.length;

      // What's the interval?
      const intervals = [];
      for (let i = 1; i < txns.length; i++) {
        intervals.push((txns[i].date - txns[i - 1].date) / 86400000);
      }
      const medianInterval = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];

      let cycle = null;
      if (medianInterval >= 25 && medianInterval <= 35) cycle = 'monthly';
      else if (medianInterval >= 5 && medianInterval <= 9) cycle = 'weekly';
      else if (medianInterval >= 355 && medianInterval <= 375) cycle = 'yearly';
      else if (medianInterval >= 80 && medianInterval <= 100) cycle = 'monthly'; // quarterly-ish, treat as monthly avg

      if (!cycle) return;

      // Try to match against known service catalogue for a nicer display name
      let displayName = merchant;
      let category = 'Other';
      if (window.LeakdImport && window.LeakdImport.KNOWN) {
        const match = window.LeakdImport.KNOWN.find(k => k.match.test(merchant) || k.match.test(txns[0].rawDesc));
        if (match) { displayName = match.name; category = match.cat; }
      }

      suggestions.push({
        merchant,
        displayName,
        category,
        price: parseFloat(avgAmount.toFixed(2)),
        cycle,
        currency: txns[0].currency,
        occurrences: txns.length,
        firstSeen: txns[0].date,
        lastSeen: txns[txns.length - 1].date,
        confidence: close.length / txns.length, // how consistent the amounts are
      });
    });

    suggestions.sort((a, b) => b.confidence * b.occurrences - a.confidence * a.occurrences);
    return { format: fmt, transactions, suggestions };
  }

  window.LeakdBankParse = { parseStatement, FORMATS, normalizeMerchant, parseAmount, parseDate };
})();
