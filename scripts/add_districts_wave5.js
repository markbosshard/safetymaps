// US-9 wave 5 — OSM Overpass ring-assembly for cities needing bespoke district sources.
// Queries overpass.kumi.systems for admin boundary relations, assembles outer-way rings into
// GeoJSON polygons, simplifies, then writes to cities.json.  Every district inherits the
// city's one honest overall rating (no per-district invention).
//
//   node scripts/add_districts_wave5.js [key ...]   (then: npm run clusters && npm run build)

'use strict';
const fs   = require('fs');
const path = require('path');
const http = require('https');
const { roundGeom, labelPoint, bboxOf, titleCase } = require('./lib/geo');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'cities.json');

// WATER / park labels we never want as district names
const SKIP = /^(Lago|Laguna|Lake|Embalse|Represa|Reservoir|Bah[ií]a|Parque\s|Río\s|Rio\s)/i;

// Each job: box=[W,S,E,N] from cities.json; levels=OSM admin_levels to try in order;
// label=what the units are called; min=minimum count before we skip.
const JOBS = [
  // Brazil — bairros
  { key: 'manaus',        box: [-60.14,-3.21,-59.91,-2.99],  levels: [10],    label: 'bairros',        min: 8  },
  { key: 'florianopolis', box: [-48.64,-27.68,-48.46,-27.52],levels: [9],     label: 'distritos',      min: 5  },
  { key: 'foz-do-iguacu', box: [-54.66,-25.58,-54.51,-25.45],levels: [10,9],  label: 'bairros',        min: 4  },
  { key: 'santarem',      box: [-54.78,-2.52,-54.64,-2.37],  levels: [9,10],  label: 'bairros',        min: 4  },
  // Argentina — barrios
  { key: 'rosario',       box: [-60.76,-33.05,-60.52,-32.85],levels: [9],     label: 'barrios',        min: 5  },
  { key: 'cordoba',       box: [-64.30,-31.51,-64.07,-31.31],levels: [10],    label: 'barrios',        min: 5  },
  { key: 'mendoza',       box: [-68.94,-32.97,-68.76,-32.81],levels: [10,9],  label: 'barrios',        min: 4  },
  { key: 'bariloche',     box: [-71.40,-41.20,-71.22,-41.07],levels: [10,9],  label: 'barrios',        min: 4  },
  // Mexico — colonias / delegaciones (sparse in OSM, will skip if too few)
  { key: 'tijuana',       box: [-117.14,32.39,-116.87,32.62],levels: [10,8],  label: 'colonias',       min: 4  },
  { key: 'ciudadjuarez',  box: [-106.59,31.61,-106.33,31.83],levels: [8,9],   label: 'delegaciones',   min: 3  },
  { key: 'torreon',       box: [-103.51,25.46,-103.32,25.63],levels: [9,8],   label: 'colonias',       min: 3  },
  { key: 'saltillo',      box: [-101.07,25.34,-100.89,25.51],levels: [9,8],   label: 'colonias',       min: 3  },
  { key: 'mexicali',      box: [-115.56,32.54,-115.35,32.71],levels: [9,8],   label: 'colonias',       min: 3  },
  { key: 'leon',          box: [-101.81,21.01,-101.56,21.24],levels: [9,8],   label: 'colonias',       min: 3  },
  // Bolivia — macrodistritos / zonas
  { key: 'lapaz',         box: [-68.25,-16.60,-68.05,-16.40],levels: [9],     label: 'macrodistritos', min: 5  },
  { key: 'cochabamba',    box: [-66.25,-17.47,-66.07,-17.30],levels: [9,8],   label: 'distritos',      min: 4  },
  // Honduras — distritos
  { key: 'tegucigalpa',   box: [-87.31,13.98,-87.10,14.18],  levels: [8],     label: 'distritos',      min: 5  },
];

// ── Overpass ──────────────────────────────────────────────────────────────────

const OVERPASS_HOSTS = [
  'overpass.kumi.systems',
  'overpass-api.de',
];

function postOverpass(query, hostIdx = 0) {
  if (hostIdx >= OVERPASS_HOSTS.length) return Promise.reject(new Error('All Overpass hosts exhausted'));
  const host = OVERPASS_HOSTS[hostIdx];
  const body = 'data=' + encodeURIComponent(query);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host, path: '/api/interpreter', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'safetymap-build' },
      timeout: 100000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(postOverpass(query, hostIdx + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        // Try next host on server error
        if (hostIdx < OVERPASS_HOSTS.length - 1) {
          process.stdout.write(` HTTP ${res.statusCode}, retrying ${OVERPASS_HOSTS[hostIdx+1]}…`);
          return resolve(postOverpass(query, hostIdx + 1));
        }
        return reject(new Error(`HTTP ${res.statusCode} from ${host}`));
      }
      let d = ''; res.setEncoding('utf8');
      res.on('data', c => (d += c));
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) {
          if (hostIdx < OVERPASS_HOSTS.length - 1) {
            process.stdout.write(` truncated, retrying ${OVERPASS_HOSTS[hostIdx+1]}…`);
            resolve(postOverpass(query, hostIdx + 1));
          } else {
            reject(new Error('Overpass response not valid JSON'));
          }
        }
      });
    });
    req.on('error', err => {
      if (hostIdx < OVERPASS_HOSTS.length - 1) {
        process.stdout.write(` error, retrying ${OVERPASS_HOSTS[hostIdx+1]}…`);
        resolve(postOverpass(query, hostIdx + 1));
      } else { reject(err); }
    });
    req.on('timeout', () => {
      req.destroy();
      if (hostIdx < OVERPASS_HOSTS.length - 1) {
        process.stdout.write(` timeout, retrying ${OVERPASS_HOSTS[hostIdx+1]}…`);
        resolve(postOverpass(query, hostIdx + 1));
      } else { reject(new Error(`Timeout from all hosts`)); }
    });
    req.write(body);
    req.end();
  });
}

async function fetchOsmRelations(box, level) {
  const [W, S, E, N] = box;
  const query = `[out:json][timeout:90];relation["boundary"="administrative"]["admin_level"="${level}"](${S},${W},${N},${E});out geom;`;
  process.stdout.write(`    OSM level ${level} query…`);
  const start = Date.now();
  const data = await postOverpass(query);
  process.stdout.write(` ${data.elements.length} rels (${((Date.now()-start)/1000).toFixed(1)}s)\n`);
  return data.elements;
}

// ── Ring assembly ─────────────────────────────────────────────────────────────

const EPS = 1e-5;
const near = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

function assembleRings(ways) {
  // ways: array of arrays of [lon, lat]
  const rings = [];
  const remaining = ways.map(w => [...w]);

  while (remaining.length > 0) {
    const chain = [remaining.shift()];
    let extended = true;

    while (extended) {
      extended = false;
      const last = chain[chain.length - 1];
      const tail = last[last.length - 1];
      const head = chain[0][0];

      if (near(tail, head)) break; // ring closed

      for (let i = 0; i < remaining.length; i++) {
        const w = remaining[i];
        if (near(w[0], tail)) {
          chain.push(w.slice(1));
          remaining.splice(i, 1);
          extended = true;
          break;
        }
        if (near(w[w.length - 1], tail)) {
          chain.push([...w].reverse().slice(1));
          remaining.splice(i, 1);
          extended = true;
          break;
        }
      }
    }

    // Flatten
    const pts = [];
    for (const seg of chain) for (const p of seg) pts.push(p);

    if (pts.length < 4) continue;

    // Close if needed
    if (!near(pts[0], pts[pts.length - 1])) pts.push([...pts[0]]);

    rings.push(pts);
  }
  return rings;
}

function relToGeom(rel) {
  const toXY = m => m.geometry.map(p => [p.lon, p.lat]);

  const outerWays = rel.members
    .filter(m => m.type === 'way' && (m.role === 'outer' || m.role === '') && m.geometry && m.geometry.length >= 2)
    .map(toXY);

  const innerWays = rel.members
    .filter(m => m.type === 'way' && m.role === 'inner' && m.geometry && m.geometry.length >= 2)
    .map(toXY);

  if (outerWays.length === 0) return null;

  const outerRings = assembleRings(outerWays);
  if (outerRings.length === 0) return null;
  const innerRings = assembleRings(innerWays);

  if (outerRings.length === 1) {
    return { type: 'Polygon', coordinates: [outerRings[0], ...innerRings] };
  }
  return {
    type: 'MultiPolygon',
    coordinates: outerRings.map((r, i) => (i === 0 ? [r, ...innerRings] : [r])),
  };
}

// ── DP simplification (from add_districts.js) ────────────────────────────────

function dpRing(pts, tol) {
  if (pts.length <= 4) return pts;
  const t2 = tol * tol;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const segD = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0]-x, dy = b[1]-y;
    if (dx||dy) { const t=((p[0]-x)*dx+(p[1]-y)*dy)/(dx*dx+dy*dy); if(t>1){x=b[0];y=b[1];}else if(t>0){x+=dx*t;y+=dy*t;} }
    return (p[0]-x)**2+(p[1]-y)**2;
  };
  const st = [[0, pts.length-1]];
  while (st.length) {
    const [s, e] = st.pop(); let md=0, idx=-1;
    for (let i=s+1;i<e;i++){const d=segD(pts[i],pts[s],pts[e]);if(d>md){md=d;idx=i;}}
    if (md>t2&&idx>-1){keep[idx]=true;st.push([s,idx]);st.push([idx,e]);}
  }
  const out=[]; for(let i=0;i<pts.length;i++) if(keep[i]) out.push(pts[i]);
  return out.length>=4?out:pts;
}
function simplifyGeom(g, tol) {
  const doPoly = poly => poly.map(r=>dpRing(r,tol)).filter(r=>r.length>=4);
  if (g.type==='Polygon') return {type:'Polygon',coordinates:doPoly(g.coordinates)};
  return {type:'MultiPolygon',coordinates:g.coordinates.map(doPoly).filter(p=>p.length)};
}

// ── Centroid + bbox filter (from add_districts.js) ───────────────────────────

function centroid(g) {
  let sx=0,sy=0,n=0;
  const ps=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  for(const p of ps) for(const r of p[0]){sx+=r[0];sy+=r[1];n++;}
  return [sx/n,sy/n];
}
function inBox(c,b) { return c[0]>=b[0]&&c[0]<=b[2]&&c[1]>=b[1]&&c[1]<=b[3]; }

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const only = process.argv.slice(2);
  const cities = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let done = 0;

  for (const job of JOBS) {
    if (only.length && !only.includes(job.key)) continue;

    // Find the city (key may not match exactly in cities.json)
    const C = cities[job.key];
    if (!C) { console.log(`${job.key} — not found in cities.json, skipping`); continue; }

    const overall = C.districts && C.districts[0] ? C.districts[0].score : null;
    if (overall == null) { console.log(`${job.key} — no overall score, skipping`); continue; }

    // Already has real districts within acceptable range — skip
    const maxAllowed = job.max || 70;
    if (C.districts && C.districts.length > 1 && C.districts.length <= maxAllowed) {
      console.log(`${job.key} — already has ${C.districts.length} districts, skipping`);
      continue;
    }

    console.log(`\n${job.key} (${C.name}) — score ${overall}`);

    let districts = null;

    for (const level of job.levels) {
      let rels;
      try {
        rels = await fetchOsmRelations(job.box, level);
      } catch (e) {
        console.log(`    level ${level}: ${e.message} — skipping`);
        continue;
      }

      if (!rels.length) { console.log(`    level ${level}: 0 relations`); continue; }

      const built = [];
      for (const rel of rels) {
        const name = (rel.tags && rel.tags.name) ? titleCase(rel.tags.name.trim()) : null;
        if (!name) continue;
        if (SKIP.test(name)) continue;

        let geom;
        try { geom = relToGeom(rel); } catch (e) { continue; }
        if (!geom) continue;

        const c = centroid(geom);
        if (!inBox(c, job.box)) continue;

        const simplified = roundGeom(simplifyGeom(geom, 0.0003));
        built.push({ name, score: overall, geom: simplified, label: labelPoint(simplified) });
      }

      // Deduplicate by name (same name may appear twice from overlapping queries)
      const byName = {};
      for (const d of built) byName[d.name] = d;
      const deduped = Object.values(byName).sort((a, b) => a.name.localeCompare(b.name, 'es'));

      console.log(`    level ${level}: ${deduped.length} districts after filter (need ≥${job.min})`);

      const maxAllowed = job.max || 70;
      if (deduped.length >= job.min && deduped.length <= maxAllowed) {
        districts = deduped;
        break; // use first level that gives enough
      }
      if (deduped.length > maxAllowed) {
        console.log(`    level ${level}: ${deduped.length} > max ${maxAllowed} — too granular, skipping level`);
      }
    }

    if (!districts) {
      console.log(`  → SKIPPED (insufficient district data)`);
      continue;
    }

    // Also skip if this level is just the city itself (1 big polygon with the city name)
    if (districts.length === 1 && districts[0].name.toLowerCase().includes(C.name.toLowerCase().split(' ')[0].toLowerCase())) {
      console.log(`  → SKIPPED (only found the city boundary itself, not sub-districts)`);
      continue;
    }

    const levelLabel = job.label;
    cities[job.key] = Object.assign({}, C, {
      model: 'tier', tier_level: 'detailed',
      districts,
      bbox: bboxOf(districts),
      note: `${C.name} — ${districts.length} ${levelLabel}. Every ${levelLabel.replace(/s$/, '')} carries ${C.name}'s ` +
        `one overall rating (we don't yet have verified per-district differences); an editorial travel-safety ` +
        `synthesis, directional and not a single crime-rate metric. Vote a district safer or flag an issue to refine it.`,
      sources: {
        boundary: [{ text: 'OpenStreetMap contributors (ODbL licence)', url: 'https://www.openstreetmap.org' }],
        basis: [{ text: 'Editorial travel-safety synthesis (US State Dept advisories, OSAC, Numbeo); districts inherit the city overall until crowd input or official data differentiates them' }],
      },
    });
    delete cities[job.key].cluster_res;
    delete cities[job.key].center;

    console.log(`  → ${districts.length} ${levelLabel}: ${districts.slice(0,5).map(d=>d.name).join(', ')}${districts.length>5?'…':''}`);
    done++;
  }

  fs.writeFileSync(FILE, JSON.stringify(cities) + '\n');
  console.log(`\nWrote ${done} cities.`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
