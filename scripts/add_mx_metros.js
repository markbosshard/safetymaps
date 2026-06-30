// Task F — upgrade Guadalajara (ZMG) and Monterrey (AMM) from city-level circles to municipal
// choropleths.  node scripts/add_mx_metros.js  (then: npm run clusters && npm run build)
//
// Boundaries: geoBoundaries MEX ADM2 (municipios), fetched via the geoBoundaries API (its raw GitHub
// files are Git-LFS pointers). Each metro is the set of municipios in its conurbation; we match by
// name AND a metro bounding box so same-named municipios in other states can't leak in.
// Tiers are an EDITORIAL travel-safety synthesis from well-documented reputation (e.g. San Pedro Garza
// García is consistently Mexico's safest municipality); directional, not a crime-rate metric.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { fetchJson, roundGeom, labelPoint, bboxOf, TIER_SCORE } = require('./lib/geo');

const API = 'https://www.geoboundaries.org/api/current/gbOpen/MEX/ADM2/';
const CACHE = path.join(os.tmpdir(), 'safetymap_mex_adm2.geojson');

function centroid(g) {
  let sx = 0, sy = 0, n = 0;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const p of poly[0]) { sx += p[0]; sy += p[1]; n++; }
  return [sx / n, sy / n];
}
const inBox = (c, b) => c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3];

// Metro configs: box = [W,S,E,N] disambiguation window; tiers keyed by geoBoundaries shapeName.
const METROS = {
  guadalajara: {
    name: 'Guadalajara', slug: 'guadalajara', box: [-103.7, 20.30, -103.10, 20.88],
    tiers: {
      'Zapopan': 2, 'Guadalajara': 2, 'San Pedro Tlaquepaque': 3, 'Tonalá': 3,
      'Tlajomulco de Zúñiga': 3, 'El Salto': 3, 'Juanacatlán': 2, 'Ixtlahuacán de los Membrillos': 3,
    },
    note: 'Zona Metropolitana de Guadalajara (ZMG) — core municipios of Jalisco’s capital metro. ' +
      'Municipal ratings are an editorial travel-safety synthesis (advisories/OSAC, traveller guidance), ' +
      'directional and not a crime-rate metric; unlisted municipios default to Caution.',
  },
  monterrey: {
    name: 'Monterrey', slug: 'monterrey', box: [-100.70, 25.45, -100.02, 25.98],
    tiers: {
      'San Pedro Garza García': 1, 'San Nicolás de los Garza': 2, 'Monterrey': 2, 'Guadalupe': 2,
      'Santa Catarina': 2, 'Apodaca': 3, 'General Escobedo': 3, 'García': 3, 'Juárez': 3,
    },
    note: 'Área Metropolitana de Monterrey (AMM) — core municipios of Nuevo León’s capital metro. ' +
      'San Pedro Garza García is consistently rated Mexico’s safest municipality. Municipal ratings ' +
      'are an editorial travel-safety synthesis (advisories/OSAC, traveller guidance), directional and ' +
      'not a crime-rate metric; unlisted municipios default to Caution.',
  },
};

async function loadAdm2() {
  if (fs.existsSync(CACHE) && fs.statSync(CACHE).size > 1e6) {
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  }
  console.log('Resolving geoBoundaries MEX ADM2…');
  const meta = await fetchJson(API);
  console.log('Downloading municipios (~17 MB)…');
  const fc = await fetchJson(meta.simplifiedGeometryGeoJSON);
  fs.writeFileSync(CACHE, JSON.stringify(fc));
  return fc;
}

(async () => {
  const fc = await loadAdm2();
  const cities = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cities.json'), 'utf8'));

  for (const key of Object.keys(METROS)) {
    const m = METROS[key];
    const want = new Set(Object.keys(m.tiers));
    const feats = fc.features.filter((f) =>
      f.geometry && f.geometry.coordinates && f.geometry.coordinates.length &&
      want.has(f.properties.shapeName) && inBox(centroid(f.geometry), m.box)
    );
    const districts = feats.map((f) => {
      const tier = m.tiers[f.properties.shapeName] || 3;
      const geom = roundGeom(f.geometry);
      return { name: f.properties.shapeName, score: TIER_SCORE[tier], geom, label: labelPoint(geom) };
    }).sort((a, b) => a.name.localeCompare(b.name, 'es'));

    const prev = cities[key];
    cities[key] = {
      name: m.name, country: 'mx', model: 'tier', slug: m.slug, tier_level: 'detailed',
      bbox: bboxOf(districts), districts, note: m.note,
      sources: [
        { text: 'Municipal boundaries: geoBoundaries MEX ADM2', url: 'https://www.geoboundaries.org' },
        { text: 'Tiers: editorial synthesis of travel-safety advisories (OSAC) and traveller guidance' },
      ],
    };
    const found = districts.map((d) => d.name);
    const missing = [...want].filter((n) => !found.includes(n));
    console.log(`${m.name}: ${districts.length} municipios${missing.length ? '  (missing: ' + missing.join(', ') + ')' : ''}` +
      (prev ? `  [was ${prev.tier_level}]` : ''));
  }

  fs.writeFileSync(path.join(__dirname, '..', 'cities.json'), JSON.stringify(cities) + '\n');
  console.log('Wrote cities.json');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
