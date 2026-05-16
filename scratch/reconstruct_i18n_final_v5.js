const fs = require('fs');
const path = 'js/i18n.js';

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

const HU_STRINGS = {
  'app.tagline': 'Hol szivárog a pénzed?',
  'header.notif': 'Értesítések',
  'header.theme': 'Téma váltása',
  'header.menu': 'Menü',
  'stats.monthly': 'Havi költés',
  'stats.yearly': 'Éves összeg',
  'stats.active': 'Aktív előfizetések',
  'stats.dueSoon': '7 napon belül',
  'nav.home': 'Kezdőlap',
  'nav.insights': 'Elemzés',
  'modal.add': 'Új előfizetés',
  'modal.edit': 'Előfizetés szerkesztése',
  'modal.orCustom': 'vagy adj hozzá egyedit',
  'field.name': 'Név',
  'field.namePh': 'pl. Netflix, edzőterem, Notion...',
  'field.price': 'Ár',
  'field.cycle': 'Fizetési ciklus',
  'field.category': 'Kategória',
  'field.nextDate': 'Következő fizetés',
  'field.trial': 'Ez egy próbaidőszak',
  'field.trialEnd': 'A próbaidőszak vége',
  'field.business': 'Ez egy céges költség',
  'field.lastUsed': 'Utoljára használva',
  'field.paused': 'Szüneteltetve (nem számít bele a végösszegbe)',
  'field.notes': 'Megjegyzések',
  'field.notesPh': 'Mit érdemes megjegyezni erről az előfizetésről?',
  'field.tags': 'Címkék',
  'field.tagsPh': 'munka, család, tervezett, …',
  'field.tagsNote': 'Szabadon megadható címkék. Vesszővel válaszd el őket.',
  'field.rating': 'Megérte?',
  'field.ratingPh': 'Koppints a csillagokra',
  'field.shared': 'Megosztva',
  'field.sharedPh': '1',
  'field.sharedNote': 'A teljes költség marad — csak a te részedet is mutatjuk',
  'filter.all': 'Összes',
  'filter.business': 'Céges',
  'filter.personal': 'Magán',
  'btn.markUsed': 'Ma használtam',
  'btn.cancel': 'Mégse',
  'btn.save': 'Mentés',
  'btn.delete': 'Törlés',
  'btn.done': 'Kész',
  'btn.next': 'Tovább',
  'btn.cancelSub': 'Előfizetés lemondása',
  'btn.cancelMark': 'Megjelölés lemondottként',
  'btn.deleteForever': 'Végleges törlés',
  'confirm.deleteSub': 'Törlöd ezt az előfizetést?',
  'confirm.markCancelled': 'Megjelölöd lemondottként? A lemondott listára kerül és nem számít a totalba.',
  'currency.choose': 'Válassz pénznemet',
  'cycle.monthly': 'Havi',
  'cycle.yearly': 'Éves',
  'cycle.weekly': 'Heti',
  'cycle.mo': '/hó',
  'cycle.yr': '/év',
  'cycle.wk': '/hét',
  'notif.title': 'Értesítések',
  'notif.blurb': 'Időben szólunk, mielőtt egy előfizetés megújul vagy egy próbaidő lejár. Minden a te eszközödön fut — nincs fiók, nincs szerver.',
  'notif.permission': 'Böngésző engedély',
  'notif.allowed': 'Engedélyezett',
  'notif.blocked': 'Letiltva (változtasd meg a böngésző beállításaiban)',
  'notif.notSet': 'Nincs beállítva',
  'notif.unsupported': 'Nem támogatott ebben a böngészőben',
  'notif.enable': 'Értesítések bekapcsolása',
  'notif.beforeRenewal': 'Emlékeztetés a megújulás előtt',
  'notif.beforeTrial': 'Emlékeztetés a próbaidő lejárta előtt',
  'notif.daysOption.0': 'Aznap',
  'notif.daysOption.1': '1 nappal előtte',
  'notif.daysOption.2': '2 nappal előtte',
  'notif.daysOption.3': '3 nappal előtte',
  'notif.daysOption.5': '5 nappal előtte',
  'notif.daysOption.7': '1 héttel előtte',
  'notif.test': 'Teszt küldése',
  'notif.deniedHint': 'A böngésződ letiltotta az értesítéseket erről az oldalról. Nyisd meg az oldal beállításait (lakat ikon a címsorban), engedélyezd az értesítéseket, és gyere vissza.',
  'notif.testTitle': 'A Leakd értesítések bekapcsolva',
  'notif.testBody': 'Időben szólunk, mielőtt az előfizetéseid megújulnak.',
  'notif.on': 'Értesítések bekapcsolva',
  'notif.off': 'Értesítések kikapcsolva',
  'insights.ytd': 'EBBEN AZ ÉVBEN EDDIG',
  'insights.paidIn': 'fizettél ki',
  'insights.projection': '12 hónapos előrejelzés',
  'insights.now': 'Most',
  'insights.byCategory': 'Kategóriánként',
  'insights.suggestions': 'Okos javaslatok',
  'insights.noData': 'Még nincs adat',
  'insights.noSubs': 'Adj hozzá előfizetéseket a javaslatokhoz',
  'insights.clean': 'Tisztának tűnik — nincs nyilvánvaló szivárgás 🎉',
  'insights.shareTitle': 'Oszd meg a szivárgásod',
  'insights.shareSub': 'Készíts megosztható képet Twitterre, IG-re vagy Redditre',
  'insights.generate': 'Generálás',
  'insights.lowestRated': 'Legkevésbé értékelt előfizetések',
  'insights.lowestRatedSub': 'Könnyű lemondási jelöltek',
  'insights.lifetimeTitle': 'Összes élettartam-költés',
  'panic.button': 'PÁNIKGOMB',
  'panic.sub': 'A költésed elszállt. Ideje elzárni a csapot.',
  'panic.title': 'Pánik mód: Aktív',
  'panic.intro': 'Ezek az előfizetések kerülnek a legtöbbe a legkevesebb érték mellett. Mondd le őket most!',
  'sug.dup.title': '{count} átfedő {cat} előfizetés',
  'sug.dup.body': '{names} mind nálad fut. Ha csak egyet tartanál meg, akár <strong>{savings}/év</strong> spórolhatnál.',
  'sug.yearly.title': 'Válts éves számlázásra: {name}',
  'sug.yearly.body': 'A legtöbb szolgáltatás ~15–20% kedvezményt ad éves fizetéssel. Spórolhatnál <strong>~{savings}/év</strong>.',
  'sug.expensive.title': '{name} a legnagyobb szivárgásod',
  'sug.expensive.body': '<strong>{monthly}/hó</strong> = {yearly}/év. Mikor használtad utoljára?',
  'sug.trial.title': '{name} próbaidőszaka lejár ekkor: {when}',
  'sug.trial.body': 'Automatikusan megújul: <strong>{price}</strong>. Most mondd le, ha nem kell.',
  'sug.old.title': 'A(z) {name} már 6+ hónapja a listán van',
  'sug.old.body': 'Még mindig aktívan használod? Eddig <strong>{paid}</strong>-t fizettél érte.',
  'sug.zombie.title': 'A(z) {name} egy zombi',
  'sug.zombie.body': 'Több mint 30 napja nem használtad. Mondd le és spórolj <strong>{monthly}/hó</strong>-t.',
  'time.today': 'ma',
  'time.tomorrow': 'holnap',
  'time.inDays': '{n} nap múlva',
  'time.dueToday': 'Ma esedékes',
  'time.dueTomorrow': 'Holnap',
  'time.dueIn': '{n} nap',
  'time.trialEnds': 'Próbaidő vége: {when}',
  'menu.settings': 'Beállítások',
  'menu.pro': 'Pro vásárlása',
  'menu.proSub': 'E-mail értesítések, szinkron, éves jelentés',
  'menu.proOn': 'Pro felhasználó vagy',
  'menu.proOnSub': 'Licenc kezelése',
  'menu.import': 'Tömeges import',
  'menu.importSub': 'Lista beillesztése vagy CSV feltöltés',
  'menu.export': 'CSV export',
  'menu.exportSub': 'Töltsd le az összes adatod',
  'menu.calendar': 'Naptár export',
  'menu.calendarSub': 'Megújulási dátumok .ics fájlban',
  'menu.yearend': 'Éves összegzés',
  'menu.yearendSub': 'Nézd meg az éves költésed',
  'menu.currency': 'Pénznem',
  'menu.language': 'Nyelv',
  'menu.share': 'Oszd meg: leakd.app',
  'menu.shareSub': 'Segíts növekedni',
  'menu.reset': 'Minden adat törlése',
  'menu.resetSub': 'Töröld és kezdd újra',
  'menu.footer': 'leakd v1.2 · indie pénztárcáknak',
  'menu.backup': 'Mentés és visszaállítás',
  'menu.backupSub': 'Adatok fájlba mentése vagy visszaállítása',
  'menu.budgets': 'Kategória költségvetés',
  'menu.budgetsSub': 'Havi limit beállítása kategóriánként',
  'menu.income': 'Jövedelem & arány',
  'menu.incomeSub': 'Nézd meg, hogy a jövedelmed hány %-a megy előfizetésekre',
  'menu.cancelled': 'Lemondott előfizetések',
  'menu.cancelledSub': 'Lásd mit nyírtál ki és mennyit spóroltál',
  'menu.theme': 'Téma',
  'menu.themeSub': 'Világos, sötét vagy rendszerkövetés',
  'menu.privacy': 'Adatvédelem',
  'menu.privacySub': 'Olvasd el mit tárolunk (spoiler: semmit)',
  'menu.terms': 'Felhasználási feltételek',
  'menu.termsSub': 'Az unalmas apróbetűs rész',
  'menu.bank': 'Bankkivonat import',
  'menu.bankSub': 'Előfizetések automatikus felismerése Revolut, Wise, stb. CSV-ből',
  'menu.goal': 'Spórolási cél',
  'menu.goalSub': 'Állíts be célt — minden mérföldkövet megünneplünk',
  'menu.tour': 'Mutasd újra a túrát',
  'menu.tourSub': 'Játszd újra az első használati túrát',
  'menu.activity': 'Aktivitásnapló',
  'menu.activitySub': 'Minden végrehajtott módosítás megtekintése',
  'menu.whatif': '„Mi lenne, ha” kalkulátor',
  'menu.whatifSub': 'Válassz lemondható előfizetéseket – lásd a megtakarítást élőben',
  'menu.compare': 'Összehasonlítás',
  'menu.compareSub': 'Válassz 2 vagy 3 szolgáltatást',
  'menu.pdf': 'PDF jelentés (Pro)',
  'menu.pdfSub': 'Nyomtatható összegzés a könyvelőnek',
  'activity.title': 'Aktivitásnapló',
  'activity.empty': 'Még nincs aktivitás. Adj hozzá egy előfizetést a kezdéshez.',
  'activity.added': '{name} hozzáadva',
  'activity.edited': '{name} szerkesztve',
  'activity.cancelled': '{name} lemondva',
  'activity.paused': '{name} szüneteltetve',
  'activity.resumed': '{name} folytatva',
  'activity.restored': '{name} visszaállítva',
  'activity.deleted': '{name} törölve',
  'activity.imported': '{n} előfizetés importálva',
  'personality.title': 'Előfizetési személyiséged',
  'personality.quietCutter': 'A Csendes Lemondó',
  'personality.quietCutterTag': 'Több előfizetést is lemondtál idén – csendes győzelem',
  'personality.bundleMaster': 'Csomagmester',
  'personality.bundleMasterTag': 'Tudod, hogyan halmozd a megtakarításokat',
  'personality.streamingJunkie': 'Streamingfüggő',
  'personality.streamingJunkieTag': '3 vagy több szórakoztató előfizetés – imádod a sorozataidat',
  'personality.aiHoarder': 'AI Gyűjtögető',
  'personality.aiHoarderTag': 'Gyorsabban gyűjtöd az AI eszközöket, mint ahogy frissítenék őket',
  'personality.productivityStack': 'Produktivitási Stack',
  'personality.productivityStackTag': '5 vagy több munkaeszköz – igazi power user energia',
  'personality.musicSnob': 'Zenei Sznob',
  'personality.musicSnobTag': 'Több zenei szolgáltatás – vájtfülű hallgatóság',
  'personality.spiraler': 'Előfizetési Spirál',
  'personality.spiralerTag': '10 vagy több aktív előfizetés. Talán itt az ideje egy auditnak?',
  'personality.minimalist': 'Egészséges Minimalista',
  'personality.minimalistTag': 'Kevés előfizetés, mind magasra értékelve. Inspiráló.',
  'personality.forgotten': 'A Felejtős',
  'personality.forgottenTag': 'Vannak egy évnél régebbi előfizetéseid, amiket sosem értékelsz',
  'personality.starting': 'Csak Most Kezdjük',
  'personality.startingTag': 'Üdvözlünk – minden szivárgás egyetlen cseppel kezdődik',
  'bench.title': 'Hogyan állsz a többiekhez képest',
  'bench.expected': 'Átlag {count} előfizetésre: {expected}',
  'bench.percentile': 'A nyomkövetők felső {pct}%-ában vagy',
  'bench.lower': 'átlag alatti',
  'bench.average': 'átlagos',
  'bench.higher': 'átlag feletti',
  'bench.muchHigher': 'jóval átlag feletti',
  'whatif.title': '„Mi lenne, ha” kalkulátor',
  'whatif.blurb': 'Koppints az előfizetésekre, hogy lemondottként jelöld meg őket ebben a szimulációban. Megmutatjuk, mennyit spórolnál a valódi adatok módosítása nélkül.',
  'whatif.empty': 'Nincsenek szimulálható aktív előfizetések.',
  'whatif.suggestBtn': 'Legjobb javaslatok',
  'whatif.clearBtn': 'Összes törlése',
  'whatif.summarySelected': '{n} kiválasztva',
  'whatif.summarySavings': '{monthly}/hó · {yearly}/év',
  'whatif.investedNote': '7%-os hozammal befektetve: {y5} 5 év múlva, {y10} 10 év múlva',
  'home.notesLabel': 'Jegyzetek',
  'streak.days': 'napos sorozat',
  'streak.msg': 'Ellenálltál ma egy új előfizetésnek?',
  'streak.btn': 'Tiszta maradtam!',
  'streak.done': 'Ma is tiszta! ✨',
  'streak.msgDone': 'Szép munka! Holnap találkozunk.',
  'toast.streakUpdated': 'Sorozat frissítve! 🔥',
  'toast.exported': '{n} előfizetés exportálva',
  'toast.nothing': 'Nincs mit exportálni',
  'toast.linkCopied': 'Link másolva',
  'toast.incomeSaved': 'Jövedelem mentve',
  'toast.budgetSaved': 'Költségvetés mentve',
  'toast.budgetCleared': 'Költségvetés törölve',
  'toast.goalSaved': 'Cél beállítva',
  'toast.goalCleared': 'Cél törölve',
  'toast.subCancelled': 'Előfizetés lemondva',
  'toast.subRestored': 'Előfizetés visszaállítva',
  'home.tagFilter': 'Szűrés címke szerint',
  'home.allTags': 'Összes címke',
  'lifetime.inflationTitle': 'Ha az árak tovább emelkednek',
  'lifetime.inflationNote': 'A legtöbbe szolgáltatás évi 3-7%-kal drágul. 5%-kal számolunk – ez tipikus a SaaS szektorban.',
  'lifetime.inflated10y': '10 év +5%/év emelkedéssel',
  'lifetime.title': 'Élettartam-költség',
  'lifetime.paidSoFar': 'Eddig fizetett',
  'lifetime.since': '{date} óta',
  'lifetime.next5y': 'Következő 5 év',
  'lifetime.next10y': 'Következő 10 év',
  'lifetime.investTitle': 'Ha helyette befektettél volna',
  'lifetime.investNote': '7% éves hozammal (S&P 500 hosszú távú átlag)',
  'lifetime.invest5y': '5 év befektetés',
  'lifetime.invest10y': '10 év befektetés',
  'compare.title': 'Összehasonlítás',
  'compare.blurb': 'Válassz 2 vagy 3 szolgáltatást. Egymás mellé tesszük őket, hogy lásd, melyiket érdemes megtartani.',
  'compare.pickPrompt': 'Koppints legfeljebb 3 előfizetés kiválasztásához',
  'compare.minPrompt': 'Válassz legalább 2 előfizetést az összehasonlításhoz',
  'compare.monthly': 'Havi',
  'compare.yearly': 'Éves',
  'compare.lifetime': 'Eddig kifizetve',
  'compare.rating': 'Értékelés',
  'compare.cancelDiff': 'Lemondás nehézsége',
  'compare.alternatives': 'Alternatívák',
  'compare.notRated': '— nincs értékelve',
  'compare.diff.easy': 'Könnyű',
  'compare.diff.medium': 'Közepes',
  'compare.diff.hard': 'Nehéz',
  'compare.diff.unknown': 'Ismeretlen',
  'compare.altCountN': '{n} opció',
  'compare.minutesAbbr': '{n} perc',
  'forecast.title': 'Következő {n} nap',
  'forecast.total': '{total} · {count} megújulás',
  'forecast.none': 'Nincsenek közelgő megújulások. Lélegezz mélyet.',
  'cat.all': 'Összes',
  'cat.Entertainment': 'Szórakozás',
  'cat.Work': 'Munka',
  'cat.Music': 'Zene',
  'cat.Fitness': 'Fitnesz',
  'cat.Cloud': 'Felhő',
  'cat.Food': 'Étel',
  'cat.News': 'Hírek',
  'cat.Other': 'Egyéb',
  'cat.new': '+ Új kategória (Pro)',
  'goal.title': 'Spórolási cél',
  'goal.nameLabel': 'Mire spórolsz?',
  'goal.estimate': 'Mondj le {count} rossz értékelésű subot, hogy spórolj <strong>{savings}/hó</strong>-t és elérd a célod <strong>{months} hónap</strong> alatt!',
  'goal.progressShort': 'Haladás: {saved} ({pct}%)',
  'goal.blurb': 'Mennyit szeretnél spórolni idén előfizetés-lemondással? Követjük a győzelmeid.',
  'goal.label': 'Cél összege',
  'goal.placeholder': '500',
  'goal.progress': 'Eddig: {saved} / {target}',
  'goal.remaining': 'Még {amount}',
  'goal.complete': '🎉 Elérted a célt!',
  'goal.empty': 'Állíts be célt a követéshez.',
  'goal.milestone': '🎉 A cél {pct}%-ánál! Hajrá!',
  'goal.clear': 'Cél törlése',
  'badge.paused': 'Szüneteltetve',
  'badge.zombie': 'Zombi',
  'search.placeholder': 'Előfizetés keresése…',
  'search.noResults': 'Nincs találat',
  'empty.title': 'Még nincs előfizetésed',
  'empty.sub': 'Koppints a + gombra vagy ragassz be egy listát',
  'empty.paste': 'Lista beillesztése',
  'empty.tryDemo': 'Próbáld példa adatokkal',
  'theme.light': 'Világos',
  'theme.dark': 'Sötét',
  'theme.auto': 'Auto (rendszer)',
};

function run() {
    const execSync = require('child_process').execSync;
    execSync('git restore js/i18n.js');
    let content = fs.readFileSync(path, 'utf8');

    const enBlockMatch = content.match(/en:\s*\{([\s\S]*?)\n  \},/);
    const EN_STRINGS = {};
    if (enBlockMatch) {
        const pairRegex = /['"]([^'"]+)['"]\s*:\s*(['"])([\s\S]*?)(?<!\\)\2/g;
        let p;
        while ((p = pairRegex.exec(enBlockMatch[1])) !== null) {
            EN_STRINGS[p[1]] = p[3].replace(/\\\\/g, '\\');
        }
    }

    let newContent = `// Localization registry
// This file is the single source of truth for all UI strings.

const FALLBACK = 'en';

const LANGUAGES = ${JSON.stringify(LANGUAGES, null, 2)};

const STRINGS = {
`;

    const allLangs = Object.keys(LANGUAGES);
    allLangs.forEach((lang, idx) => {
        const isLast = idx === allLangs.length - 1;
        let block = {};
        
        if (lang === 'en') {
            block = EN_STRINGS;
        } else if (lang === 'hu') {
            block = HU_STRINGS;
        } else {
            const regex = new RegExp(`${lang}:\\s*\\{([\\s\\S]*?)\\n  \\},`);
            const match = content.match(regex);
            if (match) {
                const pairRegex = /['"]([^'"]+)['"]\s*:\s*(['"])([\s\S]*?)(?<!\\)\2/g;
                let p;
                while ((p = pairRegex.exec(match[1])) !== null) {
                    if (lang !== 'pl' && (p[3].includes('Dziennik') || p[3].includes('subskrypcji'))) continue;
                    block[p[1]] = p[3].replace(/\\\\/g, '\\');
                }
            }
        }

        const finalPairs = [];
        const allKeys = Array.from(new Set([...Object.keys(EN_STRINGS), ...Object.keys(block)]));
        allKeys.sort().forEach(k => {
            const val = block[k] || EN_STRINGS[k] || k;
            finalPairs.push(`    ${JSON.stringify(k)}: ${JSON.stringify(val)}`);
        });

        newContent += `  ${lang}: {\n${finalPairs.join(',\n')}\n  }${isLast ? '' : ','}\n`;
    });

    newContent += `};

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
    init: function() {
      this.lang = localStorage.getItem('leakd_lang') || this.FALLBACK;
      document.documentElement.lang = this.lang;
      this.translatePage();
    },
    t: function(key, params = {}, lang = null) {
      const currentLang = lang || this.lang || this.FALLBACK;
      const langBlock = this.STRINGS[currentLang] || this.STRINGS[this.FALLBACK] || {};
      let str = langBlock[key] || (this.STRINGS[this.FALLBACK] && this.STRINGS[this.FALLBACK][key]) || key;
      Object.keys(params).forEach(p => {
        if (typeof str === 'string') {
          str = str.replace(new RegExp(\`\\\\{\${p}\\\\}\`, 'g'), params[p]);
        }
      });
      return str;
    },
    setLang: function(lang) {
      if (this.LANGUAGES[lang]) {
        this.lang = lang;
        localStorage.setItem('leakd_lang', lang);
        document.documentElement.lang = lang;
        this.translatePage();
        this._listeners.forEach(cb => cb(lang));
      }
    },
    onChange: function(cb) {
      this._listeners.push(cb);
    },
    translatePage: function() {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = this.t(key);
      });
      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        el.innerHTML = this.t(key);
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = this.t(key);
      });
      document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = this.t(key);
      });
    }
  };
}
`;

    fs.writeFileSync(path, newContent, 'utf8');
}

run();
