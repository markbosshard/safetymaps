// One-off: derive index.template.html from the delivered index.html by replacing
// the two inlined data literals (CITIES object, CMAP array) with placeholders.
//   node scripts/make_template.js
// After this, build.js fills the template from cities.json + cmap.json.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function matchBalanced(src, openIdx) {
  const open = src[openIdx];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return [openIdx, i + 1]; }
  }
  throw new Error('Unbalanced literal');
}

function replaceLiteral(src, marker, openChar, placeholder) {
  const m = src.indexOf(marker);
  const openIdx = src.indexOf(openChar, m + marker.length);
  const [s, e] = matchBalanced(src, openIdx);
  return src.slice(0, s) + placeholder + src.slice(e);
}

let tmpl = html;
tmpl = replaceLiteral(tmpl, 'const CITIES =', '{', '/*__CITIES__*/{}');
tmpl = replaceLiteral(tmpl, 'CMAP =', '[', '/*__CMAP__*/[]');

fs.writeFileSync(path.join(root, 'index.template.html'), tmpl);
console.log('Wrote index.template.html (' + tmpl.length + ' bytes)');
console.log('  __CITIES__ marker present:', tmpl.includes('/*__CITIES__*/'));
console.log('  __CMAP__   marker present:', tmpl.includes('/*__CMAP__*/'));
