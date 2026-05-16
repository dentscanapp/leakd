
const fs = require('fs');
const content = fs.readFileSync('js/i18n.js', 'utf8');

// Mock window and localStorage
global.window = {};
global.localStorage = {
    getItem: () => 'hu',
    setItem: () => {}
};
global.document = {
    documentElement: { lang: '' },
    querySelectorAll: () => []
};

// Evaluate i18n.js
eval(content);

const I = global.window.LeakdI18n;
I.init();
I.setLang('hu');
console.log("Current lang:", I.lang);
console.log("Translation for 'nav.home':", I.t('nav.home'));
console.log("Translation for 'stats.monthly':", I.t('stats.monthly'));
console.log("Hungarian block exists:", !!I.STRINGS['hu']);
console.log("Spanish block exists:", !!I.STRINGS['es']);
console.log("Value for 'nav.home' in 'hu' block:", I.STRINGS['hu']['nav.home']);
