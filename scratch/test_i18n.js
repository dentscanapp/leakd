const LANGUAGES = {
    en: { name: 'English', flag: '🇬🇧' },
    hu: { name: 'Magyar', flag: '🇭🇺' }
};

const STRINGS = {
  en: {
    'time.dueIn': 'In {n}d',
    'streak.done': 'Stayed clean today! ✨',
    'time.inDays': 'in {n} days'
  },
  hu: {
    'time.dueIn': '{n} nap',
    'streak.done': 'Ma is tiszta! ✨',
    'time.inDays': '{n} nap múlva'
  }
};

const LeakdI18n = {
    LANGUAGES,
    STRINGS,
    FALLBACK: 'en',
    lang: 'hu',
    t: function(key, params = {}, lang = null) {
      const currentLang = lang || this.lang || this.FALLBACK;
      let str = (this.STRINGS[currentLang] && this.STRINGS[currentLang][key]) || (this.STRINGS[this.FALLBACK] && this.STRINGS[this.FALLBACK][key]) || key;
      Object.keys(params).forEach(p => {
        if (typeof str === 'string') {
          str = str.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
        }
      });
      return str;
    }
};

console.log("hu streak.done:", LeakdI18n.t('streak.done'));
console.log("hu time.dueIn (5):", LeakdI18n.t('time.dueIn', { n: 5 }));
console.log("hu time.inDays (3):", LeakdI18n.t('time.inDays', { n: 3 }));

LeakdI18n.lang = 'en';
console.log("en streak.done:", LeakdI18n.t('streak.done'));

LeakdI18n.lang = 'unknown';
console.log("unknown streak.done (fallback):", LeakdI18n.t('streak.done'));
