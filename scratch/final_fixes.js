const fs = require('fs');
const path = 'c:/Users/local_user/Documents/leakd/leakd/js/i18n.js';
let content = fs.readFileSync(path, 'utf8');

// Fix Indonesian specific "va" typos (that are not Vietnamese)
const idStart = content.indexOf('id: {');
const idEnd = content.indexOf('},    vi:', idStart);
if (idStart !== -1 && idEnd !== -1) {
    let idBlock = content.substring(idStart, idEnd);
    idBlock = idBlock.replace(/ va /g, ' dan ');
    idBlock = idBlock.replace(/ va,/g, ' dan,');
    idBlock = idBlock.replace(/ và /g, ' dan ');
    content = content.substring(0, idStart) + idBlock + content.substring(idEnd);
}

// Ensure French has the apostrophe
const frStart = content.indexOf('fr: {');
const frEnd = content.indexOf('},    it:', frStart);
if (frStart !== -1 && frEnd !== -1) {
    let frBlock = content.substring(frStart, frEnd);
    frBlock = frBlock.replace(/'Conditions d utilisation'/g, "'Conditions d\\'utilisation'");
    content = content.substring(0, frStart) + frBlock + content.substring(frEnd);
}

// Final check on Hungarian
const huStart = content.indexOf('hu: {');
const huEnd = content.indexOf('},    de:', huStart);
if (huStart !== -1 && huEnd !== -1) {
    let huBlock = content.substring(huStart, huEnd);
    huBlock = huBlock.replace(/'badge\.zombie': 'Zombi',\s*'badge\.zombie': 'Zombi',/g, "'badge.zombie': 'Zombi',");
    content = content.substring(0, huStart) + huBlock + content.substring(huEnd);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Final targeted fixes applied!');
