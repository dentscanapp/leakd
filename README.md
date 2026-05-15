# Leakd — Where's your money leaking?

A free, private subscription tracker. No account, no server, no data leaves your device.

## What's inside

**Home view**
- Add subscriptions with one-tap presets (Netflix, Spotify, ChatGPT, Adobe, etc.)
- Monthly + yearly totals, due-in-7-days counter
- Category filter, sorted by next due date
- Trial + renewal alerts on the dashboard

**Insights view**
- Year-to-date "you've already paid" counter
- 12-month projection bar chart
- Category breakdown (% of spend per category)
- Smart suggestions: duplicate detection, yearly-billing arbitrage,
  expensive subs flag, "old & forgotten" warnings, trial countdowns
- Share card generator (1080×1350 PNG, perfect for Instagram / Twitter / Reddit)

**Reminders**
- Local push notifications via the Service Worker (no push server)
- Customizable lead time for renewals and trial endings
- Periodic Background Sync on Chrome / Edge / installed PWA
- Catch-up on next app open for missed events on other browsers

**Money plumbing**
- Pro upgrade flow with Gumroad license-key activation
- Trust-first verification: format check now, live Gumroad API call where CORS allows, server-side verification when the userbase justifies a Cloudflare Worker
- Pro features (email reminders, sync, year-end report, budgets) are
  currently UI-only — they unlock when the gate is implemented

**Onboarding & polish**
- 3-step first-run tutorial
- Currency picker (USD / EUR / GBP / HUF / JPY / INR / BRL / AUD)
- Bulk import: paste a list, CSV upload, or use the example button
- Dark mode, safe-area aware on iOS
- Manifest shortcuts: long-press the home-screen icon → "Add subscription" or "Insights"
- Open Graph / Twitter card meta tags for shareable links

## Deploy to Vercel (FREE — 2 minutes)

### Option 1: GitHub + Vercel (recommended)

1. **Create a GitHub account** (if you don't have one): https://github.com/signup
2. **Create a new repository**: https://github.com/new
   - Name: `leakd`
   - Public or Private (either works)
3. **Upload all files** from this folder to the repository
4. **Go to Vercel**: https://vercel.com/signup (sign up with GitHub)
5. **Import your repo**: Click "Add New" → "Project" → select `leakd`
6. **Deploy**: Click "Deploy" — that's it!
7. **Your app is live** at: `leakd.vercel.app` (or similar)

### Option 2: Vercel CLI

```bash
npm i -g vercel
cd leakd
vercel
```

Follow the prompts. Done.

## Wire up Gumroad

Once you create a Gumroad product called "Leakd Pro":

1. In Gumroad: turn on "Generate license keys"
2. Copy your product's permalink (the last part of the product URL)
3. In `js/pro.js`, change:
   ```js
   const GUMROAD_PRODUCT_URL = 'https://gumroad.com/l/leakd-pro';
   const GUMROAD_PERMALINK   = 'leakd-pro';
   ```
   to match your product

That's it — the activation flow already hits the public Gumroad license verify endpoint.

## Custom Domain (later, when validated)

1. Buy `leakd.app` from Namecheap (~$18/year)
2. In Vercel dashboard → Settings → Domains → Add `leakd.app`
3. Update DNS records as Vercel instructs
4. SSL is automatic

## Google Play Store (later)

Use Bubblewrap to wrap the PWA as a TWA:

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://leakd.app/manifest.json
bubblewrap build
```

Upload the generated AAB to Google Play Console ($25 one-time fee).

## File Structure

```
leakd/
├── index.html             # Main app shell + modals
├── manifest.json          # PWA manifest with shortcuts
├── vercel.json            # Vercel routing config
├── sw.js                  # Service worker (offline + notifications)
├── css/
│   └── app.css            # All styles, dark mode, safe-area aware
├── js/
│   ├── app.js             # App orchestration, view switching, events
│   ├── insights.js        # Analytics: totals, categories, suggestions
│   ├── pro.js             # Gumroad license activation + premium gating
│   ├── share.js           # Canvas-based share card generator
│   ├── import.js          # Bulk text + CSV parser with service catalogue
│   └── notifications.js   # Local notification scheduler
└── icons/
    ├── icon.svg           # Vector icon
    ├── icon-192.png       # PWA icon
    └── icon-512.png       # PWA icon large
```

## Tech Stack

- Pure HTML/CSS/JS — zero dependencies, zero build step
- localStorage for data (zero server, single device)
- Cache API to mirror state for the Service Worker
- PWA with Service Worker (works offline, installs to home screen)
- Hosted on Vercel (free tier)

## Cost

$0/month for hosting. $18/year for the domain (optional). Forever.
