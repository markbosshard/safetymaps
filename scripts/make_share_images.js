// Render a branded social share card per city (share/<slug>.png, 1200x630): the city's REAL district
// choropleth (green->red, same colours as the map) under a "Latam Crime Map · <City>" header, with a
// safe->high-risk legend and the URL. Deterministic (no headless browser / tiles). Run:
//   node scripts/make_share_images.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const CITIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'cities.json'), 'utf8'));
const CMAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'cmap.json'), 'utf8'));
const SHARE = require('./share_cities');
const OUT = path.join(ROOT, 'share');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const W = 1200, H = 630;
const HEAD = 116;                       // header bar height
const FOOT = 70;                        // footer/legend height
const MAPX = 0, MAPY = HEAD, MAPW = W, MAPH = H - HEAD - FOOT;

const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerp = (a, b, t) => a + (b - a) * t;
function color(s) {
  if (s == null) return '#5b6472';
  const t = Math.max(0, Math.min(1, (s - 1) / 9));
  for (let i = 1; i < CMAP.length; i++) {
    if (t <= CMAP[i][0]) {
      const [t0, c0] = CMAP[i - 1], [t1, c1] = CMAP[i], u = (t - t0) / ((t1 - t0) || 1), a = hx(c0), b = hx(c1);
      return `rgb(${Math.round(lerp(a[0], b[0], u))},${Math.round(lerp(a[1], b[1], u))},${Math.round(lerp(a[2], b[2], u))})`;
    }
  }
  return CMAP[CMAP.length - 1][1];
}
const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ringsOf = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates; // -> list of polygons ([outer,...holes])

function cardSvg(key) {
  const C = CITIES[key];
  const districts = C.districts || [];
  // bbox over all rings
  let Wb = Infinity, S = Infinity, E = -Infinity, N = -Infinity;
  for (const d of districts) for (const poly of ringsOf(d.geom)) for (const ring of poly) for (const [x, y] of ring) {
    if (x < Wb) Wb = x; if (x > E) E = x; if (y < S) S = y; if (y > N) N = y;
  }
  const midLat = (S + N) / 2, midLon = (Wb + E) / 2, k = Math.cos(midLat * Math.PI / 180);
  const spanX = Math.max((E - Wb) * k, 1e-6), spanY = Math.max(N - S, 1e-6);
  const scale = Math.min(MAPW / spanX, MAPH / spanY) * 0.94;
  const cx = MAPX + MAPW / 2, cy = MAPY + MAPH / 2;
  const px = (lon, lat) => [(cx + (lon - midLon) * k * scale).toFixed(1), (cy - (lat - midLat) * scale).toFixed(1)];

  let paths = '';
  for (const d of districts) {
    let dstr = '';
    for (const poly of ringsOf(d.geom)) for (const ring of poly) {
      dstr += 'M' + ring.map(([lon, lat]) => px(lon, lat).join(' ')).join('L') + 'Z';
    }
    paths += `<path d="${dstr}" fill="${color(d.score)}" stroke="#ffffff" stroke-width="0.7" stroke-linejoin="round"/>`;
  }

  // legend gradient from a few CMAP stops
  const stops = [0, 0.25, 0.5, 0.72, 1].map(t => {
    let c = CMAP[CMAP.length - 1][1];
    for (let i = 1; i < CMAP.length; i++) if (t <= CMAP[i][0]) { c = CMAP[i][1]; break; }
    return `<stop offset="${t * 100}%" stop-color="${c}"/>`;
  }).join('');

  const F = 'font-family="Segoe UI, Helvetica, Arial, sans-serif"';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs>
  <rect width="${W}" height="${H}" fill="#eef1f6"/>
  <rect x="0" y="${MAPY}" width="${W}" height="${MAPH}" fill="#e3e8f0"/>
  <g>${paths}</g>
  <rect x="0" y="0" width="${W}" height="${HEAD}" fill="#0F6E56"/>
  <rect x="0" y="0" width="${W}" height="8" fill="#C15A37"/>
  <text x="48" y="48" ${F} font-size="22" font-weight="700" letter-spacing="2" fill="#bfe7da">LATAM CRIME MAP</text>
  <text x="48" y="94" ${F} font-size="44" font-weight="800" fill="#ffffff">${xml(C.name)}</text>
  <rect x="0" y="${H - FOOT}" width="${W}" height="${FOOT}" fill="#0d1426"/>
  <rect x="48" y="${H - 44}" width="190" height="16" rx="8" fill="url(#lg)" stroke="#ffffff" stroke-width="1"/>
  <text x="250" y="${H - 31}" ${F} font-size="22" font-weight="600" fill="#e6ebf2">safe &#8594; high risk</text>
  <text x="${W - 48}" y="${H - 31}" ${F} font-size="24" font-weight="600" fill="#9fd6c6" text-anchor="end">latamcrimemap.com/${key}</text>
</svg>`;
}

(async () => {
  for (const key of SHARE) {
    if (!CITIES[key]) { console.log('skip (missing):', key); continue; }
    const buf = Buffer.from(cardSvg(key));
    await sharp(buf).png().toFile(path.join(OUT, key + '.png'));
  }
  console.log('rendered', SHARE.length, 'city share cards to share/');
})().catch(e => { console.error(e); process.exit(1); });
