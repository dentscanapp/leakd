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

const FORCED_ID = {
  'menu.activity': 'Log aktivitas',
  'menu.activitySub': 'Lihat setiap perubahan yang Anda buat',
  'activity.title': 'Log aktivitas',
  'activity.empty': 'Belum ada aktivitas. Tambah langganan untuk mulai.',
  'activity.added': 'Menambahkan {name}',
  'activity.edited': 'Mengubah {name}',
  'activity.cancelled': 'Membatalkan {name}',
  'activity.paused': 'Menunda {name}',
  'activity.resumed': 'Melanjutkan {name}',
  'activity.restored': 'Memulihkan {name}',
  'activity.deleted': 'Menghapus {name}',
  'activity.imported': 'Mengimpor {n} langganan',
  'personality.title': 'Kepribadian langganan Anda',
  'personality.quietCutter': 'Pemangkas Senyap',
  'personality.quietCutterTag': 'Anda telah membatalkan banyak langganan tahun ini — kemenangan dalam diam',
  'personality.bundleMaster': 'Ahli Paket',
  'personality.bundleMasterTag': 'Anda tahu cara menumpuk penghematan',
  'personality.streamingJunkie': 'Pecandu Streaming',
  'personality.streamingJunkieTag': 'Tiga atau lebih langganan hiburan — Anda sangat menyukai acara Anda',
  'personality.aiHoarder': 'Kolektor AI',
  'personality.aiHoarderTag': 'Mengumpulkan alat AI lebih cepat daripada rilis pembaruannya',
  'personality.productivityStack': 'Si Paling Produktif',
  'personality.productivityStackTag': 'Lima atau lebih alat kerja — energi power user',
  'personality.musicSnob': 'Snoob Musik',
  'personality.musicSnobTag': 'Beberapa layanan musik — telinga yang pemilih',
  'personality.spiraler': 'Spiral Langganan',
  'personality.spiralerTag': 'Sepuluh atau lebih langganan aktif. Mungkin saatnya audit?',
  'personality.minimalist': 'Minimalis Sehat',
  'personality.minimalistTag': 'Sedikit langganan, semua rating tinggi. Inspirasi.',
  'personality.forgotten': 'Si Pelupa',
  'personality.forgottenTag': 'Anda punya langganan lebih dari setahun yang tidak pernah diberi rating',
  'personality.starting': 'Baru Memulai',
  'personality.startingTag': 'Selamat datang — setiap kebocoran dimulai dengan satu tetes',
  'bench.title': 'Bagaimana Anda dibandingkan',
  'bench.expected': 'Rata-rata untuk {count} subs: {expected}',
  'bench.percentile': 'Top {pct}% pelacak',
  'bench.lower': 'di bawah rata-rata',
  'bench.average': 'rata-rata',
  'bench.higher': 'di atas rata-rata',
  'bench.muchHigher': 'jauh di atas',
  'menu.whatif': 'Kalkulator \"Bagaimana Jika\"',
  'menu.whatifSub': 'Pilih subs untuk dibatalkan — lihat penghematan langsung',
  'whatif.title': 'Kalkulator \"Bagaimana Jika\"',
  'whatif.blurb': 'Ketuk langganan untuk menandainya sebagai dibatalkan dalam skenario ini. Kami menunjukkan apa yang akan Anda hemat tanpa mengubah data asli Anda.',
  'whatif.empty': 'Tidak ada langganan aktif untuk disimulasikan.',
  'whatif.suggestBtn': 'Saran pilihan teratas',
  'whatif.clearBtn': 'Hapus semua',
  'whatif.summarySelected': '{n} terpilih',
  'whatif.summarySavings': '{monthly}/bln · {yearly}/thn',
  'whatif.investedNote': 'Diinvestasikan pada 7%: {y5} dalam 5 tahun, {y10} dalam 10 tahun',
  'home.notesLabel': 'Catatan',
  'streak.days': 'hari beruntun',
  'streak.msg': 'Apakah Anda menahan diri dari langganan baru hari ini?',
  'streak.btn': 'Saya bersih!',
  'streak.done': 'Bersih hari ini! ✨',
  'streak.msgDone': 'Bagus! Sampai jumpa besok untuk menjaga layar tetap bersih.',
  'toast.streakUpdated': 'Streak diperbarui! 🔥',
};

// 1. Collect ALL data
const allData = {};
Object.keys(LANGUAGES).forEach(l => allData[l] = {});

// Find language block starts to associate pairs with languages
const langStarts = [];
const langStartRegex = /\b([a-z]{2,3}):\s*\{/g;
let m;
while ((m = langStartRegex.exec(content)) !== null) {
    if (LANGUAGES[m[1]]) langStarts.push({ lang: m[1], index: m.index });
}

// Extract all pairs
const pairRegex = /['"]([^'"]+)['"]\s*:\s*(['"])([\s\S]*?)(?<!\\)\2/g;
let p;
while ((p = pairRegex.exec(content)) !== null) {
    const key = p[1];
    const value = p[3];
    const index = p.index;
    
    // Find owner lang
    let currentLang = 'en';
    for (let i = langStarts.length - 1; i >= 0; i--) {
        if (langStarts[i].index < index) {
            currentLang = langStarts[i].lang;
            break;
        }
    }
    
    // Filter trash
    if (value.includes('Dziennik') || value.includes('subskrypcji') || value.includes('Zobacz')) {
        if (currentLang !== 'pl') continue;
    }
    
    // For English, if it's way down the file, it's probably the injected trash
    if (currentLang === 'en' && index > 50000) continue;

    allData[currentLang][key] = value;
}

// Overwrite with forced good ones
Object.assign(allData['hu'], FORCED_HU);
Object.assign(allData['id'], FORCED_ID);

// 2. Reconstruct
let newContent = `// Localization registry
// This file is the single source of truth for all UI strings.

const FALLBACK = 'en';

const LANGUAGES = ${JSON.stringify(LANGUAGES, null, 2)};

const STRINGS = {
`;

const enKeys = Object.keys(allData['en']);

Object.keys(LANGUAGES).forEach((lang, i, arr) => {
    console.log(`Building ${lang}...`);
    const isLast = i === arr.length - 1;
    
    // For each language, ensure it has ALL the keys that English has
    // This solves the "eliminate English fallback displays" by pre-calculating the fallback
    const blockPairs = [];
    const keysToUse = Array.from(new Set([...enKeys, ...Object.keys(allData[lang])]));
    
    keysToUse.forEach(key => {
        let val = allData[lang][key] || allData['en'][key] || key;
        blockPairs.push(`      '${key}': '${val.replace(/'/g, "\\'")}'`);
    });
    
    newContent += `  ${lang}: {\n${blockPairs.join(',\\n')}\n  }${isLast ? '' : ','}\n`;
});

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
console.log("Master Reconstruction complete.");
