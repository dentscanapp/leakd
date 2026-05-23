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
      } catch { }

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
    // FREE-FOR-EVERYONE FLAG (v1.2.3 strategic pivot — 2026-05-23).
    // Every feature is unlocked for every user. Revenue now comes from
    // voluntary supporter tiers (Monthly/Yearly Supporter via Google Play
    // subscriptions + Coffee Tip consumable IAPs). The flag name is kept
    // for backwards-compat with old gates that still check it; nothing
    // is "Pro-locked" any more — supporter status is purely cosmetic.
    // ────────────────────────────────────────────────────────────────
    TEMP_UNLOCK_PRO: true,

    isPro() {
      if (this.TEMP_UNLOCK_PRO) return true;
      return !!this.state.active;
    },

    // Has the user actively supported development? Drives the "Supporter"
    // badge UI. Returns true if they hold an active Play Store subscription
    // (Monthly/Yearly Supporter, formerly Pro) OR have bought at least one
    // consumable tip product. Independent from `isPro()` — every feature
    // is free regardless, this is only for the visible thank-you state.
    isSupporter() {
      if (this.state && this.state.active) return true; // active subscription
      const tips = this._loadTipLog();
      return tips.length > 0;
    },

    // The "founding supporter" badge is permanent — given to anyone who held
    // a Pro subscription before the Free-for-everyone pivot, OR to anyone
    // who supports during the first 90 days after launch.
    isFoundingSupporter() {
      if (!this.state || !this.state.verifiedAt) return false;
      const PIVOT_DATE = Date.UTC(2026, 4, 23); // 2026-05-23 — pivot day
      return this.state.verifiedAt < PIVOT_DATE
          || this.state.verifiedAt < PIVOT_DATE + 90 * 86400000;
    },

    // Highest tier the user currently shows. Used by the UI to render the
    // right badge (dinner > pizza > coffee > monthly > yearly > none).
    supporterTier() {
      const active = this.state && this.state.active;
      const plan = active && this.state.plan;
      if (plan === 'yearly') return 'yearly';
      if (plan === 'monthly') return 'monthly';
      const tips = this._loadTipLog();
      if (tips.some(t => t.sku === 'supporter_dinner')) return 'dinner';
      if (tips.some(t => t.sku === 'supporter_pizza'))  return 'pizza';
      if (tips.some(t => t.sku === 'supporter_coffee')) return 'coffee';
      return null;
    },

    // How many one-time tips the user has bought (regardless of tier).
    // Drives the "Supported 3 times ☕" counter in the supporter badge.
    tipCount() { return this._loadTipLog().length; },

    _loadTipLog() {
      try { return JSON.parse(localStorage.getItem('leakd_tips') || '[]'); }
      catch { return []; }
    },
    _saveTipLog(arr) {
      localStorage.setItem('leakd_tips', JSON.stringify(arr));
    },
    _addTip(sku) {
      const arr = this._loadTipLog();
      arr.push({ sku, at: Date.now() });
      this._saveTipLog(arr);
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
    // its own code so the user (or we, via remote debugging) can tell
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

    // One-time supporter tip via Google Play Billing.
    // SKU = 'supporter_coffee' | 'supporter_pizza' | 'supporter_dinner'
    // Pre-condition: the SKU is configured as a Consumable Managed Product
    // in the Play Console with the matching id and a non-zero price.
    async tip(skuId) {
      const { service, code } = await this.getService();
      if (!service) {
        return {
          ok: false, code,
          error: 'Google Play Billing is not available — open Leakd via the Play Store install.'
        };
      }
      try {
        const request = new PaymentRequest(
          [{ supportedMethods: 'https://play.google.com/billing', data: { sku: skuId } }],
          { total: { label: 'Tip', amount: { currency: 'USD', value: '0' } } }
        );
        const response = await request.show();
        const { purchaseToken } = response.details;
        if (!purchaseToken) {
          await response.complete('fail');
          return { ok: false, code: 'NO_TOKEN' };
        }
        // Mark consumable as consumed so the user can tip again later.
        // (Without consume(), Play remembers the purchase and the next
        // tap on the same tier returns "item already owned".)
        try { if (typeof service.consume === 'function') await service.consume(purchaseToken); }
        catch (e) { console.warn('consume() failed (non-fatal)', e); }

        await response.complete('success');
        this._addTip(skuId);
        return { ok: true, sku: skuId };
      } catch (e) {
        return {
          ok: false,
          code: e.name === 'AbortError' ? 'USER_CANCELLED' : 'PAYMENT_REQUEST_FAILED',
          error: (e && e.message) || 'Tip failed.'
        };
      }
    },

    async restore() {
      const { service } = await this.getService();
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
      'csv-export': { name: 'CSV export', free: true },
      'unlimited': { name: 'Unlimited subscriptions', free: true },
      'notifications': { name: 'Renewal & trial reminders', free: true },
      'insights': { name: 'Smart insights & duplicate detection', free: true },
      'share-card': { name: 'Shareable leak card', free: true },

      'email-reminders': { name: 'Email reminders (in addition to push)', free: false },
      'sync': { name: 'Multi-device sync', free: false },
      'yearly-report': { name: 'Year-end spending report', free: false },
      'budgets': { name: 'Category budgets & alerts', free: false },
      'priority': { name: 'Priority support', free: false },
    },
  };

  window.LeakdPro = Pro;
})();
