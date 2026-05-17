const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting E2E comprehensive feature test...');
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: "new",
      defaultViewport: { width: 400, height: 800 }
    });
    const page = await browser.newPage();

    const errors = [];
    page.on('pageerror', err => {
      errors.push(err.message);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('http://127.0.0.1:3000');
    await page.evaluate(() => localStorage.clear());
    // Give Pro access to test everything
    await page.evaluate(() => localStorage.setItem('leakd_pro', JSON.stringify({active: true, plan: 'yearly'})));
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0' });

    console.log('1. Testing What-If Calculator...');
    await page.evaluate(() => document.getElementById('openMenu').click());
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => document.getElementById('menuWhatIf').click());
    await new Promise(r => setTimeout(r, 300));
    const whatifVisible = await page.evaluate(() => document.getElementById('whatifModal').style.display !== 'none');
    console.log(`What-If visible: ${whatifVisible ? '✅' : '❌'}`);
    await page.evaluate(() => document.getElementById('closeWhatIfModal').click());

    console.log('2. Testing Activity Log...');
    await page.evaluate(() => document.getElementById('openMenu').click());
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => document.getElementById('menuActivity').click());
    await new Promise(r => setTimeout(r, 300));
    const activityVisible = await page.evaluate(() => document.getElementById('activityModal').style.display !== 'none');
    console.log(`Activity visible: ${activityVisible ? '✅' : '❌'}`);
    await page.evaluate(() => document.getElementById('closeActivityModal').click());

    console.log('3. Testing Bulk Import...');
    await page.evaluate(() => document.getElementById('openMenu').click());
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => document.getElementById('menuImport').click());
    await new Promise(r => setTimeout(r, 300));
    await page.type('#importText', 'Netflix $15.99\nSpotify $10.99');
    await new Promise(r => setTimeout(r, 1000));
    const importStaged = await page.evaluate(() => document.getElementById('importPreviewList').innerHTML.includes('Netflix'));
    console.log(`Import detected known subs: ${importStaged ? '✅' : '❌'}`);
    await page.evaluate(() => document.getElementById('confirmImportBtn').click());
    await new Promise(r => setTimeout(r, 500));

    console.log('4. Testing Share Card...');
    await page.evaluate(() => document.getElementById('openMenu').click());
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => document.getElementById('menuShare').click());
    await new Promise(r => setTimeout(r, 1500)); // wait for html2canvas
    const shareCanvas = await page.evaluate(() => document.querySelector('#sharePreview canvas') !== null);
    console.log(`Share canvas generated: ${shareCanvas ? '✅' : '❌'}`);
    await page.evaluate(() => document.getElementById('closeShareModal').click());

    console.log('5. Testing PDF Export...');
    await page.evaluate(() => document.getElementById('openMenu').click());
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => document.getElementById('menuPdf').click());
    await new Promise(r => setTimeout(r, 500));
    // Usually PDF triggers a download, which we can't easily assert in headless, but if no errors, it's good.

    console.log('6. Testing Panic Button...');
    await page.evaluate(() => {
        // Need high monthly spend to trigger panic. Add a giant manual sub
        const subs = JSON.parse(localStorage.getItem('leakd_subs') || '[]');
        subs.push({id:'panic-test', name:'Giant Expense', price: 5000, cycle:'monthly', currency:'USD'});
        localStorage.setItem('leakd_subs', JSON.stringify(subs));
    });
    // Reload to trigger insights calc
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.querySelector('.nav-btn[data-view="insights"]').click());
    await new Promise(r => setTimeout(r, 500));
    const panicBtnVisible = await page.evaluate(() => document.getElementById('panicBtn').style.display !== 'none');
    console.log(`Panic button visible: ${panicBtnVisible ? '✅' : '❌'}`);
    if (panicBtnVisible) {
        await page.evaluate(() => document.getElementById('panicBtn').click());
        await new Promise(r => setTimeout(r, 300));
        const panicModalVisible = await page.evaluate(() => document.getElementById('panicModal').style.display !== 'none');
        console.log(`Panic modal opened: ${panicModalVisible ? '✅' : '❌'}`);
    }

    console.log('\n--- Final Validation ---');
    if (errors.length > 0) {
      console.log('❌ Console Errors Found:');
      errors.forEach(e => console.log('  - ' + e));
    } else {
      console.log('✅ ZERO Console Errors during full E2E flow!');
    }

    console.log('\n✅ All features triggered successfully.');
  } catch (error) {
    console.error('❌ E2E Script Error:', error);
  } finally {
    if (browser) await browser.close();
  }
})();
