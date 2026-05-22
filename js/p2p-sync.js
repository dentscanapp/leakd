// Leakd — Option B: Local P2P direct sync (Zero-Cloud)
// ─────────────────────────────────────────────────────
// Two devices exchange their full subscription state directly over a
// WebRTC data channel. Nothing ever touches our servers — the only
// network call is to a public WebRTC signalling broker (PeerJS default)
// which sees opaque SDP/ICE only, never your data.
//
// Security
// • Session key: 256-bit AES-GCM, freshly generated on the host each pairing
// • Key transport: embedded in the QR (NEVER traverses the signalling broker)
// • Payload: AES-GCM(key, JSON of LeakdP2PSync.SYNC_KEYS) sent over the data channel
// • Idle: the broker connection is closed the moment the P2P channel opens
//
// Lifecycle: createHost() → waitForPeer() → exchange() → close()
//            connectAsClient(peerId, key) → exchange() → close()

(function () {
  'use strict';

  // Free public broker maintained by the PeerJS project. Only SDP/ICE
  // metadata transits this server — payload is encrypted end-to-end.
  const BROKER_HOST = '0.peerjs.com';
  const BROKER_PORT = 443;
  const BROKER_PATH = '/';

  // Dynamically loaded libs (CDN, cached by browser after first use).
  // Self-host these in /js/vendor/ later if you want zero CDN traffic.
  const LIBS = {
    peerjs:  { url: 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',                  globalName: 'Peer' },
    qrcode:  { url: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',      globalName: 'qrcode' },
    jsqr:    { url: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',               globalName: 'jsQR' },
  };

  // Local-storage keys whose contents we exchange. Everything else (license,
  // sync metadata, currency cache, device-local logs) stays put.
  const SYNC_KEYS = [
    'leakd_subs', 'leakd_settings', 'leakd_cancelled', 'leakd_budgets',
    'leakd_goal', 'leakd_income', 'leakd_history', 'leakd_activity',
    'leakd_notif_prefs', 'leakd_lang', 'leakd_streak', 'leakd_tour_done',
    'leakd_onboarded',
  ];

  // Single PeerJS instance + data channel for the lifetime of one pairing.
  let peer = null;
  let conn = null;
  let sessionKey = null; // CryptoKey
  let sessionKeyB64 = null; // base64 string we embed in the QR
  let lastError = null;
  const listeners = [];

  // ── Tiny helpers ────────────────────────────────────────────
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  function b64encode(buf) {
    const a = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  }
  function b64decode(b64) {
    const s = atob(b64);
    const a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  function notify(type, extra) {
    const evt = Object.assign({ type }, extra || {});
    for (const cb of listeners.slice()) {
      try { cb(evt); } catch (e) { console.error('LeakdP2P listener', e); }
    }
  }
  function on(cb) { listeners.push(cb); }
  function off(cb) {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  }

  // ── Dynamic script loader (lazy, cached) ───────────────────
  const scriptPromises = {};
  function loadScript(name) {
    if (scriptPromises[name]) return scriptPromises[name];
    const lib = LIBS[name];
    if (!lib) return Promise.reject(new Error('UNKNOWN_LIB:' + name));
    if (typeof window[lib.globalName] !== 'undefined') {
      scriptPromises[name] = Promise.resolve(window[lib.globalName]);
      return scriptPromises[name];
    }
    scriptPromises[name] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = lib.url;
      s.async = true; s.defer = true;
      s.onload = () => resolve(window[lib.globalName]);
      s.onerror = () => { delete scriptPromises[name]; reject(new Error('LIB_LOAD_FAILED:' + name)); };
      document.head.appendChild(s);
    });
    return scriptPromises[name];
  }

  // ── Key generation + crypto ────────────────────────────────
  async function generateSessionKey() {
    sessionKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const raw = await crypto.subtle.exportKey('raw', sessionKey);
    sessionKeyB64 = b64encode(raw);
    return sessionKeyB64;
  }

  async function importSessionKey(b64) {
    const raw = b64decode(b64);
    sessionKey = await crypto.subtle.importKey(
      'raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
    );
    sessionKeyB64 = b64;
    return sessionKey;
  }

  async function encryptPayload(payload) {
    if (!sessionKey) throw new Error('NO_SESSION_KEY');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const pt = enc.encode(JSON.stringify(payload));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sessionKey, pt);
    return { iv: b64encode(iv), data: b64encode(ct) };
  }

  async function decryptPayload(envelope) {
    if (!sessionKey) throw new Error('NO_SESSION_KEY');
    if (!envelope || typeof envelope !== 'object' || !envelope.iv || !envelope.data) {
      throw new Error('BAD_ENVELOPE');
    }
    const iv = b64decode(envelope.iv);
    const ct = b64decode(envelope.data);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sessionKey, ct);
    return JSON.parse(dec.decode(pt));
  }

  // ── Local snapshot ↔ localStorage ─────────────────────────
  function snapshotLocal() {
    const data = {};
    for (const key of SYNC_KEYS) {
      const v = localStorage.getItem(key);
      if (v !== null) data[key] = v;
    }
    return {
      version: 1,
      sentAt: Date.now(),
      appVersion: (typeof window !== 'undefined' && window.LeakdVersion) || 'unknown',
      data,
    };
  }

  // ── PeerJS bootstrap ────────────────────────────────────────
  async function makePeer(id) {
    await loadScript('peerjs');
    if (typeof Peer === 'undefined') throw new Error('PEERJS_LOAD_FAILED');
    return new Peer(id || undefined, {
      host: BROKER_HOST,
      port: BROKER_PORT,
      path: BROKER_PATH,
      secure: true,
      debug: 0,
    });
  }

  // Host: open a peer, wait for an incoming connection, exchange snapshots.
  // Returns the peerId + base64 session key so the UI can render the QR.
  async function createHost() {
    closeAll();
    lastError = null;
    await generateSessionKey();
    peer = await makePeer();
    return new Promise((resolve, reject) => {
      let opened = false;
      const timer = setTimeout(() => {
        if (!opened) {
          reject(new Error('BROKER_TIMEOUT'));
          closeAll();
        }
      }, 20000);
      peer.on('open', (id) => {
        opened = true;
        clearTimeout(timer);
        notify('host-ready', { peerId: id, sessionKey: sessionKeyB64 });
        resolve({ peerId: id, sessionKey: sessionKeyB64 });
      });
      peer.on('connection', (incoming) => {
        conn = incoming;
        wireDataChannel(conn, 'host');
      });
      peer.on('error', (e) => {
        lastError = e;
        notify('error', { code: classifyPeerError(e), detail: String(e && e.message || e) });
      });
    });
  }

  // Client: connect to an existing host using the QR-decoded payload.
  async function connectAsClient(peerId, sessionKeyB64Param) {
    closeAll();
    lastError = null;
    if (!peerId || !sessionKeyB64Param) throw new Error('MISSING_QR_DATA');
    await importSessionKey(sessionKeyB64Param);
    peer = await makePeer();
    return new Promise((resolve, reject) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          reject(new Error('CONNECT_TIMEOUT'));
          closeAll();
        }
      }, 25000);
      peer.on('open', () => {
        conn = peer.connect(peerId, { reliable: true });
        wireDataChannel(conn, 'client');
        conn.on('open', () => {
          resolved = true;
          clearTimeout(timer);
          notify('client-connected', { peerId });
          resolve({ peerId });
        });
      });
      peer.on('error', (e) => {
        lastError = e;
        notify('error', { code: classifyPeerError(e), detail: String(e && e.message || e) });
        if (!resolved) reject(e);
      });
    });
  }

  function classifyPeerError(e) {
    const m = String(e && (e.type || e.message) || '');
    if (m.includes('peer-unavailable')) return 'PEER_UNAVAILABLE';
    if (m.includes('disconnected'))     return 'BROKER_DISCONNECTED';
    if (m.includes('network'))          return 'NETWORK';
    if (m.includes('browser-incompatible')) return 'BROWSER_INCOMPATIBLE';
    return 'PEER_ERROR';
  }

  function wireDataChannel(c, role) {
    c.on('open', () => {
      notify('channel-open', { role });
      // Once the secure channel is up, drop the signalling websocket — we
      // don't want the broker hanging around any longer than necessary.
      try { peer && peer.disconnect(); } catch {}
    });
    c.on('data', async (raw) => {
      try {
        const envelope = (typeof raw === 'string') ? JSON.parse(raw) : raw;
        if (envelope && envelope.kind === 'snapshot') {
          const snap = await decryptPayload(envelope.payload);
          notify('snapshot-received', { snapshot: snap });
        }
      } catch (e) {
        notify('error', { code: 'DECRYPT_FAILED', detail: String(e && e.message || e) });
      }
    });
    c.on('close', () => notify('channel-close', { role }));
    c.on('error', (e) => notify('error', { code: 'CHANNEL_ERROR', detail: String(e && e.message || e) }));
  }

  // Send the local snapshot over the open data channel (encrypted).
  async function sendSnapshot() {
    if (!conn) throw new Error('NO_CONNECTION');
    const snap = snapshotLocal();
    const payload = await encryptPayload(snap);
    conn.send(JSON.stringify({ kind: 'snapshot', payload }));
    notify('snapshot-sent', { count: countSubs(snap) });
    return snap;
  }

  function countSubs(snap) {
    try {
      const raw = snap && snap.data && snap.data.leakd_subs;
      if (!raw) return 0;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.length : 0;
    } catch { return 0; }
  }

  // Tear down peer + channel and clear the cached key. Safe to call any time.
  function closeAll() {
    try { conn && conn.close(); } catch {}
    try { peer && peer.destroy(); } catch {}
    conn = null; peer = null;
    sessionKey = null; sessionKeyB64 = null;
    notify('closed');
  }

  function isOpen() { return !!(conn && conn.open); }

  // ── Public API ──────────────────────────────────────────────
  window.LeakdP2PSync = {
    SYNC_KEYS,
    // Lifecycle
    createHost, connectAsClient, sendSnapshot, closeAll, isOpen,
    // Events
    on, off,
    // Helpers exposed for the UI layer (QR / scanner)
    loadScript, snapshotLocal, countSubs,
    // Crypto (mostly for tests)
    encryptPayload, decryptPayload, generateSessionKey, importSessionKey,
  };
})();
