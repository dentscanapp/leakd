
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('js/i18n.js', 'utf8');
// This is a bit hacky because it's not a module, but let's try to extract STRINGS
const stringsMatch = content.match(/const STRINGS = ({[\s\S]+?});/);
if (!stringsMatch) {
    console.error("Could not find STRINGS in i18n.js");
    process.exit(1);
}

// We need to evaluate the object. Since it's a static file, we can try to JSON.parse it if it's clean,
// but it has unquoted keys and single quotes. 
// A better way is to wrap it in a function and return it.
const stringsStr = stringsMatch[1];
let STRINGS;
try {
    STRINGS = eval(`(${stringsStr})`);
} catch (e) {
    console.error("Failed to eval STRINGS:", e);
    process.exit(1);
}

const enKeys = Object.keys(STRINGS.en);
const huKeys = Object.keys(STRINGS.hu || {});

const missingInHu = enKeys.filter(k => !huKeys.includes(k));
const extraInHu = huKeys.filter(k => !enKeys.includes(k));

console.log(`English keys: ${enKeys.length}`);
console.log(`Hungarian keys: ${huKeys.length}`);

if (missingInHu.length > 0) {
    console.log(`\nMissing in Hungarian (${missingInHu.length}):`);
    missingInHu.forEach(k => console.log(` - ${k}`));
} else {
    console.log("\nNo missing keys in Hungarian.");
}

if (extraInHu.length > 0) {
    console.log(`\nExtra keys in Hungarian (${extraInHu.length}):`);
    extraInHu.forEach(k => console.log(` + ${k}`));
}
