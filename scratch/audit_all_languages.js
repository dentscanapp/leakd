const fs = require('fs');
const path = require('path');

try {
  const STRINGS = {};
  const localesDir = 'locales';
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
  files.forEach(file => {
    const lang = path.basename(file, '.json');
    STRINGS[lang] = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
  });

  const languages = Object.keys(STRINGS);
  const baseKeys = Object.keys(STRINGS['en']).sort();
  
  console.log(`=== I18N AUDIT ===`);
  console.log(`Total languages: ${languages.length}`);
  console.log(`Base (en) keys: ${baseKeys.length}\n`);

  let hasErrors = false;

  languages.forEach(lang => {
    if (lang === 'en') return;
    
    const targetKeys = Object.keys(STRINGS[lang]);
    const missing = baseKeys.filter(k => !targetKeys.includes(k));
    const extra = targetKeys.filter(k => !baseKeys.includes(k));

    if (missing.length > 0 || extra.length > 0) {
      hasErrors = true;
      console.log(`\n❌ [${lang}] has issues:`);
      if (missing.length > 0) {
        console.log(`  - Missing ${missing.length} keys:`);
        missing.forEach(k => console.log(`    "${k}"`));
      }
      if (extra.length > 0) {
        console.log(`  - Extra ${extra.length} keys:`);
        extra.forEach(k => console.log(`    "${k}"`));
      }
    }

    // Check placeholders {name}, {amount}, etc.
    targetKeys.forEach(k => {
      const baseStr = STRINGS['en'][k];
      const targetStr = STRINGS[lang][k];
      
      if (typeof baseStr === 'string' && typeof targetStr === 'string') {
        const basePlaceholders = (baseStr.match(/\{[^\}]+\}/g) || []).sort();
        const targetPlaceholders = (targetStr.match(/\{[^\}]+\}/g) || []).sort();
        
        if (basePlaceholders.join(',') !== targetPlaceholders.join(',')) {
          hasErrors = true;
          console.log(`  ⚠️ [${lang}] Placeholder mismatch in "${k}":`);
          console.log(`      EN: ${baseStr}`);
          console.log(`      ${lang.toUpperCase()}: ${targetStr}`);
        }
      }
    });
  });

  if (!hasErrors) {
    console.log(`✅ All ${languages.length} languages are perfectly synced with ${baseKeys.length} keys and match all placeholders!`);
  }

} catch (e) {
  console.error('Error parsing or auditing i18n:', e);
}
