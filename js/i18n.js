// Localization registry
// This file is the single source of truth for all UI strings.

const FALLBACK = 'en';

const LANGUAGES = {
  "en": {
    "name": "English",
    "flag": "🇬🇧",
  },
  "hu": {
    "name": "Magyar",
    "flag": "🇭🇺",
  },
  "de": {
    "name": "Deutsch",
    "flag": "🇩🇪",
  },
  "es": {
    "name": "Español",
    "flag": "🇪🇸",
  },
  "fr": {
    "name": "Français",
    "flag": "🇫🇷",
  },
  "it": {
    "name": "Italiano",
    "flag": "🇮🇹",
  },
  "pt": {
    "name": "Português",
    "flag": "🇵🇹",
  },
  "nl": {
    "name": "Nederlands",
    "flag": "🇳🇱",
  },
  "pl": {
    "name": "Polski",
    "flag": "🇵🇱",
  },
  "sv": {
    "name": "Svenska",
    "flag": "🇸🇪",
  },
  "cs": {
    "name": "Čeština",
    "flag": "🇨🇿",
  },
  "ja": {
    "name": "日本語",
    "flag": "🇯🇵",
  },
  "ko": {
    "name": "한국어",
    "flag": "🇰🇷",
  },
  "zh": {
    "name": "中文",
    "flag": "🇨🇳",
  },
  "ru": {
    "name": "Русский",
    "flag": "🇷🇺",
  },
  "ro": {
    "name": "Română",
    "flag": "🇷🇴",
  },
  "id": {
    "name": "Indonesia",
    "flag": "🇮🇩",
  },
  "vi": {
    "name": "Tiếng Việt",
    "flag": "🇻🇳",
  },
  "tr": {
    "name": "Türkçe",
    "flag": "🇹🇷",
  },
  "el": {
    "name": "Ελληνικά",
    "flag": "🇬🇷",
  },
  "hi": {
    "name": "हिन्दी",
    "flag": "🇮🇳",
  },
  "uk": {
    "name": "Українська",
    "flag": "🇺🇦",
  },
  "hr": {
    "name": "Hrvatski",
    "flag": "🇭🇷",
  },
  "bg": {
    "name": "Български",
    "flag": "🇧🇬",
  },
  "th": {
    "name": "ไทย",
    "flag": "🇹🇭",
  },
  "fil": {
    "name": "Filipino",
    "flag": "🇵🇭",
  },
  "ca": {
    "name": "Català",
    "flag": "🇦🇩",
  },
  "sk": {
    "name": "Slovenčina",
    "flag": "🇸🇰",
  }
};

const STRINGS = {};

// Export for browser
if (typeof window !== 'undefined') {
  const supported = Object.keys(LANGUAGES);
  window.LeakdI18n = {
    LANGUAGES,
    STRINGS,
    FALLBACK,
    SUPPORTED: supported,
    lang: FALLBACK,
    _listeners: [],
    init: async function() {
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
    },
    t: function(key, params = {}, lang = null) {
      const currentLang = lang || this.lang || this.FALLBACK;
      const langBlock = this.STRINGS[currentLang] || this.STRINGS[this.FALLBACK] || {};
      
      let str = langBlock[key] || (this.STRINGS[this.FALLBACK] && this.STRINGS[this.FALLBACK][key]) || key;
      Object.keys(params).forEach(p => {
        if (typeof str === 'string') {
          str = str.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
        }
      });
      return str;
    },
    setLang: async function(lang) {
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
    },
    onChange: function(cb) {
      this._listeners.push(cb);
    },
    translatePage: function() {
      const keys = ['data-i18n', 'data-i18n-html', 'data-i18n-placeholder', 'data-i18n-title'];
      keys.forEach(attr => {
        document.querySelectorAll(`[${attr}]`).forEach(el => {
          try {
            const key = el.getAttribute(attr);
            const val = this.t(key);
            if (attr === 'data-i18n') el.textContent = val;
            else if (attr === 'data-i18n-html') el.innerHTML = val;
            else if (attr === 'data-i18n-placeholder') el.placeholder = val;
            else if (attr === 'data-i18n-title') {
              // Set BOTH title (desktop tooltip) and aria-label (screen
              // readers + mobile), unless the element already has an
              // explicit aria-label.
              el.title = val;
              if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', val);
            }
          } catch (e) {
            console.error('i18n error on element', el, e);
          }
        });
      });
    }
  };
}
