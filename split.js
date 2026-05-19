const fs = require('fs');
const path = require('path');

const i18nContent = fs.readFileSync(path.join(__dirname, 'js', 'i18n.js'), 'utf8');

// Extract the STRINGS object
const match = i18nContent.match(/const STRINGS = (\{[\s\S]*?\n\});\n\n\/\//);
if (!match) {
  console.error("Could not find STRINGS object");
  process.exit(1);
}

const stringsStr = match[1];

// Evaluate it to a JS object
let STRINGS;
try {
  STRINGS = eval('(' + stringsStr + ')');
} catch(e) {
  console.error("Eval error", e);
  process.exit(1);
}

const localesDir = path.join(__dirname, 'locales');
if (!fs.existsSync(localesDir)) {
  fs.mkdirSync(localesDir);
}

for (const lang in STRINGS) {
  const file = path.join(localesDir, lang + '.json');
  fs.writeFileSync(file, JSON.stringify(STRINGS[lang], null, 2));
  console.log('Saved ' + file);
}

console.log('Done!');
