const fs = require('fs');
const path = 'js/i18n.js';
let content = fs.readFileSync(path, 'utf8');
// Replace \\" with \" only when it looks like a syntax error (i.e. double backslash followed by quote)
// Actually, let's just replace all \\" with \" in the whole file if they are within strings.
// But a safer way is to target the specific lines.
const lines = content.split('\n');
const targets = [8235, 8731, 8817, 9018, 9227, 9313, 9514];
targets.forEach(lineNum => {
    const idx = lineNum - 1;
    if (lines[idx]) {
        console.log(`Fixing line ${lineNum}: ${lines[idx].trim()}`);
        lines[idx] = lines[idx].replace(/\\\\"/g, '\\"');
    }
});
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Done.');
