const fs = require('fs');
const content = fs.readFileSync('js/i18n.js', 'utf8');

try {
    eval(content);
    console.log('File is valid JS');
} catch (e) {
    console.log('Error:', e.message);
    // Find the line
    const lines = content.split('\n');
    let partial = '';
    for (let i = 0; i < lines.length; i++) {
        partial += lines[i] + '\n';
        try {
            // We need to wrap it to be valid partial JS if it's in the middle of an object
            // But let's just check if the error changes
        } catch (e2) {}
    }
}
