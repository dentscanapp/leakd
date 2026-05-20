// Leakd — Pro license gate
// Uses the Digital Goods API (Google Play Billing) for TWA.
//
// Verification strategy:
//   • We check with the Google Play Billing service on launch.
//   • Purchases are tied to the user's Google Account.

(function () {
  'use strict';

  const PRO_KEY = 'leakd_pro';
  const PLAY_BILLING_METHOD = 'https://play.google.com/billing';
  const SKUS = {
    MONTHLY: 'pro_monthly',
    YEARLY: 'pro_yearly'
  };

  const Pro = {
    state: { active: false, verifiedAt: 0, plan: '', sku: '' },

    load() {
      try {
        const raw = localStorage.getItem(PRO_KEY);
        if (raw) this.state = { ...this.state, ...JSON.parse(raw) };
      } catch {}

      // Auto-restore check if we're in a TWA
      if (this.isTwa()) {
        this.restore();
      }

      return this.state;
    },

    save() {
      localStorage.setItem(PRO_KEY, JSON.stringify(this.state));
    },

    // ────────────────────────────────────────────────────────────────
    // ⚠️ TEMP TEST FLAG — set to false to restore real Pro gating.
    // While true, EVERY user sees Pro features unlocked for testing.
    // Search for "TEMP_UNLOCK_PRO" to find and revert.
    // ────────────────────────────────────────────────────────────────
    TEMP_UNLOCK_PRO: false,

    isPro() {
      if (this.TEMP_UNLOCK_PRO) return true;
      return !!this.state.active;
    },

    isTwa() {
      return window.matchMedia('(display-mode: standalone)').matches || 
             (window.navigator.userAgent.includes('TWA') || !!window.DigitalGoodsService);
    },

    // ── Google Play Billing ──
    
    async getService() {
      if (!window.getDigitalGoodsService) return { service: null, code: 'NO_DIGITAL_GOODS_API' };
      try {
        const svc = await window.getDigitalGoodsService(PLAY_BILLING_METHOD);
        if (!svc) return { service: null, code: 'SERVICE_NULL' };
        return { service: svc, code: 'OK' };
      } catch (e) {
        console.warn('Digital Goods API call threw', e);
        return { service: null, code: 'SERVICE_THREW', detail: String(e && e.message || e) };
      }
    },

    // Returns an object the UI can display verbatim. Each failure mode has
    // its own `code` so the user (or we, via remote debugging) can tell
    // exactly which Play Billing step blew up.
    async diagnose() {
      const out = {
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        uaTwa: window.navigator.userAgent.includes('TWA'),
        hasGetDigitalGoodsService: typeof window.getDigitalGoodsService === 'function',
        hasPaymentRequest: typeof window.PaymentRequest === 'function',
        skus: SKUS,
      };
      if (out.hasGetDigitalGoodsService) {
        const { service, code, detail } = await this.getService();
        out.serviceCode = code;
        if (detail) out.serviceDetail = detail;
        if (service && typeof service.getDetails === 'function') {
          try {
            const details = await service.getDetails([SKUS.MONTHLY, SKUS.YEARLY]);
            out.skuFound = (details || []).map(d => d.itemId);
            out.skuMissing = [SKUS.MONTHLY, SKUS.YEARLY].filter(s => !out.skuFound.includes(s));
          } catch (e) {
            out.skuLookupError = String(e && e.message || e);
          }
        }
      }
      return out;
    },

    async purchase(skuId = SKUS.MONTHLY) {
      const { service, code, detail } = await this.getService();
      if (!service) {
        return {
          ok: false,
          code,
          detail,
          error: code === 'NO_DIGITAL_GOODS_API'
            ? 'Google Play Billing is not available — this build was not generated with the Digital Goods API enabled, or you are not running it from the Play Store.'
            : 'Google Play Billing service could not be initialised (' + code + (detail ? ': ' + detail : '') + ').'
        };
      }

      try {
        // Verify the SKU actually exists in Play Console before opening the
        // PaymentRequest sheet — otherwise request.show() rejects with a
        // generic error and the user just sees "nothing happens".
        if (typeof service.getDetails === 'function') {
          try {
            const details = await service.getDetails([skuId]);
            if (!details || !details.length) {
              return {
                ok: false,
                code: 'SKU_NOT_FOUND',
                error: 'Subscription product "' + skuId + '" is not configured (or not yet active) in Google Play Console.'
              };
            }
          } catch (e) {
            console.warn('SKU lookup failed', e);
          }
        }

        const paymentMethods = [{
          supportedMethods: PLAY_BILLING_METHOD,
          data: { sku: skuId }
        }];

        const paymentDetails = {
          total: { label: 'Total', amount: { currency: 'USD', value: '0' } } // Amount is defined in Play Console
        };

        const request = new PaymentRequest(paymentMethods, paymentDetails);
        const response = await request.show();

        // At this point the user has completed the flow in the Play Store overlay
        const { purchaseToken } = response.details;

        if (purchaseToken) {
          // Tell the billing service that the purchase was successful.
          // Note: In Digital Goods API 2.0, acknowledge() was removed from the client.
          // It MUST be done via a backend server, otherwise Google Play refunds the purchase in 3 days.

          try {
            const ackRes = await fetch('https://leakd-billing-worker.peterpetor1987.workers.dev', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                purchaseToken: purchaseToken,
                subscriptionId: skuId
              })
            });
            if (!ackRes.ok) console.error('Failed to acknowledge purchase via backend');
          } catch (err) {
            console.error('Backend ack error:', err);
          }

          this.state = {
            active: true,
            verifiedAt: Date.now(),
            plan: skuId === SKUS.YEARLY ? 'yearly' : 'monthly',
            sku: skuId
          };
          this.save();
          await response.complete('success');
          return { ok: true };
        } else {
          await response.complete('fail');
          return { ok: false, code: 'NO_TOKEN', error: 'Purchase failed or was cancelled.' };
        }
      } catch (e) {
        console.error('Purchase error', e);
        return {
          ok: false,
          code: e.name === 'AbortError' ? 'USER_CANCELLED' : 'PAYMENT_REQUEST_FAILED',
          detail: String(e && e.message || e),
          error: (e && e.message) || 'An error occurred during purchase.'
        };
      }
    },

    async restore() {
      const service = await this.getService();
      if (!service) return { ok: false };

      try {
        const purchases = await service.listPurchases();
        const activePro = purchases.find(p => p.itemId === SKUS.MONTHLY || p.itemId === SKUS.YEARLY);
        
        if (activePro) {
          this.state = {
            active: true,
            verifiedAt: Date.now(),
            plan: activePro.itemId === SKUS.YEARLY ? 'yearly' : 'monthly',
            sku: activePro.itemId
          };
          this.save();
          return { ok: true };
        } else {
          // If we thought we were Pro but Play Store says no, deactivate
          if (this.state.active) {
            this.deactivate();
          }
          return { ok: false };
        }
      } catch (e) {
        console.error('Restore error', e);
        return { ok: false };
      }
    },

    deactivate() {
      this.state = { active: false, verifiedAt: 0, plan: '', sku: '' };
      this.save();
    },

    // ── Premium feature catalogue ──
    features: {
      'csv-export':    { name: 'CSV export', free: true },
      'unlimited':     { name: 'Unlimited subscriptions', free: true },
      'notifications': { name: 'Renewal & trial reminders', free: true },
      'insights':      { name: 'Smart insights & duplicate detection', free: true },
      'share-card':    { name: 'Shareable leak card', free: true },

      'email-reminders': { name: 'Email reminders (in addition to push)', free: false },
      'sync':            { name: 'Multi-device sync', free: false },
      'yearly-report':   { name: 'Year-end spending report', free: false },
      'budgets':         { name: 'Category budgets & alerts', free: false },
      'priority':        { name: 'Priority support', free: false },
    },
  };

  window.LeakdPro = Pro;
})();

