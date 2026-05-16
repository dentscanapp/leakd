
const fs = require('fs');
const content = fs.readFileSync('js/i18n.js', 'utf8');

global.window = {};
global.localStorage = { getItem: () => 'hu', setItem: () => {} };
global.document = { documentElement: { lang: '' }, querySelectorAll: () => [] };

eval(content);

const I = global.window.LeakdI18n;
console.log("Supported:", I.SUPPORTED);
console.log("Strings keys:", Object.keys(I.STRINGS));
console.log("HU nav.home:", I.STRINGS['hu']['nav.home']);
console.log("ES nav.home:", I.STRINGS['es']['nav.home']);
console.log("I.lang:", I.lang);
I.init();
console.log("I.lang after init:", I.lang);
console.log("I.t('nav.home'):", I.t('nav.home'));
