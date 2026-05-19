// Leakd — End-to-end encrypted sync via Google Drive (Pro only)
//
// Architecture
// ────────────
// • Auth:        Google Identity Services (GIS) OAuth2, scope drive.appdata
// • Encryption:  AES-GCM 256, key derived from a user-chosen master password
//                via PBKDF2(SHA-256, 250 000 iterations, 16-byte random salt).
// • Storage:     One file `sync_data.json` inside Drive's hidden appDataFolder.
//                Body is `{ v, iv, salt, data }` where `data` is the AES-GCM
//                ciphertext of the JSON snapshot of every leakd_* localStorage
//                key. Master password and derived key NEVER touch disk —
//                only the salt is persisted (in localStorage) so the same
//                password yields the same key on every device.
// • Conflict:    Last-write-wins by `lastUpdated` timestamp inside the
//                snapshot. The smart `sync()` method picks the newer side.
//
// Pro gate
// ────────
// Every public mutator calls `checkPro()` first. If LeakdPro.isPro() is
// false the function throws `SYNC_REQUIRES_PRO` synchronously / via reject.
//
// Configuration
// ─────────────
// Set the OAuth Client ID before this file loads:
//
//   <script>window.LeakdSyncConfig = { clientId: '…apps.googleusercontent.com' };</script>
//   <script src="js/sync.js"></script>
//
// or call `LeakdSync.configure({ clientId })` at runtime.

(function () {
  'use strict';

  // ── Configuration ───────────────────────────────────────────
  let CLIENT_ID = (typeof window !== 'undefined' && window.LeakdSyncConfig && window.LeakdSyncConfig.clientId) || '';
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const FILE_NAME = 'sync_data.json';
  // PBKDF2-HMAC-SHA256 iteration count. OWASP 2024+ recommends ≥600 000.
  // Envelope v2 records the count per-blob so we can keep decrypting
  // legacy v1 (250 000) blobs while encrypting all new ones at 600 000.
  // On the next successful push the user's data is re-encrypted with v2,
  // transparently upgrading their cloud blob.
  const PBKDF2_ITERATIONS = 600000;
  const PBKDF2_LEGACY_ITERATIONS = 250000;
  const ENVELOPE_VERSION = 2;

  // localStorage keys this module owns
  const META_KEY = 'leakd_sync_meta';     // { fileId, lastSync, remoteUpdated }
  const SALT_KEY = 'leakd_sync_salt';     // base64 16-byte salt
  const ENABLED_KEY = 'leakd_sync_enabled'; // '1' = sync turned on by user

  // Local data that participates in sync. We deliberately exclude:
  //   • leakd_pro        — license is per-device, never synced
  //   • leakd_rates      — currency cache, refreshed locally
  //   • leakd_sync_*     — sync's own metadata
  //   • leakd_notif_log  — fired-notification ledger, device-specific
  const SYNCED_KEYS = [
    'leakd_subs', 'leakd_settings', 'leakd_cancelled', 'leakd_budgets',
    'leakd_goal', 'leakd_income', 'leakd_history', 'leakd_activity',
    'leakd_notif_prefs', 'leakd_lang', 'leakd_streak', 'leakd_tour_done',
    'leakd_onboarded',
  ];

  // ── In-memory state (never written to disk) ─────────────────
  let cryptoKey = null;       // CryptoKey from PBKDF2; AES-GCM 256
  let accessToken = null;     // OAuth bearer token
  let tokenExpiresAt = 0;     // ms epoch
  let tokenClient = null;     // GIS oauth2.TokenClient instance
  let gisLoadPromise = null;
  let pushDebounceTimer = null;
  const listeners = [];

  // ── Tiny helpers ────────────────────────────────────────────
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const b64encode = (buf) => {
    const a = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  };
  const b64decode = (b64) => {
    const s = atob(b64);
    const a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  };
  function notify(type, extra) {
    const evt = Object.assign({ type }, extra || {});
    for (const cb of listeners.slice()) {
      try { cb(evt); } catch (e) { console.error('LeakdSync listener', e); }
    }
  }
  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveMeta(m) {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  }

  // ── Pro gate ────────────────────────────────────────────────
  function checkPro() {
    const P = (typeof window !== 'undefined') ? window.LeakdPro : null;
    if (!P || typeof P.isPro !== 'function' || !P.isPro()) {
      const e = new Error('SYNC_REQUIRES_PRO');
      e.code = 'SYNC_REQUIRES_PRO';
      throw e;
    }
  }

  // ── Master password → AES key (PBKDF2 / SHA-256 / 250k) ─────
  function getSalt() {
    const raw = localStorage.getItem(SALT_KEY);
    if (raw) return b64decode(raw);
    const fresh = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(SALT_KEY, b64encode(fresh));
    return fresh;
  }
  function clearSalt() { localStorage.removeItem(SALT_KEY); }

  async function deriveKey(password, salt, iterations) {
    const pwBytes = enc.encode(String(password || ''));
    const imported = await crypto.subtle.importKey(
      'raw', pwBytes, { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: iterations || PBKDF2_ITERATIONS, hash: 'SHA-256' },
      imported,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Password is kept in memory (never persisted) so we can derive the
  // legacy 250 000-iteration key on demand when reading v1 envelopes
  // written before the 600 000 bump. Both copies are cleared by lock().
  let cachedPassword = null;
  let cryptoKeyLegacy = null;

  async function getLegacyKey() {
    if (cryptoKeyLegacy) return cryptoKeyLegacy;
    if (cachedPassword == null) {
      const e = new Error('LOCKED'); e.code = 'LOCKED'; throw e;
    }
    cryptoKeyLegacy = await deriveKey(cachedPassword, getSalt(), PBKDF2_LEGACY_ITERATIONS);
    return cryptoKeyLegacy;
  }

  async function unlock(password) {
    checkPro();
    if (!password || password.length < 4) {
      const e = new Error('PASSWORD_TOO_SHORT'); e.code = 'PASSWORD_TOO_SHORT'; throw e;
    }
    const salt = getSalt();
    cachedPassword = String(password);
    cryptoKey = await deriveKey(cachedPassword, salt, PBKDF2_ITERATIONS);
    cryptoKeyLegacy = null;
    notify('unlocked');
    return true;
  }

  // Verify the password against the existing remote file before persisting any
  // local state. Used when adding the app to a second device.
  async function unlockAndVerifyAgainstRemote(password) {
    checkPro();
    const file = await findSyncFile();
    if (!file) {
      const salt = getSalt();
      const candidate = await deriveKey(password, salt, PBKDF2_ITERATIONS);
      cachedPassword = String(password);
      cryptoKey = candidate;
      cryptoKeyLegacy = null;
      notify('unlocked');
      return { ok: true, hadRemote: false };
    }
    const text = await downloadFile(file.id);
    // Peek at envelope version and salt so we know how to derive keys
    let env = null;
    try { env = JSON.parse(text); } catch {}
    
    // If the remote file exists and has a salt, we MUST use its salt
    // to derive the candidate keys, and save it locally.
    if (env && env.salt) {
      localStorage.setItem(SALT_KEY, env.salt);
    }
    
    const salt = getSalt();
    const candidate = await deriveKey(password, salt, PBKDF2_ITERATIONS);
    let verifyKey = candidate;
    if (env && env.v === 1) {
      // Legacy blob — verify against the 250k key
      verifyKey = await deriveKey(password, salt, PBKDF2_LEGACY_ITERATIONS);
    }
    try {
      const snap = await decryptWithKey(text, verifyKey);
      cachedPassword = String(password);
      cryptoKey = candidate;            // current standard
      cryptoKeyLegacy = (env && env.v === 1) ? verifyKey : null;
      notify('unlocked');
      return { ok: true, hadRemote: true, snapshot: snap };
    } catch (e) {
      const err = new Error('WRONG_PASSWORD'); err.code = 'WRONG_PASSWORD'; throw err;
    }
  }

  function lock() {
    cryptoKey = null;
    cryptoKeyLegacy = null;
    cachedPassword = null;
    notify('locked');
  }
  function isUnlocked() { return cryptoKey !== null; }

  // ── Enabled flag (user opt-in) ──────────────────────────────
  function isEnabled() { return localStorage.getItem(ENABLED_KEY) === '1'; }
  function setEnabled(v) {
    if (v) localStorage.setItem(ENABLED_KEY, '1');
    else localStorage.removeItem(ENABLED_KEY);
    notify('enabled-changed', { enabled: !!v });
  }

  // ── AES-GCM encrypt / decrypt ──────────────────────────────
  // Envelope v2 layout:
  //   { v: 2, iter: 600000, iv, salt, data }
  // Envelope v1 layout (legacy, decrypt-only):
  //   { v: 1,                 iv, salt, data }   (implicit iterations: 250 000)
  async function encryptWithKey(payload, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const pt = enc.encode(JSON.stringify(payload));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt);
    return JSON.stringify({
      v: ENVELOPE_VERSION,
      iter: PBKDF2_ITERATIONS,
      iv: b64encode(iv),
      salt: b64encode(getSalt()),
      data: b64encode(ct),
    });
  }
  async function decryptWithKey(text, key) {
    let env;
    try { env = JSON.parse(text); }
    catch { const e = new Error('INVALID_FORMAT'); e.code = 'INVALID_FORMAT'; throw e; }
    // Pick the correct key for this envelope's iteration count
    let useKey = key;
    if (env.v === 1) {
      // Legacy 250 000-iteration blob → use the lazy-derived legacy key
      try { useKey = await getLegacyKey(); }
      catch { /* fall through; decrypt will throw WRONG_PASSWORD */ }
    } else if (env.v !== ENVELOPE_VERSION) {
      const e = new Error('VERSION_MISMATCH'); e.code = 'VERSION_MISMATCH'; throw e;
    }
    try {
      const iv = b64decode(env.iv);
      const ct = b64decode(env.data);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, useKey, ct);
      return JSON.parse(dec.decode(pt));
    } catch {
      const e = new Error('WRONG_PASSWORD'); e.code = 'WRONG_PASSWORD'; throw e;
    }
  }
  function encryptPayload(p) {
    if (!cryptoKey) { const e = new Error('LOCKED'); e.code = 'LOCKED'; throw e; }
    return encryptWithKey(p, cryptoKey);
  }
  function decryptPayload(t) {
    if (!cryptoKey) { const e = new Error('LOCKED'); e.code = 'LOCKED'; throw e; }
    return decryptWithKey(t, cryptoKey);
  }

  // ── Local snapshot ↔ localStorage ──────────────────────────
  function snapshotLocal() {
    const data = {};
    for (const key of SYNCED_KEYS) {
      const v = localStorage.getItem(key);
      if (v !== null) data[key] = v;
    }
    return {
      lastUpdated: Date.now(),
      appVersion: (typeof window !== 'undefined' && window.LeakdVersion) || 'unknown',
      data,
    };
  }
  function applySnapshot(snapshot) {
    if (!snapshot || !snapshot.data) return false;
    for (const key of SYNCED_KEYS) {
      if (key in snapshot.data) localStorage.setItem(key, snapshot.data[key]);
    }
    return true;
  }

  // ── Google Identity Services (GIS) loader ──────────────────
  function loadGISScript() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.reject(new Error('NO_DOM'));
    }
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      return Promise.resolve();
    }
    if (gisLoadPromise) return gisLoadPromise;
    gisLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('GIS_LOAD_FAILED')));
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('GIS_LOAD_FAILED'));
      document.head.appendChild(s);
    });
    return gisLoadPromise;
  }

  async function ensureTokenClient() {
    if (!CLIENT_ID) {
      const e = new Error('NO_CLIENT_ID'); e.code = 'NO_CLIENT_ID'; throw e;
    }
    await loadGISScript();
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: () => {}, // overridden per request
      });
    }
  }

  function tokenValid() {
    return !!accessToken && Date.now() < tokenExpiresAt - 60_000;
  }

  function getToken({ interactive = false } = {}) {
    checkPro();
    if (tokenValid()) return Promise.resolve(accessToken);
    return ensureTokenClient().then(() => new Promise((resolve, reject) => {
      tokenClient.callback = (resp) => {
        if (resp && resp.error) {
          const e = new Error('OAUTH_FAILED:' + resp.error);
          e.code = 'OAUTH_FAILED'; reject(e); return;
        }
        accessToken = resp.access_token;
        tokenExpiresAt = Date.now() + (resp.expires_in || 3600) * 1000;
        notify('signed-in');
        resolve(accessToken);
      };
      try {
        tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
      } catch (e) { reject(e); }
    }));
  }

  function signIn() { return getToken({ interactive: true }); }

  function signOut() {
    if (accessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(accessToken, () => {}); } catch {}
    }
    accessToken = null;
    tokenExpiresAt = 0;
    notify('signed-out');
  }

  function isSignedIn() { return tokenValid(); }

  // ── Drive REST helpers ─────────────────────────────────────
  async function driveFetch(url, opts) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const e = new Error('OFFLINE'); e.code = 'OFFLINE'; throw e;
    }
    opts = opts || {};
    const token = await getToken();
    const headers = Object.assign({ 'Authorization': 'Bearer ' + token }, opts.headers || {});
    let res = await fetch(url, Object.assign({}, opts, { headers }));
    if (res.status === 401) {
      // Token expired mid-request — refresh and retry once
      accessToken = null;
      const fresh = await getToken({ interactive: true });
      headers['Authorization'] = 'Bearer ' + fresh;
      res = await fetch(url, Object.assign({}, opts, { headers }));
    }
    return res;
  }

  async function findSyncFile() {
    const q = encodeURIComponent("name='" + FILE_NAME + "' and trashed=false");
    const url = 'https://www.googleapis.com/drive/v3/files'
      + '?spaces=appDataFolder&q=' + q
      + '&fields=files(id,modifiedTime,size)';
    const res = await driveFetch(url);
    if (!res.ok) {
      const e = new Error('DRIVE_LIST_FAILED:' + res.status); e.code = 'DRIVE_FAILED'; throw e;
    }
    const j = await res.json();
    return (j.files && j.files[0]) || null;
  }
  async function downloadFile(fileId) {
    const res = await driveFetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media');
    if (!res.ok) { const e = new Error('DRIVE_GET_FAILED:' + res.status); e.code = 'DRIVE_FAILED'; throw e; }
    return await res.text();
  }
  // Permanently delete the encrypted blob from the user's Google Drive
  // appDataFolder. Used by the in-app "Disable + delete remote" flow so
  // turning off Cloud Sync actually removes the data (GDPR Art. 17).
  // Looks the file up by name if no fileId is provided. Returns:
  //   { ok: true,  deleted: true }   — file was found and DELETE returned 2xx
  //   { ok: true,  deleted: false }  — no file existed in the first place
  //   { ok: false, code, status }    — Drive API rejected (caller decides UX)
  async function deleteRemoteFile() {
    checkPro();
    await ensureToken();
    let fileId = (loadMeta().fileId) || null;
    if (!fileId) {
      const f = await findSyncFile();
      fileId = f && f.id;
    }
    if (!fileId) {
      return { ok: true, deleted: false };
    }
    const res = await driveFetch(
      'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId),
      { method: 'DELETE' }
    );
    // 204 No Content on success; 404 = already gone (treat as success).
    if (res.status === 204 || res.status === 200 || res.status === 404) {
      const meta = loadMeta();
      delete meta.fileId;
      delete meta.remoteUpdated;
      saveMeta(meta);
      notify('remote-deleted', { fileId });
      return { ok: true, deleted: res.status !== 404 };
    }
    return { ok: false, code: 'DRIVE_DELETE_FAILED', status: res.status };
  }

  async function uploadFile(fileId, content) {
    const boundary = 'leakd-' + Math.random().toString(36).slice(2);
    const metadata = fileId
      ? { name: FILE_NAME }
      : { name: FILE_NAME, parents: ['appDataFolder'] };
    const body =
      '--' + boundary + '\r\n'
      + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
      + JSON.stringify(metadata) + '\r\n'
      + '--' + boundary + '\r\n'
      + 'Content-Type: application/json\r\n\r\n'
      + content + '\r\n'
      + '--' + boundary + '--';
    const url = 'https://www.googleapis.com/upload/drive/v3/files'
      + (fileId ? '/' + fileId : '')
      + '?uploadType=multipart&fields=id,modifiedTime';
    const res = await driveFetch(url, {
      method: fileId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body,
    });
    if (!res.ok) { const e = new Error('DRIVE_UPLOAD_FAILED:' + res.status); e.code = 'DRIVE_FAILED'; throw e; }
    return await res.json();
  }

  // ── High-level operations ──────────────────────────────────
  async function push() {
    checkPro();
    if (!cryptoKey) { const e = new Error('LOCKED'); e.code = 'LOCKED'; throw e; }
    const meta = loadMeta();
    let fileId = meta.fileId;
    if (!fileId) {
      const existing = await findSyncFile();
      if (existing) fileId = existing.id;
    }
    const snapshot = snapshotLocal();
    const ciphertext = await encryptPayload(snapshot);
    const result = await uploadFile(fileId, ciphertext);
    saveMeta({
      fileId: result.id,
      lastSync: Date.now(),
      remoteUpdated: snapshot.lastUpdated,
    });
    notify('pushed', { lastUpdated: snapshot.lastUpdated });
    return { ok: true, fileId: result.id, lastUpdated: snapshot.lastUpdated };
  }

  async function pull() {
    checkPro();
    if (!cryptoKey) { const e = new Error('LOCKED'); e.code = 'LOCKED'; throw e; }
    const file = await findSyncFile();
    if (!file) return { ok: false, reason: 'NO_REMOTE' };
    const text = await downloadFile(file.id);
    const snapshot = await decryptPayload(text);
    applySnapshot(snapshot);
    saveMeta({
      fileId: file.id,
      lastSync: Date.now(),
      remoteUpdated: snapshot.lastUpdated || 0,
    });
    notify('pulled', { lastUpdated: snapshot.lastUpdated });
    return { ok: true, snapshot };
  }

  // ── Smart Snapshot Merging (Item-level Conflict Resolution) ──────
  function mergeSnapshots(local, remote) {
    const merged = {
      lastUpdated: Math.max(local.lastUpdated || 0, remote.lastUpdated || 0),
      appVersion: local.appVersion || remote.appVersion || 'unknown',
      data: {}
    };

    function mergeArrays(localArr, remoteArr) {
      const localMap = new Map((localArr || []).map(x => [x.id, x]));
      const remoteMap = new Map((remoteArr || []).map(x => [x.id, x]));
      const mergedItems = [];
      const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
      
      for (const id of allIds) {
        const localItem = localMap.get(id);
        const remoteItem = remoteMap.get(id);
        
        if (localItem && remoteItem) {
          const localTime = localItem.updatedAt || new Date(localItem.createdAt || 0).getTime() || 0;
          const remoteTime = remoteItem.updatedAt || new Date(remoteItem.createdAt || 0).getTime() || 0;
          if (remoteTime > localTime) {
            mergedItems.push(remoteItem);
          } else {
            mergedItems.push(localItem);
          }
        } else if (localItem) {
          mergedItems.push(localItem);
        } else {
          mergedItems.push(remoteItem);
        }
      }
      return mergedItems;
    }

    for (const key of SYNCED_KEYS) {
      const localVal = local.data[key];
      const remoteVal = remote.data[key];
      
      if (localVal === undefined) {
        if (remoteVal !== undefined) merged.data[key] = remoteVal;
        continue;
      }
      if (remoteVal === undefined) {
        merged.data[key] = localVal;
        continue;
      }

      if (key === 'leakd_subs' || key === 'leakd_cancelled') {
        try {
          const localArr = JSON.parse(localVal);
          const remoteArr = JSON.parse(remoteVal);
          merged.data[key] = JSON.stringify(mergeArrays(localArr, remoteArr));
        } catch (e) {
          merged.data[key] = local.lastUpdated > remote.lastUpdated ? localVal : remoteVal;
        }
      } else {
        merged.data[key] = local.lastUpdated > remote.lastUpdated ? localVal : remoteVal;
      }
    }
    return merged;
  }

  // Smart two-way sync: merges local offline state with remote cloud state
  async function sync() {
    checkPro();
    if (!cryptoKey) { const e = new Error('LOCKED'); e.code = 'LOCKED'; throw e; }
    const meta = loadMeta();
    const file = await findSyncFile();
    if (!file) return await push();

    const text = await downloadFile(file.id);
    const remoteSnapshot = await decryptPayload(text);
    const localSnapshot = snapshotLocal();

    // Perform two-way merge
    const mergedSnapshot = mergeSnapshots(localSnapshot, remoteSnapshot);

    // Save the merged data locally
    applySnapshot(mergedSnapshot);

    // Determine if we need to push the merged state back to the cloud.
    // We push if the local offline state had newer edits than the cloud.
    const localHasNewerEdits = JSON.stringify(mergedSnapshot.data) !== JSON.stringify(remoteSnapshot.data);

    if (localHasNewerEdits) {
      const ciphertext = await encryptPayload(mergedSnapshot);
      const result = await uploadFile(file.id, ciphertext);
      saveMeta({
        fileId: result.id,
        lastSync: Date.now(),
        remoteUpdated: mergedSnapshot.lastUpdated,
      });
      notify('pushed', { lastUpdated: mergedSnapshot.lastUpdated });
      return { ok: true, action: 'merged-pushed', lastUpdated: mergedSnapshot.lastUpdated };
    } else {
      saveMeta({
        fileId: file.id,
        lastSync: Date.now(),
        remoteUpdated: remoteSnapshot.lastUpdated || 0,
      });
      notify('pulled', { lastUpdated: remoteSnapshot.lastUpdated });
      return { ok: true, action: 'pulled', lastUpdated: remoteSnapshot.lastUpdated };
    }
  }

  // ── Debounced push (call after every saveData) ─────────────
  function schedulePush(delayMs) {
    if (!isEnabled() || !cryptoKey) return;
    clearTimeout(pushDebounceTimer);
    pushDebounceTimer = setTimeout(() => {
      push().catch(e => {
        console.error('LeakdSync auto-push failed', e);
        notify('error', { code: e.code || 'PUSH_FAILED', message: String(e.message || e) });
      });
    }, typeof delayMs === 'number' ? delayMs : 2000);
  }

  // ── Listener API ───────────────────────────────────────────
  function on(cb) { listeners.push(cb); }
  function off(cb) {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  }

  // ── Public state surface ───────────────────────────────────
  function status() {
    return {
      enabled: isEnabled(),
      unlocked: isUnlocked(),
      signedIn: tokenValid(),
      configured: !!CLIENT_ID,
      hasSalt: !!localStorage.getItem(SALT_KEY),
      lastSync: loadMeta().lastSync || 0,
      remoteUpdated: loadMeta().remoteUpdated || 0,
    };
  }

  // Wipe ALL sync state — local key, token, salt, meta, enabled flag.
  // Used when the user disables sync or hits reset-all-data.
  function clearLocalState() {
    cryptoKey = null;
    accessToken = null;
    tokenExpiresAt = 0;
    localStorage.removeItem(META_KEY);
    localStorage.removeItem(SALT_KEY);
    localStorage.removeItem(ENABLED_KEY);
    notify('reset');
  }

  function configure(opts) {
    if (opts && typeof opts.clientId === 'string') CLIENT_ID = opts.clientId;
    tokenClient = null; // force re-init with new client_id
  }

  if (typeof window !== 'undefined') {
    window.LeakdSync = {
      // Configuration
      configure,
      // Auth
      signIn, signOut, isSignedIn,
      // Key lifecycle
      unlock, lock, isUnlocked,
      unlockAndVerifyAgainstRemote,
      // Enable flag
      isEnabled, setEnabled,
      // Operations
      push, pull, sync, schedulePush,
      deleteRemoteFile,
      // Inspection
      status,
      // Reset
      clearLocalState,
      // Events
      on, off,
      // Constants (for tests)
      SYNCED_KEYS, ENVELOPE_VERSION, SCOPE, FILE_NAME,
    };
  }
})();
