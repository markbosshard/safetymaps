// Wave 6 — OSM Overpass bairro/barrio geometry for cities that currently show as
// a single blob or coarse municipality polygons.  Every district inherits the city's
// overall rating on first pass; run apply_safety_tiers.js afterwards to apply the
// travel-research-sourced per-district safety overrides.
//
//   node scripts/add_districts_wave6.js [key ...]
//   node scripts/apply_safety_tiers.js
//   npm run clusters && npm run build

'use strict';
const fs   = require('fs');
const path = require('path');
const http = require('https');
const { roundGeom, labelPoint, bboxOf, titleCase } = require('./lib/geo');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'cities.json');

const SKIP = /^(Lago|Laguna|Lake|Embalse|Represa|Reservoir|Bah[ií]a|Parque\s|Río\s|Rio\s)/i;

// max = if existing district count is <= this, REPLACE rather than skip.
// (wave5 skips cities already having >1 and <=70 districts; wave6 targets cities
//  whose existing districts are coarse municipality blobs, not real bairros.)
const JOBS = [
  { key: 'fortaleza',    box: [-38.638,-3.894,-38.402,-3.693],   levels:[10],    label:'bairros',  min:6,  max:4,  maxDistricts:160 },
  { key: 'salvador',     box: [-38.538,-13.014,-38.275,-12.659], levels:[10],    label:'bairros',  min:6,  max:4,  maxDistricts:100 },
  { key: 'natal',        box: [-35.300,-5.900,-35.150,-5.715],   levels:[10],    label:'bairros',  min:5,  max:50 },
  { key: 'porto-alegre', box: [-51.326,-30.129,-51.109,-29.940], levels:[10],    label:'bairros',  min:6,  max:2,  maxDistricts:100 },
  { key: 'barranquilla', box: [-74.863,10.888,-74.699,11.049],   levels:[9,10],  label:'barrios',  min:4,  max:2  },
  { key: 'managua',      box: [-86.319,12.034,-86.154,12.196],   levels:[9,10],  label:'barrios',  min:4,  max:2  },
  { key: 'valparaiso',   box: [-71.689,-33.121,-71.524,-32.985], levels:[8,9],   label:'comunas',  min:3,  max:2  },
];

// ── Overpass ──────────────────────────────────────────────────────────────────

const OVERPASS_HOSTS = ['overpass.kumi.systems', 'overpass-api.de'];

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
        res.resume(); return resolve(postOverpass(query, hostIdx + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
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
          } else { reject(new Error('Overpass response not valid JSON')); }
        }
      });
    });
    req.on('error', err => {
      if (hostIdx < OVERPASS_HOSTS.length - 1) { process.stdout.write(` error, retrying…`); resolve(postOverpass(query, hostIdx + 1)); }
      else reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      if (hostIdx < OVERPASS_HOSTS.length - 1) { process.stdout.write(` timeout, retrying…`); resolve(postOverpass(query, hostIdx + 1)); }
      else reject(new Error('Timeout from all hosts'));
    });
    req.write(body); req.end();
  });
}

async function fetchOsmRelations(box, level) {
  const [W, S, E, N] = box;
  // `out geom` on relations inlines member way geometries so relToGeom can work directly.
  const query = `[out:json][timeout:90];relation["boundary"="administrative"]["admin_level"="${level}"](${S},${W},${N},${E});out geom;`;
  process.stdout.write(`    OSM level ${level}…`);
  const start = Date.now();
  const data = await postOverpass(query);
  process.stdout.write(` ${data.elements.length} elements (${((Date.now()-start)/1000).toFixed(1)}s)\n`);
  return data.elements.filter(e => e.type === 'relation');
}

// ── Ring assembly (identical to wave5) ───────────────────────────────────────

const EPS = 1e-5;
const near = (a, b) => Math.abs(a[0]-b[0]) < EPS && Math.abs(a[1]-b[1]) < EPS;

function assembleRings(ways) {
  const rings = [];
  const remaining = ways.map(w => [...w]);
  while (remaining.length > 0) {
    const chain = [remaining.shift()];
    let extended = true;
    while (extended) {
      extended = false;
      const head = chain[0][0], tail = chain[chain.length-1][chain[chain.length-1].length-1];
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        if (near(seg[0], tail)) { chain.push(seg); remaining.splice(i,1); extended=true; break; }
        if (near(seg[seg.length-1], tail)) { chain.push([...seg].reverse()); remaining.splice(i,1); extended=true; break; }
        if (near(seg[0], head)) { chain.unshift([...seg].reverse()); remaining.splice(i,1); extended=true; break; }
        if (near(seg[seg.length-1], head)) { chain.unshift(seg); remaining.splice(i,1); extended=true; break; }
      }
    }
    const pts = [];
    for (const seg of chain) for (const p of seg) pts.push(p);
    if (pts.length < 4) continue;
    if (!near(pts[0], pts[pts.length-1])) pts.push([...pts[0]]);
    rings.push(pts);
  }
  return rings;
}

function relToGeom(rel) {
  const toXY = m => m.geometry.map(p => [p.lon, p.lat]);
  const outerWays = rel.members
    .filter(m => m.type==='way' && (m.role==='outer'||m.role==='') && m.geometry && m.geometry.length >= 2)
    .map(toXY);
  const innerWays = rel.members
    .filter(m => m.type==='way' && m.role==='inner' && m.geometry && m.geometry.length >= 2)
    .map(toXY);
  if (!outerWays.length) return null;
  const outerRings = assembleRings(outerWays);
  if (!outerRings.length) return null;
  const innerRings = assembleRings(innerWays);
  if (outerRings.length === 1) return { type:'Polygon', coordinates:[outerRings[0],...innerRings] };
  return { type:'MultiPolygon', coordinates:outerRings.map((r,i)=>(i===0?[r,...innerRings]:[r])) };
}

// ── DP simplification (identical to wave5) ────────────────────────────────────

function dpRing(pts, tol) {
  if (pts.length <= 4) return pts;
  const t2 = tol*tol;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length-1] = true;
  const segD = (p,a,b) => { let x=a[0],y=a[1],dx=b[0]-x,dy=b[1]-y; if(dx||dy){const t=((p[0]-x)*dx+(p[1]-y)*dy)/(dx*dx+dy*dy);if(t>1){x=b[0];y=b[1];}else if(t>0){x+=dx*t;y+=dy*t;}}return(p[0]-x)**2+(p[1]-y)**2; };
  const st=[[0,pts.length-1]];
  while(st.length){const[s,e]=st.pop();let md=0,idx=-1;for(let i=s+1;i<e;i++){const d=segD(pts[i],pts[s],pts[e]);if(d>md){md=d;idx=i;}}if(md>t2&&idx>-1){keep[idx]=true;st.push([s,idx]);st.push([idx,e]);}}
  const out=[];for(let i=0;i<pts.length;i++)if(keep[i])out.push(pts[i]);
  return out.length>=4?out:pts;
}
function simplifyGeom(g, tol) {
  const doPoly=poly=>poly.map(r=>dpRing(r,tol)).filter(r=>r.length>=4);
  if(g.type==='Polygon') return{type:'Polygon',coordinates:doPoly(g.coordinates)};
  return{type:'MultiPolygon',coordinates:g.coordinates.map(doPoly).filter(p=>p.length)};
}

function centroid(g) {
  let sx=0,sy=0,n=0;
  const ps=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  for(const p of ps)for(const r of p[0]){sx+=r[0];sy+=r[1];n++;}
  return[sx/n,sy/n];
}
function inBox(c,b){return c[0]>=b[0]&&c[0]<=b[2]&&c[1]>=b[1]&&c[1]<=b[3];}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const only = process.argv.slice(2);
  const cities = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let done = 0;

  for (const job of JOBS) {
    if (only.length && !only.includes(job.key)) continue;

    const C = cities[job.key];
    if (!C) { console.log(`${job.key} — not in cities.json, skipping`); continue; }

    const overall = C.districts && C.districts[0] ? C.districts[0].score : null;
    if (overall == null) { console.log(`${job.key} — no score, skipping`); continue; }

    // Skip only if we already have GOOD sub-city district data (more than job.max)
    const maxToReplace = job.max || 2;
    if (C.districts && C.districts.length > maxToReplace) {
      console.log(`\n${job.key} — already has ${C.districts.length} districts (>${maxToReplace}), skipping`);
      continue;
    }

    console.log(`\n${job.key} (${C.name}) — replacing ${C.districts?.length || 0} coarse districts`);

    let districts = null;

    for (const level of job.levels) {
      let rels;
      try { rels = await fetchOsmRelations(job.box, level); }
      catch (e) { console.log(`    level ${level}: ${e.message} — skipping`); continue; }

      if (!rels.length) { console.log(`    level ${level}: 0 relations`); continue; }

      const built = [];
      for (const rel of rels) {
        const name = rel.tags?.name ? titleCase(rel.tags.name.trim()) : null;
        if (!name) continue;
        if (SKIP.test(name)) continue;
        let geom;
        try { geom = relToGeom(rel); } catch { continue; }
        if (!geom) continue;
        if (!inBox(centroid(geom), job.box)) continue;
        const simplified = roundGeom(simplifyGeom(geom, 0.0003));
        built.push({ name, score: overall, geom: simplified, label: labelPoint(simplified) });
      }

      const byName = {};
      for (const d of built) byName[d.name] = d;
      const deduped = Object.values(byName).sort((a,b) => a.name.localeCompare(b.name, 'es'));

      console.log(`    level ${level}: ${deduped.length} districts (need ≥${job.min})`);

      const maxD = job.maxDistricts || 80;
      if (deduped.length >= job.min && deduped.length <= maxD) {
        districts = deduped;
        break;
      }
      if (deduped.length > maxD) console.log(`    level ${level}: too granular (${deduped.length} > ${maxD}), trying next`);
    }

    if (!districts) { console.log(`  → SKIPPED (insufficient data)`); continue; }
    if (districts.length === 1 && districts[0].name.toLowerCase().includes(C.name.toLowerCase().split(' ')[0].toLowerCase())) {
      console.log(`  → SKIPPED (only found the city boundary itself)`); continue;
    }

    const levelLabel = job.label;
    cities[job.key] = Object.assign({}, C, {
      model: 'tier', tier_level: 'detailed',
      districts,
      bbox: bboxOf(districts),
      note: `${C.name} — ${districts.length} ${levelLabel}. Districts inherit the city's overall rating until crowd input or per-district research differentiates them. Editorial travel-safety synthesis; not a single crime-rate metric.`,
      sources: {
        boundary: [{ text: 'OpenStreetMap contributors (ODbL licence)', url: 'https://www.openstreetmap.org' }],
        basis: [{ text: 'Editorial travel-safety synthesis (US State Dept OSAC advisories, Numbeo, travel guides); per-district tiers applied by apply_safety_tiers.js' }],
      },
    });
    delete cities[job.key].cluster_res;
    delete cities[job.key].center;

    console.log(`  → ${districts.length} ${levelLabel}: ${districts.slice(0,6).map(d=>d.name).join(', ')}${districts.length>6?'…':''}`);
    done++;
  }

  fs.writeFileSync(FILE, JSON.stringify(cities) + '\n');
  console.log(`\nWrote ${done} cities. Now run: node scripts/apply_safety_tiers.js && npm run clusters && npm run build`);
})();
