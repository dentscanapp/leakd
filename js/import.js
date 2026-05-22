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
    { match: /\b(hbo|hbo\s*max|max)\b/i, name: 'HBO Max',     price: 15.99, cat: 'Entertainment', cancel: 'https://www.max.com/subscription' },
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
    { match: /\bmedium\b/i,          name: 'Medium',           price: 5.00,  cat: 'News', cancel: 'https://medium.com/me/membership' },
    { match: /duolingo/i,           name: 'Duolingo Super',   price: 6.99,  cat: 'Other', cancel: 'https://www.duolingo.com/settings/subscription' },
    { match: /headspace/i,          name: 'Headspace',        price: 12.99, cat: 'Other', cancel: 'https://www.headspace.com/subscription' },
    { match: /\bcalm\b/i,            name: 'Calm',             price: 14.99, cat: 'Other', cancel: 'https://www.calm.com/account/subscription' },
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
    { match: /\b(volkskrant|nrc|trouw|fd)\b/i, name: 'Krant abonnement', price: 18.50, cat: 'News', cancel: null },
    { match: /\b(der\s*spiegel|zeit)\b/i, name: 'Der Spiegel',      price: 19.99, cat: 'News', cancel: null },
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
    { match: /wolt\+?/i,            name: 'Wolt+',            price: 1490.00, currency: 'HUF', cat: 'Food', cancel: 'https://wolt.com/me' },
    { match: /foodora\s*pro/i,      name: 'Foodora Pro',      price: 1290.00, currency: 'HUF', cat: 'Food', cancel: 'https://www.foodora.hu' },
    { match: /telekom\s*(előfizetés|mobil)/i, name: 'Telekom mobil', price: 8000.00, currency: 'HUF', cat: 'Other', cancel: 'https://www.telekom.hu' },
    { match: /yettel\s*(előfizetés|mobil)/i, name: 'Yettel mobil', price: 6000.00, currency: 'HUF', cat: 'Other', cancel: 'https://www.yettel.hu' },
    { match: /vodafone\s*(előfizetés|mobil)/i, name: 'Vodafone mobil', price: 7000.00, currency: 'HUF', cat: 'Other', cancel: 'https://www.vodafone.hu' },
    { match: /skyshowtime/i,        name: 'SkyShowtime',      price: 1990.00, currency: 'HUF', cat: 'Entertainment', cancel: 'https://www.skyshowtime.com/my-account/subscription' },
    { match: /rtl\s*\+\s*(hu|magyar)?/i, name: 'RTL+ (HU)',   price: 2990.00, currency: 'HUF', cat: 'Entertainment', cancel: 'https://www.rtlplusz.hu/profil' },
    { match: /erste\s*bank|erste\s*számla/i, name: 'Erste számladíj', price: 1500.00, currency: 'HUF', cat: 'Other', cancel: 'https://www.erstebank.hu' },
    { match: /otp\s*bank|otp\s*számla/i, name: 'OTP számladíj', price: 1200.00, currency: 'HUF', cat: 'Other', cancel: 'https://www.otpbank.hu' },
    { match: /wizz\s*(discount|club)/i, name: 'Wizz Discount Club', price: 15900.00, currency: 'HUF', cat: 'Other', cancel: 'https://wizzair.com' },
    { match: /spotify\s*family/i,   name: 'Spotify Family',   price: 3290.00, currency: 'HUF', cat: 'Music', cancel: 'https://www.spotify.com/account/subscription/' },
    { match: /netflix\s*(premium|family)/i, name: 'Netflix Premium', price: 4490.00, currency: 'HUF', cat: 'Entertainment', cancel: 'https://www.netflix.com/cancelplan' },
    { match: /youtube\s*(premium\s*)?family/i, name: 'YouTube Premium Family', price: 2790.00, currency: 'HUF', cat: 'Entertainment', cancel: 'https://www.youtube.com/paid_memberships' },
    { match: /wolt\+?\s*(éves|yearly)/i, name: 'Wolt+ éves', price: 14990.00, currency: 'HUF', cat: 'Food', cancel: 'https://wolt.com/me' },
    { match: /duolingo\s*(family|családi)/i, name: 'Duolingo Családi', price: 3790.00, currency: 'HUF', cat: 'Other', cancel: 'https://www.duolingo.com/settings/subscription' },
    { match: /telekom\s*(otthoni|internet|tv)/i, name: 'Telekom Otthoni', price: 6000.00, currency: 'HUF', cat: 'Entertainment', cancel: 'https://www.telekom.hu' },
    { match: /digi\s*(előfizetés|internet|tv)/i, name: 'DIGI Internet & TV', price: 5500.00, currency: 'HUF', cat: 'Entertainment', cancel: 'https://ugyfelkapu.digi.hu' },
    { match: /canva\s*pro/i,        name: 'Canva Pro',        price: 3990.00, currency: 'HUF', cat: 'Work', cancel: 'https://www.canva.com/settings/billing-and-plans' },
    { match: /hvg\s*360/i,          name: 'HVG360',           price: 2490.00, currency: 'HUF', cat: 'News', cancel: 'https://hvg.hu/hvg360' },
    { match: /telex\s*(támogatás|támogató)/i, name: 'Telex támogatás', price: 3000.00, currency: 'HUF', cat: 'News', cancel: 'https://telex.hu/tamogatas' },
    { match: /simplepay/i,          name: 'SimplePay fizetés', price: 1500.00, currency: 'HUF', cat: 'Other', cancel: 'https://www.simplepay.hu' },
    { match: /dazn/i,               name: 'DAZN',             price: 29.99,   currency: 'EUR', cat: 'Entertainment', cancel: 'https://www.dazn.com/en-DE/my-account/subscription' },
    { match: /joyn/i,               name: 'Joyn PLUS+',       price: 6.99,    currency: 'EUR', cat: 'Entertainment', cancel: 'https://www.joyn.de/profil' },
    { match: /zattoo/i,             name: 'Zattoo Ultimate',  price: 13.99,   currency: 'EUR', cat: 'Entertainment', cancel: 'https://zattoo.com/account/subscription' },
    { match: /orf\s*(beitrag|obs|gis)/i, name: 'ORF Beitrag', price: 15.30,   currency: 'EUR', cat: 'Other', cancel: 'https://orf.beitrag.at' },
    { match: /deutschlandticket|^d-ticket/i, name: 'Deutschlandticket', price: 49.00, currency: 'EUR', cat: 'Other', cancel: 'https://www.deutschlandticket.de' },
    { match: /öbb|vorteilscard/i,        name: 'ÖBB Vorteilscard', price: 66.00, currency: 'EUR', cat: 'Other', cancel: 'https://www.oebb.at' },
    { match: /bahncard/i,           name: 'BahnCard 25',      price: 59.90,   currency: 'EUR', cat: 'Other', cancel: 'https://www.bahn.de' },
    { match: /serafe/i,             name: 'Serafe fee',       price: 335.00,  currency: 'CHF', cat: 'Other', cancel: 'https://www.serafe.ch' },
    { match: /sbb\s*ga|general\s*abonnement/i, name: 'SBB GA Travelcard', price: 340.00, currency: 'CHF', cat: 'Other', cancel: 'https://www.sbb.ch' },
    { match: /sbb\s*halbtax|half\s*fare/i, name: 'SBB Halbtax', price: 190.00, currency: 'CHF', cat: 'Other', cancel: 'https://www.sbb.ch' },
    { match: /ns\s*flex|nederlandse\s*spoorwegen/i, name: 'NS Flex subscription', price: 35.60, currency: 'EUR', cat: 'Other', cancel: 'https://www.ns.nl/mijnns' },
    { match: /videoland/i,          name: 'Videoland Basis',  price: 4.99,    currency: 'EUR', cat: 'Entertainment', cancel: 'https://www.videoland.com' },
    { match: /nl\s*ziet|nlziet/i,   name: 'NLZIET',           price: 8.95,    currency: 'EUR', cat: 'Entertainment', cancel: 'https://www.nlziet.nl/en/my-account/' },
    { match: /tv\s*licence|tv\s*licensing/i, name: 'TV Licence (UK)', price: 169.50, currency: 'GBP', cat: 'Other', cancel: 'https://www.tvlicensing.co.uk/cs/cancel/index.app' },
    { match: /deliveroo\s*plus/i,   name: 'Deliveroo Plus',   price: 3.49,    currency: 'GBP', cat: 'Food', cancel: 'https://deliveroo.co.uk/menu' },
    { match: /now\s*tv|^now\b/i,    name: 'NOW TV Pass',      price: 9.99,    currency: 'GBP', cat: 'Entertainment', cancel: 'https://www.nowtv.com/home/myaccount' },
    { match: /telepass/i,           name: 'Telepass toll',    price: 3.90,    currency: 'EUR', cat: 'Other', cancel: 'https://www.telepass.com/en/privati/supporto' },
    { match: /tim\s*vision|telecom\s*italia/i, name: 'TIM Vision', price: 6.99, currency: 'EUR', cat: 'Entertainment', cancel: 'https://www.tim.it/assistenza' },
    { match: /canal\+?/i,           name: 'Canal+ FR',        price: 22.99,   currency: 'EUR', cat: 'Entertainment', cancel: 'https://client.canalplus.com/abonnement/' },
    { match: /deezer/i,             name: 'Deezer Premium',   price: 11.99,   currency: 'EUR', cat: 'Music', cancel: 'https://www.deezer.com/account/subscription' },
    { match: /navigo|ile-de-france\s*mobilit/i, name: 'Pass Navigo', price: 86.40, currency: 'EUR', cat: 'Other', cancel: 'https://www.iledefrance-mobilites.fr/en/tickets-fares/media/navigo-travel-card' },
    // ── Expansion: 100+ additional services with cancel URLs ──
    // Productivity & Work
    { match: /trello/i,               name: 'Trello Premium',    price: 10.00, cat: 'Work', cancel: 'https://trello.com/your/account' },
    { match: /asana/i,                name: 'Asana Premium',     price: 10.99, cat: 'Work', cancel: 'https://app.asana.com/0/billing' },
    { match: /monday\.com|monday/i,   name: 'Monday.com',        price: 9.00,  cat: 'Work', cancel: 'https://auth.monday.com/account/billing' },
    { match: /clickup/i,              name: 'ClickUp',           price: 7.00,  cat: 'Work', cancel: 'https://app.clickup.com/settings/billing' },
    { match: /todoist/i,              name: 'Todoist Pro',       price: 4.00,  cat: 'Work', cancel: 'https://todoist.com/app/settings/subscription' },
    { match: /evernote/i,             name: 'Evernote',          price: 14.99, cat: 'Work', cancel: 'https://www.evernote.com/Settings.action' },
    { match: /miro/i,                 name: 'Miro',              price: 8.00,  cat: 'Work', cancel: 'https://miro.com/app/settings/company/billing/' },
    { match: /airtable/i,             name: 'Airtable',          price: 20.00, cat: 'Work', cancel: 'https://airtable.com/account/billing' },
    { match: /coda\.io|coda/i,        name: 'Coda',              price: 10.00, cat: 'Work', cancel: 'https://coda.io/account' },
    { match: /basecamp/i,             name: 'Basecamp',          price: 15.00, cat: 'Work', cancel: 'https://launchpad.37signals.com/account' },
    { match: /loom/i,                 name: 'Loom',              price: 12.50, cat: 'Work', cancel: 'https://www.loom.com/account/billing' },
    { match: /calendly/i,             name: 'Calendly',          price: 10.00, cat: 'Work', cancel: 'https://calendly.com/app/admin/billing' },
    { match: /hubspot/i,              name: 'HubSpot',           price: 20.00, cat: 'Work', cancel: 'https://app.hubspot.com/account-and-billing' },
    { match: /salesforce/i,           name: 'Salesforce',        price: 25.00, cat: 'Work', cancel: 'https://login.salesforce.com/' },
    { match: /freshdesk|freshworks/i, name: 'Freshworks',        price: 15.00, cat: 'Work', cancel: 'https://billing.freshworks.com/' },
    // Design & Creative
    { match: /sketch/i,               name: 'Sketch',            price: 10.00, cat: 'Work', cancel: 'https://www.sketch.com/settings/billing/' },
    { match: /invision/i,             name: 'InVision',          price: 7.95,  cat: 'Work', cancel: 'https://projects.invisionapp.com/account/billing' },
    { match: /procreate\s*dreams/i,   name: 'Procreate Dreams',  price: 2.99,  cat: 'Work', cancel: 'https://support.apple.com/en-us/118428' },
    { match: /shutterstock/i,         name: 'Shutterstock',      price: 29.00, cat: 'Work', cancel: 'https://www.shutterstock.com/account/plans' },
    { match: /envato\s*elements/i,    name: 'Envato Elements',   price: 16.50, cat: 'Work', cancel: 'https://account.envato.com/subscriptions' },
    // Developer & DevOps
    { match: /jetbrains/i,            name: 'JetBrains',         price: 24.90, cat: 'Work', cancel: 'https://account.jetbrains.com/licenses' },
    { match: /vercel/i,               name: 'Vercel Pro',        price: 20.00, cat: 'Work', cancel: 'https://vercel.com/account/billing' },
    { match: /netlify/i,              name: 'Netlify Pro',       price: 19.00, cat: 'Work', cancel: 'https://app.netlify.com/account/billing' },
    { match: /heroku/i,               name: 'Heroku',            price: 5.00,  cat: 'Work', cancel: 'https://dashboard.heroku.com/account/billing' },
    { match: /digitalocean/i,         name: 'DigitalOcean',      price: 5.00,  cat: 'Cloud', cancel: 'https://cloud.digitalocean.com/account/billing' },
    { match: /linode|akamai\s*cloud/i, name: 'Linode',           price: 5.00,  cat: 'Cloud', cancel: 'https://cloud.linode.com/account/billing' },
    { match: /aws/i,                  name: 'AWS',               price: 10.00, cat: 'Cloud', cancel: 'https://console.aws.amazon.com/billing/home' },
    { match: /cloudflare/i,           name: 'Cloudflare',        price: 20.00, cat: 'Work', cancel: 'https://dash.cloudflare.com/?to=/:account/billing' },
    { match: /docker/i,               name: 'Docker Pro',        price: 5.00,  cat: 'Work', cancel: 'https://hub.docker.com/billing' },
    { match: /npm\s*pro/i,            name: 'npm Pro',           price: 7.00,  cat: 'Work', cancel: 'https://www.npmjs.com/settings/billing' },
    { match: /sentry/i,               name: 'Sentry',            price: 26.00, cat: 'Work', cancel: 'https://sentry.io/settings/billing/' },
    { match: /datadog/i,              name: 'Datadog',           price: 15.00, cat: 'Work', cancel: 'https://app.datadoghq.com/billing/plan' },
    // Communication & Meetings
    { match: /teams/i,                name: 'Microsoft Teams',   price: 4.00,  cat: 'Work', cancel: 'https://admin.microsoft.com/adminportal/home#/subscriptions' },
    { match: /webex/i,                name: 'Webex',             price: 13.50, cat: 'Work', cancel: 'https://settings.webex.com/billing' },
    { match: /discord\s*nitro/i,      name: 'Discord Nitro',     price: 9.99,  cat: 'Entertainment', cancel: 'https://discord.com/settings/subscriptions' },
    { match: /telegram\s*premium/i,   name: 'Telegram Premium',  price: 4.99,  cat: 'Other', cancel: 'https://my.telegram.org/' },
    { match: /whatsapp\s*business/i,  name: 'WhatsApp Business', price: 0.00,  cat: 'Work', cancel: null },
    // VPN & Security (additional)
    { match: /cyberghost/i,           name: 'CyberGhost',        price: 12.99, cat: 'Work', cancel: 'https://my.cyberghostvpn.com/account/subscription' },
    { match: /pia|private\s*internet/i, name: 'PIA VPN',         price: 11.95, cat: 'Work', cancel: 'https://www.privateinternetaccess.com/account' },
    { match: /tunnelbear/i,           name: 'TunnelBear',        price: 3.33,  cat: 'Work', cancel: 'https://www.tunnelbear.com/account' },
    { match: /dashlane/i,             name: 'Dashlane',          price: 4.99,  cat: 'Work', cancel: 'https://app.dashlane.com/my-account' },
    { match: /keeper/i,               name: 'Keeper',            price: 2.92,  cat: 'Work', cancel: 'https://keepersecurity.com/account/' },
    { match: /norton/i,               name: 'Norton 360',        price: 9.99,  cat: 'Work', cancel: 'https://my.norton.com/extspa/subscriptions' },
    { match: /mcafee/i,               name: 'McAfee',            price: 9.99,  cat: 'Work', cancel: 'https://home.mcafee.com/root/myaccount.aspx' },
    { match: /kaspersky/i,            name: 'Kaspersky',         price: 4.99,  cat: 'Work', cancel: 'https://my.kaspersky.com/subscriptions' },
    { match: /malwarebytes/i,         name: 'Malwarebytes',      price: 3.75,  cat: 'Work', cancel: 'https://my.malwarebytes.com/account/subscriptions' },
    // Email & Domains
    { match: /namecheap/i,            name: 'Namecheap',         price: 12.98, cat: 'Work', cancel: 'https://ap.www.namecheap.com/dashboard' },
    { match: /godaddy/i,              name: 'GoDaddy',           price: 11.99, cat: 'Work', cancel: 'https://account.godaddy.com/products' },
    { match: /squarespace/i,          name: 'Squarespace',       price: 16.00, cat: 'Work', cancel: 'https://account.squarespace.com/billing' },
    { match: /wix/i,                  name: 'Wix Premium',       price: 16.00, cat: 'Work', cancel: 'https://www.wix.com/account/billing' },
    { match: /wordpress\.com|wpcom/i, name: 'WordPress.com',     price: 7.00,  cat: 'Work', cancel: 'https://wordpress.com/me/purchases' },
    { match: /mailchimp/i,            name: 'Mailchimp',         price: 13.00, cat: 'Work', cancel: 'https://admin.mailchimp.com/account/billing-history/' },
    { match: /convertkit/i,           name: 'ConvertKit',        price: 9.00,  cat: 'Work', cancel: 'https://app.convertkit.com/account/billing' },
    // Education & Learning
    { match: /skillshare/i,           name: 'Skillshare',        price: 13.99, cat: 'Other', cancel: 'https://www.skillshare.com/settings/payments' },
    { match: /masterclass/i,          name: 'MasterClass',       price: 10.00, cat: 'Other', cancel: 'https://www.masterclass.com/settings/subscriptions' },
    { match: /coursera/i,             name: 'Coursera Plus',     price: 49.00, cat: 'Other', cancel: 'https://www.coursera.org/my-purchases' },
    { match: /udemy/i,                name: 'Udemy Pro',         price: 19.99, cat: 'Other', cancel: 'https://www.udemy.com/user/edit-account/' },
    { match: /brilliant/i,            name: 'Brilliant',         price: 13.49, cat: 'Other', cancel: 'https://brilliant.org/account/' },
    { match: /babbel/i,               name: 'Babbel',            price: 13.95, cat: 'Other', cancel: 'https://my.babbel.com/subscription' },
    { match: /rosetta\s*stone/i,      name: 'Rosetta Stone',     price: 11.99, cat: 'Other', cancel: 'https://support.rosettastone.com/articles/en_US/Manage-Your-Subscription' },
    { match: /blinkist/i,             name: 'Blinkist',          price: 7.49,  cat: 'Other', cancel: 'https://www.blinkist.com/nc/settings/account' },
    // Dating & Social
    { match: /tinder/i,               name: 'Tinder',            price: 14.99, cat: 'Other', cancel: 'https://account.gotinder.com/subscription' },
    { match: /bumble/i,               name: 'Bumble Premium',    price: 29.99, cat: 'Other', cancel: 'https://bumble.com/get-started' },
    { match: /hinge/i,                name: 'Hinge+',            price: 29.99, cat: 'Other', cancel: null },
    { match: /match\.com|match/i,     name: 'Match.com',         price: 21.99, cat: 'Other', cancel: 'https://www.match.com/dnsr/cpx/subscription' },
    { match: /okcupid/i,              name: 'OkCupid Premium',   price: 19.99, cat: 'Other', cancel: 'https://www.okcupid.com/settings/subscription' },
    // Fitness (additional)
    { match: /nike\s*training|ntc/i,  name: 'Nike Training Club', price: 14.99, cat: 'Fitness', cancel: 'https://www.nike.com/member/settings' },
    { match: /\bwhoop\b/i,            name: 'WHOOP',             price: 30.00, cat: 'Fitness', cancel: 'https://app.whoop.com/account/membership' },
    { match: /noom/i,                 name: 'Noom',              price: 59.00, cat: 'Fitness', cancel: 'https://web.noom.com/account/' },
    { match: /apple\s*fitness\+?/i,   name: 'Apple Fitness+',    price: 9.99,  cat: 'Fitness', cancel: 'https://support.apple.com/en-us/118428' },
    { match: /classpass/i,            name: 'ClassPass',         price: 49.00, cat: 'Fitness', cancel: 'https://classpass.com/account/membership' },
    // Food Delivery & Meal Kits (additional)
    { match: /uber\s*one/i,           name: 'Uber One',          price: 9.99,  cat: 'Food', cancel: 'https://account.uber.com/spending' },
    { match: /doordash/i,             name: 'DashPass',          price: 9.99,  cat: 'Food', cancel: 'https://www.doordash.com/consumer/membership/' },
    { match: /grubhub/i,              name: 'Grubhub+',          price: 9.99,  cat: 'Food', cancel: 'https://www.grubhub.com/account/membership' },
    { match: /instacart/i,            name: 'Instacart+',        price: 9.99,  cat: 'Food', cancel: 'https://www.instacart.com/store/account/manage_membership' },
    { match: /blue\s*apron/i,         name: 'Blue Apron',        price: 47.95, cat: 'Food', cancel: 'https://www.blueapron.com/account' },
    { match: /factor|factor_/i,       name: 'Factor Meals',      price: 43.99, cat: 'Food', cancel: 'https://www.factor75.com/my-account' },
    // Cloud Storage (additional)
    { match: /backblaze/i,            name: 'Backblaze',         price: 7.00,  cat: 'Cloud', cancel: 'https://secure.backblaze.com/user_overview.htm' },
    { match: /idrive/i,               name: 'IDrive',            price: 5.95,  cat: 'Cloud', cancel: 'https://www.idrive.com/idrive/login/loginForm' },
    { match: /mega/i,                 name: 'MEGA Pro',          price: 4.99,  cat: 'Cloud', cancel: 'https://mega.nz/account' },
    { match: /sync\.com/i,            name: 'Sync.com',          price: 8.00,  cat: 'Cloud', cancel: 'https://cp.sync.com/account' },
    // Books & Audio (additional)
    { match: /bookmate/i,             name: 'Bookmate',          price: 8.99,  cat: 'Entertainment', cancel: 'https://bookmate.com/settings' },
    { match: /kobo\s*plus/i,          name: 'Kobo Plus',         price: 7.99,  cat: 'Entertainment', cancel: 'https://www.kobo.com/account' },
    // Gaming (additional)
    { match: /ea\s*play/i,            name: 'EA Play',           price: 4.99,  cat: 'Entertainment', cancel: 'https://myaccount.ea.com/cp-ui/subscriptions' },
    { match: /ubisoft\+?/i,           name: 'Ubisoft+',          price: 14.99, cat: 'Entertainment', cancel: 'https://store.ubi.com/account' },
    { match: /geforce\s*now/i,        name: 'GeForce NOW',       price: 9.99,  cat: 'Entertainment', cancel: 'https://www.nvidia.com/en-us/account/gfn/' },
    { match: /humble\s*(choice|bundle)/i, name: 'Humble Choice', price: 11.99, cat: 'Entertainment', cancel: 'https://www.humblebundle.com/subscription' },
    { match: /crunchyroll/i,          name: 'Crunchyroll',       price: 7.99,  cat: 'Entertainment', cancel: 'https://www.crunchyroll.com/account/subscription' },
    { match: /funimation/i,           name: 'Funimation',        price: 7.99,  cat: 'Entertainment', cancel: 'https://www.funimation.com/account/' },
    // News & Media (additional)
    { match: /washington\s*post|wapo/i, name: 'Washington Post', price: 10.00, cat: 'News', cancel: 'https://www.washingtonpost.com/my-account/subscriptions/' },
    { match: /guardian/i,             name: 'The Guardian',       price: 5.00,  cat: 'News', cancel: 'https://manage.theguardian.com/' },
    { match: /wired/i,                name: 'WIRED',              price: 4.99,  cat: 'News', cancel: 'https://www.wired.com/account/subscriptions' },
    { match: /atlantic/i,             name: 'The Atlantic',       price: 7.99,  cat: 'News', cancel: 'https://accounts.theatlantic.com/accounts/subscription/' },
    { match: /new\s*yorker/i,         name: 'The New Yorker',     price: 6.99,  cat: 'News', cancel: 'https://w1.buysub.com/loc/NYR/ATGFail498' },
    { match: /bloomberg/i,            name: 'Bloomberg',          price: 34.99, cat: 'News', cancel: 'https://login.bloomberg.com/account' },
    { match: /reuters/i,              name: 'Reuters',            price: 34.99, cat: 'News', cancel: 'https://www.reuters.com/account/' },
    { match: /bild\+?/i,              name: 'BILDplus',           price: 7.99,  currency: 'EUR', cat: 'News', cancel: 'https://mein.bild.de/aboverwaltung/' },
    { match: /sueddeutsche|sz\+/i,    name: 'SZ Plus',            price: 14.99, currency: 'EUR', cat: 'News', cancel: 'https://service.sueddeutsche.de/' },
    { match: /corriere/i,             name: 'Corriere della Sera', price: 9.99, currency: 'EUR', cat: 'News', cancel: 'https://abbonamenti.corriere.it/profilo' },
    { match: /la\s*repubblica/i,      name: 'La Repubblica',      price: 9.99,  currency: 'EUR', cat: 'News', cancel: 'https://abbonamenti.repubblica.it/profilo' },
    // Streaming — additional international
    { match: /peacock/i,              name: 'Peacock',            price: 5.99,  cat: 'Entertainment', cancel: 'https://www.peacocktv.com/account/subscription' },
    { match: /discovery\+?/i,         name: 'Discovery+',         price: 4.99,  cat: 'Entertainment', cancel: 'https://www.discoveryplus.com/account' },
    { match: /mubi/i,                 name: 'MUBI',               price: 11.99, cat: 'Entertainment', cancel: 'https://mubi.com/account' },
    { match: /criterion\s*channel/i,  name: 'Criterion Channel',  price: 10.99, cat: 'Entertainment', cancel: 'https://www.criterionchannel.com/account' },
    { match: /britbox/i,              name: 'BritBox',            price: 7.99,  cat: 'Entertainment', cancel: 'https://www.britbox.com/account/subscription' },
    { match: /curiosity\s*stream/i,   name: 'CuriosityStream',    price: 2.99,  cat: 'Entertainment', cancel: 'https://app.curiositystream.com/settings/account' },
    { match: /shudder/i,              name: 'Shudder',            price: 5.99,  cat: 'Entertainment', cancel: 'https://www.shudder.com/account' },
    // European regional (additional)
    { match: /yle\s*areena/i,         name: 'Yle Areena',         price: 0.00,  currency: 'EUR', cat: 'Entertainment', cancel: null },
    { match: /nrk/i,                  name: 'NRK',                price: 0.00,  currency: 'NOK', cat: 'Entertainment', cancel: null },
    { match: /svt\s*play/i,           name: 'SVT Play',           price: 0.00,  currency: 'SEK', cat: 'Entertainment', cancel: null },
    { match: /tv2\s*play/i,           name: 'TV2 Play',           price: 89.00, currency: 'DKK', cat: 'Entertainment', cancel: 'https://play.tv2.dk/min-side' },
    { match: /hbo\s*max/i,            name: 'HBO Max',            price: 12.99, currency: 'EUR', cat: 'Entertainment', cancel: 'https://www.max.com/account' },
    { match: /movistar\+?/i,          name: 'Movistar+',          price: 10.00, currency: 'EUR', cat: 'Entertainment', cancel: 'https://www.movistar.es/particulares/Soporte/mimovistar/' },
    { match: /filmin/i,               name: 'Filmin',             price: 7.99,  currency: 'EUR', cat: 'Entertainment', cancel: 'https://www.filmin.es/cuenta' },
    { match: /bol\.com\s*select/i,    name: 'bol.com Select',     price: 12.99, currency: 'EUR', cat: 'Other', cancel: 'https://www.bol.com/nl/rnwy/account/select/' },
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
    'Wolt+': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Open Wolt app or wolt.com and sign in',
        'Go to your Profile → Wolt+',
        'Click "Manage Membership" or "Cancel Subscription" and confirm',
      ],
    },
    'Foodora Pro': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Open Foodora app or website and log in',
        'Go to your Account → Foodora Pro',
        'Tap "Cancel subscription" and confirm',
      ],
    },
    'Telekom mobil': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Log in to the Telekom online portal or app',
        'Go to "Subscriptions" or "Contracts"',
        'For fixed term, check expiry. Otherwise, click "Modify/Cancel contract" or contact support via chat',
      ],
    },
    'Yettel mobil': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Log in to the Yettel app or website',
        'Under subscriptions, check your active tariff',
        'To cancel, you must request termination online, by phone, or visit a store if under loyalty contract',
      ],
    },
    'Vodafone mobil': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Log in to your My Vodafone account',
        'Under active services, review your contract loyalty period',
        'Submit a cancellation request or use the support chat to terminate',
      ],
    },
    'SkyShowtime': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Open skyshowtime.com and sign in',
        'Go to your Account → Subscriptions',
        'Click "Cancel Subscription" and confirm',
      ],
    },
    'RTL+ (HU)': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Log in to your RTL+ account',
        'Open your Profile and go to "Subscription management"',
        'Click "Cancel Auto-Renewal" and confirm',
      ],
    },
    'Erste számladíj': {
      difficulty: 'hard',
      minutes: 15,
      steps: [
        'You must close the bank account',
        'Open George app or web, send a message, or visit a branch in person',
        'Clear any negative balance, sign account closure forms',
      ],
    },
    'OTP számladíj': {
      difficulty: 'hard',
      minutes: 15,
      steps: [
        'OTP account fee cannot be cancelled directly; you must close the account',
        'Visit a local OTP branch in person with your ID',
        'Return any debit/credit cards and sign the termination protocol',
      ],
    },
    'Wizz Discount Club': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Log in to wizzair.com',
        'Go to your Profile → Wizz Discount Club',
        'Turn off Auto-Renewal or let it expire naturally',
      ],
    },
    'Spotify Family': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Go to spotify.com/account',
        'Click "Manage your plan"',
        'Choose "Cancel Premium" and confirm',
      ],
    },
    'YouTube Premium Family': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Open youtube.com/paid_memberships',
        'Click YouTube Premium Family → "Deactivate"',
        'Confirm cancellation',
      ],
    },
    'Wolt+ éves': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Open Wolt app or wolt.com and sign in',
        'Go to your Profile → Wolt+',
        'Click "Manage Membership" or "Cancel Subscription" and confirm',
      ],
    },
    'Duolingo Családi': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Open duolingo.com/settings/subscription',
        'Click "Cancel Subscription"',
        'Confirm',
      ],
    },
    'Telekom Otthoni': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Log in to the Telekom online portal or app',
        'Go to "My Subscriptions" → "Home services"',
        'Check contract loyalty, then submit a disconnect request or contact support via chat',
      ],
    },
    'DIGI Internet & TV': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Log in to DIGI Ügyfélkapu (client portal)',
        'Go to "Subscriptions" (Előfizetések)',
        'Request termination online, or contact support by phone or in person',
      ],
    },
    'Canva Pro': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Log in to canva.com',
        'Click your profile → Settings → "Billing & Plans"',
        'Under your subscription, click "Cancel subscription" and confirm',
      ],
    },
    'HVG360': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Log in to hvg.hu',
        'Go to your Profile → hvg360 settings',
        'Click "Cancel Auto-Renewal" and confirm',
      ],
    },
    'Telex támogatás': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Go to Telex portal and log in',
        'Go to "My support" (Támogatásaim)',
        'Click "Cancel recurring support" or manage via SimplePay/Stripe dashboard',
      ],
    },
    'SimplePay fizetés': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Open the recurring payment confirmation email from SimplePay',
        'Click the unique "Manage subscription" link in the email footer',
        'Cancel the active token, or block it via your bank card settings if link is missing',
      ],
    },
    'DAZN': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Sign in to dazn.com',
        'Go to "My Account" → "Subscription"',
        'Click "Cancel Subscription" and confirm',
      ],
    },
    'Joyn PLUS+': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Log in to joyn.de or joyn.at',
        'Go to your Profile → Subscription',
        'Click "Cancel PLUS+ membership" and confirm',
      ],
    },
    'Zattoo Ultimate': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Log in to zattoo.com',
        'Go to Account → Subscription',
        'Click "Manage subscription" → "Cancel auto-renewal" and confirm',
      ],
    },
    'ORF Beitrag': {
      difficulty: 'hard',
      minutes: 15,
      steps: [
        'Go to orf.beitrag.at (formerly GIS)',
        'Fill in the online deregulation form (Abmeldung) due to moving, exemption, or no devices',
        'Sign the PDF, upload ID, and submit online',
      ],
    },
    'Deutschlandticket': {
      difficulty: 'medium',
      minutes: 3,
      steps: [
        'Log in to the portal where you purchased it (DB Navigator or local authority)',
        'Go to active subscriptions and click "Cancel subscription"',
        'Must cancel before the 10th of the current month to stop next month\'s billing',
      ],
    },
    'ÖBB Vorteilscard': {
      difficulty: 'medium',
      minutes: 3,
      steps: [
        'Log in to your ÖBB account',
        'Under Vorteilscard, click "Disable Auto-Renewal" (Kündigungsschutz)',
        'Cancel online at least 1 month before expiry to prevent renewal billing',
      ],
    },
    'BahnCard 25': {
      difficulty: 'medium',
      minutes: 4,
      steps: [
        'Log in to bahn.de or DB Navigator app',
        'Go to BahnCard Services → "Manage BahnCard"',
        'Click "Cancel BahnCard subscription" (Kündigen) at least 6 weeks before renewal',
      ],
    },
    'Serafe fee': {
      difficulty: 'hard',
      minutes: 15,
      steps: [
        'Open serafe.ch or contact Serafe AG directly',
        'Exemption or cancellation is only allowed if moving abroad, household merging, or meeting deaf/blind criteria',
        'Submit written deregulation notification with official proof to Serafe or your municipal authority',
      ],
    },
    'SBB GA Travelcard': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Log in to Swisspass.ch or sbb.ch',
        'Go to "My Swisspass" → "My Subscriptions"',
        'Disable automatic renewal online at least 1 month before the annual renewal date, or return card to SBB counter',
      ],
    },
    'SBB Halbtax': {
      difficulty: 'medium',
      minutes: 4,
      steps: [
        'Log in to Swisspass.ch',
        'Go to active subscriptions and click "Cancel renewal"',
        'Must cancel at least 1 month before expiry to prevent automatic renewal billing',
      ],
    },
    'NS Flex subscription': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Log in to Mijn NS on ns.nl',
        'Go to "Products" → "Change subscription"',
        'Downgrade to "NS Flex Basis" (0 EUR/mo) to stop monthly charges while keeping your card, or cancel at a ticket machine',
      ],
    },
    'Videoland Basis': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Log in to videoland.com',
        'Go to Account Settings → subscription',
        'Click "Cancel subscription" and confirm',
      ],
    },
    'NLZIET': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Log in to nlziet.nl',
        'Go to Account → Subscription',
        'Click "Cancel subscription" and confirm',
      ],
    },
    'TV Licence (UK)': {
      difficulty: 'medium',
      minutes: 10,
      steps: [
        'Go to tvlicensing.co.uk',
        'Declare that you no longer watch live TV or BBC iPlayer on any device',
        'Submit the online refund or cancellation form, and provide a forwarding address if applicable',
      ],
    },
    'Deliveroo Plus': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Open Deliveroo app or website and log in',
        'Go to Account → Deliveroo Plus',
        'Tap "Cancel Subscription" and confirm',
      ],
    },
    'NOW TV Pass': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Log in to nowtv.com',
        'Go to My Account → Passes & Vouchers',
        'Next to your active pass, click "Cancel" and confirm',
      ],
    },
    'Telepass toll': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Log in to Telepass website or app',
        'Go to "Contracts" → "Terminate contract"',
        'Must return the physical Telepass transponder to a Telepass Store or Telepass Point (Punto Blu) within 20 days',
      ],
    },
    'TIM Vision': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Log in to MyTIM portal or call TIM customer support (187)',
        'Go to "Active Offers" and request deactivation of TIMVISION',
        'Return the rented TIM box decoder within 30 days to avoid penalty fees',
      ],
    },
    'Canal+ FR': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Log in to your Canal+ Espace Client portal',
        'Go to "Abonnement" → "Résilier mon abonnement"',
        'Follow steps, print confirmation form, and verify commitment expiry (engagement)',
      ],
    },
    'Deezer Premium': {
      difficulty: 'easy',
      minutes: 2,
      steps: [
        'Log in to deezer.com in a web browser',
        'Go to Account Settings → "My Subscription"',
        'Click "Cancel Subscription" and confirm',
      ],
    },
    'Pass Navigo': {
      difficulty: 'medium',
      minutes: 5,
      steps: [
        'Log in to your Île-de-France Mobilités / Navigo online account',
        'Go to "Suspend or Terminate my contract" (Suspendre ou Résilier mon contrat)',
        'Submit the cancellation request before the 20th of the current month to stop next month\'s billing',
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
  const PRICE_RE = /(\$|€|£|¥|₹|R\$|A\$|Ft|zł|kr|Kč|lei|₺|Rp|฿)?\s*([0-9][0-9\s.,]*[0-9])\s*(\$|€|£|¥|₹|R\$|A\$|Ft|zł|kr|Kč|lei|₺|Rp|฿)?/;

  const SYMBOL_TO_CODE = {
    '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR',
    'R$': 'BRL', 'A$': 'AUD', 'Ft': 'HUF', 'zł': 'PLN', 'kr': 'SEK',
    'Kč': 'CZK', 'lei': 'RON', '₺': 'TRY', 'Rp': 'IDR', '฿': 'THB',
  };

  function parseLine(raw) {
    const line = raw.trim();
    if (!line || line.length < 2) return null;

    // CSV detection: skip lines that look like a bank/PayPal CSV row instead
    // of a "Netflix 15.99"-style subscription paste. Such rows have lots of
    // quoted fields and many commas and tend to spuriously match brand
    // regexes inside random words ("Neighborhood" contains "hbo", etc.).
    if (/^name\s*,/i.test(line)) return null;
    const commaCount = (line.match(/,/g) || []).length;
    const quoteCount = (line.match(/"/g) || []).length;
    if (commaCount >= 5 && quoteCount >= 8) return null;
    // Also reject date-only / timestamp-only fragments left from CSV splits
    if (/^["']?\d{4}[.\-/\s]+\d{1,2}[.\-/\s]+\d{1,2}["']?\.?$/.test(line)) return null;

    // Identify known service
    const known = KNOWN.find(k => k.match.test(line));

    // Extract price (and currency from the symbol, if present)
    const m = line.match(PRICE_RE);
    let price = known ? known.price : null;
    let currency = null;
    if (m) {
      let raw = m[2].trim();
      // If it looks like "1.200,50" or "1 200,50", normalize to "1200.50"
      // 1. Remove all spaces
      raw = raw.replace(/\s/g, '');
      // 2. If it has both . and , then the LAST one is the decimal
      if (raw.includes('.') && raw.includes(',')) {
        if (raw.lastIndexOf('.') > raw.lastIndexOf(',')) {
          raw = raw.replace(/,/g, ''); // dot is decimal
        } else {
          raw = raw.replace(/\./g, '').replace(',', '.'); // comma is decimal
        }
      // 3. Heuristic for single separator (dot or comma)
      } else if (raw.includes(',')) {
        // Only comma: decimal if 1-2 digits after, else thousands (e.g. 1,200)
        if (raw.match(/,[0-9]{1,2}$/)) raw = raw.replace(',', '.');
        else raw = raw.replace(/,/g, '');
      } else if (raw.includes('.')) {
        // Only dot: thousands if followed by exactly 3 digits (e.g. 1.200)
        if (raw.match(/\.[0-9]{3}$/)) raw = raw.replace(/\./g, '');
        // Decimal if followed by 1-2 digits (e.g. 1.20)
        else if (raw.match(/\.[0-9]{1,2}$/)) { /* keep dot */ }
        else raw = raw.replace(/\./g, '');
      }
      
      const p = parseFloat(raw);
      if (!isNaN(p) && p > 0 && p < 10000000) price = p;
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
      const rawCycle = (cells[cycleI] || 'monthly').toLowerCase();
      const cycle = ['monthly','yearly','weekly'].includes(rawCycle) ? rawCycle : 'monthly';
      const rawCurrency = currencyI !== -1 ? (cells[currencyI] || '').trim() : '';
      // Only accept a 3-letter ISO-like code so a malicious cell can't carry markup.
      const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : null;
      out.push({
        name,
        price,
        currency,
        cycle,
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
  // Renderer calls trStep() to get the localized string from the JSON files.
  function trStep(text) {
    if (!text) return text;
    if (window.LeakdI18n && typeof window.LeakdI18n.t === 'function') {
      const translated = window.LeakdI18n.t('pb.' + text);
      if (translated && translated !== 'pb.' + text) return translated;
    }
    return text;
  }

  window.LeakdImport = { parseText, parseCSV, parseLine, findCancelUrl, findPlaybook, trStep, KNOWN, PLAYBOOKS };
})();
