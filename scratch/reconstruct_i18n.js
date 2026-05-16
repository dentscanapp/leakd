const fs = require('fs');
const path = 'js/i18n.js';
let content = fs.readFileSync(path, 'utf8');

console.log("Original content length:", content.length);

const LANGUAGES = {
    en: { name: 'English', flag: '🇬🇧' },
    hu: { name: 'Magyar', flag: '🇭🇺' },
    de: { name: 'Deutsch', flag: '🇩🇪' },
    es: { name: 'Español', flag: '🇪🇸' },
    fr: { name: 'Français', flag: '🇫🇷' },
    it: { name: 'Italiano', flag: '🇮🇹' },
    pt: { name: 'Português', flag: '🇵🇹' },
    nl: { name: 'Nederlands', flag: '🇳🇱' },
    pl: { name: 'Polski', flag: '🇵🇱' },
    sv: { name: 'Svenska', flag: '🇸🇪' },
    cs: { name: 'Čeština', flag: '🇨🇿' },
    ja: { name: '日本語', flag: '🇯🇵' },
    ko: { name: '한국어', flag: '🇰🇷' },
    zh: { name: '中文', flag: '🇨🇳' },
    ru: { name: 'Русский', flag: '🇷🇺' },
    ro: { name: 'Română', flag: '🇷🇴' },
    id: { name: 'Indonesia', flag: '🇮🇩' },
    vi: { name: 'Tiếng Việt', flag: '🇻🇳' },
    tr: { name: 'Türkçe', flag: '🇹🇷' },
    el: { name: 'Ελληνικά', flag: '🇬🇷' },
    hi: { name: 'हिन्दी', flag: '🇮🇳' },
    uk: { name: 'Українська', flag: '🇺🇦' },
    hr: { name: 'Hrvatski', flag: '🇭🇷' },
    bg: { name: 'Български', flag: '🇧🇬' },
    th: { name: 'ไทย', flag: '🇹🇭' },
    fil: { name: 'Filipino', flag: '🇵🇭' },
    ca: { name: 'Català', flag: '🇦🇩' },
    sk: { name: 'Slovenčina', flag: '🇸🇰' }
};

// 1. Reconstruct the header
let newContent = `// Localization registry
// This file is the single source of truth for all UI strings.

const FALLBACK = 'en';

const LANGUAGES = ${JSON.stringify(LANGUAGES, null, 2)};

const STRINGS = {
`;

// 2. Extract and clean each language block
const langKeys = Object.keys(LANGUAGES);
for (const lang of langKeys) {
    console.log(`Processing ${lang}...`);
    
    // We need to find the REAL block in STRINGS.
    // Since the file is corrupted, there might be multiple occurrences.
    // We'll look for the one that seems most like a string block.
    
    let bestBlock = "";
    let bestCount = -1;
    
    // Find all occurrences of "lang: {"
    const regex = new RegExp(`\\b${lang}:\\s*\\{`, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
        let startIdx = match.index;
        let braceCount = 0;
        let foundStart = false;
        let endIdx = -1;
        for (let i = startIdx; i < content.length; i++) {
            if (content[i] === '{') {
                braceCount++;
                foundStart = true;
            } else if (content[i] === '}') {
                braceCount--;
                if (foundStart && braceCount === 0) {
                    endIdx = i;
                    break;
                }
            }
        }
        
        if (endIdx !== -1) {
            let blockContent = content.substring(startIdx, endIdx + 1);
            // Count how many valid-looking keys are in here
            const pairCount = (blockContent.match(/['"][^'"]+['"]\s*:\s*['"]/g) || []).length;
            if (pairCount > bestCount) {
                bestCount = pairCount;
                bestBlock = blockContent;
            }
        }
    }
    
    if (bestBlock) {
        const pairs = [];
        // Extract key-value pairs
        // Handle escaped quotes
        const pairRegex = /['"]([^'"]+)['"]\s*:\s*(['"])([\s\S]*?)(?<!\\)\2/g;
        let pMatch;
        const seenKeys = new Set();
        while ((pMatch = pairRegex.exec(bestBlock)) !== null) {
            const key = pMatch[1];
            let value = pMatch[3];
            
            // CLEANUP LOGIC for specific languages
            
            // 1. Purge non-English keys from 'en' block
            if (lang === 'en') {
                // If the value looks like it's from another language (e.g. contains special chars)
                // or if it's one of the known "injected" keys like goal.nameLabel, etc.
                // But for now, we'll just keep everything that was in the FIRST 'en' block found.
                // Actually, let's just keep the keys that ARE in the English language.
            }
            
            // 2. Remove Polish from Hungarian
            if (lang === 'hu' && (value.includes('Dziennik') || value.includes('subskrypcji'))) {
                continue; 
            }
            
            // 3. Remove Vietnamese from Indonesian
            if (lang === 'id' && (value.includes(' và ') || value.includes('văn bản'))) {
                continue;
            }

            if (!seenKeys.has(key)) {
                pairs.push(`      '${key}': '${value.replace(/'/g, "\\'")}'`);
                seenKeys.add(key);
            }
        }
        
        newContent += `  ${lang}: {\n${pairs.join(',\n')}\n  }${lang === 'sk' ? '' : ','}\n`;
    } else {
        console.warn(`Could not find any block for ${lang}`);
        newContent += `  ${lang}: {},\n`;
    }
}

newContent += `};

// Export for browser
if (typeof window !== 'undefined') {
  window.i18n = {
    LANGUAGES,
    STRINGS,
    FALLBACK,
    t: (key, params = {}, lang = null) => {
      const currentLang = lang || window.currentLang || FALLBACK;
      let str = (STRINGS[currentLang] && STRINGS[currentLang][key]) || (STRINGS[FALLBACK] && STRINGS[FALLBACK][key]) || key;
      Object.keys(params).forEach(p => {
        if (typeof str === 'string') {
          str = str.replace(new RegExp(\`\\\\{\${p}\\\\}\`, 'g'), params[p]);
        }
      });
      return str;
    }
  };
}
`;

fs.writeFileSync(path, newContent, 'utf8');
console.log("Reconstruction complete.");
