const fs = require('fs');

try {
  let code = fs.readFileSync('js/i18n.js', 'utf8');

  // We want to delete these specific 9 keys from all language blocks.
  const keysToRemove = [
    'pro.activate',
    'pro.activatedOffline',
    'pro.confirmRemove',
    'pro.invalidKey',
    'pro.invalidServer',
    'pro.key',
    'pro.note',
    'pro.remove',
    'pro.yourKey'
  ];

  let totalRemoved = 0;

  keysToRemove.forEach(key => {
    // Matches: "pro.activate": "something",
    // We use a regex that handles the key and its value, including the comma and newline.
    // Be careful with escape characters in string.
    const regex = new RegExp(`\\s*"${key.replace('.', '\\.')}":\\s*"[^"]*",?\\r?\\n?`, 'g');
    
    // Also handle cases with single quotes or no trailing comma if they exist
    // Actually the standard in i18n.js is `"key": "value",\n`
    code = code.replace(regex, match => {
      totalRemoved++;
      return '';
    });
  });

  fs.writeFileSync('js/i18n.js', code, 'utf8');
  console.log(`Successfully removed ${totalRemoved} instances of legacy Gumroad keys.`);

} catch (e) {
  console.error('Error:', e);
}
