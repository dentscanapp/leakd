// Leakd — Service alternatives
// For each known service, suggest cheaper or comparable alternatives.
// Shown in the sub edit modal as actionable savings advice. Nobody else
// does this — Bobby/Subby just track, Rocket negotiates but doesn't advise.

(function () {
  'use strict';

  // Each entry: keyed by service name, list of alternatives.
  // Alternative: { name, price, why } — `why` is a one-line reason to switch.
  const ALTERNATIVES = {
    Netflix: [
      { name: 'Netflix Standard with Ads', price: 7.99, why: 'Same library, ads on most titles' },
      { name: 'Hulu (with Ads)', price: 6.99, why: 'Different catalog, cheapest streaming option' },
      { name: 'Disney+ Basic with Ads', price: 7.99, why: 'Disney/Marvel/Star Wars + Hulu shows' },
      { name: 'Library card', price: 0, why: 'Hoopla, Kanopy free with most US/EU library cards' },
    ],
    Spotify: [
      { name: 'YouTube Music', price: 10.99, why: 'Same price, bundles with YouTube Premium' },
      { name: 'Apple Music', price: 10.99, why: 'Same price, bundled in Apple One' },
      { name: 'Tidal HiFi', price: 10.99, why: 'Lossless audio, same price' },
      { name: 'Amazon Music', price: 9.99, why: 'Cheaper, free with Prime' },
    ],
    'Apple Music': [
      { name: 'Apple One Individual', price: 19.95, why: 'Bundles Music + TV+ + iCloud+ 50GB + Arcade' },
      { name: 'Spotify', price: 10.99, why: 'Same price, broader podcast library' },
    ],
    'YouTube Premium': [
      { name: 'YouTube Premium Family', price: 22.99, why: 'Up to 6 family members for ~2x the individual' },
      { name: 'Just ad-blocker', price: 0, why: 'uBlock Origin is free; you lose offline downloads' },
    ],
    'Disney+': [
      { name: 'Disney Bundle (Disney+/Hulu/ESPN+)', price: 14.99, why: 'Bundle saves $16+/mo vs separate' },
      { name: 'Disney+ with Ads', price: 7.99, why: 'Same library, lower price' },
    ],
    'ChatGPT Plus': [
      { name: 'Claude Pro', price: 20.00, why: 'Same price; better at long-context + code' },
      { name: 'Gemini Advanced', price: 19.99, why: 'Same tier, bundled with Google One 2TB' },
      { name: 'Free ChatGPT + free Claude', price: 0, why: 'Free tiers cover ~80% of use cases' },
    ],
    'Claude Pro': [
      { name: 'ChatGPT Plus', price: 20.00, why: 'Same price; better image gen + voice' },
      { name: 'Claude API pay-per-use', price: 5.00, why: 'If you use it lightly, pay-per-token may be cheaper' },
    ],
    'Adobe CC': [
      { name: 'Affinity Photo/Designer/Publisher', price: 7.99, why: 'One-time purchase ($164 total), not subscription' },
      { name: 'Photopea (free)', price: 0, why: 'Browser-based Photoshop clone' },
      { name: 'Figma free + GIMP', price: 0, why: 'Covers most design + photo workflows' },
      { name: 'Adobe CC Photography Plan', price: 9.99, why: 'Photoshop + Lightroom only, much cheaper than full CC' },
    ],
    'Microsoft 365': [
      { name: 'Microsoft 365 Family', price: 9.99, why: 'Up to 6 people, same price as Personal' },
      { name: 'Google Workspace (Free for personal)', price: 0, why: 'Docs/Sheets/Slides + 15GB Drive' },
      { name: 'LibreOffice', price: 0, why: 'Open-source, works offline' },
    ],
    Notion: [
      { name: 'Notion Free', price: 0, why: 'Unlimited pages for personal use' },
      { name: 'Obsidian', price: 0, why: 'Local-first, lifetime free for personal' },
      { name: 'Apple Notes', price: 0, why: 'Free, syncs across Apple devices' },
    ],
    'iCloud+': [
      { name: 'Google One 2TB', price: 9.99, why: '2TB storage + Gemini Advanced + VPN' },
      { name: 'pCloud Lifetime', price: 8.25, why: '$199 one-time = $8.25/mo for 5 years vs $30 in iCloud' },
      { name: 'Self-hosted Nextcloud', price: 5.00, why: '~$60/yr on a Hetzner VPS, unlimited' },
    ],
    'Google One': [
      { name: 'iCloud+ 200GB', price: 2.99, why: 'Cheaper if you only need basic storage' },
      { name: 'pCloud Lifetime', price: 8.25, why: 'One-time payment beats yearly fees long-term' },
    ],
    Dropbox: [
      { name: 'iCloud+ 2TB', price: 9.99, why: 'Same 2TB, $12/mo cheaper' },
      { name: 'Google One 2TB', price: 9.99, why: 'Includes Gemini + VPN' },
      { name: 'Sync.com', price: 8.00, why: 'End-to-end encrypted, cheaper' },
    ],
    'NYT': [
      { name: 'NYT All Access', price: 25.00, why: 'Bundles News + Games + Cooking + Athletic — better if you use 2+' },
      { name: 'NYT Games only', price: 8.00, why: 'If you only play Wordle/Connections' },
    ],
    Audible: [
      { name: 'Library card + Libby', price: 0, why: 'Free audiobooks via Libby (most US/EU libraries)' },
      { name: 'Spotify (audiobooks included)', price: 10.99, why: '15 hrs/mo of audiobooks bundled with Music' },
      { name: 'LibriVox (public domain)', price: 0, why: 'Free classics, no DRM' },
    ],
    Peloton: [
      { name: 'Peloton App One', price: 12.99, why: 'No bike required, same classes' },
      { name: 'YouTube + free fitness', price: 0, why: 'Caroline Girvan, MadFit, etc. have free programs' },
    ],
    'LinkedIn Premium': [
      { name: 'LinkedIn Premium Career', price: 29.99, why: 'Job seeker plan if Sales Nav isn\'t needed' },
      { name: 'Free LinkedIn', price: 0, why: '80% of value is in the free tier' },
    ],
    NordVPN: [
      { name: 'Mullvad VPN', price: 5.00, why: 'Same security, half the price, no logs by design' },
      { name: 'Proton VPN Free', price: 0, why: 'Free tier covers basic privacy needs' },
    ],
  };

  function findAlternatives(name) {
    if (!name) return [];
    // Exact match first
    if (ALTERNATIVES[name]) return ALTERNATIVES[name];
    // Fuzzy match against known service catalog
    if (window.LeakdImport && window.LeakdImport.KNOWN) {
      const known = window.LeakdImport.KNOWN.find(k => k.match.test(name));
      if (known && ALTERNATIVES[known.name]) return ALTERNATIVES[known.name];
    }
    return [];
  }

  // ── Localization lookup ──
  // The data above is canonical English. We translate strings at render time
  // by matching the English value against an entry in this table. If no
  // translation exists for the current language, we fall back to English.
  // Adding a new language = one new entry per "name" + "why" string.
  const I18N = {
    hu: {
      // Alternative names (most stay in English brand names, only translate descriptors)
      'Netflix Standard with Ads': 'Netflix Standard reklámmal',
      'Disney+ Basic with Ads': 'Disney+ Basic reklámmal',
      'Disney+ with Ads': 'Disney+ reklámmal',
      'Library card': 'Könyvtári tagság',
      'Apple One Individual': 'Apple One egyéni',
      'Apple One Family': 'Apple One családi',
      'YouTube Premium Family': 'YouTube Premium családi',
      'Just ad-blocker': 'Csak ad-blocker',
      'Disney Bundle (Disney+/Hulu/ESPN+)': 'Disney csomag (Disney+/Hulu/ESPN+)',
      'Free ChatGPT + free Claude': 'Ingyenes ChatGPT + ingyenes Claude',
      'Claude API pay-per-use': 'Claude API használat-arányos',
      'Affinity Photo/Designer/Publisher': 'Affinity Photo/Designer/Publisher',
      'Photopea (free)': 'Photopea (ingyenes)',
      'Figma free + GIMP': 'Figma ingyenes + GIMP',
      'Adobe CC Photography Plan': 'Adobe CC fotós csomag',
      'Microsoft 365 Family': 'Microsoft 365 családi',
      'Google Workspace (Free for personal)': 'Google Workspace (személyesnek ingyenes)',
      'LibreOffice': 'LibreOffice',
      'Notion Free': 'Notion ingyenes',
      'Obsidian': 'Obsidian',
      'Apple Notes': 'Apple Notes',
      'Google One 2TB': 'Google One 2TB',
      'pCloud Lifetime': 'pCloud élethosszig',
      'Self-hosted Nextcloud': 'Saját Nextcloud',
      'iCloud+ 200GB': 'iCloud+ 200GB',
      'iCloud+ 2TB': 'iCloud+ 2TB',
      'Sync.com': 'Sync.com',
      'NYT All Access': 'NYT All Access',
      'NYT Games only': 'NYT csak játékok',
      'Library card + Libby': 'Könyvtár + Libby',
      'Spotify (audiobooks included)': 'Spotify (hangoskönyvekkel)',
      'LibriVox (public domain)': 'LibriVox (közkincs)',
      'Peloton App One': 'Peloton App One',
      'YouTube + free fitness': 'YouTube + ingyenes fitnesz',
      'LinkedIn Premium Career': 'LinkedIn Premium karrier',
      'Free LinkedIn': 'Ingyenes LinkedIn',
      'Mullvad VPN': 'Mullvad VPN',
      'Proton VPN Free': 'Proton VPN ingyenes',

      // Why strings — the savings reasoning
      'Same library, ads on most titles': 'Ugyanaz a kínálat, reklámmal a legtöbb tartalomnál',
      'Different catalog, cheapest streaming option': 'Más kínálat, legolcsóbb streaming opció',
      'Disney/Marvel/Star Wars + Hulu shows': 'Disney/Marvel/Star Wars + Hulu sorozatok',
      'Hoopla, Kanopy free with most US/EU library cards': 'Hoopla, Kanopy ingyen a legtöbb EU/US könyvtári taggal',
      'Same price, bundles with YouTube Premium': 'Ugyanaz az ár, YouTube Premium-mal csomagolva',
      'Same price, bundled in Apple One': 'Ugyanaz az ár, Apple One-ban csomagban',
      'Lossless audio, same price': 'Lossless audio, ugyanaz az ár',
      'Cheaper, free with Prime': 'Olcsóbb, Prime-mal ingyen',
      'Bundles Music + TV+ + iCloud+ 50GB + Arcade': 'Music + TV+ + iCloud+ 50GB + Arcade csomag',
      'Same price, broader podcast library': 'Ugyanaz az ár, szélesebb podcast kínálat',
      'Up to 6 family members for ~2x the individual': 'Akár 6 családtag az egyéni ~2x áráért',
      'uBlock Origin is free; you lose offline downloads': 'uBlock Origin ingyenes; offline letöltéseket elveszíted',
      'Bundle saves $16+/mo vs separate': 'A csomag $16+/hó-t spórol vs külön',
      'Same library, lower price': 'Ugyanaz a kínálat, alacsonyabb ár',
      'Same price; better at long-context + code': 'Ugyanaz az ár; jobb hosszú-kontextusra + kódra',
      'Same tier, bundled with Google One 2TB': 'Ugyanaz a szint, Google One 2TB csomagban',
      'Free tiers cover ~80% of use cases': 'Az ingyenes verziók a felhasználási esetek ~80%-át fedik',
      'Same price; better image gen + voice': 'Ugyanaz az ár; jobb képgen + hang',
      'If you use it lightly, pay-per-token may be cheaper': 'Ha keveset használod, a per-token fizetés olcsóbb lehet',
      'One-time purchase ($164 total), not subscription': 'Egyszeri vásárlás ($164 összesen), nem előfizetés',
      'Browser-based Photoshop clone': 'Böngészős Photoshop klón',
      'Covers most design + photo workflows': 'A legtöbb design + fotó workflow-t lefedi',
      'Photoshop + Lightroom only, much cheaper than full CC': 'Csak Photoshop + Lightroom, jóval olcsóbb mint a teljes CC',
      'Up to 6 people, same price as Personal': 'Akár 6 fő, ugyanaz az ár mint a személyes',
      'Docs/Sheets/Slides + 15GB Drive': 'Docs/Sheets/Slides + 15GB Drive',
      'Open-source, works offline': 'Nyílt forrású, offline is működik',
      'Unlimited pages for personal use': 'Korlátlan oldal személyes használatra',
      'Local-first, lifetime free for personal': 'Lokális, személyesnek életfogytig ingyenes',
      'Free, syncs across Apple devices': 'Ingyenes, Apple eszközök közt szinkronban',
      '2TB storage + Gemini Advanced + VPN': '2TB tárhely + Gemini Advanced + VPN',
      '$199 one-time = $8.25/mo for 5 years vs $30 in iCloud': '$199 egyszeri = $8.25/hó 5 évre vs $30 iCloud-ban',
      '~$60/yr on a Hetzner VPS, unlimited': '~$60/év Hetzner VPS-en, korlátlan',
      'Cheaper if you only need basic storage': 'Olcsóbb ha csak alap tárhely kell',
      'One-time payment beats yearly fees long-term': 'Egyszeri fizetés hosszú távon veri az éves díjat',
      'Same 2TB, $12/mo cheaper': 'Ugyanaz 2TB, $12/hó olcsóbb',
      'Includes Gemini + VPN': 'Tartalmazza Gemini + VPN-t',
      'End-to-end encrypted, cheaper': 'End-to-end titkosított, olcsóbb',
      'Bundles News + Games + Cooking + Athletic — better if you use 2+': 'News + Games + Cooking + Athletic csomag — jobb ha 2+ kell',
      'If you only play Wordle/Connections': 'Ha csak Wordle/Connections kell',
      'Free audiobooks via Libby (most US/EU libraries)': 'Ingyenes hangoskönyvek Libby-vel (a legtöbb EU/US könyvtár)',
      '15 hrs/mo of audiobooks bundled with Music': '15 óra/hó hangoskönyv a Music mellett',
      'Free classics, no DRM': 'Ingyenes klasszikusok, DRM nélkül',
      'No bike required, same classes': 'Bicikli nélkül is, ugyanazok az órák',
      'Caroline Girvan, MadFit, etc. have free programs': 'Caroline Girvan, MadFit, stb. programjai ingyenesek',
      "Job seeker plan if Sales Nav isn't needed": 'Álláskereső csomag ha nem kell Sales Nav',
      '80% of value is in the free tier': 'Az érték 80%-a az ingyenes szinten van',
      'Same security, half the price, no logs by design': 'Ugyanaz a biztonság, fele ár, alapból log-mentes',
      'Free tier covers basic privacy needs': 'Az ingyenes szint fedi az alap privacy igényeket',
    },
  };

  function tr(text) {
    if (!text) return text;
    const lang = window.LeakdI18n && window.LeakdI18n.lang;
    if (!lang || lang === 'en') return text;
    const dict = I18N[lang];
    return (dict && dict[text]) || text;
  }

  window.LeakdAlternatives = { findAlternatives, tr, ALTERNATIVES, I18N };
})();
