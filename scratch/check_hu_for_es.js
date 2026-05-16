
const fs = require('fs');
const content = fs.readFileSync('js/i18n.js', 'utf8');
const huMatch = content.match(/hu: {([\s\S]*?)\n  },/);
if (huMatch) {
    const huText = huMatch[1];
    const spanishWords = ['Inicio', 'Análisis', 'Gasto', 'mensual', 'Total', 'anual'];
    spanishWords.forEach(word => {
        if (huText.includes(word)) {
            console.log(`FOUND SPANISH WORD "${word}" IN HUNGARIAN BLOCK!`);
        }
    });
} else {
    console.log("Could not find hu block");
}
