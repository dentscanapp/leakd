const fs = require('fs');
const path = 'js/i18n.js';
const content = fs.readFileSync(path, 'utf8');
const stringsMatch = content.match(/const STRINGS = ({[\s\S]*?});/);
const languages = {};
const langRegex = /\n  ([a-z]{2}): {([\s\S]*?)\n  }/g;
let match;
while ((match = langRegex.exec(stringsMatch[1])) !== null) {
    const langCode = match[1];
    const keysContent = match[2];
    const keys = [];
    const keyRegex = /"([^"]+)":/g;
    let keyMatch;
    while ((keyMatch = keyRegex.exec(keysContent)) !== null) {
        keys.push(keyMatch[1]);
    }
    languages[langCode] = keys;
}
const enKeys = new Set(languages['en']);
const deKeys = languages['de'];
const extra = deKeys.filter(k => !enKeys.has(k));
console.log('Extra keys in DE (missing in EN):');
console.log(extra);
