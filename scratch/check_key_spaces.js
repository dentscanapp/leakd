const fs = require('fs');
const content = fs.readFileSync('js/i18n.js', 'utf8');
const keyRegex = /"([^"]+)"\s*:/g;
let match;
while ((match = keyRegex.exec(content)) !== null) {
    const key = match[1];
    if (key !== key.trim()) {
        console.log(`Key with spaces: [${key}]`);
    }
}
