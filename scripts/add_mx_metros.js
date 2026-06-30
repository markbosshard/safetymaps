// Task F — upgrade Mexican city-level entries to municipal choropleths.
//   node scripts/add_mx_metros.js  (then: npm run clusters && npm run build)
//
// Boundaries: geoBoundaries MEX ADM2 (municipios), fetched via the geoBoundaries API (its raw GitHub
// files are Git-LFS pointers). Each metro = the municipios in `include` whose centroid falls in `box`
// (so same-named municipios in other states can't leak in). Tiers are an EDITORIAL travel-safety
// synthesis; municipios without a curated tier INHERIT the city's existing honest overall rating
// (we don't fabricate per-municipio differences we don't know — PROJECT.md §5).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { fetchJson, roundGeom, labelPoint, bboxOf, TIER_SCORE } = require('./lib/geo');

const API = 'https://www.geoboundaries.org/api/current/gbOpen/MEX/ADM2/';
const CACHE = path.join(os.tmpdir(), 'safetymap_mex_adm2.geojson');

const centroid = (g) => { let sx = 0, sy = 0, n = 0; const ps = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; for (const p of ps) for (const q of p[0]) { sx += q[0]; sy += q[1]; n++; } return [sx / n, sy / n]; };
const inBox = (c, b) => c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3];

const ED = 'Municipal ratings are an editorial travel-safety synthesis (advisories/OSAC, traveller guidance), directional and not a crime-rate metric.';

const METROS = {
  guadalajara: { name: 'Guadalajara', slug: 'guadalajara', box: [-103.7, 20.30, -103.10, 20.88],
    include: ['Zapopan', 'Guadalajara', 'San Pedro Tlaquepaque', 'Tonalá', 'Tlajomulco de Zúñiga', 'El Salto', 'Juanacatlán', 'Ixtlahuacán de los Membrillos'],
    tiers: { 'Zapopan': 2, 'Guadalajara': 2, 'San Pedro Tlaquepaque': 3, 'Tonalá': 3, 'Tlajomulco de Zúñiga': 3, 'El Salto': 3, 'Juanacatlán': 2, 'Ixtlahuacán de los Membrillos': 3 },
    note: 'Zona Metropolitana de Guadalajara (ZMG) — core municipios of Jalisco’s capital metro. ' + ED },
  monterrey: { name: 'Monterrey', slug: 'monterrey', box: [-100.70, 25.45, -100.02, 25.98],
    include: ['San Pedro Garza García', 'San Nicolás de los Garza', 'Monterrey', 'Guadalupe', 'Santa Catarina', 'Apodaca', 'General Escobedo', 'García', 'Juárez'],
    tiers: { 'San Pedro Garza García': 1, 'San Nicolás de los Garza': 2, 'Monterrey': 2, 'Guadalupe': 2, 'Santa Catarina': 2, 'Apodaca': 3, 'General Escobedo': 3, 'García': 3, 'Juárez': 3 },
    note: 'Área Metropolitana de Monterrey (AMM) — core municipios of Nuevo León’s capital metro. San Pedro Garza García is consistently rated Mexico’s safest municipality. ' + ED },
  toluca: { name: 'Toluca', slug: 'toluca', box: [-99.9, 19.1, -99.45, 19.5],
    include: ['Toluca', 'Metepec', 'Zinacantepec', 'Lerma', 'San Mateo Atenco', 'Almoloya de Juárez', 'Otzolotepec', 'Xonacatlán', 'San Antonio la Isla', 'Calimaya', 'Chapultepec', 'Mexicaltzingo'],
    tiers: { 'Metepec': 2 },
    note: 'Zona Metropolitana de Toluca — core municipios of the State of México capital metro. Metepec is the affluent, lower-crime municipio; others inherit the metro overall. ' + ED },
  aguascalientes: { name: 'Aguascalientes', slug: 'aguascalientes', box: [-102.45, 21.75, -102.1, 22.05],
    include: ['Aguascalientes', 'Jesús María', 'San Francisco de los Romo'], tiers: {},
    note: 'Zona Metropolitana de Aguascalientes — generally one of Mexico’s safer metros. ' + ED },
  sanluispotosi: { name: 'San Luis Potosí', slug: 'sanluispotosi', box: [-101.15, 22.0, -100.8, 22.3],
    include: ['San Luis Potosí', 'Soledad de Graciano Sánchez'], tiers: {},
    note: 'Zona Metropolitana de San Luis Potosí (San Luis Potosí + Soledad de Graciano Sánchez). ' + ED },
  cuernavaca: { name: 'Cuernavaca', slug: 'cuernavaca', box: [-99.4, 18.78, -99.05, 19.08],
    include: ['Cuernavaca', 'Jiutepec', 'Temixco', 'Emiliano Zapata', 'Huitzilac'], tiers: {},
    note: 'Zona Metropolitana de Cuernavaca. ' + ED },
  queretaro: { name: 'Querétaro', slug: 'queretaro', box: [-100.65, 20.3, -100.0, 20.95],
    include: ['Querétaro', 'Corregidora', 'El Marqués', 'Huimilpan'], tiers: { 'Corregidora': 2 },
    note: 'Zona Metropolitana de Querétaro — one of Mexico’s safer metros; Corregidora is an affluent municipio. ' + ED },
  puebla: { name: 'Puebla', slug: 'puebla', box: [-98.35, 18.9, -98.05, 19.18],
    include: ['Puebla', 'San Andrés Cholula', 'San Pedro Cholula', 'Cuautlancingo', 'Amozoc', 'Coronango', 'Ocoyucan'], tiers: { 'San Andrés Cholula': 2 },
    note: 'Zona Metropolitana de Puebla (core municipios). San Andrés Cholula (university/residential) is lower-crime; others inherit the metro overall. ' + ED },
};

async function loadAdm2() {
  if (fs.existsSync(CACHE) && fs.statSync(CACHE).size > 1e6) return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  console.log('Resolving + downloading geoBoundaries MEX ADM2 (~17 MB)…');
  const meta = await fetchJson(API);
  const fc = await fetchJson(meta.simplifiedGeometryGeoJSON);
  fs.writeFileSync(CACHE, JSON.stringify(fc));
  return fc;
}

(async () => {
  const fc = await loadAdm2();
  const cities = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cities.json'), 'utf8'));

  for (const key of Object.keys(METROS)) {
    const m = METROS[key];
    const include = new Set(m.include);
    const prev = cities[key];
    const defScore = (prev && prev.districts && prev.districts[0]) ? prev.districts[0].score : TIER_SCORE[3];
    const feats = fc.features.filter((f) => f.geometry && f.geometry.coordinates && f.geometry.coordinates.length &&
      include.has(f.properties.shapeName) && inBox(centroid(f.geometry), m.box));
    const districts = feats.map((f) => {
      const name = f.properties.shapeName;
      const score = (m.tiers && m.tiers[name] != null) ? TIER_SCORE[m.tiers[name]] : defScore;
      const geom = roundGeom(f.geometry);
      return { name, score, geom, label: labelPoint(geom) };
    }).sort((a, b) => a.name.localeCompare(b.name, 'es'));

    cities[key] = { name: m.name, country: 'mx', model: 'tier', slug: m.slug, tier_level: 'detailed',
      bbox: bboxOf(districts), districts, note: m.note, sources: [] };
    const missing = [...include].filter((n) => !districts.some((d) => d.name === n));
    console.log(`${m.name}: ${districts.length} municipios (default score ${defScore})${missing.length ? '  MISSING: ' + missing.join(', ') : ''}`);
  }

  fs.writeFileSync(path.join(__dirname, '..', 'cities.json'), JSON.stringify(cities) + '\n');
  console.log('Wrote cities.json');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
