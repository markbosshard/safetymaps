// Shared cluster helpers (Task C). Used by build_clusters.js, the backend, and (mirrored) the frontend.
//
// Cluster model — every reportable area has a stable, deterministic cluster_id:
//   - Detailed cities  : cluster_id = "<slug>:<slugified district name>"  (one per district polygon)
//   - City-level cities: cluster_id = "<slug>:h3:<h3index>"  where the H3 cell is computed from the
//                        report's lat/lng at the city's chosen resolution (city.cluster_res).
// City-level cities store only `cluster_res` (a small integer) — no hex geometry is baked into
// cities.json, so the bundle stays small while coverage is effectively unlimited.

const h3 = require('h3-js');

// Deterministic, DB/URL-safe slug from an area name (handles accents, ES/PT/EN).
function slugify(name) {
  return String(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Pick the finest H3 resolution (from coarse->fine) whose grid still yields a reasonable number of
// cells over the footprint — neighbourhood-sized, not whole-city and not hundreds of slivers.
function chooseRes(geojsonPolygonCoords, { min = 10, candidates = [6, 7, 8] } = {}) {
  let best = candidates[0];
  for (const res of candidates) {
    best = res;
    const n = h3.polygonToCells(geojsonPolygonCoords, res, true).length;
    if (n >= min) return res;   // first res that's granular enough
  }
  return best;                  // fall through to finest candidate
}

// cluster_id for a report at (lat, lng) in a given city object.
//   detailed  -> the district whose polygon contains the point (point-in-polygon), else nearest label.
//   city-level-> "<slug>:h3:<cell>".
function clusterIdForPoint(city, lat, lng) {
  if (city.cluster_res) {
    return `${city.slug}:h3:${h3.latLngToCell(lat, lng, city.cluster_res)}`;
  }
  // detailed: find containing district
  const hit = (city.districts || []).find(d => d.cluster_id && pointInGeom(lng, lat, d.geom));
  if (hit) return hit.cluster_id;
  // fallback: nearest district label
  let nearest = null, bestD = Infinity;
  for (const d of city.districts || []) {
    if (!d.label) continue;
    const dd = (d.label[0] - lng) ** 2 + (d.label[1] - lat) ** 2;
    if (dd < bestD) { bestD = dd; nearest = d; }
  }
  return nearest ? nearest.cluster_id : `${city.slug}:unknown`;
}

// Minimal ray-casting point-in-polygon for GeoJSON Polygon/MultiPolygon ([lng,lat] rings).
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function pointInPolygon(x, y, polygon) {
  if (!polygon.length || !pointInRing(x, y, polygon[0])) return false;
  for (let k = 1; k < polygon.length; k++) if (pointInRing(x, y, polygon[k])) return false; // hole
  return true;
}
function pointInGeom(x, y, geom) {
  if (!geom) return false;
  if (geom.type === 'Polygon') return pointInPolygon(x, y, geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some(p => pointInPolygon(x, y, p));
  return false;
}

module.exports = { slugify, chooseRes, clusterIdForPoint, pointInGeom };
