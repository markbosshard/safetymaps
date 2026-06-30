// Build landmask.json — a simplified land + lakes mask for Latin America, used at runtime to decide
// whether a clicked point is on land (replaces the brittle reverse-geocode "looks like water" guess)
// and at build time to clip coastal district polygons to land (scripts/clip_to_land.js).
//
// Source: Natural Earth 1:50m physical land + lakes (public domain). Clipped to a LatAm bbox and
// simplified so the shipped file stays small. Run: node scripts/build_landmask.js
const fs = require('fs');
const path = require('path');
const mapshaper = require('mapshaper');

const BASE = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/';
const LAND_URL = BASE + 'ne_10m_land.geojson';
const LAKES_URL = BASE + 'ne_10m_lakes.geojson';
const BBOX = '-120,-58,-30,35';                 // Baja/Patagonia/Caribbean envelope
const OUT = path.join(__dirname, '..', 'landmask.json');

const ms = (commands, input) => new Promise((res, rej) =>
  mapshaper.applyCommands(commands, input, (e, o) => (e ? rej(e) : res(o))));

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('fetch ' + url + ' -> ' + r.status);
  return r.text();
}

// flatten a FeatureCollection into a list of polygons, each polygon = [outerRing, ...holes]
function polysOf(geojson) {
  const out = [];
  for (const f of geojson.features || []) {
    const g = f.geometry; if (!g) continue;
    const list = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of list) out.push(poly);
  }
  return out;
}

(async () => {
  console.log('fetching Natural Earth 10m land + lakes…');
  const [landRaw, lakesRaw] = await Promise.all([fetchText(LAND_URL), fetchText(LAKES_URL)]);
  const cmd = '-i in.json -clip bbox=' + BBOX + ' -simplify 18% keep-shapes -o format=geojson precision=0.0004 out.json';
  const landOut = await ms(cmd, { 'in.json': landRaw });
  const lakesOut = await ms(cmd, { 'in.json': lakesRaw });
  const land = polysOf(JSON.parse(Buffer.from(landOut['out.json']).toString()));
  const lakes = polysOf(JSON.parse(Buffer.from(lakesOut['out.json']).toString()));
  fs.writeFileSync(OUT, JSON.stringify({ land, lakes }));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`landmask.json: ${kb} KB · ${land.length} land polys · ${lakes.length} lake polys`);
})().catch(e => { console.error(e); process.exit(1); });
