const fs = require('fs');
const path = 'c:/Users/local_user/Documents/leakd/leakd/js/i18n.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /([a-z]{2}): {/g;
let match;
const found = [];
while ((match = regex.exec(content)) !== null) {
    found.push({ lang: match[1], index: match.index, line: content.substring(0, match.index).split('\n').length });
}

console.log(JSON.stringify(found, null, 2));
