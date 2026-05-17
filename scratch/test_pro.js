const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting PRO features test...');
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: "new",
      defaultViewport: { width: 400, height: 800 }
    });
    const page = await browser.newPage();
    
    // Step 1: Test WITHOUT Pro
    console.log('--- Testing Free mode ---');
    await page.goto('http://127.0.0.1:3000');
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0' });
    
    await page.waitForSelector('#addBtn');
    
    // Open Menu
    await page.evaluate(() => document.getElementById('openMenu').click());
    await new Promise(r => setTimeout(r, 500));
    
    // Click Sync
    await page.evaluate(() => document.getElementById('menuSync').click());
    await new Promise(r => setTimeout(r, 500));
    
    // Verify sync lock is visible
    const syncLockVisibleFree = await page.evaluate(() => {
        const lock = document.getElementById('syncProLock');
        return lock && lock.style.display !== 'none';
    });
    console.log(`Sync Pro Lock visible in free mode: ${syncLockVisibleFree ? '✅ Yes' : '❌ No'}`);

    // Click Budgets
    await page.evaluate(() => document.getElementById('closeSyncModal').click());
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => document.getElementById('openMenu').click());
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => document.getElementById('menuBudgets').click());
    await new Promise(r => setTimeout(r, 500));
    
    const budgetsLockVisibleFree = await page.evaluate(() => {
        const lock = document.getElementById('budgetsProLock');
        return lock && lock.style.display !== 'none';
    });
    console.log(`Budgets Pro Lock visible in free mode: ${budgetsLockVisibleFree ? '✅ Yes' : '❌ No'}`);


    // Step 2: Test WITH Pro
    console.log('\n--- Testing PRO mode ---');
    await page.evaluate(() => {
        localStorage.setItem('leakd_pro', JSON.stringify({active: true, plan: 'yearly'}));
    });
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#addBtn');

    // Check Sync modal
    await page.evaluate(() => document.getElementById('openMenu').click());
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => document.getElementById('menuSync').click());
    await new Promise(r => setTimeout(r, 500));
    
    const syncLockVisiblePro = await page.evaluate(() => {
        const lock = document.getElementById('syncProLock');
        return lock && lock.style.display !== 'none';
    });
    const syncSetupVisiblePro = await page.evaluate(() => {
        const setup = document.getElementById('syncSetupStep');
        const status = document.getElementById('syncStatusCard');
        return (setup && setup.style.display !== 'none') || (status && status.style.display !== 'none');
    });
    console.log(`Sync Pro Lock hidden in Pro mode: ${!syncLockVisiblePro ? '✅ Yes' : '❌ No'}`);
    console.log(`Sync Setup/Status visible in Pro mode: ${syncSetupVisiblePro ? '✅ Yes' : '❌ No'}`);

    // Check Budgets modal
    await page.evaluate(() => document.getElementById('closeSyncModal').click());
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => document.getElementById('openMenu').click());
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => document.getElementById('menuBudgets').click());
    await new Promise(r => setTimeout(r, 500));

    const budgetsLockVisiblePro = await page.evaluate(() => {
        const lock = document.getElementById('budgetsProLock');
        return lock && lock.style.display !== 'none';
    });
    const budgetsListVisiblePro = await page.evaluate(() => {
        const list = document.getElementById('budgetsList');
        return list && list.style.display !== 'none';
    });
    console.log(`Budgets Pro Lock hidden in Pro mode: ${!budgetsLockVisiblePro ? '✅ Yes' : '❌ No'}`);
    console.log(`Budgets List visible in Pro mode: ${budgetsListVisiblePro ? '✅ Yes' : '❌ No'}`);
    await page.evaluate(() => document.getElementById('closeBudgetsModal').click());
    await new Promise(r => setTimeout(r, 500));

    // Check Year-End modal
    await page.evaluate(() => document.getElementById('openMenu').click());
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => document.getElementById('menuYearend').click());
    await new Promise(r => setTimeout(r, 500));
    const yearendModalVisible = await page.evaluate(() => {
        const modal = document.getElementById('yearendModal');
        return modal && modal.style.display !== 'none';
    });
    console.log(`Year-end report opens in Pro mode: ${yearendModalVisible ? '✅ Yes' : '❌ No'}`);

    console.log('\n✅ PRO features testing completed!');
  } catch (error) {
    console.error('❌ Error during PRO testing:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
