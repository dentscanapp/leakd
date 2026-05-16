const fs = require('fs');
const code = fs.readFileSync('js/app.js', 'utf8');
const i18n = fs.readFileSync('js/i18n.js', 'utf8');

// More precise t() call extraction
const regex = /\bt\(["']([\w.]+)["'](?:\s*[,)])/g;
const keys = [];
let m;
while ((m = regex.exec(code)) !== null) {
  keys.push(m[1]);
}
const unique = [...new Set(keys)];

const missing = unique.filter(key => !i18n.includes('"' + key + '":'));

console.log('Real missing keys in app.js:', missing.length);
missing.forEach(k => console.log(' -', k));

// Also check other JS files
const otherFiles = ['js/insights.js', 'js/lifetime.js', 'js/personality.js', 'js/budgets.js', 'js/income.js', 'js/goals.js'];
const allMissing = {};
otherFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const c = fs.readFileSync(file, 'utf8');
  const r = /\bt\(["']([\w.]+)["'](?:\s*[,)])/g;
  let mm;
  while ((mm = r.exec(c)) !== null) {
    const key = mm[1];
    if (!i18n.includes('"' + key + '":')) {
      if (!allMissing[key]) allMissing[key] = [];
      allMissing[key].push(file);
    }
  }
});

const otherMissingKeys = Object.keys(allMissing);
console.log('\nMissing keys in other files:', otherMissingKeys.length);
otherMissingKeys.forEach(k => console.log(' -', k, '(in', allMissing[k].join(', ') + ')'));
