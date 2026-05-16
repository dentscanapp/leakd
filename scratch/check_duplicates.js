
const fs = require('fs');
const content = fs.readFileSync('js/i18n.js', 'utf8');
global.window = {};
eval(content);
const STRINGS = global.window.LeakdI18n.STRINGS;
const keys = Object.keys(STRINGS);
for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
        if (JSON.stringify(STRINGS[keys[i]]) === JSON.stringify(STRINGS[keys[j]])) {
            console.log(`DUPLICATE BLOCKS: ${keys[i]} and ${keys[j]}`);
        }
    }
}
console.log("Check complete.");
