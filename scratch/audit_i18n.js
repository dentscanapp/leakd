const fs = require('fs');
const path = 'js/i18n.js';
const content = fs.readFileSync(path, 'utf8');

// Use a regex to extract the STRINGS object content
const stringsMatch = content.match(/const STRINGS = ({[\s\S]*?});/);
if (!stringsMatch) {
    console.error('Could not find STRINGS object');
    process.exit(1);
}

// Since STRINGS is a JS object literal, we can try to evaluate it carefully
// or just parse it manually for keys.
// Manual parsing is safer for our needs.
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

const langCodes = Object.keys(languages);
if (langCodes.length === 0) {
    console.error('No languages found');
    process.exit(1);
}

// Find all unique keys across all languages
const allKeys = new Set();
langCodes.forEach(lang => languages[lang].forEach(key => allKeys.add(key)));

console.log(`Audit Summary:`);
console.log(`- Total Languages: ${langCodes.length}`);
console.log(`- Total Unique Keys: ${allKeys.size}`);

// Check for missing keys in each language compared to English ('en')
const enKeys = new Set(languages['en'] || []);
const results = {};

langCodes.forEach(lang => {
    const missing = [...enKeys].filter(key => !languages[lang].includes(key));
    const extra = languages[lang].filter(key => !enKeys.has(key));
    results[lang] = { missing, extra };
});

console.log('\nConsistency Check (against English):');
langCodes.forEach(lang => {
    if (lang === 'en') return;
    const { missing, extra } = results[lang];
    if (missing.length === 0 && extra.length === 0) {
        console.log(`- ${lang}: PERFECT`);
    } else {
        console.log(`- ${lang}: ${missing.length} missing, ${extra.length} extra`);
        if (missing.length > 0 && missing.length < 10) {
            console.log(`  Missing: ${missing.join(', ')}`);
        }
    }
});

// Check for Dutch strings in Greek block (sample check)
const elBlock = stringsMatch[1].match(/\n  el: {([\s\S]*?)\n  }/);
if (elBlock) {
    const samples = [
        'Geen bundelbesparingen beschikbaar',
        'Verlengingskalender',
        'Opgezegde abonnementen'
    ];
    let dutchCount = 0;
    samples.forEach(s => {
        if (elBlock[1].includes(s)) dutchCount++;
    });
    if (dutchCount > 0) {
        console.log(`\nCritical Finding: Greek (el) block contains Dutch strings! (${dutchCount} samples found)`);
    }
}
