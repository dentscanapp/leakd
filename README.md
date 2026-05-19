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

