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

  const out = template
    .replace('/*__CITIES__*/{}', JSON.stringify(cities))
    .replace('/*__CMAP__*/[]', JSON.stringify(cmap))
    .replace('/*__CATEGORIES__*/{}', JSON.stringify(categories))
    .replace('__MAPTILER_KEY__', mtKey);

  fs.writeFileSync(path.join(root, 'index.html'), out);
  // 404.html = a copy of the app, so GitHub Pages serves it for pretty paths (/sao-paulo, …);
  // the in-app router reads location.pathname and renders the right city.
  fs.writeFileSync(path.join(root, '404.html'), out);

  const keys = Object.keys(cities);
  console.log(`Built index.html (+404.html): ${out.length} bytes  (${keys.length} cities, ${cmap.length} cmap stops)`);
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
