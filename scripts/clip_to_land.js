// Clip district polygons to land using landmask.json, so a city's fill never bleeds across open water
// (e.g. Salvador over the Baía de Todos os Santos). Conservative: only replaces a polygon when the clip
// removes a meaningful slice of water (>=4%) AND keeps most of the original (>=60%), so a slightly
// inland Natural-Earth coastline can't erode a valid city. Idempotent (re-running barely changes a
// already-clipped polygon, so it's skipped). Run AFTER build_landmask.js, BEFORE build.
const fs = require('fs');
const path = require('path');
const pc = require('polygon-clipping');
const FILE = path.join(__dirname, '..', 'cities.json');
const MASK = path.join(__dirname, '..', 'landmask.json');
const r5 = x => +x.toFixed(5);

const cities = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const mask = JSON.parse(fs.readFileSync(MASK, 'utf8'));

// Only clip INDICATIVE city-level circles (model:'city') — they were never real boundaries, so trimming
// sea just makes them hug the coast. Detailed district choropleths are left alone (the 10m coastline is
// too coarse and would erode real small coastal neighbourhoods, e.g. Rio's Joá/Urca/Galeão) EXCEPT a
// curated allowlist of municipal polygons that egregiously balloon over water.
const DETAIL_ALLOW = new Set(['salvador']);

function polyBbox(poly) { let W = Infinity, S = Infinity, E = -Infinity, N = -Infinity;
  for (const ring of poly) for (const [x, y] of ring) { if (x < W) W = x; if (x > E) E = x; if (y < S) S = y; if (y > N) N = y; }
  return [W, S, E, N]; }
const landBb = mask.land.map(p => ({ p, bb: polyBbox(p) }));
const overlap = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const toMP = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
function mpArea(mp) { let a = 0; for (const poly of mp) { a += ringArea(poly[0]); for (let h = 1; h < poly.length; h++) a -= ringArea(poly[h]); } return a; }
function bboxOfMP(mp) { let W = Infinity, S = Infinity, E = -Infinity, N = -Infinity;
  for (const poly of mp) for (const ring of poly) for (const [x, y] of ring) { if (x < W) W = x; if (x > E) E = x; if (y < S) S = y; if (y > N) N = y; }
  return [r5(W), r5(S), r5(E), r5(N)]; }

let changed = 0;
for (const key of Object.keys(cities)) {
  const C = cities[key];
  const isCity = C.model === 'city';
  if (!isCity && !DETAIL_ALLOW.has(key)) continue;   // leave detailed choropleths alone (erosion risk)
  const maxRemove = isCity ? 0.85 : 0.70;            // circles may be mostly sea; detailed must keep land
  let cityTouched = false;
  for (const d of C.districts || []) {
    const dmp = toMP(d.geom);
    const dbb = bboxOfMP(dmp);
    const local = landBb.filter(L => overlap(L.bb, dbb)).map(L => L.p);
    if (!local.length) continue;                 // wholly outside the mask's land — skip (no info)
    let inter;
    try { inter = pc.intersection(dmp, local); } catch (e) { continue; }
    if (!inter || !inter.length) continue;
    const removed = 1 - mpArea(inter) / mpArea(dmp);
    if (removed < 0.04 || removed > maxRemove) continue;  // nothing meaningful, or would erode too much
    d.geom = inter.length === 1
      ? { type: 'Polygon', coordinates: inter[0].map(r => r.map(([x, y]) => [r5(x), r5(y)])) }
      : { type: 'MultiPolygon', coordinates: inter.map(p => p.map(r => r.map(([x, y]) => [r5(x), r5(y)]))) };
    cityTouched = true; changed++;
    console.log(`clip ${key} / ${d.name}: removed ${(removed * 100).toFixed(0)}% (water)`);
  }
  if (cityTouched) C.bbox = bboxOfMP([].concat(...C.districts.map(d => toMP(d.geom))));
}
fs.writeFileSync(FILE, JSON.stringify(cities));
console.log(`clipped ${changed} district(s) to land`);
