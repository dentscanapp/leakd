const fs = require('fs');
const path = 'js/i18n.js';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
const targets = [8235, 8731, 8817, 9018, 9227, 9313, 9514];
targets.forEach(lineNum => {
    const idx = lineNum - 1;
    if (lines[idx]) {
        let line = lines[idx].trimEnd();
        if (!line.endsWith(',')) {
            console.log(`Adding comma to line ${lineNum}`);
            lines[idx] = line + ',';
        }
    }
});
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Done.');
