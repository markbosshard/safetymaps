// US-9 — turn single-circle cities into district choropleths so the map feels like real places to
// vote on, not "deserted" circles. Every district INHERITS the city's one honest overall rating
// (uniform colour) — we do not invent per-district differences we don't have (PROJECT.md §5).
//
// Generalized over two source kinds:
//   - {kind:'gb', iso3, level}  — geoBoundaries gbOpen ADMx (cached per country/level)
//   - {kind:'url', url, prov}   — a direct GeoJSON (e.g. Peru INEI distritos); `prov` filters by a
//                                  parent-name property so we keep only this city's sub-units.
// Each city gives a [W,S,E,N] box; we keep features whose centroid falls inside it.
//
//   node scripts/add_districts.js [key ...]   (then: npm run clusters && npm run build)
// Idempotent per run (rewrites the listed cities). Pass keys to limit to a subset.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { fetchJson, roundGeom, labelPoint, bboxOf, titleCase } = require('./lib/geo');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'cities.json');

const PERU = 'https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_distrital_simple.geojson';
// Quito: parroquias of the Metropolitan District (Fernanda Andrade's quito-crime-map, from the DMQ open data).
// The historic urban core is one "Quito" parroquia; the surrounding parroquias (Calderón, Cumbayá, Tumbaco,
// Conocoto…) are real, populous communities — far better than one circle. A box trims the far rural NW parishes.
const QUITO = 'https://raw.githubusercontent.com/flandrade/quito-crime-map/master/data/parroquias_quito.geojson';
// Wave-3 municipal open-data (ArcGIS query endpoints → GeoJSON in WGS84 via outSR=4326).
const GYE  = 'https://geoportalcat.guayaquil.gob.ec/arcgis/rest/services/Geoportal_Actualizado/GEOPORTAL_ACTUALIZADO/MapServer/9/query?where=1%3D1&outFields=*&outSR=4326&f=geojson';
const CALI = 'https://services7.arcgis.com/fHfQ8qeNWagUQB9e/arcgis/rest/services/Comunas_Cal/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson';
const CTG  = 'https://services.arcgis.com/deQSb0Gn7gDPf3uV/arcgis/rest/services/UnidadesComunerasResponsables_Cartagena/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson';

// key | source | metro box [W,S,E,N] | (optional) name property override
const JOBS = [
  // --- geoBoundaries ADM2 (municipios that form the conurbation) ---
  { key: 'oaxaca-city',       src: { kind: 'gb', iso3: 'MEX', level: 'ADM2' }, box: [-96.84, 16.95, -96.60, 17.22] },
  { key: 'merida',            src: { kind: 'gb', iso3: 'MEX', level: 'ADM2' }, box: [-89.80, 20.82, -89.45, 21.12] },
  { key: 'antigua-guatemala', src: { kind: 'gb', iso3: 'GTM', level: 'ADM2' }, box: [-90.83, 14.48, -90.63, 14.66] },
  { key: 'montevideo',        src: { kind: 'gb', iso3: 'URY', level: 'ADM2' }, box: [-56.43, -34.94, -56.00, -34.74] },
  { key: 'maracay',           src: { kind: 'gb', iso3: 'VEN', level: 'ADM2' }, box: [-67.78, 10.13, -67.45, 10.38] },
  // NOTE: Argentine cities (Mendoza, Córdoba, Rosario) are deliberately NOT here. geoBoundaries ARG ADM2
  // is departamentos, whose geometry sprawls far into rural/Andean land — districting by them would balloon
  // the "city" across empty mountains, less honest than the circle. They need a barrio-level source (later wave).
  // --- geoBoundaries ADM3 (distritos / barrios) ---
  { key: 'sanjose',           src: { kind: 'gb', iso3: 'CRI', level: 'ADM3' }, box: [-84.14, 9.90, -84.03, 9.98] },
  { key: 'san-juan',          src: { kind: 'gb', iso3: 'PRI', level: 'ADM3' }, box: [-66.18, 18.36, -66.00, 18.48] },
  // --- Peru INEI distritos (same source as Lima/Arequipa) ---
  { key: 'cusco',             src: { kind: 'url', url: PERU, prov: 'CUSCO', provKey: 'NOMBPROV', nameKey: 'NOMBDIST' }, box: [-72.05, -13.63, -71.84, -13.46] },
  // --- Ecuador (wave 2): Quito parroquias (DMQ). ---
  { key: 'quito',             src: { kind: 'url', url: QUITO, nameKey: 'parroquia' }, box: [-78.58, -0.42, -78.34, -0.02] },
  // --- Wave 3 — bespoke municipal open-data (ArcGIS). ---
  // Guayaquil: parroquias urbanas (Municipio de Guayaquil). Tarqui is two polygons in the source → merged by name.
  { key: 'guayaquil', src: { kind: 'url', url: GYE, nameKey: 'Nam' }, box: [-80.10, -2.36, -79.75, -2.00], simplify: 0.0004,
    label: 'parroquias', cite: { text: 'Parroquias urbanas — Municipio de Guayaquil geoportal', url: 'https://geoportalcat.guayaquil.gob.ec/' } },
  // Cali: the 22 comunas (IDESC / Alcaldía de Cali).
  { key: 'cali', src: { kind: 'url', url: CALI, nameKey: 'nombre' }, box: [-76.66, 3.30, -76.40, 3.55], simplify: 0.0004,
    label: 'comunas', cite: { text: 'Comunas de Cali (IDESC — Alcaldía de Cali)', url: 'https://idesc.cali.gov.co/' } },
  // Cartagena: Unidades Comuneras de Gobierno (numbered UCGs + Boquilla/Zona Expansión). Labels kept raw (UCG n).
  { key: 'cartagena', src: { kind: 'url', url: CTG, nameKey: 'COD_UGC', raw: true }, box: [-75.60, 10.27, -75.36, 10.53], simplify: 0.0004,
    label: 'unidades comuneras', cite: { text: 'Unidades Comuneras de Gobierno — Cartagena (open data)', url: 'https://geoportal-cartagena.hub.arcgis.com/' } },
];

const centroid = (g) => { let sx = 0, sy = 0, n = 0; const ps = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; for (const p of ps) for (const q of p[0]) { sx += q[0]; sy += q[1]; n++; } return [sx / n, sy / n]; };
const inBox = (c, b) => c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3];
// For LARGE units (e.g. Argentine departamentos) whose centroid sits in distant countryside, keep any
// feature that overlaps the box by a ring vertex instead of its centroid.
const touchesBox = (g, b) => { const ps = g.type === 'Polygon' ? [g.coordinates] : g.coordinates; for (const p of ps) for (const r of p) for (const v of r) if (inBox(v, b)) return true; return false; };
const matches = (g, b, mode) => mode === 'intersect' ? touchesBox(g, b) : inBox(centroid(g), b);
// Combine polygons that share a name (e.g. a discontiguous parroquia split across features) into one geometry.
const toPolys = (g) => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
const mergeGeoms = (geoms) => { const polys = []; for (const g of geoms) for (const p of toPolys(g)) polys.push(p); return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys }; };
// Douglas-Peucker ring simplification (tol in degrees ≈ 0.0004 → ~44 m). Full-res municipal ArcGIS
// boundaries carry tens of thousands of points; at city-district zoom this trims ~80% with no visible change.
function dpRing(pts, tol) {
  if (pts.length <= 4) return pts;
  const segD = (p, a, b) => { let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y; if (dx || dy) { const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy); if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; } } return (p[0] - x) ** 2 + (p[1] - y) ** 2; };
  const t2 = tol * tol, keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
  const st = [[0, pts.length - 1]];
  while (st.length) { const [s, e] = st.pop(); let md = 0, idx = -1; for (let i = s + 1; i < e; i++) { const d = segD(pts[i], pts[s], pts[e]); if (d > md) { md = d; idx = i; } } if (md > t2 && idx > -1) { keep[idx] = true; st.push([s, idx]); st.push([idx, e]); } }
  const out = []; for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]); return out.length >= 4 ? out : pts;
}
function simplifyGeom(g, tol) {
  const doPoly = (poly) => poly.map((ring) => dpRing(ring, tol)).filter((r) => r.length >= 4);
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: doPoly(g.coordinates) };
  return { type: 'MultiPolygon', coordinates: g.coordinates.map(doPoly).filter((p) => p.length) };
}
const WATER = /^(Lago|Laguna|Lake|Embalse|Represa|Reservoir|Bah[ií]a)\b/i;

const gbCache = {};
async function loadGb(iso3, level) {
  const k = iso3 + level;
  if (gbCache[k]) return gbCache[k];
  const cache = path.join(os.tmpdir(), `safetymap_${iso3}_${level}.geojson`);
  let fc;
  if (fs.existsSync(cache) && fs.statSync(cache).size > 1000) fc = JSON.parse(fs.readFileSync(cache, 'utf8'));
  else {
    const meta = await fetchJson(`https://www.geoboundaries.org/api/current/gbOpen/${iso3}/${level}/`);
    process.stdout.write(`  downloading ${iso3} ${level}…\n`);
    fc = await fetchJson(meta.simplifiedGeometryGeoJSON || meta.gjDownloadURL);
    fs.writeFileSync(cache, JSON.stringify(fc));
  }
  return (gbCache[k] = fc);
}
const urlCache = {};
async function loadUrl(url) {
  if (urlCache[url]) return urlCache[url];
  process.stdout.write(`  downloading ${url.split('/').pop()}…\n`);
  return (urlCache[url] = await fetchJson(url));
}

(async () => {
  const only = process.argv.slice(2);
  const cities = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let done = 0;

  for (const job of JOBS) {
    if (only.length && !only.includes(job.key)) continue;
    const C = cities[job.key];
    if (!C) { console.log(job.key, '— missing'); continue; }
    const overall = (C.districts && C.districts[0]) ? C.districts[0].score : null;
    if (overall == null) { console.log(job.key, '— no overall score, skipping'); continue; }

    let fc, nameKey;
    if (job.src.kind === 'gb') { fc = await loadGb(job.src.iso3, job.src.level); nameKey = 'shapeName'; }
    else { fc = await loadUrl(job.src.url); nameKey = job.src.nameKey; }

    const feats = fc.features.filter((f) => {
      if (!f.geometry || !f.geometry.coordinates || !f.geometry.coordinates.length) return false;
      if (job.src.prov && String(f.properties[job.src.provKey] || '').trim().toUpperCase() !== job.src.prov) return false;
      if (WATER.test(f.properties[nameKey] || '')) return false;
      return matches(f.geometry, job.box, job.match);
    });

    if (feats.length < 2) { console.log(`${job.key}: ${feats.length} unit(s) in box — SKIPPED (widen box?)`); continue; }

    const nm = (v) => { const s = String(v || '').trim(); return job.src.raw ? s : titleCase(s); };
    // Merge features sharing a name (e.g. Guayaquil's Tarqui, split into two polygons) into one MultiPolygon.
    const byName = {};
    for (const f of feats) { const name = nm(f.properties[nameKey]); if (!name) continue; (byName[name] = byName[name] || []).push(roundGeom(f.geometry)); }
    const districts = Object.entries(byName).map(([name, geoms]) => {
      let geom = geoms.length === 1 ? geoms[0] : mergeGeoms(geoms);
      if (job.simplify) geom = roundGeom(simplifyGeom(geom, job.simplify));
      return { name, score: overall, geom, label: labelPoint(geom) };
    }).sort((a, b) => a.name.localeCompare(b.name, 'es'));

    const levelLabel = job.label || (job.src.kind === 'url' ? 'distritos' : (job.src.level === 'ADM3' ? 'distritos' : 'municipios'));
    const boundaryCite = job.cite || (job.src.kind === 'url'
      ? { text: 'INEI distritos (Peru) via juaneladio/peru-geojson', url: 'https://github.com/juaneladio/peru-geojson' }
      : { text: `geoBoundaries ${job.src.iso3} ${job.src.level}`, url: 'https://www.geoboundaries.org' });

    cities[job.key] = Object.assign({}, C, {
      model: 'tier', tier_level: 'detailed', districts, bbox: bboxOf(districts),
      note: `${C.name} — ${districts.length} ${levelLabel}. Every ${levelLabel.replace(/s$/, '')} carries ${C.name}'s ` +
        `one overall rating (we don't yet have verified per-district differences); an editorial travel-safety ` +
        `synthesis, directional and not a single crime-rate metric. Vote a district safer or flag an issue to refine it.`,
      sources: { boundary: [boundaryCite], basis: [{ text: 'Editorial travel-safety synthesis (US State Dept advisories, OSAC, Numbeo); districts inherit the city overall until crowd input or official data differentiates them' }] },
    });
    delete cities[job.key].cluster_res;
    delete cities[job.key].center;
    console.log(`${job.key}: ${districts.length} ${levelLabel} @ score ${overall} — ${districts.map((d) => d.name).join(', ')}`);
    done++;
  }

  fs.writeFileSync(FILE, JSON.stringify(cities) + '\n');
  console.log(`\nWrote ${done} cities.`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
