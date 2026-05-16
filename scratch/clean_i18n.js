const fs = require('fs');
const path = 'js/i18n.js';
let content = fs.readFileSync(path, 'utf8');

// Fix double commas
content = content.replace(/",,/g, '",');

// Fix missing commas (very carefully)
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    // If line looks like a key-value pair and doesn't end with , or { or [ or } or ] or ;
    if (line.match(/"[^"]+"\s*:\s*"[^"]*"$/)) {
        lines[i] = line + ',';
    }
}
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed.');
