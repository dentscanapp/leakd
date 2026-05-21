const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('app.html', 'utf8');

// Check Duplicate IDs
const idRegex = /\bid="([^"]+)"/g;
const ids = [];
let match;
while ((match = idRegex.exec(html)) !== null) {
  ids.push(match[1]);
}
const seen = new Set();
const duplicates = new Set();
ids.forEach(id => {
  if (seen.has(id)) duplicates.add(id);
  seen.add(id);
});

// Basic JS Syntax check
const jsDir = 'js';
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => path.join(jsDir, f));
jsFiles.push('sw.js', 'app.js');
let syntaxErrors = [];
jsFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  try {
    // A quick way to check syntax in node:
    require('vm').createScript(content, file);
  } catch (e) {
    syntaxErrors.push({ file, error: e.message });
  }
});

// Check I18N for duplicate values in the same language
const STRINGS = {};
const localesDir = 'locales';
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
files.forEach(file => {
  const lang = path.basename(file, '.json');
  STRINGS[lang] = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
});

let duplicateTranslations = [];
for (const lang of Object.keys(STRINGS)) {
  const dict = STRINGS[lang];
  const seenVals = new Map(); // value -> key
  for (const [key, val] of Object.entries(dict)) {
    // Ignore very short strings like "OK", "Cancel", and dates
    if (typeof val === 'string' && val.length > 10 && !val.includes('{')) {
      if (seenVals.has(val)) {
        duplicateTranslations.push(`[${lang}] "${val}" is used for both "${seenVals.get(val)}" and "${key}"`);
      } else {
        seenVals.set(val, key);
      }
    }
  }
}

console.log('--- AUDIT RESULTS ---');
console.log('1. Duplicate HTML IDs:');
if (duplicates.size === 0) console.log('✅ No duplicate IDs in app.html');
else console.log('❌ Duplicates found:', [...duplicates]);

console.log('\n2. JS Syntax Errors:');
if (syntaxErrors.length === 0) console.log('✅ No syntax errors in JS files');
else syntaxErrors.forEach(e => console.log(`❌ ${e.file}: ${e.error}`));

console.log('\n3. Exact duplicate translations (Suspicious copy-pastes >10 chars):');
if (duplicateTranslations.length === 0) console.log('✅ No obvious duplicate translation strings');
else {
  console.log(`⚠️ Found ${duplicateTranslations.length} duplicate translation values:`);
  duplicateTranslations.slice(0, 10).forEach(d => console.log('  - ' + d));
  if (duplicateTranslations.length > 10) console.log('  ... and more.');
}

