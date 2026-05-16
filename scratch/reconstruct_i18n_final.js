const fs = require('fs');
const path = 'js/i18n.js';
let content = fs.readFileSync(path, 'utf8');

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

const FORCED_HU = {
  'menu.activity': 'Aktivitásnapló',
  'menu.activitySub': 'Minden végrehajtott módosítás megtekintése',
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
  'menu.whatif': '„Mi lenne, ha” kalkulátor',
  'menu.whatifSub': 'Válassz lemondható előfizetéseket – lásd a megtakarítást élőben',
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
  'field.tags': 'Címkék',
  'field.tagsPh': 'munka, család, tervezett, …',
  'field.tagsNote': 'Szabadon megadható címkék. Vesszővel válaszd el őket.',
  'home.tagFilter': 'Szűrés címke szerint',
  'home.allTags': 'Összes címke',
  'lifetime.inflationTitle': 'Ha az árak tovább emelkednek',
  'lifetime.inflationNote': 'A legtöbb szolgáltatás évi 3-7%-kal drágul. 5%-kal számolunk – ez tipikus a SaaS szektorban.',
  'lifetime.inflated10y': '10 év +5%/év emelkedéssel',
  'menu.compare': 'Összehasonlítás',
  'menu.compareSub': 'Válassz 2 vagy 3 szolgáltatást',
  'compare.title': 'Összehasonlítás',
  'compare.blurb': 'Válassz 2 vagy 3 előfizetést. Egymás mellé tesszük őket, hogy lásd, melyiket érdemes megtartani.',
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
  'compare.minutesAbbr': '{n} perc'
};

// Reconstruct the header
let newContent = `// Localization registry
// This file is the single source of truth for all UI strings.

const FALLBACK = 'en';

const LANGUAGES = ${JSON.stringify(LANGUAGES, null, 2)};

const STRINGS = {
`;

// Extract and clean each language block
const langKeys = Object.keys(LANGUAGES);
for (const lang of langKeys) {
    console.log(`Processing ${lang}...`);
    
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
            const pairCount = (blockContent.match(/['"][^'"]+['"]\s*:\s*['"]/g) || []).length;
            if (pairCount > bestCount) {
                bestCount = pairCount;
                bestBlock = blockContent;
            }
        }
    }
    
    if (bestBlock) {
        const pairsMap = {};
        const pairRegex = /['"]([^'"]+)['"]\s*:\s*(['"])([\s\S]*?)(?<!\\)\2/g;
        let pMatch;
        while ((pMatch = pairRegex.exec(bestBlock)) !== null) {
            const key = pMatch[1];
            const value = pMatch[3];
            
            // Clean logic: remove known non-native strings from this block
            if (lang === 'hu' && (value.includes('Dziennik') || value.includes('subskrypcji') || value.includes('Zobacz'))) continue;
            if (lang === 'id' && (value.includes(' và ') || value.includes('văn bản'))) continue;
            if (lang === 'en' && (/[^\x00-\x7F]/.test(value) && !value.includes('🎉') && !value.includes('🔥') && !value.includes('✨'))) continue;

            pairsMap[key] = value;
        }
        
        // Force specific translations if needed
        if (lang === 'hu') {
            Object.assign(pairsMap, FORCED_HU);
        }
        
        const pairs = Object.entries(pairsMap).map(([k, v]) => `      '${k}': '${v.replace(/'/g, "\\'")}'`);
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
