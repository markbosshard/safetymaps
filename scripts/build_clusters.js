// Task C — annotate cities.json with stable cluster identifiers. Idempotent.
//   node scripts/build_clusters.js
// Detailed cities: each district gets `cluster_id = "<slug>:<slugified name>"`.
// City-level cities: city gets `cluster_res` (H3 resolution); per-report cluster ids are computed
// from location at that resolution (see scripts/clusters.js).

const fs = require('fs');
const path = require('path');
const { slugify, chooseRes } = require('./clusters');

const root = path.join(__dirname, '..');
const file = path.join(root, 'cities.json');
const cities = JSON.parse(fs.readFileSync(file, 'utf8'));

let detailed = 0, districts = 0, cityLevel = 0;
const resHist = {};
const dupGuard = {};

for (const key of Object.keys(cities)) {
  const city = cities[key];
  const slug = city.slug || slugify(city.name);

  if (city.tier_level === 'detailed') {
    detailed++;
    const seen = new Set();
    for (const d of city.districts) {
      let base = `${slug}:${slugify(d.name)}`;
      let id = base, n = 2;
      while (seen.has(id)) id = `${base}-${n++}`;   // disambiguate rare name collisions
      seen.add(id);
      d.cluster_id = id;
      districts++;
    }
  } else {
    // city-level: choose an H3 resolution from the rendered footprint (the circle polygon).
    cityLevel++;
    const geom = city.districts && city.districts[0] && city.districts[0].geom;
    const coords = geom && geom.type === 'Polygon' ? geom.coordinates : null;
    const res = coords ? chooseRes(coords) : 7;
    city.cluster_res = res;
    resHist[res] = (resHist[res] || 0) + 1;
    // tag the city's single display area with its own cluster_id namespace prefix for clarity
    if (city.districts && city.districts[0]) city.districts[0].cluster_id = `${slug}:overall`;
  }
}

fs.writeFileSync(file, JSON.stringify(cities) + '\n');
console.log(`Detailed cities: ${detailed}  (district clusters: ${districts})`);
console.log(`City-level cities: ${cityLevel}  (H3 res histogram: ${JSON.stringify(resHist)})`);
console.log('Wrote cities.json');
