const fs = require('fs');
const path = require('path');

const i18nPath = path.join(__dirname, 'js', 'i18n.js');
let content = fs.readFileSync(i18nPath, 'utf8');

// 1. Remove the STRINGS object
content = content.replace(/const STRINGS = \{[\s\S]*?\n\};\n\n/, 'const STRINGS = {};\n\n');

// 2. Replace init function and add loadLang
content = content.replace(
  /init: function\(\) \{[\s\S]*?this\.translatePage\(\);\n    \},/,
  `init: async function() {
      let lang = localStorage.getItem('leakd_lang');
      if (!lang && window.LeakdLocale && typeof window.LeakdLocale.detectLanguage === 'function') {
        const detected = window.LeakdLocale.detectLanguage(this.SUPPORTED);
        if (detected) {
          lang = detected;
          localStorage.setItem('leakd_lang', lang);
        }
      }
      this.lang = lang || this.FALLBACK;
      document.documentElement.lang = this.lang;
      await this.loadLang(this.lang);
      if (this.lang !== this.FALLBACK) {
        await this.loadLang(this.FALLBACK);
      }
      this.translatePage();
    },
    loadLang: async function(lang) {
      if (!this.STRINGS[lang]) {
        try {
          const res = await fetch('locales/' + lang + '.json?v=1');
          if (res.ok) {
            this.STRINGS[lang] = await res.json();
          }
        } catch (e) { console.error('Failed to load lang', lang, e); }
      }
    },`
);

// 3. Replace setLang function
content = content.replace(
  /setLang: function\(lang\) \{[\s\S]*?\}\n    \},/,
  `setLang: async function(lang) {
      if (this.LANGUAGES[lang]) {
        this.lang = lang;
        localStorage.setItem('leakd_lang', lang);
        document.documentElement.lang = lang;
        await this.loadLang(lang);
        this.translatePage();
        [...this._listeners].forEach(cb => {
          try { cb(lang); } catch (e) { console.error('LeakdI18n listener failed', e); }
        });
      }
    },`
);

fs.writeFileSync(i18nPath, content);
console.log('i18n.js updated!');
