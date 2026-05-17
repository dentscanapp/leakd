const fs = require('fs');

// Mock window and window.LeakdCurrency
global.window = {
  LeakdCurrency: {
    toMonthly: (price, cycle, currency) => {
      if (cycle === 'weekly') return price * 4.33;
      if (cycle === 'yearly') return price / 12;
      return price;
    }
  }
};

// Load lifetime.js
const code = fs.readFileSync('js/lifetime.js', 'utf8');
eval(code);

const L = window.LeakdLifetime;

// Create a dummy subscription 2 years old
const d = new Date();
d.setFullYear(d.getFullYear() - 2);

const sub = {
  createdAt: d.toISOString(),
  price: 10,
  cycle: 'monthly',
  currency: 'USD'
};

const report = L.report(sub, 7);

console.log('Lifetime Math Test Results:');
console.log('Months elapsed:', report.lifetime.months.toFixed(2));
console.log('Total paid so far:', report.lifetime.totalPaid.toFixed(2));
console.log('Next 1 year cost:', report.next1y.toFixed(2));
console.log('Next 5 years cost:', report.next5y.toFixed(2));
console.log('Next 10 years cost:', report.next10y.toFixed(2));
console.log('If invested 10 years @ 7%:', report.invested10y.toFixed(2));
console.log('Inflated 10 year cost (5% YoY):', report.inflated10yTotal.toFixed(2));

if (report.invested10y > report.next10y) {
  console.log('✅ Compound interest > flat cost');
} else {
  console.log('❌ Math error in investment calculation');
}

if (report.inflated10yTotal > report.next10y) {
  console.log('✅ Inflated cost > flat cost');
} else {
  console.log('❌ Math error in inflation calculation');
}
