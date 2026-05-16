// Comprehensive bug hunt across the Leakd codebase

const fs = require('fs');
const path = require('path');

const jsFiles = [
  'js/app.js', 'js/import.js', 'js/share.js', 'js/insights.js',
  'js/i18n.js', 'js/lifetime.js', 'js/notifications.js', 'js/budgets.js',
  'js/income.js', 'js/goals.js', 'js/activity.js', 'js/personality.js',
  'js/bankparse.js', 'js/compare.js', 'js/whatif.js', 'sw.js'
];

const bugs = [];

// 1. Check for common null/undefined patterns
jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const code = fs.readFileSync(file, 'utf8');
  const lines = code.split('\n');

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();

    // getElementById without null check used directly
    if (trimmed.match(/\$\('[^']+'\)\.\w+\s*=/) && !trimmed.includes('if') && !trimmed.includes('?')) {
      // Only flag if it's accessing a property that would crash if null
    }

    // NaN comparisons
    if (trimmed.includes('=== NaN') || trimmed.includes('!== NaN') || trimmed.includes('== NaN')) {
      bugs.push({ file, line: lineNum, severity: 'HIGH', msg: `NaN comparison should use isNaN(): "${trimmed.substring(0, 80)}"` });
    }

    // Undefined variable patterns
    if (trimmed.match(/\bparseFloat\(undefined\)/) || trimmed.match(/\bparseInt\(undefined\)/)) {
      bugs.push({ file, line: lineNum, severity: 'HIGH', msg: `Parsing undefined: "${trimmed.substring(0, 80)}"` });
    }

    // Console.log debug leftovers
    if (trimmed.startsWith('console.log') && !file.includes('scratch')) {
      bugs.push({ file, line: lineNum, severity: 'LOW', msg: `Debug log leftover: "${trimmed.substring(0, 80)}"` });
    }
  });
});

// 2. Check i18n keys used in app.js vs defined in i18n.js
const appCode = fs.readFileSync('js/app.js', 'utf8');
const tCalls = [...appCode.matchAll(/t\(['"]([^'"]+)['"]/g)].map(m => m[1]);
const i18nCode = fs.readFileSync('js/i18n.js', 'utf8');
const enBlock = i18nCode.match(/en:\s*\{([\s\S]*?)\n  \},/);
const definedKeys = enBlock ? [...enBlock[1].matchAll(/"([^"]+)":/g)].map(m => m[1]) : [];

const missingKeys = [];
tCalls.forEach(key => {
  if (!definedKeys.includes(key) && !key.includes('{') && !key.includes('cycle.') && !key.includes('cat.')) {
    // check if it's in i18n at all
    if (!i18nCode.includes(`"${key}":`)) {
      missingKeys.push(key);
    }
  }
});

// 3. Check for duplicate IDs in index.html
const html = fs.readFileSync('index.html', 'utf8');
const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const idCounts = {};
idMatches.forEach(id => { idCounts[id] = (idCounts[id] || 0) + 1; });
const dupIds = Object.entries(idCounts).filter(([, count]) => count > 1).map(([id]) => id);

// 4. Check sw.js syntax
try {
  const swCode = fs.readFileSync('sw.js', 'utf8');
  // Simple bracket balance check
  let depth = 0;
  for (const ch of swCode) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  if (depth !== 0) bugs.push({ file: 'sw.js', line: 0, severity: 'HIGH', msg: `Unbalanced braces in sw.js (depth: ${depth})` });
} catch(e) {}

// Report
console.log('=== BUG HUNT REPORT ===\n');
console.log(`Code bugs found: ${bugs.length}`);
bugs.forEach(b => console.log(`  [${b.severity}] ${b.file}:${b.line} — ${b.msg}`));

console.log(`\nMissing i18n keys (used in app.js but not in i18n.js): ${missingKeys.length}`);
if (missingKeys.length) missingKeys.forEach(k => console.log(`  MISSING: "${k}"`));

console.log(`\nDuplicate HTML IDs: ${dupIds.length}`);
if (dupIds.length) dupIds.forEach(id => console.log(`  DUPLICATE: #${id} (${idCounts[id]}x)`));

console.log('\n=== DONE ===');
