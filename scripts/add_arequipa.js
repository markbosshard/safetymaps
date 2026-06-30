// Task F — upgrade Arequipa from a city-level circle to a distrito choropleth (Peru's 2nd city).
//   node scripts/add_arequipa.js   (then: npm run clusters && npm run build)
// Same source as Lima (INEI distritos via juaneladio/peru-geojson), filtered to the Arequipa
// metropolitan distritos (province distritos within a metro bounding box). Editorial tiers;
// unlisted distritos default to Caution (honesty rule, PROJECT.md §5).

const fs = require('fs');
const path = require('path');
const { fetchJson, roundGeom, labelPoint, bboxOf, titleCase, TIER_SCORE } = require('./lib/geo');

const SRC = 'https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_distrital_simple.geojson';
const METRO_BOX = [-71.78, -16.56, -71.28, -16.18]; // [W,S,E,N] around the Arequipa conurbation

// Curated tiers by INEI district name (UPPERCASE). Default = 3 (caution).
const TIER = {
  'YANAHUARA': 2, 'CAYMA': 2, 'JOSE LUIS BUSTAMANTE Y RIVERO': 2, 'SACHACA': 2, 'AREQUIPA': 2,
  // caution (default) covers Paucarpata, Cerro Colorado, Socabaya, Mariano Melgar, Alto Selva Alegre,
  // Jacobo Hunter, Miraflores, Tiabaya, Uchumayo, Sabandia, Characato, etc.
};
const centroid = (g) => { let sx = 0, sy = 0, n = 0; const ps = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; for (const p of ps) for (const q of p[0]) { sx += q[0]; sy += q[1]; n++; } return [sx / n, sy / n]; };
const inBox = (c, b) => c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3];

(async () => {
  console.log('Fetching Peru districts…');
  const fc = await fetchJson(SRC);
  const feats = fc.features.filter((f) =>
    /^AREQUIPA$/.test((f.properties.NOMBPROV || '').trim()) &&
    f.geometry && f.geometry.coordinates && f.geometry.coordinates.length &&
    inBox(centroid(f.geometry), METRO_BOX));

  const districts = feats.map((f) => {
    const raw = (f.properties.NOMBDIST || '').trim();
    const tier = TIER[raw] != null ? TIER[raw] : 3;
    const geom = roundGeom(f.geometry);
    return { name: titleCase(raw), score: TIER_SCORE[tier], geom, label: labelPoint(geom) };
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const cities = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cities.json'), 'utf8'));
  cities['arequipa'] = {
    name: 'Arequipa', country: 'pe', model: 'tier', slug: 'arequipa', tier_level: 'detailed',
    bbox: bboxOf(districts), districts,
    note: `Arequipa Metropolitana — ${districts.length} distritos. District-level ratings are an editorial ` +
      'travel-safety synthesis (advisories/OSAC, traveller guidance), directional and not a single ' +
      'crime-rate metric. Distritos not individually assessed default to Caution.',
    sources: [],
  };
  fs.writeFileSync(path.join(__dirname, '..', 'cities.json'), JSON.stringify(cities) + '\n');
  console.log(`Arequipa: ${districts.length} distritos written (${districts.map(d => d.name).join(', ')})`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
