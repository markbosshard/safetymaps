// Enlarge the single-circle "bubble" of city-level cities (model==='city') by a fixed factor so it
// covers more of the city when you're zoomed in. City-level entries are an indicative circle, not a
// real boundary, so scaling the radius is honest (it was never a precise footprint).
//
// Idempotent: each city records `bubble_scale` once applied and is skipped on re-run.
// Usage:  node scripts/scale_bubbles.js  [factor]   (default 1.5)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'cities.json');
const SCALE = Number(process.argv[2]) || 1.5;
const round = v => Math.round(v * 1e5) / 1e5;

const cities = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let n = 0;

for (const key of Object.keys(cities)) {
  const C = cities[key];
  if (C.model !== 'city') continue;          // only single-bubble city-level entries
  if (C.bubble_scale) continue;              // already scaled — keep idempotent
  const d = (C.districts || [])[0];
  if (!d || !d.geom || !d.label) continue;
  const [clon, clat] = d.label;              // scale around the circle's centre

  const scaleRing = ring => ring.map(([x, y]) =>
    [round(clon + (x - clon) * SCALE), round(clat + (y - clat) * SCALE)]);
  const g = d.geom;
  if (g.type === 'Polygon') g.coordinates = g.coordinates.map(scaleRing);
  else if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(p => p.map(scaleRing));
  else continue;

  // recompute the city bbox from the scaled geometry
  let W = Infinity, S = Infinity, E = -Infinity, N = -Infinity;
  const rings = g.type === 'Polygon' ? g.coordinates : [].concat(...g.coordinates);
  rings.forEach(ring => ring.forEach(([x, y]) => {
    if (x < W) W = x; if (x > E) E = x; if (y < S) S = y; if (y > N) N = y;
  }));
  C.bbox = [round(W), round(S), round(E), round(N)];
  C.bubble_scale = SCALE;
  n++;
}

fs.writeFileSync(FILE, JSON.stringify(cities));
console.log(`scaled ${n} city-level bubble(s) by ${SCALE}x`);
