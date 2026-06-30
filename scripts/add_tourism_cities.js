// Add the missing top-tourism cities as honest CITY-LEVEL circles (one indicative bubble + an editorial
// overall rating — never invented neighbourhood detail; see CLAUDE.md honesty rule). The circle radius
// here is the BASE radius; `npm run bubbles` then scales every city-level bubble 1.5x.
//
// Idempotent: skips a key that already exists. Run: node scripts/add_tourism_cities.js
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'cities.json');
const r5 = x => +x.toFixed(5);

// key | name | country | lat | lon | base radius km | editorial overall (1=safe … 10=high; null = unrated grey)
const NEW = [
  ['cancun',            'Cancún',            'mx',  21.1619,  -86.8515, 5.5, 5.0],
  ['punta-cana',        'Punta Cana',        'do',  18.5601,  -68.3725, 6.0, 3.0],
  ['cusco',             'Cusco',             'pe', -13.5320,  -71.9675, 4.5, 3.5],
  ['florianopolis',     'Florianópolis',     'br', -27.5949,  -48.5482, 6.0, 4.0],
  ['foz-do-iguacu',     'Foz do Iguaçu',     'br', -25.5163,  -54.5854, 4.5, 5.0],
  ['los-cabos',         'Los Cabos',         'mx',  22.8905, -109.9167, 5.5, 3.5],
  ['mendoza',           'Mendoza',           'ar', -32.8895,  -68.8458, 5.5, 3.0],
  ['montevideo',        'Montevideo',        'uy', -34.9011,  -56.1645, 6.5, 3.5],
  ['oaxaca-city',       'Oaxaca City',       'mx',  17.0732,  -96.7266, 4.5, 4.0],
  ['playa-del-carmen',  'Playa del Carmen',  'mx',  20.6296,  -87.0739, 4.5, 4.5],
  ['puerto-vallarta',   'Puerto Vallarta',   'mx',  20.6534, -105.2253, 5.0, 4.0],
  ['san-juan',          'San Juan',          'pr',  18.4655,  -66.1057, 5.5, 5.0],
  ['bariloche',         'Bariloche',         'ar', -41.1335,  -71.3103, 4.5, 2.5],
  ['antigua-guatemala', 'Antigua Guatemala', 'gt',  14.5586,  -90.7295, 4.0, 4.0],
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
function bboxOfRing(ring) {
  let W = Infinity, S = Infinity, E = -Infinity, N = -Infinity;
  ring.forEach(([x, y]) => { if (x < W) W = x; if (x > E) E = x; if (y < S) S = y; if (y > N) N = y; });
  return [r5(W), r5(S), r5(E), r5(N)];
}

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
  if (score == null) delete cities[key].districts[0].score; // unrated -> neutral grey
  added++;
}
fs.writeFileSync(FILE, JSON.stringify(cities));
console.log('added', added, 'tourism cities');
