const fs = require('fs');
const lines = fs.readFileSync('js/i18n.js', 'utf8').split('\n');
const line = lines[8234]; // 0-indexed
console.log('Line 8235:', JSON.stringify(line));
console.log('Length:', line.length);
for (let i = 0; i < line.length; i++) {
    console.log(i, line[i], line.charCodeAt(i).toString(16));
}
