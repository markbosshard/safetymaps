// Data fix (CORRECTIONS.md §A) — relocate city-level entries that landed on a same-named namesake
// town instead of the intended major city. Rebuilds each circle at the correct centre, preserving
// its original radius and point count. Only LOCATION changes; the editorial score/note are unchanged.
//   node scripts/fix_coords.js   (then: npm run clusters && npm run build)
//
// Belém was fixed separately (scripts/fix_belem.js). These two remained per the corrected handoff:
//   Campinas (BR): Santa Catarina namesake -> -22.90556, -47.06083
//   Puebla   (MX): Baja California namesake -> 19.04778, -98.20723

const fs = require('fs');
const path = require('path');

const FIX = {
  campinas: [-47.06083, -22.90556],   // [lon, lat]
  puebla: [-98.20723, 19.04778],
};

const r5 = (x) => Math.round(x * 1e5) / 1e5;
const file = path.join(__dirname, '..', 'cities.json');
const cities = JSON.parse(fs.readFileSync(file, 'utf8'));

for (const key of Object.keys(FIX)) {
  const C = cities[key];
  if (!C) { console.log('skip (missing):', key); continue; }
  const d = C.districts[0];
  const [olon, olat] = d.label;
  const ring = (d.geom.type === 'Polygon' ? d.geom.coordinates[0] : d.geom.coordinates[0][0]);
  const N = ring.length - 1;                          // segments (ring is closed)
  const rKm = Math.max(...ring.map((p) => Math.abs(p[1] - olat))) * 111.32;  // radius from lat extent

  const [clon, clat] = FIX[key];
  const out = [];
  for (let i = 0; i < N; i++) {
    const a = (2 * Math.PI * i) / N;
    const lat = clat + (rKm / 111.32) * Math.cos(a);
    const lon = clon + (rKm / (111.32 * Math.cos((clat * Math.PI) / 180))) * Math.sin(a);
    out.push([r5(lon), r5(lat)]);
  }
  out.push(out[0]);

  const lats = out.map((p) => p[1]), lons = out.map((p) => p[0]);
  C.bbox = [r5(Math.min(...lons)), r5(Math.min(...lats)), r5(Math.max(...lons)), r5(Math.max(...lats))];
  d.geom = { type: 'Polygon', coordinates: [out] };
  d.label = [r5(clon), r5(clat)];
  console.log(`Relocated ${C.name} -> [${r5(clon)}, ${r5(clat)}]  (r≈${rKm.toFixed(1)} km, ${out.length} pts)`);
}

fs.writeFileSync(file, JSON.stringify(cities) + '\n');
