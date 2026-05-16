const fs = require('fs');

try {
    const content = fs.readFileSync('js/i18n.js', 'utf8');
    // Remove the window/export logic to just get the object
    const start = content.indexOf('const STRINGS = {');
    const end = content.lastIndexOf('};');
    const objCode = content.substring(start, end + 2);
    
    // Evaluate it safely
    const sandbox = {};
    const fn = new Function('window', objCode + '; return STRINGS;');
    const strings = fn({});
    
    console.log('STRINGS object is valid.');
    console.log('hu block keys:', Object.keys(strings.hu).length);
    console.log('share.title in hu:', strings.hu['share.title']);
    console.log('share.note in hu:', strings.hu['share.note']);
    
    // Check for potential issues
    for (const lang in strings) {
        for (const key in strings[lang]) {
            if (typeof strings[lang][key] !== 'string') {
                console.error(`Invalid value for ${lang}.${key}:`, strings[lang][key]);
            }
        }
    }
} catch (e) {
    console.error('Validation failed:', e);
}
