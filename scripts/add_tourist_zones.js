// US-8 — split resort cities into a safer "tourist/hotel core" + the rest, where the core is derived from
// the ACTUAL cluster of OpenStreetMap-tagged hotels (real data; OSM has no clean zona-hotelera boundary).
// Each hotel is buffered ~300 m and unioned; the result is clipped to land, then the city's indicative
// circle is split into core (safer score) + rest (the city's existing overall). Honest label: the core is
// "approximate, from OSM hotel locations", not an official boundary. One-time data generator (network) —
// run, then `npm run clusters && npm run build`. Idempotent (skips a city already marked tourist_zone).
//
// Run: node scripts/add_tourist_zones.js
const fs = require('fs');
const path = require('path');
const pc = require('polygon-clipping');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'cities.json');
const cities = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const mask = JSON.parse(fs.readFileSync(path.join(ROOT, 'landmask.json'), 'utf8'));

const UA = 'LatamCrimeMap/1.0 (https://latamcrimemap.com; tourist-zone build)';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const BUF_KM = 0.42;                 // hotel buffer radius (connects a dense strip into one blob)
const COAST_KM = 1.3;                // keep only hotels this close to the coast (resorts are beachfront)
const r5 = x => +x.toFixed(5);

// key | core zone name | core (safer) score
const ZONES = [
  ['cancun', 'Zona Hotelera', 2.8],
  ['playa-del-carmen', 'Hotel zone', 2.8],
  ['los-cabos', 'Resort corridor', 2.3],
  ['punta-cana', 'Resort zone', 2.0],
  ['puerto-vallarta', 'Hotel zone', 2.5],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function overpass(q) {
  for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA }, body: 'data=' + encodeURIComponent(q) });
      const ct = r.headers.get('content-type') || ''; const txt = await r.text();
      if (ct.includes('json')) return JSON.parse(txt);
      console.log('  overpass', r.status, 'via', url);
    } catch (e) { console.log('  overpass error', e.message); }
    await sleep(1500);
  }
  return null;
}

function circle(clat, clon, rkm, n = 22) {
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n;
    ring.push([clon + (rkm / (111.32 * Math.cos(clat * Math.PI / 180))) * Math.sin(a), clat + (rkm / 111.32) * Math.cos(a)]);
  }
  ring.push(ring[0]);
  return [ring]; // Polygon coords
}
const toMP = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
function mpArea(mp) { let a = 0; for (const p of mp) { a += ringArea(p[0]); for (let h = 1; h < p.length; h++) a -= ringArea(p[h]); } return a; }
function bboxMP(mp) { let W = Infinity, S = Infinity, E = -Infinity, N = -Infinity; for (const p of mp) for (const r of p) for (const [x, y] of r) { if (x < W) W = x; if (x > E) E = x; if (y < S) S = y; if (y > N) N = y; } return [r5(W), r5(S), r5(E), r5(N)]; }
const round = mp => mp.map(p => p.map(r => r.map(([x, y]) => [r5(x), r5(y)])));
const fromMP = mp => mp.length === 1 ? { type: 'Polygon', coordinates: round(mp)[0] } : { type: 'MultiPolygon', coordinates: round(mp) };
function reprPoint(mp) { let best = mp[0][0], ba = 0; for (const p of mp) { const a = ringArea(p[0]); if (a > ba) { ba = a; best = p[0]; } } let sx = 0, sy = 0; best.forEach(([x, y]) => { sx += x; sy += y; }); return [r5(sx / best.length), r5(sy / best.length)]; }

const overlap = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const landBb = mask.land.map(p => { let W = Infinity, S = Infinity, E = -Infinity, N = -Infinity; for (const r of p) for (const [x, y] of r) { if (x < W) W = x; if (x > E) E = x; if (y < S) S = y; if (y > N) N = y; } return { p, bb: [W, S, E, N] }; });

// km distance from a point to the nearest coastline (= edge of a land-mask polygon). Resorts hug the
// coast; inland/downtown hotels are far from it — this is how we drop "downtown has hotels" clusters.
function distPtSegKm(plon, plat, alon, alat, blon, blat) {
  const k = Math.cos(plat * Math.PI / 180);
  const Ax = alon * k, Ay = alat, Bx = blon * k, By = blat, Px = plon * k, Py = plat;
  const dx = Bx - Ax, dy = By - Ay, L2 = dx * dx + dy * dy;
  let t = L2 ? ((Px - Ax) * dx + (Py - Ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(Px - (Ax + t * dx), Py - (Ay + t * dy)) * 111.32;
}
function coastDistKm(lon, lat, localPolys) {
  let m = Infinity;
  for (const poly of localPolys) for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const d = distPtSegKm(lon, lat, ring[j][0], ring[j][1], ring[i][0], ring[i][1]); if (d < m) m = d;
  }
  return m;
}

(async () => {
  let done = 0;
  for (const [key, zoneName, coreScore] of ZONES) {
    const C = cities[key];
    if (!C) { console.log('no city', key); continue; }
    if (C.tourist_zone) { console.log('skip (done):', key); continue; }
    const [W, S, E, N] = C.bbox;
    const q = `[out:json][timeout:60];(node["tourism"~"^(hotel|resort)$"](${S - 0.02},${W - 0.02},${N + 0.02},${E + 0.02});way["tourism"~"^(hotel|resort)$"](${S - 0.02},${W - 0.02},${N + 0.02},${E + 0.02}););out center;`;
    const j = await overpass(q);
    if (!j) { console.log(key, '— overpass failed, skipping'); continue; }
    const pts = j.elements.map(e => e.type === 'node' ? [e.lon, e.lat] : (e.center ? [e.center.lon, e.center.lat] : null)).filter(Boolean);
    if (pts.length < 6) { console.log(`${key} — only ${pts.length} hotels, skipping`); continue; }

    // keep beachfront hotels only — drop inland/downtown clusters (hotel density ≠ resort safety)
    const localLand = landBb.filter(L => overlap(L.bb, [W - 0.06, S - 0.06, E + 0.06, N + 0.06])).map(L => L.p);
    let usePts = pts;
    if (localLand.length) {
      const coastal = pts.filter(([lon, lat]) => coastDistKm(lon, lat, localLand) <= COAST_KM);
      console.log(`  ${pts.length} hotels, ${coastal.length} within ${COAST_KM}km of coast`);
      if (coastal.length >= 5) usePts = coastal;
    }
    let core = pc.union(...usePts.map(([lon, lat]) => circle(lat, lon, BUF_KM)));
    // clip to land (fall back to unclipped if the coarse mask would erode too much, e.g. narrow islands)
    const cbb = bboxMP(core); const local = landBb.filter(L => overlap(L.bb, cbb)).map(L => L.p);
    if (local.length) { try { const cl = pc.intersection(core, local); if (cl.length && mpArea(cl) >= 0.45 * mpArea(core)) core = cl; } catch (e) {} }
    // Keep only the dominant hotel cluster(s) — the actual resort strip — and drop scattered downtown/
    // single-hotel blobs, so the zone reads as one coherent area rather than confetti.
    if (core.length > 1) {
      const compA = core.map(p => ringArea(p[0]) - p.slice(1).reduce((a, h) => a + ringArea(h), 0));
      const mx = Math.max(...compA);
      const keep = core.filter((p, i) => compA[i] >= 0.35 * mx);
      if (keep.length) core = keep;
    }

    const circ = toMP(C.districts[0].geom);
    const inCircle = (() => { try { return mpArea(pc.intersection(core, circ)); } catch (e) { return 0; } })();
    const circA = mpArea(circ);
    if (inCircle > 0.85 * circA) { console.log(`${key} — hotels too diffuse (core covers ${(inCircle / circA * 100).toFixed(0)}% of city), skipping`); continue; }
    if (mpArea(core) < 0.02 * circA) { console.log(`${key} — core too small, skipping`); continue; }

    let rest; try { rest = pc.difference(circ, core); } catch (e) { console.log(key, 'difference failed'); continue; }
    if (!rest.length) { console.log(key, '— empty rest, skipping'); continue; }

    const restScore = C.districts[0].score;
    C.districts = [
      { name: C.name, score: restScore, geom: fromMP(rest), label: reprPoint(rest), cluster_id: key + ':' + key },
      { name: zoneName, score: coreScore, geom: fromMP(core), label: reprPoint(core), cluster_id: key + ':zona' },
    ];
    C.model = 'tier'; C.tier_level = 'detailed'; C.tourist_zone = true; delete C.cluster_res;
    C.bbox = bboxMP(toMP(C.districts[0].geom).concat(toMP(C.districts[1].geom)));
    C.note = `Two zones: a safer ${zoneName.toLowerCase()} (approximate, traced from OpenStreetMap hotel locations) and the rest of the city. Not official boundaries.`;
    C.sources = C.sources || {};
    C.sources.basis = [
      { text: 'Tourist core: OpenStreetMap hotel locations (approximate, not an official boundary)', url: 'https://www.openstreetmap.org/' },
      { text: 'Editorial travel-safety synthesis (US State Dept advisories, OSAC, Numbeo)' },
    ];
    console.log(`${key}: ${pts.length} hotels -> core score ${coreScore} / rest ${restScore}  (core ${(mpArea(core) / circA * 100).toFixed(0)}% of circle)`);
    done++;
    await sleep(1200);
  }
  fs.writeFileSync(FILE, JSON.stringify(cities));
  console.log('tourist zones added to', done, 'cities');
})().catch(e => { console.error(e); process.exit(1); });
