
const fs = require('fs');
const content = fs.readFileSync('js/i18n.js', 'utf8');
const lines = content.split('\n');
let inHu = false;
for (let line of lines) {
    if (line.includes('hu: {')) inHu = true;
    if (inHu && line.includes('},')) {
        // Only stop if it's the end of the hu block
        // This is a bit loose but let's see
        if (line.trim() === '},') inHu = false;
    }
    if (inHu) {
        if (line.includes('Inicio') || line.includes('Gasto mensual')) {
            console.log("Found Spanish in line:", line);
        }
    }
}
console.log("Check complete.");
