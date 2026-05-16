const fs = require('fs');
const path = 'js/i18n.js';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split(/\r?\n/);
const targets = [8235, 8731, 8817, 9018, 9227, 9313, 9514];
targets.forEach(lineNum => {
    const idx = lineNum - 1;
    if (lines[idx]) {
        console.log(`Checking line ${lineNum}: [${lines[idx]}]`);
        if (!lines[idx].trim().endsWith(',')) {
            console.log(`FIXING line ${lineNum}`);
            lines[idx] = lines[idx].trimEnd() + ',';
        }
    }
});
fs.writeFileSync(path, lines.join('\n'), 'utf8');
