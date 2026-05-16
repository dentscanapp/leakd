const fs = require('fs');
const path = 'c:/Users/local_user/Documents/leakd/leakd/js/i18n.js';
let content = fs.readFileSync(path, 'utf8');

const idStart = content.indexOf('id: {');
const idEnd = content.indexOf('},', idStart);

if (idStart !== -1 && idEnd !== -1) {
    let idBlock = content.substring(idStart, idEnd);
    idBlock = idBlock.replace(/\s+và\s+/g, ' dan ');
    idBlock = idBlock.replace(/\s+va\s+/g, ' dan ');
    
    content = content.substring(0, idStart) + idBlock + content.substring(idEnd);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Indonesian block "và" issues fixed!');
}
