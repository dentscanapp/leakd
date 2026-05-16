const fs = require('fs');
const path = 'c:/Users/local_user/Documents/leakd/leakd/js/i18n.js';
let content = fs.readFileSync(path, 'utf8');

const cleanHeader = `// Localization registry
// This file is the single source of truth for all UI strings.
// To add a new language: 
// 1. Add it to LANGUAGES
// 2. Add a new block in STRINGS
// 3. Fallback to 'en' if a key is missing.

const LANGUAGES = {
  en: { name: 'English', flag: '🇺🇸' },
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
  ca: { name: 'Català', flag: '🇪🇸' }, // Catalan flag is often shown as Spanish or Senyera
  sk: { name: 'Slovenčina', flag: '🇸🇰' },
};

// ── Strings ──
const STRINGS = {`;

// Find where STRINGS = { starts
const stringsStart = content.indexOf('const STRINGS = {');
// We want to keep everything from "en: {" onwards
const enStart = content.indexOf('en: {', stringsStart);

if (enStart !== -1) {
    content = cleanHeader + '\n    ' + content.substring(enStart);
    fs.writeFileSync(path, content, 'utf8');
    console.log('File header and LANGUAGES object fixed!');
} else {
    console.error('Could not find en: { block!');
}
