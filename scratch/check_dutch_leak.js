const fs = require('fs');
const path = 'js/i18n.js';
const content = fs.readFileSync(path, 'utf8');
const stringsMatch = content.match(/const STRINGS = ({[\s\S]*?});/);
const langRegex = /\n  ([a-z]{2}): {([\s\S]*?)\n  }/g;
let match;
const dutchSamples = [
    'Geen bundelbesparingen beschikbaar',
    'Verlengingskalender',
    'Opgezegde abonnementen'
];
while ((match = langRegex.exec(stringsMatch[1])) !== null) {
    const lang = match[1];
    const body = match[2];
    dutchSamples.forEach(s => {
        if (body.includes(s)) {
            console.log(`Language ${lang} contains Dutch string: "${s}"`);
        }
    });
}
