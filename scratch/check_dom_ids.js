const fs = require('fs');

// Extract all IDs from index.html
const htmlContent = fs.readFileSync('index.html', 'utf8');
const idRegex = /id="([^"]+)"/g;
const htmlIds = new Set();
let m;
while ((m = idRegex.exec(htmlContent)) !== null) htmlIds.add(m[1]);

// Files to check
const jsFiles = fs.readdirSync('js').filter(f => f.endsWith('.js'));
const missingIds = [];

jsFiles.forEach(file => {
    const content = fs.readFileSync(`js/${file}`, 'utf8');
    // Look for document.getElementById('...') or $('...')
    const getElRegex = /(\$|document\.getElementById)\(['"]([^'"]+)['"]\)/g;
    while ((m = getElRegex.exec(content)) !== null) {
        const id = m[2];
        if (!htmlIds.has(id)) {
            missingIds.push({ file, id });
        }
    }
});

console.log('--- Missing DOM IDs referenced in JS ---');
if (missingIds.length === 0) {
    console.log('None found.');
} else {
    missingIds.forEach(({ file, id }) => {
        console.log(`File: ${file}, ID: ${id}`);
    });
}
