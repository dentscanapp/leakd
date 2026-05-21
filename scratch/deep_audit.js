const fs = require('fs');
const path = require('path');

const jsDir = 'js';
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => path.join(jsDir, f));
jsFiles.push('sw.js', 'app.js'); // check root if needed, app.js is in js/

const html = fs.readFileSync('app.html', 'utf8');
// Extract all IDs from index.html
const idRegex = /\bid="([^"]+)"/g;
const validIds = new Set();
let match;
while ((match = idRegex.exec(html)) !== null) {
  validIds.add(match[1]);
}

const audit = {
  missingIds: [],
  innerHTML: [],
  implicitGlobals: [],
  unhandledPromises: [],
  suspiciousNaN: []
};

jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();

    // 1. Check for missing IDs accessed via $('id')
    const idCallRegex = /\$\(\s*['"]([^'"]+)['"]\s*\)/g;
    let idMatch;
    while ((idMatch = idCallRegex.exec(trimmed)) !== null) {
      const id = idMatch[1];
      if (!validIds.has(id)) {
        audit.missingIds.push({ file, line: lineNum, id });
      }
    }

    // 2. Check for missing IDs accessed via getElementById
    const gebiRegex = /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
    let gebiMatch;
    while ((gebiMatch = gebiRegex.exec(trimmed)) !== null) {
      const id = gebiMatch[1];
      if (!validIds.has(id)) {
        audit.missingIds.push({ file, line: lineNum, id });
      }
    }

    // 3. Check for innerHTML vulnerabilities
    if (trimmed.includes('innerHTML') && trimmed.includes('=')) {
      if (trimmed.includes('${') && !trimmed.includes('escHtml') && !trimmed.includes('trStep')) {
        audit.innerHTML.push({ file, line: lineNum, code: trimmed.substring(0, 80) });
      }
    }

    // 4. Suspicious NaN
    if (trimmed.includes('=== NaN') || trimmed.includes('== NaN') || trimmed.includes('!= NaN')) {
        audit.suspiciousNaN.push({ file, line: lineNum, code: trimmed.substring(0, 80) });
    }
  });
});

console.log('=== LEAKD DEEP AUDIT REPORT ===');

console.log('\n1. DOM Element References (missing IDs):');
if (audit.missingIds.length === 0) console.log('  ✅ All referenced IDs exist in app.html');
else {
  const uniqueIds = new Set(audit.missingIds.map(m => m.id));
  console.log(`  ❌ Found ${audit.missingIds.length} references to non-existent IDs:`, [...uniqueIds].join(', '));
  // audit.missingIds.forEach(m => console.log(`    - ${m.file}:${m.line} -> #${m.id}`));
}

console.log('\n2. XSS / innerHTML Risks (missing escHtml):');
if (audit.innerHTML.length === 0) console.log('  ✅ No obvious unescaped innerHTML injections');
else {
  console.log(`  ⚠️ Found ${audit.innerHTML.length} potentially unescaped innerHTML assignments:`);
  audit.innerHTML.forEach(m => console.log(`    - ${m.file}:${m.line} -> ${m.code}`));
}

console.log('\n3. JS Logic & Types:');
if (audit.suspiciousNaN.length === 0) console.log('  ✅ No suspicious NaN checks');
else {
    audit.suspiciousNaN.forEach(m => console.log(`    ❌ - ${m.file}:${m.line} -> ${m.code}`));
}

