// Task F (broad) — upgrade many city-level entries to municipal choropleths from geoBoundaries ADM2.
//   node scripts/add_metros.js   (then: npm run clusters && npm run build)
//
// Generalized over countries. For each metro we include every ADM2 municipio whose centroid falls in
// the metro's bounding box (so we don't have to enumerate names). Municipios without a curated tier
// INHERIT the city's existing honest overall rating — we do not fabricate per-municipio differences we
// don't know (PROJECT.md §5). Boundaries: geoBoundaries (gbOpen) ADM2; cited per city.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { fetchJson, roundGeom, labelPoint, bboxOf, TIER_SCORE } = require('./lib/geo');

const ISO3 = { br: 'BRA', bo: 'BOL', py: 'PRY', co: 'COL', cu: 'CUB', do: 'DOM', pa: 'PAN', gt: 'GTM', sv: 'SLV' };
const AUTH = {
  br: { text: 'Authority: IBGE (malha municipal)', url: 'https://www.ibge.gov.br/' },
  bo: { text: 'Authority: INE Bolivia', url: 'https://www.ine.gob.bo/' },
  py: { text: 'Authority: INE Paraguay' },
  co: { text: 'Authority: DANE Colombia', url: 'https://www.dane.gov.co/' },
  cu: { text: 'Authority: ONEI Cuba' },
  do: { text: 'Authority: ONE República Dominicana' },
  pa: { text: 'Authority: INEC Panamá' },
  gt: { text: 'Authority: INE Guatemala' },
  sv: { text: 'Authority: DIGESTYC El Salvador' },
};

const centroid = (g) => { let sx = 0, sy = 0, n = 0; const ps = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; for (const p of ps) for (const q of p[0]) { sx += q[0]; sy += q[1]; n++; } return [sx / n, sy / n]; };
const inBox = (c, b) => c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3];

// box = [W,S,E,N] around the contiguous metro. tiers = high-confidence overrides only.
const METROS = [
  // --- Brazil ---
  { key: 'recife', name: 'Recife', iso2: 'br', box: [-35.05, -8.20, -34.82, -7.90] },
  { key: 'salvador', name: 'Salvador', iso2: 'br', box: [-38.60, -13.05, -38.25, -12.70] },
  { key: 'fortaleza', name: 'Fortaleza', iso2: 'br', box: [-38.70, -3.90, -38.40, -3.65] },
  { key: 'belohorizonte', name: 'Belo Horizonte', iso2: 'br', box: [-44.20, -20.10, -43.80, -19.70], tiers: { 'Nova Lima': 2 } },
  { key: 'curitiba', name: 'Curitiba', iso2: 'br', box: [-49.45, -25.65, -49.10, -25.30] },
  { key: 'vitoria', name: 'Vitória', iso2: 'br', box: [-40.55, -20.45, -40.25, -20.05],
    note: 'Grande Vitória — mainland metropolitan municipios (Serra, Vila Velha, Cariacica, Viana). The Vitória island core is not shown: its administrative area includes distant Atlantic islands, putting its centroid offshore. Editorial travel-safety synthesis; municipios inherit the overall rating; directional, not a crime-rate metric.' },
  { key: 'goiania', name: 'Goiânia', iso2: 'br', box: [-49.45, -16.85, -49.05, -16.45] },
  { key: 'campinas', name: 'Campinas', iso2: 'br', box: [-47.25, -23.05, -46.85, -22.75] },
  { key: 'belem', name: 'Belém', iso2: 'br', box: [-48.60, -1.55, -48.30, -1.25] },
  { key: 'maceio', name: 'Maceió', iso2: 'br', box: [-35.85, -9.75, -35.55, -9.45] },
  // (Bolivia skipped — its geoBoundaries ADM2 is provinces, not municipios, so La Paz/El Alto don't split.)
  // --- Paraguay ---
  { key: 'asuncion', name: 'Asunción', iso2: 'py', box: [-57.75, -25.45, -57.35, -25.15] },
  // --- Colombia ---
  { key: 'bucaramanga', name: 'Bucaramanga', iso2: 'co', box: [-73.20, 6.95, -72.95, 7.20] },
  // --- Cuba ---
  { key: 'havana', name: 'Havana', iso2: 'cu', box: [-82.55, 22.95, -82.05, 23.25] },
  // --- Dominican Republic ---
  { key: 'santodomingo', name: 'Santo Domingo', iso2: 'do', box: [-70.10, 18.40, -69.75, 18.65] },
  // --- Panama ---
  { key: 'panamacity', name: 'Panama City', iso2: 'pa', box: [-79.95, 8.80, -79.35, 9.35], include: ['Panamá', 'San Miguelito', 'Arraiján', 'La Chorrera'] },
  // --- Guatemala ---
  { key: 'guatemalacity', name: 'Guatemala City', iso2: 'gt', box: [-90.64, 14.48, -90.42, 14.74] },
  // --- El Salvador ---
  { key: 'sansalvador', name: 'San Salvador', iso2: 'sv', box: [-89.32, 13.62, -89.08, 13.80],
    tiers: { 'Santa Tecla': 2, 'Antiguo Cuscatlan': 2, 'Nuevo Cuscatlán': 2 } },
];

async function loadAdm2(iso2) {
  const iso3 = ISO3[iso2];
  const cache = path.join(os.tmpdir(), `safetymap_${iso3}_adm2.geojson`);
  if (fs.existsSync(cache) && fs.statSync(cache).size > 3e5) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const meta = await fetchJson(`https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM2/`);
  const url = meta.simplifiedGeometryGeoJSON || meta.gjDownloadURL;
  process.stdout.write(`  downloading ${iso3} ADM2…\n`);
  const fc = await fetchJson(url);
  fs.writeFileSync(cache, JSON.stringify(fc));
  return fc;
}

(async () => {
  const citiesPath = path.join(__dirname, '..', 'cities.json');
  const cities = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));
  const byIso = {};
  for (const m of METROS) (byIso[m.iso2] = byIso[m.iso2] || []).push(m);

  for (const iso2 of Object.keys(byIso)) {
    const fc = await loadAdm2(iso2);
    for (const m of byIso[iso2]) {
      const prev = cities[m.key];
      const defScore = (prev && prev.districts && prev.districts[0]) ? prev.districts[0].score : TIER_SCORE[3];
      const feats = fc.features.filter((f) => f.geometry && f.geometry.coordinates && f.geometry.coordinates.length &&
        !/^(Lago|Laguna|Lake|Embalse|Represa|Reservoir)\b/i.test(f.properties.shapeName || '') &&
        (!m.include || m.include.includes(f.properties.shapeName)) &&
        inBox(centroid(f.geometry), m.box));
      const districts = feats.map((f) => {
        const name = f.properties.shapeName;
        const score = (m.tiers && m.tiers[name] != null) ? TIER_SCORE[m.tiers[name]] : defScore;
        const geom = roundGeom(f.geometry);
        return { name, score, geom, label: labelPoint(geom) };
      }).sort((a, b) => a.name.localeCompare(b.name, 'es'));

      if (districts.length < 2) { console.log(`${m.name}: ${districts.length} unit(s) — SKIPPED (box too tight / single municipio)`); continue; }
      cities[m.key] = {
        name: m.name, country: m.iso2, model: 'tier', slug: m.key, tier_level: 'detailed',
        bbox: bboxOf(districts), districts,
        note: m.note || (`${m.name} metropolitan area — ${districts.length} municipal units (geoBoundaries ADM2). ` +
          `Municipios without a curated tier inherit ${m.name}'s overall rating; an editorial travel-safety ` +
          `synthesis, directional and not a single crime-rate metric.`),
        sources: {
          boundary: [{ text: `geoBoundaries ${ISO3[m.iso2]} ADM2 municipios`, url: 'https://www.geoboundaries.org' }, AUTH[m.iso2]],
          basis: [{ text: 'Tiers: editorial travel-safety synthesis (OSAC/advisories); municipios without a curated tier inherit the city overall' }],
        },
      };
      console.log(`${m.name} (${m.iso2}): ${districts.length} units — ${districts.map((d) => d.name).join(', ')}`);
    }
  }
  fs.writeFileSync(citiesPath, JSON.stringify(cities) + '\n');
  console.log('\nWrote cities.json');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
