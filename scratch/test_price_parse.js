// Test the PRICE_RE regex against Hungarian formats

const PRICE_RE = /(\$|€|£|¥|₹|R\$|A\$|Ft|zł|kr|Kč|lei|₺|Rp|฿)?\s*([0-9][0-9\s.,]*[0-9])\s*(\$|€|£|¥|₹|R\$|A\$|Ft|zł|kr|Kč|lei|₺|Rp|฿)?/;

const testCases = [
  'Netflix 4 990 Ft',
  'Spotify 1.200,50',
  'Disney 2500',
  '1.200,50',
  '4 990 Ft',
  'Adobe 59.99',
  'Notion 10,00',
];

function parsePrice(line) {
  const m = line.match(PRICE_RE);
  if (!m) return null;
  let raw = m[2].trim();
  raw = raw.replace(/\s/g, '');
  if (raw.includes('.') && raw.includes(',')) {
    if (raw.lastIndexOf('.') > raw.lastIndexOf(',')) {
      raw = raw.replace(/,/g, '');
    } else {
      raw = raw.replace(/\./g, '').replace(',', '.');
    }
  } else if (raw.includes(',')) {
    if (raw.match(/,[0-9]{1,2}$/)) raw = raw.replace(',', '.');
    else raw = raw.replace(/,/g, '');
  } else if (raw.includes('.')) {
    if (raw.match(/\.[0-9]{3}$/)) raw = raw.replace(/\./g, '');
    else if (raw.match(/\.[0-9]{1,2}$/)) { /* keep dot */ }
    else raw = raw.replace(/\./g, '');
  }
  return { raw: m[2], cleaned: raw, parsed: parseFloat(raw), sym: m[1] || m[3] };
}

testCases.forEach(tc => {
  const r = parsePrice(tc);
  console.log(`"${tc}" => raw="${r ? r.raw : 'NO MATCH'}" cleaned="${r ? r.cleaned : ''}" parsed=${r ? r.parsed : 'N/A'}`);
});
