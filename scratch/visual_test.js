const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Starting visual test...');
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: "new",
      defaultViewport: { width: 400, height: 800 }
    });
    const page = await browser.newPage();
    
    await page.goto('http://127.0.0.1:3000');
    await page.evaluate(() => localStorage.clear());
    
    console.log('Navigating to app...');
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle0' });
    
    // Wait for the app to initialize
    await page.waitForSelector('#addBtn');
    
    console.log('Taking screenshot: 01_home_initial.png');
    await page.screenshot({ path: '01_home_initial.png' });

    console.log('Adding Netflix subscription...');
    // Click add button
    await page.evaluate(() => document.getElementById('addBtn').click());
    
    // Wait a bit for modal animation
    await new Promise(r => setTimeout(r, 1000));
    console.log('Taking screenshot: 02_modal_open.png');
    await page.screenshot({ path: '02_modal_open.png' });

    // Click preset
    await page.evaluate(() => {
        const btn = document.querySelector('#presets button[data-name="Netflix"]');
        if(btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 500));
    console.log('Taking screenshot: 03_preset_selected.png');
    await page.screenshot({ path: '03_preset_selected.png' });

    // Save
    await page.evaluate(() => document.getElementById('saveBtn').click());
    
    // Wait for modal to close and UI to update
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Taking screenshot: 04_home_added.png');
    await page.screenshot({ path: '04_home_added.png' });

    const monthlyTotal = await page.$eval('#monthlyTotal', el => el.innerText);
    console.log(`Monthly total updated to: ${monthlyTotal}`);

    console.log('Changing language to Hungarian...');
    await page.evaluate(() => document.getElementById('openMenu').click());
    await new Promise(r => setTimeout(r, 500));
    
    await page.evaluate(() => document.getElementById('menuLanguage').click());
    await new Promise(r => setTimeout(r, 500));
    
    await page.evaluate(() => {
        const btn = document.querySelector('#langModal button[data-lang="hu"]');
        if(btn) btn.click();
    });
    
    // Wait for UI to update strings
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Taking screenshot: 05_hungarian_ui.png');
    await page.screenshot({ path: '05_hungarian_ui.png' });

    console.log('Navigating to Insights view...');
    await page.evaluate(() => {
        const btn = document.querySelector('.nav-btn[data-view="insights"]');
        if(btn) btn.click();
    });
    
    // Wait for charts to render
    await new Promise(r => setTimeout(r, 1500));
    
    console.log('Taking screenshot: 06_insights.png');
    await page.screenshot({ path: '06_insights.png' });

    // Generate markdown report
    const report = `# Visual Test Results
    
![Initial Home State](file:///c:/Users/local_user/Documents/leakd/leakd/scratch/01_home_initial.png)
![Modal Open](file:///c:/Users/local_user/Documents/leakd/leakd/scratch/02_modal_open.png)
![Preset Selected](file:///c:/Users/local_user/Documents/leakd/leakd/scratch/03_preset_selected.png)
![Home Added](file:///c:/Users/local_user/Documents/leakd/leakd/scratch/04_home_added.png)
![Hungarian UI](file:///c:/Users/local_user/Documents/leakd/leakd/scratch/05_hungarian_ui.png)
![Insights](file:///c:/Users/local_user/Documents/leakd/leakd/scratch/06_insights.png)

**Monthly Total after add:** ${monthlyTotal}
`;
    fs.writeFileSync('report.md', report);

    console.log('✅ Visual testing completed successfully!');
  } catch (error) {
    console.error('❌ Error during visual testing:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
