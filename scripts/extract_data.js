// Extract the embedded data layer back out of index.html into editable JSON files.
//   node scripts/extract_data.js
// Produces:
//   cities.json  — the full CITIES object (the data bundle for all cities)
//   cmap.json    — the green->red colormap as [[t, hex], ...]
//
// This recovers the editable source-of-truth that build.py/build.js bundles back
// into index.html. The delivered HTML inlined everything; this reverses that.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Scan a balanced literal starting at the opening bracket `open` (`{` or `[`),
// correctly skipping brackets that appear inside string literals.
function matchBalanced(src, openIdx) {
  const open = src[openIdx];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return src.slice(openIdx, i + 1); }
  }
  throw new Error('Unbalanced literal starting at ' + openIdx);
}

// Pull the literal that follows a `<marker> =` assignment.
function extractAfter(marker, openChar) {
  const m = html.indexOf(marker);
  if (m < 0) throw new Error('Marker not found: ' + marker);
  const openIdx = html.indexOf(openChar, m + marker.length);
  return matchBalanced(html, openIdx);
}

const citiesLiteral = extractAfter('const CITIES =', '{');
const cmapLiteral = extractAfter('CMAP =', '[');

const cities = JSON.parse(citiesLiteral);
const cmap = JSON.parse(cmapLiteral);

// cities.json: compact (it's large); cmap.json: pretty (small, human-edited).
fs.writeFileSync(path.join(root, 'cities.json'), JSON.stringify(cities) + '\n');
fs.writeFileSync(path.join(root, 'cmap.json'), JSON.stringify(cmap) + '\n');

const keys = Object.keys(cities);
const tiers = keys.reduce((a, k) => { const t = cities[k].tier_level || '?'; a[t] = (a[t] || 0) + 1; return a; }, {});
console.log(`cities.json: ${keys.length} cities  ${JSON.stringify(tiers)}`);
console.log(`cmap.json:   ${cmap.length} stops  (${cmap[0][1]} -> ${cmap[cmap.length - 1][1]})`);
