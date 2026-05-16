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

    isPro() {
      return !!this.state.active;
    },

    isTwa() {
      return window.matchMedia('(display-mode: standalone)').matches || 
             (window.navigator.userAgent.includes('TWA') || !!window.DigitalGoodsService);
    },

    // ── Google Play Billing ──
    
    async getService() {
      if (!window.getDigitalGoodsService) return null;
      try {
        return await window.getDigitalGoodsService(PLAY_BILLING_METHOD);
      } catch (e) {
        console.warn('Digital Goods API not available', e);
        return null;
      }
    },

    async purchase(skuId = SKUS.MONTHLY) {
      const service = await this.getService();
      if (!service) {
        return { ok: false, error: 'Google Play Billing is not available. Please ensure you are using the app from the Play Store.' };
      }

      try {
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
          // Tell the billing service that the purchase was successful and should be acknowledged
          await service.acknowledge(purchaseToken, 'repeatable');
          
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
          return { ok: false, error: 'Purchase failed or was cancelled.' };
        }
      } catch (e) {
        console.error('Purchase error', e);
        return { ok: false, error: e.message || 'An error occurred during purchase.' };
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

