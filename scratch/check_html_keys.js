const fs = require('fs');

// Keys extracted from index.html (partial list from previous grep)
const htmlKeys = [
    'header.notif', 'header.theme', 'header.menu', 'stats.monthly', 'stats.yearly',
    'stats.active', 'stats.dueSoon', 'streak.days', 'streak.msg', 'streak.btn',
    'search.placeholder', 'cat.all', 'empty.title', 'empty.sub', 'empty.paste',
    'empty.tryDemo', 'insights.ytd', 'insights.paidIn', 'filter.all', 'filter.business',
    'filter.personal', 'health.title', 'personality.title', 'bench.title',
    'insights.projection', 'insights.now', 'calendar.prev', 'calendar.next',
    'insights.lifetimeTitle', 'insights.byCategory', 'donut.title', 'insights.noData',
    'bundles.title', 'insights.suggestions', 'insights.noSubs', 'insights.lowestRated',
    'insights.lowestRatedSub', 'panic.button', 'panic.sub', 'insights.shareTitle',
    'insights.shareSub', 'insights.generate', 'modal.add', 'nav.home', 'nav.insights',
    'panic.title', 'panic.intro', 'btn.done', 'modal.orCustom', 'field.name',
    'field.namePh', 'field.price', 'field.cycle', 'cycle.monthly', 'cycle.yearly',
    'cycle.weekly', 'field.category', 'cat.Entertainment', 'cat.Work', 'cat.Music',
    'cat.Fitness', 'cat.Cloud', 'cat.Food', 'cat.News', 'cat.Other', 'cat.new',
    'field.nextDate', 'field.trial', 'field.trialEnd', 'field.shared', 'field.sharedPh',
    'field.sharedNote', 'field.paused', 'field.business', 'field.lastUsed',
    'btn.markUsed', 'field.rating', 'field.tags', 'field.tagsPh', 'field.tagsNote',
    'field.notes', 'field.notesPh', 'lifetime.paidSoFar', 'lifetime.next5y',
    'lifetime.next10y', 'lifetime.investTitle', 'lifetime.investNote', 'lifetime.invest5y',
    'lifetime.invest10y', 'lifetime.inflationTitle', 'lifetime.inflationNote',
    'lifetime.inflated10y', 'alt.title', 'playbook.title', 'btn.cancelSub',
    'btn.delete', 'btn.cancelMark', 'btn.cancel', 'btn.save', 'currency.choose',
    'lang.choose', 'notif.title', 'notif.blurb', 'notif.permission', 'notif.notSet',
    'notif.enable', 'notif.beforeRenewal', 'notif.daysOption.0', 'notif.daysOption.1',
    'notif.daysOption.2', 'notif.daysOption.3', 'notif.daysOption.5', 'notif.daysOption.7',
    'notif.beforeTrial', 'notif.deniedHint', 'notif.test', 'onb.skip', 'onb.allow',
    'menu.settings', 'menu.pro', 'menu.proSub', 'menu.cancelled', 'menu.cancelledSub',
    'menu.theme', 'menu.yearend', 'menu.yearendSub', 'menu.bank', 'menu.bankSub',
    'menu.goal', 'menu.goalSub', 'menu.import', 'menu.importSub', 'menu.export',
    'menu.exportSub', 'menu.pdf', 'menu.pdfSub', 'menu.calendar', 'menu.calendarSub',
    'menu.budgets', 'menu.budgetsSub', 'menu.backup', 'menu.backupSub', 'menu.language',
    'menu.privacy', 'menu.privacySub', 'menu.terms', 'menu.termsSub', 'menu.tour',
    'menu.tourSub', 'menu.whatif', 'menu.whatifSub'
];

const jsPath = 'js/i18n.js';
const content = fs.readFileSync(jsPath, 'utf8');
const enBlock = content.match(/\n  en: {([\s\S]*?)\n  }/)[1];
const enKeys = new Set();
const keyRegex = /"([^"]+)":/g;
let m;
while ((m = keyRegex.exec(enBlock)) !== null) enKeys.add(m[1]);

console.log('--- Missing keys in English (referenced in HTML) ---');
htmlKeys.forEach(k => {
    if (!enKeys.has(k)) console.log(`Missing: ${k}`);
});
