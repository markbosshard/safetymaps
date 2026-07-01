#!/usr/bin/env node
// build.js — bundle the data layer into the deployable single-file app.
//
//   node build.js          fetch -> score -> bundle -> emit index.html
//   node build.js --bundle  only the bundle step (default for now)
//
// Pipeline stages (per PROJECT.md §10 "Setup"):
//   1. fetch  — download raw boundary geometry per city (TODO: Tasks D & F).
//   2. score  — assign editorial tiers / ingest published crime data (TODO: see scoring/).
//   3. bundle — inject cities.json + cmap.json into index.template.html -> index.html.   <-- implemented
//
// Only the bundle step is implemented today: the delivered cities are already fetched &
// scored (their results live in cities.json). fetch/score become real when we rebuild a
// city from raw sources. The bundle step is idempotent: it always reads the template fresh,
// so re-running produces a stable index.html.

const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function bundle() {
  const template = read('index.template.html');
  const cities = JSON.parse(read('cities.json'));
  const cmap = JSON.parse(read('cmap.json'));
  const categories = JSON.parse(read('categories.json'));
  // MapTiler key: env var wins, else the gitignored maptiler.key file, else empty (app falls back to OSM/Nominatim).
  const mtKey = (process.env.MAPTILER_KEY ||
    (fs.existsSync(path.join(root, 'maptiler.key')) ? read('maptiler.key') : '')).trim();

  for (const ph of ['/*__CITIES__*/{}', '/*__CMAP__*/[]', '/*__CATEGORIES__*/{}']) {
    if (!template.includes(ph)) throw new Error('index.template.html is missing placeholder ' + ph);
  }

  const buildDate = (process.env.BUILD_DATE || new Date().toISOString().slice(0, 10)); // YYYY-MM-DD

  const base = template
    .replace('/*__CITIES__*/{}', JSON.stringify(cities))
    .replace('/*__CMAP__*/[]', JSON.stringify(cmap))
    .replace('/*__CATEGORIES__*/{}', JSON.stringify(categories))
    .replace('__MAPTILER_KEY__', mtKey)
    .replace(/__BUILD_DATE__/g, buildDate);

  // Fill the OpenGraph/Twitter meta. The default (home/overview + any non-listed path via 404.html)
  // uses the generic LatAm image; the top cities below get their OWN image so a shared /sao-paulo link
  // previews São Paulo's map.
  const SITE = 'https://latamcrimemap.com';
  const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fillMeta = (html, m) => html
    .replace(/__PAGE_TITLE__/g, attr(m.title)).replace(/__OG_TITLE__/g, attr(m.title))
    .replace(/__OG_DESC__/g, attr(m.desc)).replace(/__OG_URL__/g, m.url).replace(/__OG_IMAGE__/g, m.image);

  const genericDesc = `Neighbourhood and city safety across Latin America — ${Object.keys(cities).length} cities on a green-to-red scale, synthesized from multiple safety sources.`;
  const generic = fillMeta(base, { title: 'Latam Crime Map', desc: genericDesc, url: SITE + '/', image: SITE + '/og-image.png' });
  fs.writeFileSync(path.join(root, 'index.html'), generic);
  // 404.html = SPA fallback for pretty paths; the in-app router reads location.pathname.
  fs.writeFileSync(path.join(root, '404.html'), generic);

  // Per-city share pages (GitHub Pages serves /sao-paulo from sao-paulo.html).
  const SHARE = require('./scripts/share_cities');
  let pages = 0;
  for (const key of SHARE) {
    const C = cities[key]; if (!C) { console.warn('  share: missing city', key); continue; }
    const html = fillMeta(base, {
      title: `${C.name} — Latam Crime Map`,
      desc: `${C.name}: neighbourhood safety on a green-to-red scale, synthesized from multiple safety sources — Latam Crime Map.`,
      url: `${SITE}/${key}`, image: `${SITE}/share/${key}.png`,
    });
    fs.writeFileSync(path.join(root, key + '.html'), html);
    pages++;
  }

  const keys = Object.keys(cities);
  console.log(`Built index.html (+404.html, +${pages} city pages): ${generic.length} bytes  (${keys.length} cities, ${cmap.length} cmap stops)`);
}

function fetchStage() {
  console.log('[fetch]  no-op — cities already fetched into cities.json. See PROJECT.md §11 for sources.');
}
function scoreStage() {
  console.log('[score]  no-op — scores already baked into cities.json. See scoring/tiers.js for constants.');
}

const arg = process.argv[2] || '--all';
if (arg === '--bundle') {
  bundle();
} else {
  fetchStage();
  scoreStage();
  bundle();
}
