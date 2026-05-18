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
      // Revolut localizes its statement column headers per user country. We
      // match either the canonical English layout, the legacy layout, or
      // any localized "date + description + amount" triplet that contains
      // a Revolut-distinctive token. The substantive recognition happens
      // in `cols` below; the fingerprint just needs to be permissive
      // enough so this format wins over the generic fallback (which would
      // still work but show "Generic CSV" in the UI).
      fingerprint: /(Type,Product,Started Date|Date,Description,Paid Out|Date completed.*Description.*Amount|T[íi]pus.*Term[ée]k|Typ.*Produkt.*Startdatum|Tipo.*Producto.*Fecha|Tipo.*Prodotto.*Data inizio|Typ.*Produkt.*Data rozpocz|Tip.*Produs.*Data|Typ.*Produkt.*Po[čc][aá]te[čc]n[íi]|Type.*Produit.*Date|Tipo.*Produto.*Data|Type.*Product.*Begindatum|Soort.*Product.*Begindatum|タイプ.*プロダクト.*開始日|유형.*제품.*시작일|类型.*产品.*开始日期|Тип.*Продукт.*Дата начала|Tipe.*Produk.*Tanggal mulai|Loại.*Sản phẩm.*Ngày bắt đầu|Tür.*Ürün.*Başlama|Τύπος.*Προϊόν.*Ημερομηνία|प्रकार.*उत्पाद.*प्रारंभ|Тип.*Продукт.*Дата початку|Vrsta.*Proizvod.*Datum početka|Тип.*Продукт.*Начална|ประเภท.*ผลิตภัณฑ์.*วันที่เริ่ม|Uri.*Produkto.*Petsa|Tipus.*Producte.*Data d'inici|Dátum začatia|Slags.*Produkt.*Startdatum)/i,
      cols: {
        date: [
          // English
          'Started Date', 'Date completed (UTC)', 'Date',
          // Hungarian
          'Kezdés dátuma', 'Teljesítés dátuma', 'Dátum',
          // German
          'Startdatum', 'Abgeschlossen am', 'Datum',
          // Spanish
          'Fecha inicio', 'Fecha completado', 'Fecha',
          // French
          'Date de début', 'Date de fin', 'Date',
          // Italian
          'Data inizio', 'Data completamento', 'Data',
          // Portuguese
          'Data início', 'Data conclusão',
          // Dutch
          'Begindatum', 'Voltooidatum',
          // Polish
          'Data rozpoczęcia', 'Data zakończenia',
          // Swedish
          'Startdatum', 'Slutdatum', 'Datum',
          // Romanian
          'Data început', 'Data finalizare',
          // Czech / Slovak
          'Počáteční datum', 'Dátum začatia', 'Dátum dokončenia', 'Datum dokončení',
          // Japanese
          '開始日', '完了日', '日付',
          // Korean
          '시작일', '완료일', '날짜',
          // Chinese (Simplified)
          '开始日期', '完成日期', '日期',
          // Russian
          'Дата начала', 'Дата завершения', 'Дата',
          // Indonesian
          'Tanggal mulai', 'Tanggal selesai', 'Tanggal',
          // Vietnamese
          'Ngày bắt đầu', 'Ngày hoàn tất', 'Ngày',
          // Turkish
          'Başlama tarihi', 'Tamamlanma tarihi', 'Tarih',
          // Greek
          'Ημερομηνία έναρξης', 'Ημερομηνία ολοκλήρωσης', 'Ημερομηνία',
          // Hindi
          'प्रारंभ तिथि', 'पूर्ण तिथि', 'तिथि',
          // Ukrainian
          'Дата початку', 'Дата завершення',
          // Croatian
          'Datum početka', 'Datum završetka',
          // Bulgarian
          'Начална дата', 'Крайна дата',
          // Thai
          'วันที่เริ่มต้น', 'วันที่เสร็จสิ้น', 'วันที่',
          // Filipino
          'Petsa ng simula', 'Petsa ng pagkumpleto', 'Petsa',
          // Catalan
          "Data d'inici", 'Data de finalització', 'Data',
        ],
        desc: [
          'Description', 'Leírás', 'Beschreibung', 'Descripción', 'Descrizione',
          'Descrição', 'Omschrijving', 'Opis', 'Beskrivning', 'Descriere', 'Popis',
          // CJK
          '説明', '摘要', '内容', '설명', '描述', '说明',
          // Russian / Ukrainian / Bulgarian
          'Описание', 'Опис', 'Описание',
          // SE-Asian
          'Deskripsi', 'Mô tả', 'Açıklama',
          // Greek / Hindi
          'Περιγραφή', 'विवरण',
          // Thai / Filipino / Catalan
          'รายละเอียด', 'Paglalarawan', 'Descripció',
        ],
        amount: [
          'Amount', 'Paid Out (GBP)',
          'Összeg', 'Betrag', 'Importe', 'Montant', 'Importo', 'Valor',
          'Bedrag', 'Kwota', 'Belopp', 'Sumă', 'Suma', 'Částka',
          // CJK
          '金額', '金额', '금액',
          // Cyrillic
          'Сумма', 'Сума',
          // SE-Asian
          'Jumlah', 'Số tiền', 'Tutar',
          // Greek / Hindi
          'Ποσό', 'राशि',
          // Thai / Filipino / Catalan
          'จำนวนเงิน', 'Halaga', 'Import',
        ],
        currency: [
          'Currency', 'Pénznem', 'Währung', 'Divisa', 'Devise', 'Valuta',
          'Moeda', 'Waluta', 'Monedă', 'Měna', 'Mena',
          // CJK
          '通貨', '货币', '通货', '통화',
          // Cyrillic
          'Валюта',
          // SE-Asian
          'Mata uang', 'Tiền tệ', 'Para birimi',
          // Greek / Hindi
          'Νόμισμα', 'मुद्रा',
          // Thai / Filipino / Catalan
          'สกุลเงิน', 'Pera',
        ],
      },
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
      cols: {
        // Recognize date/desc/amount headers across the major European
        // banking-export languages. findColIndex() is case-insensitive and
        // does a substring fuzzy match, so partial matches work too.
        date: [
          'date', 'Date', 'DATE', 'transaction date',
          'dátum', 'datum', 'fecha', 'data',
          'kezdés', 'started', 'completed', 'teljesítés',
          'value date', 'booking date', 'posting date',
        ],
        desc: [
          'description', 'Description', 'merchant', 'name', 'payee',
          'leírás', 'beschreibung', 'descripción', 'descrizione', 'descrição',
          'omschrijving', 'opis', 'descriere', 'popis',
          'reference', 'memo', 'note', 'narration', 'details', 'subject',
        ],
        amount: [
          'amount', 'Amount', 'value', 'debit', 'credit',
          'összeg', 'betrag', 'importe', 'montant', 'importo', 'valor',
          'bedrag', 'kwota', 'sumă', 'suma', 'částka',
        ],
        currency: [
          'currency', 'Currency',
          'pénznem', 'währung', 'divisa', 'devise', 'valuta',
          'moeda', 'waluta', 'monedă', 'měna', 'mena',
        ],
      },
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
    // Try strict ISO YYYY-MM-DD first — reject month/day overflows
    // (`new Date('2026-02-30')` silently rolls over to Mar 2).
    const isoMatch = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      const yi = parseInt(y, 10), mi = parseInt(m, 10), di = parseInt(d, 10);
      if (yi >= 2000 && mi >= 1 && mi <= 12 && di >= 1 && di <= 31) {
        const dt = new Date(yi, mi - 1, di);
        if (dt.getFullYear() === yi && dt.getMonth() === mi - 1 && dt.getDate() === di) return dt;
      }
      return null;
    }
    const iso = new Date(raw);
    if (!isNaN(iso.getTime()) && iso.getFullYear() > 2000) return iso;
    // Try DD/MM/YYYY and MM/DD/YYYY and YYYY-MM-DD
    const m1 = raw.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (m1) {
      let [_, d, m, y] = m1;
      if (y.length === 2) y = '20' + y;
      // Heuristic: if first part > 12, it's DD/MM
      const day = parseInt(d, 10), mon = parseInt(m, 10), year = parseInt(y, 10);
      // Reject impossible combinations — JS Date silently overflows otherwise
      // ("2026-13-50" would otherwise become Jan 25, 2051).
      const valid = (a, b) => a >= 1 && a <= 31 && b >= 1 && b <= 12;
      let dt = null;
      let expDay = null, expMon = null; // what the round-trip should restore
      if (day > 12 && valid(day, mon)) {
        dt = new Date(year, mon - 1, day); expDay = day; expMon = mon - 1;
      } else if (mon > 12 && valid(mon, day)) {
        dt = new Date(year, day - 1, mon); expDay = mon; expMon = day - 1;
      } else if (valid(day, mon)) {
        dt = new Date(year, mon - 1, day); expDay = day; expMon = mon - 1; // default DD/MM (Europe)
      }
      if (!dt || isNaN(dt.getTime())) return null;
      // Round-trip check rejects e.g. 30/02 (which JS would auto-correct to Mar 2)
      if (dt.getDate() !== expDay || dt.getMonth() !== expMon) return null;
      return dt;
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
      const colName = header[amountIdx].toLowerCase();
      let isOutflow = amount < 0;
      if (amount > 0 && (colName.includes('paid out') || colName.includes('debit'))) {
        isOutflow = true;
      }
      if (!isOutflow) continue;
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
