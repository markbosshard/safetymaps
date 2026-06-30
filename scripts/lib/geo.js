// Shared helpers for building detailed-city choropleths from downloaded admin GeoJSON (Task F).
// Keeps the same conventions as the original pipeline: coords rounded to 5 dp, small bundle.

const https = require('https');

// Follow-redirect JSON fetch (Node has global fetch too, but this avoids edge cases on some setups).
function fetchJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'safetymap-build' } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && redirects < 5) {
        r.resume(); return resolve(fetchJson(r.headers.location, redirects + 1));
      }
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode + ' for ' + url)); }
      let d = ''; r.setEncoding('utf8');
      r.on('data', (c) => (d += c));
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

const r5 = (x) => Math.round(x * 1e5) / 1e5;

// Round a ring to 5 dp, dropping consecutive duplicate points; keep it closed.
function roundRing(ring) {
  const out = []; let prev = null;
  for (const pt of ring) {
    const p = [r5(pt[0]), r5(pt[1])];
    if (!prev || p[0] !== prev[0] || p[1] !== prev[1]) { out.push(p); prev = p; }
  }
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0].slice());
  return out;
}
function roundGeom(g) {
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: g.coordinates.map(roundRing).filter((r) => r.length >= 4) };
  if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.coordinates.map((poly) => poly.map(roundRing).filter((r) => r.length >= 4)).filter((p) => p.length) };
  return g;
}

// Largest outer ring (for a representative label point).
function largestOuter(g) {
  if (g.type === 'Polygon') return g.coordinates[0];
  let best = g.coordinates[0][0], bestLen = -1;
  for (const poly of g.coordinates) { const ring = poly[0]; if (ring.length > bestLen) { bestLen = ring.length; best = ring; } }
  return best;
}
function labelPoint(g) {
  const ring = largestOuter(g); let sx = 0, sy = 0;
  for (const p of ring) { sx += p[0]; sy += p[1]; }
  return [r5(sx / ring.length), r5(sy / ring.length)];
}
function bboxOf(districts) {
  let W = Infinity, S = Infinity, E = -Infinity, N = -Infinity;
  for (const d of districts) {
    const polys = d.geom.type === 'Polygon' ? [d.geom.coordinates] : d.geom.coordinates;
    for (const poly of polys) for (const ring of poly) for (const p of ring) {
      if (p[0] < W) W = p[0]; if (p[0] > E) E = p[0]; if (p[1] < S) S = p[1]; if (p[1] > N) N = p[1];
    }
  }
  return [r5(W), r5(S), r5(E), r5(N)];
}

// Title-case an UPPERCASE admin name, keeping Spanish connectors lowercase.
const SMALL = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y']);
function titleCase(name) {
  return String(name).toLowerCase().split(/\s+/).map((w, i) =>
    (i > 0 && SMALL.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
}

const TIER_SCORE = { 1: 2.0, 2: 4.0, 3: 6.0, 4: 8.5 };

module.exports = { fetchJson, r5, roundGeom, labelPoint, bboxOf, titleCase, TIER_SCORE };
