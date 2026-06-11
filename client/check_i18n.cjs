const fs = require('fs');
const content = fs.readFileSync(process.argv[2], 'utf8');
const zhMatch = content.match(/"zh":\s*\{(.+?)\}/s);
const enMatch = content.match(/"en":\s*\{(.+?)\}/s);
if (!zhMatch || !enMatch) { console.log('Could not parse'); process.exit(1); }
const zhKeys = [...zhMatch[1].matchAll(/"([^"]+?)"\s*:/g)].map(m => m[1]);
const enKeys = [...enMatch[1].matchAll(/"([^"]+?)"\s*:/g)].map(m => m[1]);
const missing = zhKeys.filter(k => !enKeys.includes(k));
console.log('Missing English translations:', missing.length);
missing.forEach(k => console.log('  MISSING:', k));
const same = zhKeys.filter(k => {
  const re = new RegExp('"' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"\\s*:\\s*"(.+?)"');
  const zhVal = zhMatch[1].match(re);
  const enVal = enMatch[1].match(re);
  return zhVal && enVal && zhVal[1] === enVal[1];
});
console.log('Keys with same zh/en value:', same.length);
same.forEach(k => console.log('  SAME:', k));
