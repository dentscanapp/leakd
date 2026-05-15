# Leakd → Google Play Store: teljes feltöltési útmutató

Mire kész leszel, a Leakd PWA-d natív Android appként lesz a Play Store-ban.

---

## 📋 Mit kell előkészítened (előfeltétel)

1. **Domain leakd.app** (vagy bármilyen HTTPS-en futó cím)
   - Namecheap-nél `.app` ~$18/év
   - Vercel-en SSL automatikus
2. **Google Play Developer account** — $25 egyszeri, [play.google.com/console](https://play.google.com/console)
3. **Számítógép, ahol Java + Android SDK fut**
   - Windows: telepítsd a [JDK 17+](https://adoptium.net/) és [Android Studio](https://developer.android.com/studio)-t
   - Mac: `brew install openjdk@17` és `brew install --cask android-studio`
   - Linux: csomagkezelő szerint
4. **Node.js 18+** (már megvan, v24 telepítve)

---

## 1️⃣ Deploy a Leakd-et publikus HTTPS-re

### Vercel + GitHub (legegyszerűbb)

```bash
# 1. Push a repót GitHub-ra
cd c:/Users/local_user/Documents/leakd/leakd
git init
git add .
git commit -m "Initial Leakd PWA"
git branch -M main
# Új repo a github.com-on (private vagy public)
git remote add origin https://github.com/USERNAME/leakd.git
git push -u origin main

# 2. Vercel-re: vercel.com → New Project → válaszd a leakd repót → Deploy
```

Élesben: `leakd.vercel.app` vagy custom domain (`leakd.app`).

### Domain hozzáadása Vercel-en (ha leakd.app)

1. Namecheap-en regisztráld a domaint
2. Vercel dashboard → Project → Settings → Domains
3. Add: `leakd.app`
4. Vercel megadja az A vagy CNAME rekordokat → Namecheap-en beállítod
5. ~10 percig terjed → SSL automatikus

---

## 2️⃣ Bubblewrap telepítése + projekt initelése

```bash
# Bubblewrap CLI (a Google hivatalos PWA → Android csomagolója)
npm i -g @bubblewrap/cli

# Init a projektet (a leakd.app/manifest.json-ből olvas)
mkdir leakd-android
cd leakd-android
bubblewrap init --manifest https://leakd.app/manifest.json
```

A prompt-ok közben:
- **Domain:** `leakd.app`
- **Application name:** `Leakd`
- **Launcher name:** `Leakd`
- **Application ID:** `app.leakd.twa`
- **Display mode:** `standalone`
- **Theme color:** `#ef4444`
- **Background color:** `#0f0f0f`
- **Signing key:** Új létrehozása (Bubblewrap maga csinál egyet) — **MENTSD EL** a `.keystore` fájlt és a jelszót!

Bubblewrap létrehozza a `twa-manifest.json`-t és egy Android Studio-projektet.

---

## 3️⃣ Build a release AAB-t

```bash
# A leakd-android mappában
bubblewrap build
```

Ez generál:
- `app-release-signed.aab` — ezt fogod feltölteni a Play Console-ba
- `app-release-signed.apk` — ezt telefonra is tudod telepíteni teszteléshez
- SHA-256 fingerprint a signing key-ről — ezt kell beírni az `assetlinks.json`-be

A build kimenet végén látsz egy ilyen sort:
```
SHA-256 fingerprint of the signing key:
   12:34:56:78:9A:BC:DE:F0:...
```
**Másold ki ezt.**

---

## 4️⃣ Asset Links beállítása

Nyisd meg az [.well-known/assetlinks.json](../.well-known/assetlinks.json) fájlt és cseréld a placeholder-t a tényleges SHA-256-ra:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.leakd.twa",
      "sha256_cert_fingerprints": [
        "12:34:56:78:9A:BC:DE:F0:..."   ← ide
      ]
    }
  }
]
```

**Fontos:** A `package_name`-nek pontosan egyeznie kell a Bubblewrap-nek megadott Application ID-vel (`app.leakd.twa`).

Push GitHub-ra → Vercel auto-deploy → ellenőrizd:
```
curl https://leakd.app/.well-known/assetlinks.json
```
JSON-t kell visszaadnia. Ha 404 — Vercel a `vercel.json`-ben elérhetővé kell tegye a `/.well-known/` mappát (alapból elérhető, ha a fájl jó helyen van).

---

## 5️⃣ Play Console — App létrehozása

1. Menj a [play.google.com/console](https://play.google.com/console)
2. Create app
3. **App name:** Leakd
4. **Default language:** English (later add 15 more)
5. **App or game:** App
6. **Free or paid:** Free
7. Elfogadod a Play Console nyilatkozatait

---

## 6️⃣ Store listing kitöltése

A bal oldali menüben: **Grow → Store presence → Main store listing**

### App icon
- Méret: 512×512 PNG
- Forrás: `leakd/icons/icon-512.png` (már megvan!)
- Feltöltés: **App icon**

### Feature graphic
- Méret: 1024×500 PNG (Play Store-nak PNG kell, az SVG-t exportálni kell)
- Forrás: `play-store/feature-graphic.svg` → export PNG-be (Figma / Inkscape / online SVG→PNG converter)
- Feltöltés: **Feature graphic**

### Screenshots
Minimum 2, javasolt 4-8 telefon screenshot.
- Méret: 16:9 vagy 9:16 (telefon)
- Min: 320px rövid oldal, max: 3840px
- Forrás: nyisd meg az appot Chrome DevTools-ban (F12 → eszköz-emuláció → iPhone 14 Pro vagy Pixel 7), screenshotold ezeket:
  1. Home view néhány előfizetéssel (Netflix, Spotify, Adobe)
  2. Insights view donut chart-tal + sparkline-nal
  3. Lifetime cost card megnyitva ($179.86 + $2,596 invested)
  4. Calendar view dot-okkal
  5. Cancellation playbook megnyitva (Adobe vagy NYT)
  6. Cancelled subs lista zöld savings hero-val
  7. Year-end report modal
  8. Settings menü (mutatja a 16 nyelv támogatást)

**Tipp:** példa adatok beírásához nyisd meg a Settings → Bulk Import → Try an example gombot.

### Descriptions (16 nyelven)
Másold a [`listings.md`](listings.md) fájlból nyelvenként.

### Categorization
- Category: **Finance**
- Tags: Personal finance, Budgeting, Savings

### Contact details
- Email: `hello@leakd.app` (vagy a sajátod)
- Website: `https://leakd.app`

### Privacy Policy URL
- **Required:** `https://leakd.app/privacy.html`

---

## 7️⃣ App content kitöltése

Bal menü: **Policy → App content**

- **Privacy Policy:** `https://leakd.app/privacy.html`
- **App access:** All features available without restrictions (ha nincs login)
- **Ads:** No
- **Content rating:** Töltsd ki a kérdőívet → IARC rating (Everyone)
- **Target audience:** 18-65
- **Data safety:** **No data collected, no data shared** (ezért építettük privacy-firstre!)
- **Government apps:** No
- **News apps:** No
- **Health apps:** No

---

## 8️⃣ Release létrehozása

Bal menü: **Production → Create new release**

1. Feltöltés: `app-release-signed.aab` (a Bubblewrap-ből)
2. Release name: `1.7.0`
3. Release notes (EN):
   ```
   First release of Leakd 🚰

   • Track unlimited subscriptions for free
   • 16 languages, 24 currencies, auto-detected
   • Lifetime cost calculator (see how much each sub really cost you)
   • Investment alternative ("if you invested instead at 7%")
   • Cancellation guides for 20+ services
   • Visual renewal calendar
   • Year-end spending report
   • Push notifications before renewals
   • Privacy-first: no account, no bank login, all on device
   ```
4. **Save** → **Review release** → **Start rollout to production**

Google kb. 24-72 órán át reviewolja. Ha jó: publikálva.

---

## 9️⃣ Verifikáció a publikálás után

1. Telepítsd a Play Store-ról a Leakd-et
2. Nyisd meg → ne legyen URL bar (különben az assetlinks.json rossz)
3. Push notification engedélyezése → működjön
4. PWA install → kell hogy felismerje, hogy már TWA-ként telepítve van

---

## 🔁 Frissítések ezután

Amikor új feature van:
```bash
# A leakd-android mappában
bubblewrap update --skip-version-upgrade  # opcionális: skip ha PWA frissítés elég
# VAGY teljes Android újraépítés:
# 1. Növeld a version-t twa-manifest.json-ben (appVersionCode +1)
bubblewrap build
# 2. Új AAB feltöltés a Play Console → Production → Create new release
```

A legtöbb frissítés a PWA-ban (HTML/JS/CSS) automatikusan jön — nem kell új Play Store release-t csinálni minden apró bugfixhez. **Csak nagyobb verzió- vagy manifest-változásnál kell új AAB.**

---

## 🚨 Gyakori problémák

| Probléma | Megoldás |
|---|---|
| URL bar megjelenik a TWA-ban | `assetlinks.json` nincs jó helyen vagy rossz SHA-256 |
| "Java not found" Bubblewrap-nél | `bubblewrap doctor` futtatása → mutatja mit kell javítani |
| AAB elutasítva: "missing privacy policy" | `https://leakd.app/privacy.html` URL beírása a Play Console-ba |
| AAB elutasítva: "missing icon" | 512×512 PNG ikon hiányzik a store listing-ben |
| Notification nem működik | Service Worker rendben? `chrome://serviceworker-internals` ellenőriz |

---

## 💰 Költségek összefoglaló

| Tétel | Költség |
|---|---|
| Domain leakd.app | $18/év |
| Vercel hosting | $0 (free tier elég kb. 1M látogatóig) |
| Google Play developer | $25 egyszeri |
| Apple Developer (ha iOS is) | $99/év |
| **Évi total (Android-only)** | **$18 + amortizált $25 első évben = $43** |

A Pro bevétel ($5/hó × N user × 85% Gumroad után = $4.25/user/hó) az első 5 fizető usernél fedezi az éves költséget. 5 user × $4.25 = $21.25/hó → $255/év.

---

## 📦 Hol találod a Play Store fájlokat ebben a repóban

```
leakd/
├── twa-manifest.json              ← Bubblewrap config
├── .well-known/
│   └── assetlinks.json            ← Asset Links (SHA-256 helyettesítendő)
├── privacy.html                   ← Privacy Policy (EN + HU)
├── terms.html                     ← Terms of Service (EN + HU)
├── icons/
│   ├── icon-192.png               ← Launcher ikonokhoz
│   └── icon-512.png               ← Store icon + maskable
└── play-store/
    ├── listings.md                ← 16 nyelvű leírás
    ├── feature-graphic.svg        ← 1024×500 banner (export PNG-be)
    └── UPLOAD-GUIDE.md            ← Ez a fájl
```

---

## ✅ Hosszú checkbox lista

- [ ] Vercel deploy él, leakd.app vagy .vercel.app cím működik
- [ ] manifest.json elérhető publikusan
- [ ] privacy.html elérhető publikusan
- [ ] terms.html elérhető publikusan
- [ ] icons/icon-512.png elérhető és valid maskable
- [ ] Bubblewrap init lefutott, twa-manifest.json generálva
- [ ] Bubblewrap build sikeresen lefutott, AAB megvan
- [ ] SHA-256 fingerprint kimásolva
- [ ] assetlinks.json frissítve a SHA-256-tal és publikálva
- [ ] curl-rel ellenőrizted, hogy assetlinks.json elérhető
- [ ] Play Console fiók aktív ($25 fizetve)
- [ ] App létrehozva a Play Console-ban
- [ ] Store listing kitöltve (legalább EN)
- [ ] Screenshots (min 2) feltöltve
- [ ] Feature graphic 1024×500 PNG feltöltve
- [ ] App icon 512×512 PNG feltöltve
- [ ] Privacy Policy URL beállítva
- [ ] Content rating kérdőív kitöltve
- [ ] Target audience beállítva
- [ ] Data safety kitöltve (No data collected)
- [ ] AAB feltöltve a Production release-be
- [ ] Release notes beírva
- [ ] Rollout indítva
- [ ] Várakozás Google review-ra (24-72 óra)
- [ ] Élesítés után telepítés és teszt

Sok sikert. 🚀
