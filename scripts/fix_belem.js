// Data fix: relocate Belém to its real coordinates.
//   node scripts/fix_belem.js   (then: npm run clusters && npm run build)
//
// The delivered cities.json placed "Belém" at São Paulo's coordinates (~-23.5, -46.6) — the original
// geocoder almost certainly matched the *Belém bairro in São Paulo* instead of Belém, Pará (the northern
// capital the score 8.5 was intended for). This left Belém's marker inside São Paulo's footprint, which
// the Task A overview/cityAt logic then mis-focused. Correct center (verified, multiple sources):
//   Belém, PA, Brazil — lat -1.45583, lon -48.50444
// Only the LOCATION is corrected here; the editorial score/note are unchanged (honesty rule).

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'cities.json');
const cities = JSON.parse(fs.readFileSync(file, 'utf8'));

const CLAT = -1.45583, CLON = -48.50444;
const R_KM = 7.0;          // matches the original ~7 km circle radius
const N = 46;              // 46 segments + closing point = 47-point ring (as before)
const r5 = (x) => +x.toFixed(5);

const ring = [];
for (let i = 0; i < N; i++) {
  const a = (2 * Math.PI * i) / N;
  const lat = CLAT + (R_KM / 111.32) * Math.cos(a);
  const lon = CLON + (R_KM / (111.32 * Math.cos((CLAT * Math.PI) / 180))) * Math.sin(a);
  ring.push([r5(lon), r5(lat)]);
}
ring.push(ring[0]); // close

const lats = ring.map(p => p[1]), lons = ring.map(p => p[0]);
const belem = cities['belem'];
belem.bbox = [r5(Math.min(...lons)), r5(Math.min(...lats)), r5(Math.max(...lons)), r5(Math.max(...lats))];
belem.districts[0].geom = { type: 'Polygon', coordinates: [ring] };
belem.districts[0].label = [r5(CLON), r5(CLAT)];

fs.writeFileSync(file, JSON.stringify(cities) + '\n');
console.log('Relocated Belém ->', belem.districts[0].label, 'bbox', belem.bbox, '(' + ring.length + ' pts)');
