// Add the missing Latin-American metros of ~1M+ (agglomeration, periphery counted) as honest CITY-LEVEL
// circles — one indicative bubble + an editorial overall rating (1=safe … 10=high). NEVER invented
// neighbourhood detail (CLAUDE.md honesty rule); city-level overall is the established methodology used by
// every other circle city. Radius here is the BASE; `npm run bubbles` then scales city bubbles 1.5x, and
// `npm run clipland` trims coastal circles to land.
//   node scripts/add_missing_metros.js   →   npm run bubbles && npm run clipland && npm run clusters && npm run build
// Idempotent: skips any key that already exists.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'cities.json');
const r5 = x => +x.toFixed(5);

// key | name | country | lat | lon | base radius km | editorial overall (1=safe … 10=high)
const NEW = [
  // --- Venezuela (systematically missing; very high violent-crime environment) ---
  ['caracas',            'Caracas',                    've',  10.4806,  -66.9036, 7.0, 9.5],
  ['maracaibo',          'Maracaibo',                  've',  10.6427,  -71.6125, 6.5, 9.0],
  ['valencia-ve',        'Valencia',                   've',  10.1620,  -68.0077, 6.0, 8.5],
  ['barquisimeto',       'Barquisimeto',               've',  10.0678,  -69.3467, 5.5, 8.0],
  // --- Brazil (second-tier metros) ---
  ['porto-alegre',       'Porto Alegre',               'br', -30.0346,  -51.2177, 7.0, 6.5],
  ['santos',             'Santos',                     'br', -23.9608,  -46.3336, 5.5, 6.0],
  ['sorocaba',           'Sorocaba',                   'br', -23.5015,  -47.4526, 5.0, 4.5],
  ['ribeirao-preto',     'Ribeirão Preto',             'br', -21.1775,  -47.8103, 5.5, 5.0],
  ['sao-luis',           'São Luís',                   'br',  -2.5307,  -44.3068, 5.5, 6.5],
  ['natal',              'Natal',                      'br',  -5.7945,  -35.2110, 5.5, 6.5],
  ['joao-pessoa',        'João Pessoa',                'br',  -7.1195,  -34.8450, 5.5, 6.0],
  ['teresina',           'Teresina',                   'br',  -5.0892,  -42.8019, 5.5, 5.5],
  ['joinville',          'Joinville',                  'br', -26.3044,  -48.8456, 5.0, 4.0],
  ['londrina',           'Londrina',                   'br', -23.3045,  -51.1696, 5.0, 4.5],
  ['cuiaba',             'Cuiabá',                     'br', -15.6014,  -56.0979, 5.5, 5.5],
  ['aracaju',            'Aracaju',                    'br', -10.9472,  -37.0731, 5.0, 6.5],
  // --- Chile (safer by regional standards; rising petty/violent crime) ---
  ['valparaiso',         'Valparaíso',                 'cl', -33.0472,  -71.6127, 5.5, 5.0],
  ['concepcion',         'Concepción',                 'cl', -36.8201,  -73.0444, 5.5, 4.5],
  // --- Colombia ---
  ['barranquilla',       'Barranquilla',               'co',  10.9685,  -74.7813, 6.0, 6.0],
  ['cucuta',             'Cúcuta',                     'co',   7.8939,  -72.5078, 5.0, 6.5],
  // --- Bolivia ---
  ['santa-cruz',         'Santa Cruz de la Sierra',    'bo', -17.7833,  -63.1821, 6.5, 5.5],
  // --- Peru ---
  ['trujillo',           'Trujillo',                   'pe',  -8.1116,  -79.0288, 5.5, 6.0],
  // --- Mexico ---
  ['culiacan',           'Culiacán',                   'mx',  24.8091, -107.3940, 5.5, 7.5],
  // --- Central America & Caribbean ---
  ['san-pedro-sula',     'San Pedro Sula',             'hn',  15.5041,  -88.0250, 5.5, 7.5],
  ['managua',            'Managua',                    'ni',  12.1150,  -86.2362, 6.0, 5.0],
  ['santiago-caballeros','Santiago de los Caballeros', 'do',  19.4517,  -70.6970, 5.5, 5.5],
  ['port-au-prince',     'Port-au-Prince',             'ht',  18.5944,  -72.3074, 6.0, 9.0],
];

function circle(clat, clon, rkm, n = 46) {
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    const lat = clat + (rkm / 111.32) * Math.cos(a);
    const lon = clon + (rkm / (111.32 * Math.cos((clat * Math.PI) / 180))) * Math.sin(a);
    ring.push([r5(lon), r5(lat)]);
  }
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}
const bboxOfRing = ring => { let W = Infinity, S = Infinity, E = -Infinity, N = -Infinity; ring.forEach(([x, y]) => { if (x < W) W = x; if (x > E) E = x; if (y < S) S = y; if (y > N) N = y; }); return [r5(W), r5(S), r5(E), r5(N)]; };

const cities = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let added = 0;
for (const [key, name, country, lat, lon, r, score] of NEW) {
  if (cities[key]) { console.log('skip (exists):', key); continue; }
  const geom = circle(lat, lon, r);
  cities[key] = {
    name, country, model: 'city', slug: key, tier_level: 'city',
    bbox: bboxOfRing(geom.coordinates[0]),
    districts: [{ name, score, geom, label: [r5(lon), r5(lat)], cluster_id: key + ':overall' }],
    note: 'City-level overall rating · indicative circle, not a boundary. Neighbourhood detail not yet mapped.',
    sources: {
      boundary: [{ text: 'Indicative circle — not an official boundary' }],
      basis: [{ text: 'Editorial travel-safety synthesis (US State Dept advisories, OSAC, Numbeo)' }],
    },
  };
  added++;
}
fs.writeFileSync(FILE, JSON.stringify(cities));
console.log('added', added, 'metros');
