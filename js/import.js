// Leakd — Bulk import
// Two modes:
//   1. CSV from a Leakd export (round-trip)
//   2. Free-form paste — line per subscription, auto-detect known services
//      and prices via regex. Lenient parser, returns suggestions for the user
//      to review before committing.

(function () {
  'use strict';

  // ── Catalogue of well-known services with typical pricing, category, and
  // a "cancel URL" so the UI can offer a 1-click "Cancel this subscription"
  // button. URLs go to the service's own cancellation/subscription page —
  // we don't auto-cancel anything, just take the user there.
  const KNOWN = [
    { match: /netflix/i,            name: 'Netflix',          price: 15.99, cat: 'Entertainment', cancel: 'https://www.netflix.com/cancelplan' },
    { match: /spotify/i,            name: 'Spotify',          price: 10.99, cat: 'Music', cancel: 'https://www.spotify.com/account/subscription/' },
    { match: /apple\s*music/i,      name: 'Apple Music',      price: 10.99, cat: 'Music', cancel: 'https://music.apple.com/account/subscriptions' },
    { match: /youtube\s*(premium|music)/i, name: 'YouTube Premium', price: 13.99, cat: 'Entertainment', cancel: 'https://www.youtube.com/paid_memberships' },
    { match: /disney\+?/i,          name: 'Disney+',          price: 13.99, cat: 'Entertainment', cancel: 'https://www.disneyplus.com/account/subscription' },
    { match: /hbo|max/i,            name: 'HBO Max',          price: 15.99, cat: 'Entertainment', cancel: 'https://www.max.com/subscription' },
    { match: /prime\s*video|amazon\s*prime/i, name: 'Amazon Prime', price: 14.99, cat: 'Entertainment', cancel: 'https://www.amazon.com/mc' },
    { match: /chatgpt|openai/i,     name: 'ChatGPT Plus',     price: 20.00, cat: 'Work', cancel: 'https://chatgpt.com/#settings/Subscription' },
    { match: /claude/i,             name: 'Claude Pro',       price: 20.00, cat: 'Work', cancel: 'https://claude.ai/settings/billing' },
    { match: /github\s*copilot/i,   name: 'GitHub Copilot',   price: 10.00, cat: 'Work', cancel: 'https://github.com/settings/copilot' },
    { match: /github/i,             name: 'GitHub Pro',       price: 4.00,  cat: 'Work', cancel: 'https://github.com/settings/billing' },
    { match: /notion/i,             name: 'Notion',           price: 10.00, cat: 'Work', cancel: 'https://www.notion.so/my-account' },
    { match: /figma/i,              name: 'Figma',            price: 15.00, cat: 'Work', cancel: 'https://www.figma.com/settings' },
    { match: /adobe/i,              name: 'Adobe CC',         price: 54.99, cat: 'Work', cancel: 'https://account.adobe.com/plans' },
    { match: /1password/i,          name: '1Password',        price: 3.00,  cat: 'Work', cancel: 'https://my.1password.com/billing' },
    { match: /dropbox/i,            name: 'Dropbox',          price: 11.99, cat: 'Cloud', cancel: 'https://www.dropbox.com/account/plan' },
    { match: /icloud/i,             name: 'iCloud+',          price: 2.99,  cat: 'Cloud', cancel: 'https://www.icloud.com/settings/' },
    { match: /google\s*one/i,       name: 'Google One',       price: 1.99,  cat: 'Cloud', cancel: 'https://one.google.com/storage' },
    { match: /microsoft\s*365|office\s*365/i, name: 'Microsoft 365', price: 6.99, cat: 'Work', cancel: 'https://account.microsoft.com/services' },
    { match: /nytimes|nyt|new\s*york\s*times/i, name: 'NYT', price: 17.00, cat: 'News', cancel: 'https://myaccount.nytimes.com/seg/subscription' },
    { match: /economist/i,          name: 'The Economist',    price: 19.00, cat: 'News', cancel: 'https://myaccount.economist.com/' },
    { match: /substack/i,           name: 'Substack',         price: 5.00,  cat: 'News', cancel: 'https://substack.com/account' },
    { match: /medium/i,             name: 'Medium',           price: 5.00,  cat: 'News', cancel: 'https://medium.com/me/membership' },
    { match: /duolingo/i,           name: 'Duolingo Super',   price: 6.99,  cat: 'Other', cancel: 'https://www.duolingo.com/settings/subscription' },
    { match: /headspace/i,          name: 'Headspace',        price: 12.99, cat: 'Other', cancel: 'https://www.headspace.com/subscription' },
    { match: /calm/i,               name: 'Calm',             price: 14.99, cat: 'Other', cancel: 'https://www.calm.com/account/subscription' },
    { match: /audible/i,            name: 'Audible',          price: 14.95, cat: 'Entertainment', cancel: 'https://www.audible.com/account/mship-cancel' },
    { match: /kindle\s*unlimited/i, name: 'Kindle Unlimited', price: 11.99, cat: 'Entertainment', cancel: 'https://www.amazon.com/kindle-dbs/ku/ku-central' },
    { match: /strava/i,             name: 'Strava',           price: 11.99, cat: 'Fitness', cancel: 'https://www.strava.com/account' },
    { match: /fitbod/i,             name: 'Fitbod',           price: 12.99, cat: 'Fitness', cancel: null },
    { match: /myfitnesspal/i,       name: 'MyFitnessPal',     price: 19.99, cat: 'Fitness', cancel: 'https://www.myfitnesspal.com/account/manage_subscription' },
    { match: /peloton/i,            name: 'Peloton',          price: 44.00, cat: 'Fitness', cancel: 'https://members.onepeloton.com/preferences/subscriptions' },
    { match: /linkedin/i,           name: 'LinkedIn Premium', price: 39.99, cat: 'Work', cancel: 'https://www.linkedin.com/premium/manage/' },
    // European & regional services
    { match: /videoland/i,          name: 'Videoland',        price: 9.99,  cat: 'Entertainment', cancel: 'https://www.videoland.com/account/subscription' },
    { match: /nl\s*ziet|nlziet/i,   name: 'NLZIET',           price: 8.95,  cat: 'Entertainment', cancel: 'https://www.nlziet.nl/account' },
    { match: /viaplay/i,            name: 'Viaplay',          price: 13.99, cat: 'Entertainment', cancel: 'https://account.viaplay.com/' },
    { match: /streamz/i,            name: 'Streamz',          price: 11.95, cat: 'Entertainment', cancel: 'https://www.streamz.be/account' },
    { match: /sky\s*go|skyq|sky\s*ticket/i, name: 'Sky', price: 25.00, cat: 'Entertainment', cancel: 'https://www.sky.com/myaccount' },
    { match: /canal\+?/i,           name: 'Canal+',           price: 25.99, cat: 'Entertainment', cancel: 'https://www.canalplus.com/compte' },
    { match: /rtl\+/i,              name: 'RTL+',             price: 6.99,  cat: 'Entertainment', cancel: 'https://www.rtlplus.com/account' },
    { match: /dazn/i,               name: 'DAZN',             price: 29.99, cat: 'Entertainment', cancel: 'https://www.dazn.com/account/subscription' },
    { match: /paramount\+?/i,       name: 'Paramount+',       price: 8.99,  cat: 'Entertainment', cancel: 'https://www.paramountplus.com/account/' },
    { match: /apple\s*tv\+?/i,      name: 'Apple TV+',        price: 9.99,  cat: 'Entertainment', cancel: 'https://tv.apple.com/account' },
    { match: /deezer/i,             name: 'Deezer',           price: 11.99, cat: 'Music', cancel: 'https://www.deezer.com/account/subscription' },
    { match: /tidal/i,              name: 'Tidal',            price: 10.99, cat: 'Music', cancel: 'https://account.tidal.com/' },
    { match: /soundcloud/i,         name: 'SoundCloud Go',    price: 9.99,  cat: 'Music', cancel: 'https://soundcloud.com/settings/subscriptions' },
    { match: /telegraaf/i,          name: 'De Telegraaf',     price: 7.99,  cat: 'News', cancel: 'https://www.telegraaf.nl/mijn/abonnement' },
    { match: /volkskrant|nrc|trouw|fd/i, name: 'Krant abonnement', price: 18.50, cat: 'News', cancel: null },
    { match: /der\s*spiegel|zeit/i, name: 'Der Spiegel',      price: 19.99, cat: 'News', cancel: null },
    { match: /el\s*pa[ií]s/i,       name: 'El País',          price: 10.00, cat: 'News', cancel: null },
    { match: /le\s*monde/i,         name: 'Le Monde',         price: 9.99,  cat: 'News', cancel: 'https://abo.lemonde.fr/' },
    { match: /onlyfans/i,           name: 'OnlyFans',         price: 9.99,  cat: 'Other', cancel: null },
    { match: /patreon/i,            name: 'Patreon',          price: 5.00,  cat: 'Other', cancel: 'https://www.patreon.com/settings/memberships' },
    { match: /twitch/i,             name: 'Twitch Turbo',     price: 8.99,  cat: 'Entertainment', cancel: 'https://www.twitch.tv/subscriptions' },
    { match: /xbox\s*game\s*pass/i, name: 'Xbox Game Pass',   price: 14.99, cat: 'Entertainment', cancel: 'https://account.microsoft.com/services' },
    { match: /playstation\s*plus|ps\+/i, name: 'PlayStation Plus', price: 9.99, cat: 'Entertainment', cancel: 'https://www.playstation.com/account/subscriptions/' },
    { match: /nintendo\s*online/i,  name: 'Nintendo Online',  price: 3.99,  cat: 'Entertainment', cancel: 'https://accounts.nintendo.com/' },
    { match: /proton\s*(mail|vpn|drive)/i, name: 'Proton',    price: 9.99,  cat: 'Work', cancel: 'https://account.proton.me/subscription' },
    { match: /nordvpn/i,            name: 'NordVPN',          price: 11.99, cat: 'Work', cancel: 'https://my.nordaccount.com/dashboard/nordvpn/' },
    { match: /mullvad/i,            name: 'Mullvad VPN',      price: 5.00,  cat: 'Work', cancel: 'https://mullvad.net/account/' },
    { match: /\bgym\b|fitness\s*first|basic\s*fit|sportcity/i, name: 'Gym', price: 29.99, cat: 'Fitness', cancel: null },
    { match: /hellofresh/i,         name: 'HelloFresh',       price: 49.99, cat: 'Food', cancel: 'https://www.hellofresh.com/account' },
    { match: /spar\s*box|gousto|marley\s*spoon/i, name: 'Meal kit', price: 39.99, cat: 'Food', cancel: null },
  ];

  // Find the cancel URL for an existing sub by name (used by the edit modal)
  function findCancelUrl(name) {
    if (!name) return null;
    const match = KNOWN.find(k => k.match.test(name));
    return match && match.cancel ? match.cancel : null;
  }

  // ── Cancellation playbooks ──
  // Tactical guide per service: difficulty (easy/medium/hard), estimated
  // time, and step-by-step instructions. This is what LowerMySubs hints
  // at but doesn't actually do well — most users don't cancel because
  // they don't know HOW, not because they don't want to.
  const PLAYBOOKS = {
    Netflix: {
      difficulty: 'easy',
      minutes: 1,
      steps: [
        'Open netflix.com and sign in',
        'Click your profile → Account',
        'Click "Cancel Membership"',
        'Confirm cancellation',
      ],
    },
    Spotify: {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Go to spotify.com/account',
        'Click "Manage your plan"',
        'Click "Change plan" → "Cancel Premium"',
        'Confirm — access continues until period ends',
      ],
    },
    'YouTube Premium': {
      difficulty: 'easy',
      minutes: 1,
      steps: [
        'Open youtube.com/paid_memberships',
        'Find YouTube Premium → "Deactivate"',
        'Choose reason and confirm',
      ],
    },
    'Apple Music': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'iPhone: Settings → tap your name → Subscriptions',
        'Tap Apple Music → "Cancel Subscription"',
        'Confirm',
      ],
    },
    'Disney+': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Sign in at disneyplus.com',
        'Click profile → Account → Subscription',
        '"Cancel Subscription" → confirm',
      ],
    },
    'HBO Max': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Open max.com → Settings → Subscription',
        'Click "Manage subscription" → "Cancel"',
      ],
    },
    'Amazon Prime': {
      difficulty: 'medium',
      minutes: 3,
      steps: [
        'Go to amazon.com/mc',
        'Find "Prime" → "End Membership"',
        'Click through 3 confirmation screens (Amazon tries to talk you out of it)',
      ],
    },
    'ChatGPT Plus': {
      difficulty: 'easy',
      minutes: 1,
      steps: [
        'chatgpt.com → bottom-left avatar → Settings',
        '"Subscription" → "Cancel plan"',
      ],
    },
    'Claude Pro': {
      difficulty: 'easy',
      minutes: 1,
      steps: [
        'claude.ai → Settings → Billing',
        'Click "Cancel subscription"',
      ],
    },
    'Adobe CC': {
      difficulty: 'hard',
      minutes: 10,
      steps: [
        'WARNING: Adobe charges 50% of remaining contract if you cancel early',
        'Go to account.adobe.com/plans',
        '"Cancel your plan" — they hide this behind multiple clicks',
        'Try the chat for a no-fee cancellation excuse',
        'Document everything — Adobe is known to keep charging',
      ],
    },
    'iCloud+': {
      difficulty: 'easy',
      minutes: 1,
      steps: [
        'iPhone: Settings → tap your name → iCloud → Manage Storage → Change Storage Plan',
        'Select "Downgrade options" → 5GB Free',
      ],
    },
    'Microsoft 365': {
      difficulty: 'medium',
      minutes: 3,
      steps: [
        'account.microsoft.com/services',
        'Find Microsoft 365 → "Manage" → "Cancel subscription"',
        'May need to wait until end of period for refund',
      ],
    },
    'NYT': {
      difficulty: 'hard',
      minutes: 15,
      steps: [
        'NYT requires a phone call or chat — no self-service cancel',
        'Go to myaccount.nytimes.com → Subscription → "Cancel"',
        'You will be redirected to chat',
        'Be firm, say "I want to cancel" and refuse the discount offers',
      ],
    },
    'Audible': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'audible.com/account/mship-cancel (only works on desktop)',
        'Click through 4-5 "are you sure" screens',
        'Use your remaining credits before cancelling',
      ],
    },
    'LinkedIn Premium': {
      difficulty: 'medium',
      minutes: 3,
      steps: [
        'linkedin.com/premium/manage',
        '"Cancel subscription" — LinkedIn will offer 50% off, decline if you truly want out',
      ],
    },
    'Peloton': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Sign in to members.onepeloton.com → Preferences → Subscriptions',
        'Membership → "Cancel membership"',
        'If you bought hardware, the warranty stays — only membership is cancelled',
      ],
    },
    'NordVPN': {
      difficulty: 'medium',
      minutes: 3,
      steps: [
        'my.nordaccount.com → Subscription',
        '"Cancel auto-renewal" (does NOT cancel immediately — they remember this)',
        'Service continues until period ends',
      ],
    },
    'OnlyFans': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Go to each subscribed creator',
        'Toggle off "Renew automatically"',
        'No central cancel — must repeat per creator',
      ],
    },
    'Patreon': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'patreon.com/settings/memberships',
        'Find each pledge → "Edit" → "Cancel pledge"',
        'No central cancel — must repeat per creator',
      ],
    },
  };

  // Fuzzy match a sub name against playbooks. Returns the playbook or null.
  function findPlaybook(name) {
    if (!name) return null;
    // Try exact match first
    if (PLAYBOOKS[name]) return { name, ...PLAYBOOKS[name] };
    // Fall back to known catalog mapping
    const known = KNOWN.find(k => k.match.test(name));
    if (known && PLAYBOOKS[known.name]) return { name: known.name, ...PLAYBOOKS[known.name] };
    return null;
  }

  // Find a price-like number anywhere in a line. Accepts $, €, £, Ft, ¥, R$, A$.
  // Currency symbol may appear before the number ("$15.99") OR after ("5000 Ft").
  const PRICE_RE = /(\$|€|£|¥|₹|R\$|A\$|Ft|zł|kr|Kč|lei|₺|Rp|฿)?\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*(\$|€|£|¥|₹|R\$|A\$|Ft|zł|kr|Kč|lei|₺|Rp|฿)?/;

  const SYMBOL_TO_CODE = {
    '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR',
    'R$': 'BRL', 'A$': 'AUD', 'Ft': 'HUF', 'zł': 'PLN', 'kr': 'SEK',
    'Kč': 'CZK', 'lei': 'RON', '₺': 'TRY', 'Rp': 'IDR', '฿': 'THB',
  };

  function parseLine(raw) {
    const line = raw.trim();
    if (!line || line.length < 2) return null;

    // CSV detection: 5+ commas with leading "Name" header → skip header rows
    if (/^name\s*,/i.test(line)) return null;

    // Identify known service
    const known = KNOWN.find(k => k.match.test(line));

    // Extract price (and currency from the symbol, if present)
    const m = line.match(PRICE_RE);
    let price = known ? known.price : null;
    let currency = null;
    if (m) {
      const p = parseFloat(m[2].replace(',', '.'));
      if (!isNaN(p) && p > 0 && p < 10000) price = p;
      const sym = m[1] || m[3];
      if (sym && SYMBOL_TO_CODE[sym]) currency = SYMBOL_TO_CODE[sym];
    }

    // Name fallback: first 1-3 word phrase that's not a number
    let name;
    if (known) {
      name = known.name;
    } else {
      const cleaned = line
        .replace(PRICE_RE, '')
        .replace(/[\/]\s*(mo|month|year|yr|week|wk)\b.*/i, '')
        .replace(/[,;|].*/, '')
        .trim();
      const words = cleaned.split(/\s+/).slice(0, 3).join(' ');
      name = words || line.slice(0, 30);
    }

    if (!price) return null;

    // Cycle detection
    let cycle = 'monthly';
    if (/year|yr|annual/i.test(line)) cycle = 'yearly';
    else if (/week|wk/i.test(line)) cycle = 'weekly';

    return {
      name,
      price,
      currency,
      cycle,
      category: known ? known.cat : 'Other',
      matched: !!known,
    };
  }

  function parseText(text) {
    const lines = text.split(/\r?\n/);
    const results = [];
    lines.forEach(line => {
      const parsed = parseLine(line);
      if (parsed) results.push(parsed);
    });
    // De-dupe by name
    const seen = new Set();
    return results.filter(r => {
      const key = r.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Parse a Leakd-exported CSV (round-trip)
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    const nameI = header.indexOf('name');
    const priceI = header.indexOf('price');
    const currencyI = header.indexOf('currency');
    const cycleI = header.indexOf('cycle');
    const catI = header.indexOf('category');
    const dateI = header.indexOf('next payment');
    if (nameI === -1 || priceI === -1) return [];

    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCSV(lines[i]);
      const name = cells[nameI];
      const price = parseFloat(cells[priceI]);
      if (!name || isNaN(price)) continue;
      out.push({
        name,
        price,
        currency: currencyI !== -1 ? (cells[currencyI] || null) : null,
        cycle: (cells[cycleI] || 'monthly').toLowerCase(),
        category: cells[catI] || 'Other',
        nextDate: cells[dateI] || '',
        matched: false,
      });
    }
    return out;
  }

  function splitCSV(line) {
    const out = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  // ── Playbook step localization ──
  // Same pattern as alternatives.js: canonical English steps, lookup table
  // per language. Renderer calls trStep() to get the localized string.
  const STEP_I18N = {
    hu: {
      // Netflix
      'Open netflix.com and sign in': 'Nyisd meg a netflix.com-ot és jelentkezz be',
      'Click your profile → Account': 'Kattints a profilra → Fiók',
      'Click "Cancel Membership"': 'Kattints a "Tagság lemondása" gombra',
      'Confirm cancellation': 'Erősítsd meg a lemondást',
      // Spotify
      'Go to spotify.com/account': 'Menj a spotify.com/account-ra',
      'Click "Manage your plan"': 'Kattints a "Csomag kezelése" gombra',
      'Click "Change plan" → "Cancel Premium"': '"Csomag módosítása" → "Premium lemondása"',
      'Confirm — access continues until period ends': 'Erősítsd meg — a hozzáférés a periódus végéig megmarad',
      // YouTube Premium
      'Open youtube.com/paid_memberships': 'Nyisd meg a youtube.com/paid_memberships-et',
      'Find YouTube Premium → "Deactivate"': 'Keresd a YouTube Premium-ot → "Deaktiválás"',
      'Choose reason and confirm': 'Válassz okot és erősítsd meg',
      // Apple Music
      'iPhone: Settings → tap your name → Subscriptions': 'iPhone: Beállítások → koppints a nevedre → Előfizetések',
      'Tap Apple Music → "Cancel Subscription"': 'Koppints Apple Music → "Előfizetés lemondása"',
      'Confirm': 'Erősítsd meg',
      // Disney+
      'Sign in at disneyplus.com': 'Jelentkezz be a disneyplus.com-on',
      'Click profile → Account → Subscription': 'Kattints profil → Fiók → Előfizetés',
      '"Cancel Subscription" → confirm': '"Előfizetés lemondása" → erősítsd meg',
      // HBO Max
      'Open max.com → Settings → Subscription': 'Nyisd meg max.com → Beállítások → Előfizetés',
      'Click "Manage subscription" → "Cancel"': 'Kattints "Előfizetés kezelése" → "Lemondás"',
      // Amazon Prime
      'Go to amazon.com/mc': 'Menj az amazon.com/mc-re',
      'Find "Prime" → "End Membership"': 'Keresd "Prime" → "Tagság befejezése"',
      'Click through 3 confirmation screens (Amazon tries to talk you out of it)': 'Kattints át 3 megerősítő képernyőn (az Amazon megpróbál lebeszélni)',
      // ChatGPT Plus
      'chatgpt.com → bottom-left avatar → Settings': 'chatgpt.com → bal-alsó avatar → Beállítások',
      '"Subscription" → "Cancel plan"': '"Előfizetés" → "Csomag lemondása"',
      // Claude Pro
      'claude.ai → Settings → Billing': 'claude.ai → Beállítások → Számlázás',
      'Click "Cancel subscription"': 'Kattints "Előfizetés lemondása"',
      // Adobe CC
      'WARNING: Adobe charges 50% of remaining contract if you cancel early': 'FIGYELEM: az Adobe a maradék szerződés 50%-át felszámolja korai lemondásnál',
      'Go to account.adobe.com/plans': 'Menj az account.adobe.com/plans-re',
      '"Cancel your plan" — they hide this behind multiple clicks': '"Csomag lemondása" — több kattintás mögé rejtik',
      'Try the chat for a no-fee cancellation excuse': 'Próbáld a chatet díjmentes lemondási indokért',
      'Document everything — Adobe is known to keep charging': 'Dokumentálj mindent — az Adobe ismert arról hogy tovább számláz',
      // iCloud+
      'iPhone: Settings → tap your name → iCloud → Manage Storage → Change Storage Plan': 'iPhone: Beállítások → név → iCloud → Tárhely kezelése → Csomag módosítása',
      'Select "Downgrade options" → 5GB Free': 'Válaszd "Visszaminősítés" → 5GB Ingyenes',
      // Microsoft 365
      'account.microsoft.com/services': 'account.microsoft.com/services',
      'Find Microsoft 365 → "Manage" → "Cancel subscription"': 'Keresd Microsoft 365 → "Kezelés" → "Előfizetés lemondása"',
      'May need to wait until end of period for refund': 'A periódus végéig várni kell a visszatérítésért',
      // NYT
      'NYT requires a phone call or chat — no self-service cancel': 'A NYT telefont vagy chatet igényel — nincs önkiszolgáló lemondás',
      'Go to myaccount.nytimes.com → Subscription → "Cancel"': 'myaccount.nytimes.com → Előfizetés → "Lemondás"',
      'You will be redirected to chat': 'Át fognak irányítani chatre',
      'Be firm, say "I want to cancel" and refuse the discount offers': 'Légy határozott, mondd "le akarom mondani" és utasíts el minden kedvezmény-ajánlatot',
      // Audible
      'audible.com/account/mship-cancel (only works on desktop)': 'audible.com/account/mship-cancel (csak desktopon)',
      'Click through 4-5 "are you sure" screens': 'Kattints át 4-5 "biztos vagy benne" képernyőn',
      'Use your remaining credits before cancelling': 'Használd fel a maradék krediteket lemondás előtt',
      // LinkedIn Premium
      'linkedin.com/premium/manage': 'linkedin.com/premium/manage',
      '"Cancel subscription" — LinkedIn will offer 50% off, decline if you truly want out': '"Előfizetés lemondása" — a LinkedIn 50% kedvezményt fog kínálni, utasítsd el ha tényleg ki akarsz lépni',
      // Peloton
      'Sign in to members.onepeloton.com → Preferences → Subscriptions': 'Jelentkezz be members.onepeloton.com → Beállítások → Előfizetések',
      'Membership → "Cancel membership"': 'Tagság → "Tagság lemondása"',
      'If you bought hardware, the warranty stays — only membership is cancelled': 'Ha hardvert vettél, a garancia marad — csak a tagság szűnik',
      // NordVPN
      'my.nordaccount.com → Subscription': 'my.nordaccount.com → Előfizetés',
      '"Cancel auto-renewal" (does NOT cancel immediately — they remember this)': '"Automatikus megújítás lemondása" (NEM mond le azonnal — erre figyelj)',
      'Service continues until period ends': 'A szolgáltatás a periódus végéig folytatódik',
      // OnlyFans
      'Go to each subscribed creator': 'Menj minden alkotóhoz akire előfizettél',
      'Toggle off "Renew automatically"': 'Kapcsold ki a "Automatikus megújítás"-t',
      'No central cancel — must repeat per creator': 'Nincs központi lemondás — minden alkotónál külön',
      // Patreon
      'patreon.com/settings/memberships': 'patreon.com/settings/memberships',
      'Find each pledge → "Edit" → "Cancel pledge"': 'Keresd minden vállalást → "Szerkesztés" → "Vállalás lemondása"',
      // Generic
      'no-central-cancel-repeat': 'Nincs központi lemondás — minden alkotónál külön',
    },
  };

  function trStep(text) {
    if (!text) return text;
    const lang = window.LeakdI18n && window.LeakdI18n.lang;
    if (!lang || lang === 'en') return text;
    const dict = STEP_I18N[lang];
    return (dict && dict[text]) || text;
  }

  window.LeakdImport = { parseText, parseCSV, parseLine, findCancelUrl, findPlaybook, trStep, KNOWN, PLAYBOOKS, STEP_I18N };
})();
