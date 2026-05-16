const fs = require('fs');
const path = 'js/i18n.js';
let content = fs.readFileSync(path, 'utf8');

const lines = content.split('\n');
let fixedCount = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    // Match key-value pairs that end with a quote but no comma.
    // Handles escaped quotes inside the value.
    if (line.match(/^\s*"[^"]+"\s*:\s*"([^"\\]|\\.)*"$/)) {
        lines[i] = line + ',';
        fixedCount++;
    }
}
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log(`Fixed ${fixedCount} lines.`);
