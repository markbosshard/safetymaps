// Task F — upgrade Lima from a single city-level circle to a detailed district choropleth.
//   node scripts/add_lima.js   (then: npm run clusters && npm run build)
//
// Units: the 43 districts of Lima Province + the 6 districts of Callao = Lima Metropolitana (~49).
// Boundaries: INEI district polygons via juaneladio/peru-geojson (peru_distrital_simple.geojson).
// Tiers are an EDITORIAL travel-safety synthesis from widely-documented reputation (advisories/OSAC,
// common traveller guidance) — directional, not a crime-rate metric. Unlisted districts default to
// Caution (tier 3), matching the project's convention (honesty rule: PROJECT.md §5).

const fs = require('fs');
const path = require('path');
const { fetchJson, roundGeom, labelPoint, bboxOf, titleCase, TIER_SCORE } = require('./lib/geo');

const SRC = 'https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_distrital_simple.geojson';

// Curated tiers by INEI district name (UPPERCASE as in NOMBDIST). Default = 3 (caution).
const TIER = {
  // Tier 1 — safe, affluent, well-policed / tourist core
  'SAN ISIDRO': 1, 'MIRAFLORES': 1, 'SAN BORJA': 1, 'LA MOLINA': 1, 'BARRANCO': 1,
  'SANTIAGO DE SURCO': 1, 'JESUS MARIA': 1, 'MAGDALENA DEL MAR': 1, 'MAGDALENA VIEJA': 1,
  'SAN MIGUEL': 1, 'LINCE': 1,
  // Tier 2 — moderate / mixed but generally fine, + quieter southern beach districts
  'SURQUILLO': 2, 'SAN LUIS': 2, 'SANTA ANITA': 2, 'BREÑA': 2, 'CHORRILLOS': 2,
  'CHACLACAYO': 2, 'CIENEGUILLA': 2, 'PUEBLO LIBRE': 2,
  'SAN BARTOLO': 2, 'SANTA MARIA DEL MAR': 2, 'PUNTA HERMOSA': 2, 'PUNTA NEGRA': 2,
  'PUCUSANA': 2, 'SANTA ROSA': 2, 'ANCON': 2, 'PACHACAMAC': 2, 'LURIN': 2,
  'LA PUNTA': 2, 'BELLAVISTA': 2, 'LA PERLA': 2,
  // Tier 4 — highest violent-crime reputation
  'SAN JUAN DE LURIGANCHO': 4, 'LA VICTORIA': 4, 'CALLAO': 4,
};
// everything else (Cercado de Lima, Rímac, El Agustino, Ate, SMP, Comas, VES, etc.) -> 3

function tierFor(name) { return TIER[name] != null ? TIER[name] : 3; }

(async () => {
  console.log('Fetching Peru districts…');
  const fc = await fetchJson(SRC);
  const inLima = (f) => /^LIMA$/.test((f.properties.NOMBPROV || '').trim());
  const inCallao = (f) => /CALLAO/.test((f.properties.NOMBDEP || '').trim());
  const matched = fc.features.filter((f) => inLima(f) || inCallao(f));
  const feats = matched.filter((f) => f.geometry && f.geometry.coordinates && f.geometry.coordinates.length);
  const dropped = matched.length - feats.length;

  const districts = feats.map((f) => {
    const raw = (f.properties.NOMBDIST || '').trim();
    const tier = tierFor(raw);
    const geom = roundGeom(f.geometry);
    return { name: titleCase(raw), score: TIER_SCORE[tier], geom, label: labelPoint(geom) };
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const cities = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cities.json'), 'utf8'));
  cities['lima'] = {
    name: 'Lima', country: 'pe', model: 'tier', slug: 'lima', tier_level: 'detailed',
    bbox: bboxOf(districts),
    districts,
    note: `Lima Metropolitana — ${districts.length} districts across Lima Province and Callao` +
      (dropped ? ` (${dropped} omitted where the source lacked geometry)` : '') +
      '. District-level ratings are an editorial travel-safety synthesis (advisories/OSAC, common ' +
      'traveller guidance), directional and not a single crime-rate metric. Districts not individually ' +
      'assessed default to Caution.',
    sources: [
      { text: 'District boundaries: INEI via juaneladio/peru-geojson', url: 'https://github.com/juaneladio/peru-geojson' },
      { text: 'Tiers: editorial synthesis of travel-safety advisories (OSAC) and traveller guidance' },
    ],
  };

  fs.writeFileSync(path.join(__dirname, '..', 'cities.json'), JSON.stringify(cities) + '\n');
  const counts = districts.reduce((a, d) => { a[d.score] = (a[d.score] || 0) + 1; return a; }, {});
  console.log(`Lima: ${districts.length} districts written. Score histogram: ${JSON.stringify(counts)}`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
