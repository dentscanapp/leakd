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

  window.LeakdAlternatives = { findAlternatives, ALTERNATIVES };
})();
