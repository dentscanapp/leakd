const fs = require('fs');
const content = fs.readFileSync('js/i18n.js', 'utf8');

// Simple eval-like parsing to check the object
try {
    // We can't easily eval the whole file because of window etc.
    // But we can extract the STRINGS object.
    const match = content.match(/const STRINGS = (\{[\s\S]*?\});/);
    if (!match) throw new Error('STRINGS not found');
    
    // We need to define it in a way we can access
    const STRINGS = eval('(' + match[1] + ')');
    
    console.log('Languages in STRINGS:', Object.keys(STRINGS));
    
    const lang = 'hu';
    const keysToCheck = ['cat.all', 'cat.Work', 'time.dueIn', 'forecast.title'];
    
    keysToCheck.forEach(k => {
        const huVal = STRINGS[lang] ? STRINGS[lang][k] : 'LANG_MISSING';
        const enVal = STRINGS['en'] ? STRINGS['en'][k] : 'EN_MISSING';
        console.log(`Key: ${k} | hu: [${huVal}] | en: [${enVal}]`);
    });

} catch (e) {
    console.error('Error parsing STRINGS:', e);
}
