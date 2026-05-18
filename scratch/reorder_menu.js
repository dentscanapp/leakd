const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Find the menu-list div
const menuListStart = html.indexOf('<div class="menu-list">');
const menuListEnd = html.indexOf('</div>', html.indexOf('<div class="menu-footer">') - 20);

// Extract individual menu items by their IDs
function extractItem(id) {
  // Handle both button and a tags
  let startTag, endTag;
  
  // Try button first
  let startIdx = html.indexOf(`id="${id}"`);
  if (startIdx === -1) return null;
  
  // Go back to find the opening tag
  let tagStart = html.lastIndexOf('<button', startIdx);
  let tagStartA = html.lastIndexOf('<a ', startIdx);
  
  let isLink = false;
  if (tagStartA > tagStart) {
    tagStart = tagStartA;
    isLink = true;
  }
  
  let tagEnd;
  if (isLink) {
    tagEnd = html.indexOf('</a>', startIdx) + '</a>'.length;
  } else {
    tagEnd = html.indexOf('</button>', startIdx) + '</button>'.length;
  }
  
  return html.substring(tagStart, tagEnd);
}

const order = [
  'menuPro',        // 1. PRO upsell
  'menuCurrency',   // 2. Currency
  'menuLanguage',   // 3. Language
  'menuTheme',      // 4. Theme
  'menuIncome',     // 5. Income & ratio
  'menuBudgets',    // 6. Category budgets PRO
  'menuGoal',       // 7. Savings goal
  'menuWhatIf',     // 8. What-if calculator
  'menuCompare',    // 9. Compare
  'menuCancelled',  // 10. Cancelled subs
  'menuBank',       // 11. Bank import
  'menuImport',     // 12. Bulk import
  'menuExport',     // 13. Export CSV
  'menuPdf',        // 14. PDF PRO
  'menuCalendar',   // 15. Calendar export
  'menuShare',      // 16. Share
  'menuSync',       // 17. Cloud sync PRO
  'menuBackup',     // 18. Backup & restore
  'menuYearend',    // 19. Year-end PRO
  'menuEmailRem',   // 20. Email reminders PRO
  'menuActivity',   // 21. Activity log
  'menuTour',       // 22. Tour
];

// Privacy and Terms are <a> tags, Reset is a button
const privacyLink = extractItem('privacy.html');  // won't work by ID
const termsLink = extractItem('terms.html');

// Extract privacy and terms manually
let privacyStart = html.indexOf('href="privacy.html"');
privacyStart = html.lastIndexOf('<a ', privacyStart);
let privacyEnd = html.indexOf('</a>', privacyStart) + '</a>'.length;
const privacyItem = html.substring(privacyStart, privacyEnd);

let termsStart = html.indexOf('href="terms.html"');
termsStart = html.lastIndexOf('<a ', termsStart);
let termsEnd = html.indexOf('</a>', termsStart) + '</a>'.length;
const termsItem = html.substring(termsStart, termsEnd);

const resetItem = extractItem('menuReset');

const items = [];
for (const id of order) {
  const item = extractItem(id);
  if (item) {
    items.push(item);
  } else {
    console.error(`Could not find menu item: ${id}`);
  }
}

// Build new menu list content
const newMenuContent = '    <div class="menu-list">\n' +
  items.map(i => '      ' + i).join('\n\n') + '\n\n' +
  '      ' + privacyItem + '\n\n' +
  '      ' + termsItem + '\n\n' +
  '      ' + resetItem + '\n' +
  '    </div>';

// Find exact boundaries of <div class="menu-list">...</div>
const mlStart = html.indexOf('<div class="menu-list">');
// Find the matching closing </div> - it's right before <div class="menu-footer">
const footerStart = html.indexOf('<div class="menu-footer">');
const mlEnd = html.lastIndexOf('</div>', footerStart) + '</div>'.length;

const before = html.substring(0, mlStart);
const after = html.substring(mlEnd);

html = before + newMenuContent + '\n\n' + after;

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Menu reordered successfully!');
console.log('Items placed:', items.length + 3, '(+privacy, terms, reset)');
