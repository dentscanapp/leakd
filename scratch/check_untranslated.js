const fs = require('fs');
const path = 'js/i18n.js';
const content = fs.readFileSync(path, 'utf8');
const stringsMatch = content.match(/const STRINGS = ({[\s\S]*?});/);
const langRegex = /\n  ([a-z]{2}): {([\s\S]*?)\n  }/g;
let match;
const enString = 'No activity yet. Add a subscription to start your journey.';
while ((match = langRegex.exec(stringsMatch[1])) !== null) {
    const lang = match[1];
    if (lang === 'en') continue;
    const body = match[2];
    if (body.includes(enString)) {
        console.log(`Language ${lang} has untranslated string: "${enString}"`);
    }
}
