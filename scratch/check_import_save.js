const fs = require('fs');
const brands = fs.readFileSync('js/brands.js', 'utf8');

// Check if brands overwrite price
if (brands.includes('price')) {
  console.log('BRANDS.JS CONTAINS PRICE OVERWRITE!');
  const lines = brands.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('price')) console.log(`  line ${i+1}: ${l.trim()}`);
  });
} else {
  console.log('brands.js does NOT set price — OK');
}

// Check import.js confirmImport function
const app = fs.readFileSync('js/app.js', 'utf8');
const confirmStart = app.indexOf('function confirmImport');
const confirmEnd = app.indexOf('\n  }', confirmStart + 100) + 4;
console.log('\nconfirmImport function:');
console.log(app.substring(confirmStart, confirmEnd));

// Also check importStaged usage
const stagedIdx = app.indexOf('importStaged');
console.log('\nFirst importStaged reference:');
console.log(app.substring(stagedIdx, stagedIdx + 200));
