// Check sw.js syntax by counting braces, brackets, parens
const fs = require('fs');

const files = ['sw.js', 'js/app.js', 'js/import.js', 'js/insights.js', 'js/share.js'];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  const code = fs.readFileSync(file, 'utf8');
  
  let braces = 0, brackets = 0, parens = 0;
  let inString = false, stringChar = null, escaped = false;
  let inLineComment = false, inBlockComment = false;
  
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];
    
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    
    if (!inString && ch === '/' && next === '/') { inLineComment = true; continue; }
    if (!inString && ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    
    if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
      inString = true; stringChar = ch; continue;
    }
    if (inString && ch === stringChar) { inString = false; stringChar = null; continue; }
    if (inString) continue;
    
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
    else if (ch === '(') parens++;
    else if (ch === ')') parens--;
  }
  
  const ok = braces === 0 && brackets === 0 && parens === 0;
  console.log(`${file}: ${ok ? 'OK' : 'SYNTAX ERROR'} (braces:${braces}, brackets:${brackets}, parens:${parens})`);
});

// Also check for common issues
console.log('\n--- Common patterns ---');
const swCode = fs.readFileSync('sw.js', 'utf8');
const lines = swCode.split('\n');
lines.forEach((line, i) => {
  const t = line.trim();
  // Look for unclosed Promise.all or other issues
  if (t.includes('Promise.all([') && !t.includes('])')) {
    // Check if closing is on same or next few lines
    const context = lines.slice(i, i + 6).join(' ');
    if (!context.includes('])')) {
      console.log(`sw.js:${i+1} — Possibly unclosed Promise.all: "${t}"`);
    }
  }
});

console.log('\n--- SW activate event ---');
const activateStart = swCode.indexOf("addEventListener('activate'");
const activateEnd = swCode.indexOf('\n});', activateStart) + 3;
console.log(swCode.substring(activateStart, activateEnd));
