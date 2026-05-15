// Leakd — Backup & Restore
// Bundles everything in localStorage that the app cares about into a single
// JSON file. The user can save it anywhere (cloud drive, email to themselves)
// and restore it on another device. This is the "poor man's sync" — works
// today, no server required.

(function () {
  'use strict';

  const KEYS = [
    'leakd_subs',
    'leakd_settings',
    'leakd_notif_prefs',
    'leakd_notif_log',
    'leakd_pro',
    'leakd_lang',
    'leakd_onboarded',
    'leakd_budgets',
    'leakd_history',
    'leakd_income',
    'leakd_cancelled',
    'leakd_goal',
    'leakd_activity',
  ];

  const FORMAT = 'leakd-backup-v1';

  function exportData() {
    const payload = { format: FORMAT, exportedAt: new Date().toISOString(), data: {} };
    KEYS.forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try { payload.data[key] = JSON.parse(raw); }
        catch { payload.data[key] = raw; } // store as string if not JSON
      }
    });
    return payload;
  }

  function download() {
    const payload = exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `leakd-backup-${date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  function validate(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.format !== FORMAT) return false;
    if (!payload.data || typeof payload.data !== 'object') return false;
    // At minimum we need either subs or settings
    if (!('leakd_subs' in payload.data) && !('leakd_settings' in payload.data)) return false;
    return true;
  }

  function restoreFromPayload(payload) {
    if (!validate(payload)) return false;
    // Wipe known keys first so leftover state doesn't merge weirdly
    KEYS.forEach(k => localStorage.removeItem(k));
    Object.keys(payload.data).forEach(k => {
      if (!KEYS.includes(k)) return; // ignore unknown keys
      const val = payload.data[k];
      const stored = typeof val === 'string' ? val : JSON.stringify(val);
      localStorage.setItem(k, stored);
    });
    return true;
  }

  function restoreFromFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(String(reader.result || ''));
          resolve(restoreFromPayload(payload));
        } catch {
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file);
    });
  }

  window.LeakdBackup = { download, restoreFromFile, exportData, FORMAT };
})();
