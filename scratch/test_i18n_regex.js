
const p = "count";
const params = { count: 3 };
let str = "{count} előfizetés található";
str = str.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
console.log("Result:", str);
