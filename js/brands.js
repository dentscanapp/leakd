// Leakd — Brand badge catalogue
// Maps known service names (fuzzy match) to a brand color + display symbol.
// We do NOT ship the actual brand logos (legally risky and bloats the bundle).
// Instead each service gets a tasteful rounded badge with the brand's primary
// colour and an initial / unicode glyph — same recognition signal, original art.

(function () {
  'use strict';

  // bg = badge background, fg = symbol colour (default white)
  const BRANDS = [
    { match: /netflix/i,                bg: '#e50914', symbol: 'N' },
    { match: /spotify/i,                bg: '#1db954', symbol: '♪' },
    { match: /apple\s*music/i,          bg: '#fc3c44', symbol: '♫' },
    { match: /apple\s*tv\+?/i,          bg: '#000000', symbol: 'tv+' },
    { match: /youtube\s*(premium|music)?/i, bg: '#ff0000', symbol: '▶' },
    { match: /disney\+?/i,              bg: '#113ccf', symbol: 'D+' },
    { match: /hbo|max/i,                bg: '#0046ff', symbol: 'M' },
    { match: /prime\s*video|amazon\s*prime/i, bg: '#00a8e1', symbol: 'a' },
    { match: /paramount\+?/i,           bg: '#0064ff', symbol: 'P+' },
    { match: /chatgpt|openai/i,         bg: '#10a37f', symbol: '✦' },
    { match: /claude/i,                 bg: '#cc785c', symbol: 'C' },
    { match: /gemini|bard/i,            bg: '#1a73e8', symbol: 'G' },
    { match: /perplexity/i,             bg: '#20808d', symbol: '?' },
    { match: /github\s*copilot/i,       bg: '#24292e', symbol: '⌘' },
    { match: /github/i,                 bg: '#24292e', symbol: 'G' },
    { match: /gitlab/i,                 bg: '#fc6d26', symbol: 'GL' },
    { match: /notion/i,                 bg: '#000000', symbol: 'N' },
    { match: /figma/i,                  bg: '#1abcfe', symbol: 'F' },
    { match: /adobe/i,                  bg: '#fa0f00', symbol: 'A' },
    { match: /canva/i,                  bg: '#00c4cc', symbol: 'C' },
    { match: /1password/i,              bg: '#0572ec', symbol: '1' },
    { match: /bitwarden/i,              bg: '#175ddc', symbol: 'B' },
    { match: /lastpass/i,               bg: '#d32d27', symbol: 'L' },
    { match: /dropbox/i,                bg: '#0061ff', symbol: '◆' },
    { match: /icloud/i,                 bg: '#3b82f6', symbol: '☁' },
    { match: /google\s*one|google\s*drive/i, bg: '#4285f4', symbol: 'G' },
    { match: /microsoft\s*365|office\s*365/i, bg: '#d83b01', symbol: 'M' },
    { match: /onedrive/i,               bg: '#0078d4', symbol: '☁' },
    { match: /pcloud/i,                 bg: '#17bed0', symbol: 'p' },
    { match: /backblaze/i,              bg: '#f7341a', symbol: 'B' },
    // News & reading
    { match: /nytimes|nyt|new\s*york\s*times/i, bg: '#000000', symbol: 'T' },
    { match: /economist/i,              bg: '#e3120b', symbol: 'E' },
    { match: /substack/i,               bg: '#ff6719', symbol: 'S' },
    { match: /medium/i,                 bg: '#000000', symbol: 'M' },
    { match: /der\s*spiegel/i,          bg: '#dd1414', symbol: 'S' },
    { match: /zeit/i,                   bg: '#a51e22', symbol: 'Z' },
    { match: /le\s*monde/i,             bg: '#0a0a0a', symbol: 'M' },
    { match: /el\s*pa[ií]s/i,           bg: '#df1e2c', symbol: 'P' },
    { match: /telegraaf/i,              bg: '#0c2340', symbol: 'T' },
    { match: /volkskrant/i,             bg: '#e60000', symbol: 'V' },
    { match: /financial\s*times|^ft\b/i, bg: '#fff1e5', fg: '#0d7680', symbol: 'FT' },
    { match: /wsj|wall\s*street/i,      bg: '#000000', symbol: 'WSJ' },
    // Learning & wellness
    { match: /duolingo/i,               bg: '#58cc02', symbol: 'D' },
    { match: /headspace/i,              bg: '#f47d31', symbol: 'H' },
    { match: /calm/i,                   bg: '#1a73e8', symbol: 'C' },
    { match: /masterclass/i,            bg: '#000000', symbol: 'MC' },
    { match: /skillshare/i,             bg: '#f24a00', symbol: 'S' },
    { match: /coursera/i,               bg: '#0056d2', symbol: 'C' },
    // Books & audio
    { match: /audible/i,                bg: '#f8991c', symbol: 'A' },
    { match: /kindle\s*unlimited/i,     bg: '#232f3e', symbol: 'K' },
    { match: /storytel/i,               bg: '#ff5757', symbol: 'S' },
    { match: /scribd|everand/i,         bg: '#1e7b85', symbol: 'S' },
    // Fitness
    { match: /strava/i,                 bg: '#fc4c02', symbol: 'S' },
    { match: /fitbod/i,                 bg: '#00d4aa', symbol: 'F' },
    { match: /myfitnesspal/i,           bg: '#0072ce', symbol: 'M' },
    { match: /peloton/i,                bg: '#000000', symbol: 'P' },
    { match: /apple\s*fitness/i,        bg: '#34c759', symbol: 'F+' },
    { match: /\bgym\b|fitness\s*first|basic\s*fit|sportcity/i, bg: '#10b981', symbol: '💪' },
    // Music alternatives
    { match: /deezer/i,                 bg: '#9d4cff', symbol: 'D' },
    { match: /tidal/i,                  bg: '#000000', symbol: 'T' },
    { match: /soundcloud/i,             bg: '#ff5500', symbol: '~' },
    { match: /bandcamp/i,               bg: '#1da0c3', symbol: 'B' },
    // Gaming
    { match: /xbox\s*game\s*pass/i,     bg: '#107c10', symbol: 'X' },
    { match: /playstation\s*plus|ps\+/i, bg: '#0070d1', symbol: 'PS' },
    { match: /nintendo\s*online/i,      bg: '#e60012', symbol: 'N' },
    { match: /twitch/i,                 bg: '#9146ff', symbol: 'T' },
    { match: /steam/i,                  bg: '#1b2838', symbol: 'S' },
    { match: /ea\s*play/i,              bg: '#ff4747', symbol: 'EA' },
    { match: /ubisoft\+?/i,             bg: '#0066cc', symbol: 'U+' },
    // Privacy / VPN
    { match: /proton/i,                 bg: '#6d4aff', symbol: 'P' },
    { match: /nordvpn/i,                bg: '#4687ff', symbol: 'N' },
    { match: /expressvpn/i,             bg: '#da3940', symbol: 'E' },
    { match: /mullvad/i,                bg: '#fbcd31', fg: '#1a1a1a', symbol: 'M' },
    { match: /surfshark/i,              bg: '#1eba6c', symbol: 'S' },
    // Communication
    { match: /slack/i,                  bg: '#4a154b', symbol: '#' },
    { match: /discord\s*nitro/i,        bg: '#5865f2', symbol: 'D' },
    { match: /zoom/i,                   bg: '#2d8cff', symbol: 'Z' },
    { match: /linkedin/i,               bg: '#0a66c2', symbol: 'in' },
    // Streaming — regional
    { match: /videoland/i,              bg: '#000000', symbol: 'V' },
    { match: /nl\s*ziet|nlziet/i,       bg: '#ff6c00', symbol: 'N' },
    { match: /viaplay/i,                bg: '#1a1a1a', symbol: 'V' },
    { match: /streamz/i,                bg: '#7c3aed', symbol: 'S' },
    { match: /sky\s*go|skyq|sky\s*ticket|^sky\b/i, bg: '#0c1a3a', symbol: 'S' },
    { match: /canal\+?/i,               bg: '#000000', symbol: '+' },
    { match: /rtl\+/i,                  bg: '#ff0026', symbol: '+' },
    { match: /dazn/i,                   bg: '#f8f8ff', fg: '#000000', symbol: 'D' },
    // Food
    { match: /hellofresh/i,             bg: '#a4d233', fg: '#1a1a1a', symbol: 'HF' },
    { match: /uber\s*one|uber\s*eats/i, bg: '#000000', symbol: 'U' },
    { match: /deliveroo|too\s*good\s*to\s*go/i, bg: '#00ccbc', symbol: 'D' },
    { match: /spar\s*box|gousto|marley\s*spoon/i, bg: '#0c0c0c', symbol: '🥘' },
    { match: /wolt\+?/i,                bg: '#00c2e8', symbol: 'W+' },
    { match: /foodora\s*pro/i,          bg: '#ff007f', symbol: 'Fp' },
    // Creators
    { match: /onlyfans/i,               bg: '#00aff0', symbol: 'OF' },
    { match: /patreon/i,                bg: '#f96854', symbol: 'P' },
    { match: /buymeacoffee/i,           bg: '#ffdd00', fg: '#1a1a1a', symbol: 'B' },
    { match: /ko-?fi/i,                 bg: '#ff5e5b', symbol: 'k' },
    // Hungarian & European telco / banking / travel
    { match: /telekom/i,                bg: '#e20074', symbol: 'T' },
    { match: /yettel/i,                 bg: '#00aeef', symbol: 'Y' },
    { match: /vodafone/i,               bg: '#e60000', symbol: 'V' },
    { match: /skyshowtime/i,            bg: '#000000', symbol: 'S' },
    { match: /rtl\s*\+\s*(hu|magyar)/i, bg: '#0a0a0a', symbol: 'R+' },
    { match: /erste\s*bank|erste\s*számla/i, bg: '#005fa9', symbol: 'E' },
    { match: /otp\s*bank|otp\s*számla/i, bg: '#009900', symbol: 'O' },
    { match: /wizz\s*(discount|club)/i, bg: '#e0007b', symbol: 'W' },
    { match: /hvg\s*360/i,              bg: '#f78e1e', symbol: 'H360' },
    { match: /telex/i,                  bg: '#00aeef', symbol: 'T' },
    { match: /digi/i,                   bg: '#0054a6', symbol: 'D' },
    { match: /simplepay/i,              bg: '#25a75b', symbol: 'S' },
  ];

  // Default badge per category (when service is unknown)
  const CATEGORY_DEFAULTS = {
    Entertainment: { bg: '#fee2e2', fg: '#991b1b', symbol: '🎬' },
    Work:          { bg: '#dbeafe', fg: '#1e40af', symbol: '💼' },
    Music:         { bg: '#dcfce7', fg: '#166534', symbol: '🎵' },
    Fitness:       { bg: '#fef3c7', fg: '#854d0e', symbol: '💪' },
    Cloud:         { bg: '#cffafe', fg: '#075985', symbol: '☁️' },
    Food:          { bg: '#fed7aa', fg: '#9a3412', symbol: '🍕' },
    News:          { bg: '#e9d5ff', fg: '#6b21a8', symbol: '📰' },
    Other:         { bg: '#e7e5e4', fg: '#44403c', symbol: '📦' },
  };

  function badge(name, category) {
    const hit = BRANDS.find(b => b.match.test(name));
    if (hit) {
      return { bg: hit.bg, fg: hit.fg || '#ffffff', symbol: hit.symbol, branded: true };
    }
    const def = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.Other;
    return { ...def, branded: false };
  }

  function badgeHtml(name, category, size) {
    const b = badge(name, category);
    const s = size || 42;
    const fontSize = b.symbol.length > 2 ? Math.round(s * 0.34) : Math.round(s * 0.45);
    const style = `width:${s}px;height:${s}px;background:${b.bg};color:${b.fg};font-size:${fontSize}px;`;
    const cls = b.branded ? 'sub-icon branded' : 'sub-icon';
    return `<div class="${cls}" style="${style}">${escapeSym(b.symbol)}</div>`;
  }

  function escapeSym(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // ── Autocomplete suggestions ──
  // Given a partial name, return matching brand presets. We use the import.js
  // catalogue (LeakdImport.KNOWN) as the source of truth for price + category,
  // and pair it with this module's brand colour. Result is the top N matches.
  function suggestions(query, limit) {
    query = String(query || '').trim().toLowerCase();
    if (query.length < 1) return [];
    limit = limit || 6;
    const known = (window.LeakdImport && window.LeakdImport.KNOWN) || [];
    const seen = new Set();
    const out = [];
    for (const k of known) {
      // Prefer prefix-of-display-name matches over regex matches for relevance
      const name = k.name;
      if (seen.has(name.toLowerCase())) continue;
      const nameLower = name.toLowerCase();
      const starts = nameLower.startsWith(query);
      const contains = nameLower.includes(query);
      const regex = k.match && k.match.test(query);
      if (starts || contains || regex) {
        seen.add(nameLower);
        const b = badge(name, k.cat);
        out.push({
          name, price: k.price, category: k.cat,
          badge: b,
          score: starts ? 3 : contains ? 2 : 1,
        });
        if (out.length >= limit * 2) break;
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit);
  }

  window.LeakdBrands = { badge, badgeHtml, suggestions, BRANDS, CATEGORY_DEFAULTS };
})();
