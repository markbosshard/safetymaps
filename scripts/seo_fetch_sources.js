#!/usr/bin/env node
// scripts/seo_fetch_sources.js — fetch source excerpts for the SEO pipeline.
//
//   node scripts/seo_fetch_sources.js             fetch all cities (skips existing)
//   node scripts/seo_fetch_sources.js sao-paulo   fetch one city
//   node scripts/seo_fetch_sources.js --force     overwrite existing source files
//   node scripts/seo_fetch_sources.js --audit     print what's fetched vs missing
//
// Sources fetched per city (no extra setup needed):
//   [advisory]    US State Dept travel advisory (country-level)
//   [advisory]    UK FCDO travel advice (country-level)
//
// Sources that need additional unlocks (see bottom of this file):
//   [index]       Numbeo crime/safety index  → needs NUMBEO_API_KEY
//   [community]   Reddit posts               → needs REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET
//   [crime_data]  Country official stats     → needs Playwright (JS-rendered)
//   [advisory]    OSAC reports               → needs Playwright (CloudFront-protected)
//   [editorial]   Vanguard Attaché           → needs Playwright

'use strict';

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const ROOT    = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'seo', 'sources');
const CITIES  = JSON.parse(fs.readFileSync(path.join(ROOT, 'cities.json'), 'utf8'));

const FORCE  = process.argv.includes('--force');
const AUDIT  = process.argv.includes('--audit');
const TARGET = process.argv.find(a => !a.startsWith('-') && a !== __filename.split('/').pop() && CITIES[a]);

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function get(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'LatamCrimeMap research bot (latamcrimemap.com)',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        ...opts.headers,
      },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, opts).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} ${url}`));
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => { if (body.length < 500000) body += c; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// getBinary: returns a Buffer (needed for latin-1 encoded files like ISP-RJ CSV)
function getBinary(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout: 35000,
      headers: { 'User-Agent': 'LatamCrimeMap research bot (latamcrimemap.com)', ...opts.headers },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return getBinary(res.headers.location, opts).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} ${url}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Strip HTML tags; decode common HTML entities; collapse whitespace
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/\\u003c/g,'<').replace(/\\u003e/g,'>').replace(/\\u0026/g,'&')
    .replace(/\b[A-Z]\b/g, '')   // remove isolated icon-letter artifacts (nav/link chars)
    .replace(/\s+/g, ' ').trim();
}

// Extract meaningful safety sentences from a block of plain text
function extractSafetySentences(text, maxChars = 1200) {
  const SAFETY_WORDS = /crime|theft|robbery|murder|kidnap|safety|danger|risk|assault|pickpocket|scam|violent|secure|warn|caution|precaution|incident|arrest/i;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const picked = sentences.filter(s => s.length > 60 && s.length < 400 && SAFETY_WORDS.test(s));
  let out = '', added = 0;
  for (const s of picked) {
    if (out.length + s.length > maxChars) break;
    out += (out ? ' ' : '') + s.trim();
    added++;
  }
  return { text: out, sentences: added };
}

// ── US State Dept ─────────────────────────────────────────────────────────────

const STATE_DEPT_SLUGS = {
  br:'brazil',mx:'mexico',ar:'argentina',co:'colombia',pe:'peru',cl:'chile',
  ec:'ecuador',bo:'bolivia',ve:'venezuela',hn:'honduras',gt:'guatemala',
  sv:'el-salvador',ni:'nicaragua',cr:'costa-rica',pa:'panama',cu:'cuba',
  do:'dominican-republic',ht:'haiti',uy:'uruguay',py:'paraguay',
  // pr (Puerto Rico) = US territory, no separate advisory
};

async function fetchStateDept(country) {
  const slug = STATE_DEPT_SLUGS[country];
  if (!slug) return null;
  const url = `https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/${slug}-travel-advisory.html`;
  try {
    const html = await get(url);
    const text = stripHtml(html);
    const { text: excerpt, sentences } = extractSafetySentences(text);
    if (!excerpt) return null;

    // Extract advisory level
    const lvlMatch = text.match(/Level\s+(\d)[:\s]*([A-Z][a-zA-Z\s]+?)(?:\.|–|$)/);
    const level = lvlMatch ? `Level ${lvlMatch[1]} — ${lvlMatch[2].trim()}` : 'See link';

    return {
      id: `state_dept_${country}`,
      source_name: 'US State Department Travel Advisory',
      source_class: 'advisory',
      url,
      published_date: new Date().toISOString().slice(0,7),
      license: 'US Government public domain',
      advisory_level: level,
      excerpt: excerpt.slice(0, 1200),
    };
  } catch (e) {
    console.warn(`    state_dept_${country}: ${e.message}`);
    return null;
  }
}

// ── UK FCDO ───────────────────────────────────────────────────────────────────

const FCDO_SLUGS = {
  br:'brazil',mx:'mexico',ar:'argentina',co:'colombia',pe:'peru',cl:'chile',
  ec:'ecuador',bo:'bolivia',ve:'venezuela',hn:'honduras',gt:'guatemala',
  sv:'el-salvador',ni:'nicaragua',cr:'costa-rica',pa:'panama',cu:'cuba',
  do:'dominican-republic',pr:null,ht:'haiti',uy:'uruguay',py:'paraguay',
};

async function fetchFCDO(country) {
  const slug = FCDO_SLUGS[country];
  if (!slug) return null;
  const url = `https://www.gov.uk/foreign-travel-advice/${slug}/safety-and-security`;
  try {
    const html = await get(url);
    // FCDO embeds article body as JSON-LD with unicode escapes
    const m = html.match(/"articleBody":\s*"([\s\S]+?)",\s*"publisher"/);
    let text;
    if (m) {
      text = stripHtml(m[1].replace(/\\n/g,' ').replace(/\\"/g,'"').replace(/\\u([\da-f]{4})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))));
    } else {
      text = stripHtml(html);
    }
    const { text: excerpt } = extractSafetySentences(text);
    if (!excerpt) return null;
    return {
      id: `fcdo_${country}`,
      source_name: 'UK FCDO Travel Advice — Safety and Security',
      source_class: 'advisory',
      url,
      published_date: new Date().toISOString().slice(0,7),
      license: 'Open Government Licence v3.0',
      excerpt: excerpt.slice(0, 1200),
    };
  } catch (e) {
    console.warn(`    fcdo_${country}: ${e.message}`);
    return null;
  }
}

// ── Canada DFATD ─────────────────────────────────────────────────────────────

const CANADA_SLUGS = {
  br:'brazil',mx:'mexico',ar:'argentina',co:'colombia',pe:'peru',cl:'chile',
  ec:'ecuador',bo:'bolivia',ve:'venezuela',hn:'honduras',gt:'guatemala',
  sv:'el-salvador',ni:'nicaragua',cr:'costa-rica',pa:'panama',cu:'cuba',
  do:'dominican-republic',pr:'puerto-rico',ht:'haiti',uy:'uruguay',py:'paraguay',
};

async function fetchCanada(country) {
  const slug = CANADA_SLUGS[country];
  if (!slug) return null;
  const url = `https://travel.gc.ca/destinations/${slug}`;
  try {
    const html = await get(url);
    const text = stripHtml(html);
    const { text: excerpt } = extractSafetySentences(text);
    if (!excerpt) return null;
    return {
      id: `canada_dfatd_${country}`,
      source_name: 'Canada DFATD Travel Advice',
      source_class: 'advisory',
      url,
      published_date: new Date().toISOString().slice(0,7),
      license: 'Government of Canada — Open Government Licence',
      excerpt: excerpt.slice(0, 1200),
    };
  } catch (e) {
    console.warn(`    canada_${country}: ${e.message}`);
    return null;
  }
}

// ── SSP-SP REST API (São Paulo state crime stats — no auth needed) ────────────
// API discovered by intercepting network calls on ssp.sp.gov.br/estatistica/dados-mensais
// Capital region = idGrupo=1; grupoDelito=6 covers homicídio group

// Map city keys that fall within São Paulo state to their SSP region id
const SSPSP_CITY_REGIONS = {
  'sao-paulo':      { idGrupo: 1, regionName: 'Capital' },
  'campinas':       { idGrupo: 4, regionName: 'Campinas' },
  'sorocaba':       { idGrupo: 12, regionName: 'Sorocaba' },
  'ribeirao-preto': { idGrupo: 8, regionName: 'Ribeirão Preto' },
  'santos':         { idGrupo: 9, regionName: 'Santos' },
};

// grupoDelito codes discovered from the API
const DELITO_GROUPS = [
  { id: 6, name: 'Homicídios' },
  { id: 1, name: 'Furtos e Roubos' },
];

async function fetchSspSp(cityKey) {
  const cfg = SSPSP_CITY_REGIONS[cityKey];
  if (!cfg) return null;
  const year = new Date().getFullYear();
  try {
    let allRows = [];
    for (const grp of DELITO_GROUPS) {
      const url = `https://www.ssp.sp.gov.br/v1/OcorrenciasMensais/RecuperaDadosMensaisAgrupados?ano=${year}&grupoDelito=${grp.id}&tipoGrupo=REGIAO&idGrupo=${cfg.idGrupo}`;
      const raw = await get(url);
      const json = JSON.parse(raw);
      const rows = (json.data?.[0]?.listaDados || []).map(r => ({
        crime: r.delito?.delito || '',
        total: r.total,
      }));
      allRows = allRows.concat(rows);
    }
    if (!allRows.length) return null;
    // Format as a concise excerpt
    const lines = allRows
      .filter(r => r.total > 0 && !/VÍTIMAS|CULPOSO|TRÂNSITO/i.test(r.crime))
      .map(r => `${r.crime}: ${r.total.toLocaleString()} (${year})`);
    const excerpt = `SSP-SP official crime statistics for ${cfg.regionName} region — ${year}:\n${lines.join('; ')}.`;
    return {
      id: `sspsp_${cityKey.replace(/-/g,'_')}`,
      source_name: `SSP-SP — Secretaria da Segurança Pública do Estado de São Paulo (${cfg.regionName})`,
      source_class: 'crime_data',
      url: 'https://www.ssp.sp.gov.br/estatistica/dados-mensais',
      published_date: new Date().toISOString().slice(0,7),
      license: 'Dados abertos — Governo do Estado de São Paulo',
      excerpt: excerpt.slice(0, 1200),
    };
  } catch (e) {
    console.warn(`    ssp-sp_${cityKey}: ${e.message}`);
    return null;
  }
}

// ── Argentina SNIC API ────────────────────────────────────────────────────────
// Homicides (dolosos) by province — annual time series via datos.gob.ar
// Series ID pattern: snic_1_hechos_{2-digit INDEC province code}
// Note: province-level data; for CABA (02) it is city-level.

const SNIC_CITIES = {
  'buenos-aires': { code: '02', province: 'CABA' },
  'cordoba':      { code: '14', province: 'Córdoba' },
  'mendoza':      { code: '50', province: 'Mendoza' },
  'rosario':      { code: '82', province: 'Santa Fe' },
  'bariloche':    { code: '62', province: 'Río Negro' },
};

async function fetchSnicArgentina(cityKey) {
  const cfg = SNIC_CITIES[cityKey];
  if (!cfg) return null;
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=snic_1_hechos_${cfg.code}&limit=8&sort=desc&format=json`;
  try {
    const raw = await get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LatamCrimeMap)' } });
    const json = JSON.parse(raw);
    const series = (json.data || []).filter(d => d[1] != null);
    if (!series.length) return null;
    const lines = series.slice(0, 6).map(([date, val]) => `${date.slice(0,4)}: ${val}`);
    const scope = cfg.code === '02' ? 'ciudad-nivel' : 'nivel provincial';
    const excerpt = `SNIC Argentina — homicidios dolosos en ${cfg.province} (${scope}): ${lines.join('; ')}. Fuente: Sistema Nacional de Información Criminal, MJyDDHH Argentina.`;
    return {
      id: `snic_ar_${cfg.code}`,
      source_name: `SNIC — Sistema Nacional de Información Criminal (${cfg.province})`,
      source_class: 'crime_data',
      url: 'https://www.argentina.gob.ar/seguridad/snic/datos',
      published_date: new Date().toISOString().slice(0,7),
      license: 'Creative Commons Attribution 2.5 Argentina',
      excerpt: excerpt.slice(0, 1200),
    };
  } catch (e) {
    console.warn(`    snic_ar_${cityKey}: ${e.message}`);
    return null;
  }
}

// ── ISP-RJ CSV (Rio de Janeiro state crime stats) ─────────────────────────────
// CSV at ispdados.rj.gov.br uses latin-1 encoding + semicolon delimiters.
// Fields: fmun (municipality), ano, mes, hom_doloso, cvli, total_roubos, latrocinio, ...

const ISPRJ_CITIES = {
  'rio-de-janeiro': 'Rio de Janeiro',
};

let isprjCache = null; // download once per run

async function fetchIspRj(cityKey) {
  const fmun = ISPRJ_CITIES[cityKey];
  if (!fmun) return null;
  try {
    if (!isprjCache) {
      console.log('\n    Downloading ISP-RJ CSV (2.3 MB)…');
      const buf = await getBinary('http://www.ispdados.rj.gov.br/Arquivos/BaseMunicipioMensal.csv');
      const text = buf.toString('latin1');
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(';').map(h => h.trim());
      isprjCache = lines.slice(1).map(line => {
        const vals = line.split(';');
        const row = {};
        headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
        return row;
      });
    }
    const rows = isprjCache
      .filter(r => r.fmun === fmun)
      .sort((a, b) => {
        const ka = a.ano + a.mes.padStart(2,'0');
        const kb = b.ano + b.mes.padStart(2,'0');
        return kb.localeCompare(ka);
      });
    if (!rows.length) return null;

    const sumYear = (yr) => {
      const yr_rows = rows.filter(r => r.ano === yr);
      if (!yr_rows.length) return null;
      const tot = {};
      for (const k of ['hom_doloso','cvli','total_roubos','latrocinio']) {
        tot[k] = yr_rows.reduce((s, r) => s + (parseFloat(r[k]) || 0), 0);
      }
      return { year: yr, months: yr_rows.length, ...tot };
    };

    const latestYear = rows[0].ano;
    const curr = sumYear(latestYear);
    const prev = sumYear(String(Number(latestYear) - 1));

    let excerpt = `ISP-RJ dados para ${fmun}`;
    if (curr) {
      const mo = curr.months < 12 ? ` (${curr.months} meses YTD)` : '';
      excerpt += ` — ${curr.year}${mo}: ${curr.hom_doloso} homicídios dolosos, ${curr.cvli} CVLI, ${curr.total_roubos.toLocaleString()} roubos totais, ${curr.latrocinio} latrocínios.`;
    }
    if (prev) {
      excerpt += ` ${prev.year}: ${prev.hom_doloso} homicídios, ${prev.total_roubos.toLocaleString()} roubos.`;
    }
    return {
      id: `isprj_${cityKey.replace(/-/g,'_')}`,
      source_name: `ISP-RJ — Instituto de Segurança Pública do Rio de Janeiro (${fmun})`,
      source_class: 'crime_data',
      url: 'https://www.ispdados.rj.gov.br/',
      published_date: new Date().toISOString().slice(0,7),
      license: 'Dados abertos — Governo do Estado do Rio de Janeiro',
      excerpt: excerpt.slice(0, 1200),
    };
  } catch (e) {
    console.warn(`    isprj_${cityKey}: ${e.message}`);
    return null;
  }
}

// ── Reddit (needs REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET) ───────────────────

async function fetchReddit(cityName, country) {
  const id  = process.env.REDDIT_CLIENT_ID;
  const sec = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !sec) return null;

  try {
    // Get OAuth token
    const tokenBody = 'grant_type=client_credentials';
    const tokenRes = await new Promise((resolve, reject) => {
      const auth = Buffer.from(`${id}:${sec}`).toString('base64');
      const req = https.request({
        hostname: 'www.reddit.com', path: '/api/v1/access_token', method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded',
                   'User-Agent': 'LatamCrimeMap/1.0', 'Content-Length': Buffer.byteLength(tokenBody) },
      }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve(JSON.parse(d))); });
      req.on('error', reject);
      req.write(tokenBody); req.end();
    });

    const token = tokenRes.access_token;
    const q = encodeURIComponent(`${cityName} safe travel`);
    const searchRes = await get(
      `https://oauth.reddit.com/search.json?q=${q}&sort=relevance&limit=5&type=link`,
      { headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'LatamCrimeMap/1.0' } }
    );
    const posts = JSON.parse(searchRes).data.children
      .filter(p => p.data.selftext && p.data.selftext.length > 100)
      .slice(0, 3);

    if (!posts.length) return null;
    const excerpt = posts.map(p => `[${p.data.subreddit}] ${p.data.title}: ${p.data.selftext.slice(0,300)}`).join('\n\n');
    return {
      id: `reddit_${country}`,
      source_name: 'Reddit — traveller community posts (r/solotravel, r/travel, city subs)',
      source_class: 'community',
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(cityName+' safe')}`,
      published_date: new Date().toISOString().slice(0,7),
      license: 'Reddit public posts — paraphrase only, do not reproduce verbatim',
      excerpt: excerpt.slice(0, 1200),
    };
  } catch (e) {
    console.warn(`    reddit_${country}: ${e.message}`);
    return null;
  }
}

// ── Numbeo (needs NUMBEO_API_KEY) ─────────────────────────────────────────────

async function fetchNumbeo(cityName, country) {
  const key = process.env.NUMBEO_API_KEY;
  if (!key) return null;
  const city = encodeURIComponent(cityName);
  const url  = `https://www.numbeo.com/api/city_crime?api_key=${key}&city=${city}`;
  try {
    const raw  = await get(url);
    const data = JSON.parse(raw);
    if (!data.crime_index) return null;
    const excerpt = `Numbeo crime index for ${cityName}: ${data.crime_index.toFixed(1)} (higher = more crime; world range 0–100). Safety index: ${data.safety_index ? data.safety_index.toFixed(1) : 'n/a'}. Based on ${data.contributors || '?'} contributors.`;
    return {
      id: `numbeo_${country}`,
      source_name: 'Numbeo Crime & Safety Index',
      source_class: 'index',
      url: `https://www.numbeo.com/crime/in/${cityName.replace(/ /g, '-')}`,
      published_date: new Date().toISOString().slice(0,7),
      license: 'Numbeo — attributed, not reproduced verbatim',
      excerpt,
    };
  } catch (e) {
    console.warn(`    numbeo_${country}: ${e.message}`);
    return null;
  }
}

// ── Per-city source assembly ──────────────────────────────────────────────────

// Cache country-level results (State Dept + FCDO are per-country, not per-city)
const countryCache = {};

async function fetchForCity(key) {
  const city    = CITIES[key];
  const country = city.country;

  process.stdout.write(`  ${key} (${city.name})…`);

  if (!countryCache[country]) {
    countryCache[country] = {};
    const [sd, fcdo, ca] = await Promise.all([fetchStateDept(country), fetchFCDO(country), fetchCanada(country)]);
    if (sd)   countryCache[country].state_dept = sd;
    if (fcdo) countryCache[country].fcdo = fcdo;
    if (ca)   countryCache[country].canada = ca;
  }

  const sources = Object.values(countryCache[country]).filter(Boolean);

  // City-specific: Reddit (if key available)
  const reddit = await fetchReddit(city.name, country);
  if (reddit) sources.push(reddit);

  // City-specific: SSP-SP crime stats (São Paulo state cities only)
  const sspsp = await fetchSspSp(key);
  if (sspsp) sources.push(sspsp);

  // City-specific: Argentina SNIC (Argentine cities only)
  const snic = await fetchSnicArgentina(key);
  if (snic) sources.push(snic);

  // City-specific: ISP-RJ CSV (Rio de Janeiro state cities only)
  const isprj = await fetchIspRj(key);
  if (isprj) sources.push(isprj);

  // City-specific: Numbeo (if key available)
  const numbeo = await fetchNumbeo(city.name, country);
  if (numbeo) sources.push(numbeo);

  // Add existing basis sources from cities.json as reference entries (no excerpt — human fills these)
  const basis = (city.sources && city.sources.basis) || [];
  for (const b of basis) {
    if (b.url && !sources.find(s => s.url === b.url)) {
      sources.push({
        id: `editorial_${b.text.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,30)}`,
        source_name: b.text,
        source_class: 'editorial',
        url: b.url,
        published_date: null,
        license: 'see source',
        excerpt: '',
        _note: 'Excerpt needed — paste a key safety paragraph from this URL',
      });
    }
  }

  // Merge with existing source file (preserve Playwright-fetched sources like australia_dfat, osac)
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const existingPath = path.join(OUT_DIR, `${key}.json`);
  let existing = [];
  if (fs.existsSync(existingPath)) {
    try { existing = JSON.parse(fs.readFileSync(existingPath, 'utf8')); } catch {}
  }
  const existingIds = new Set(existing.map(s => s.id));
  for (const s of sources) {
    if (!existingIds.has(s.id) || FORCE) {
      existing = existing.filter(e => e.id !== s.id);
      existing.push(s);
    }
  }
  fs.writeFileSync(existingPath, JSON.stringify(existing, null, 2));

  const filled   = existing.filter(s => s.excerpt).length;
  const unfilled = existing.filter(s => !s.excerpt).length;
  console.log(` ${filled} excerpts, ${unfilled} stubs (total ${existing.length} sources)`);

  return { filled, unfilled };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (AUDIT) {
    console.log('\n▸ Source file coverage\n');
    const keys = Object.keys(CITIES);
    let withFile = 0, withExcerpts = 0;
    for (const k of keys) {
      const p = path.join(OUT_DIR, `${k}.json`);
      if (fs.existsSync(p)) {
        withFile++;
        const src = JSON.parse(fs.readFileSync(p,'utf8'));
        const n = src.filter(s=>s.excerpt).length;
        if (n) withExcerpts++;
        console.log(`  ${k.padEnd(28)} ${src.length} sources, ${n} with excerpts`);
      }
    }
    console.log(`\n  ${withFile}/${keys.length} cities have source files`);
    console.log(`  ${withExcerpts} have at least one excerpt → ready for pipeline`);
    console.log('\n  To unlock more sources:');
    console.log('    NUMBEO_API_KEY          → crime/safety index numbers');
    console.log('    REDDIT_CLIENT_ID/SECRET → community travel posts');
    console.log('    npm install playwright  → JS-rendered sites (OSAC, Numbeo web, Vanguard Attaché)');
    return;
  }

  // Without --force: only process cities that are missing SNIC/ISP-RJ where applicable,
  // or that have no source file yet. With --force: re-fetch everything.
  const keys = TARGET ? [TARGET] : Object.keys(CITIES).filter(k => {
    if (FORCE) return true;
    const p = path.join(OUT_DIR, `${k}.json`);
    if (!fs.existsSync(p)) return true;
    // Also re-process if we have new crime data sources for this city
    const src = JSON.parse(fs.readFileSync(p, 'utf8'));
    const ids = new Set(src.map(s => s.id));
    if (SNIC_CITIES[k] && !ids.has(`snic_ar_${SNIC_CITIES[k].code}`)) return true;
    if (ISPRJ_CITIES[k] && !ids.has(`isprj_${k.replace(/-/g,'_')}`)) return true;
    return false;
  });

  if (!keys.length) {
    console.log('All cities already have source files. Use --force to re-fetch.');
    return;
  }

  console.log(`\nFetching sources for ${keys.length} cities…`);
  console.log('Sources active: US State Dept ✓  UK FCDO ✓' +
    (process.env.REDDIT_CLIENT_ID ? '  Reddit ✓' : '  Reddit ✗ (no REDDIT_CLIENT_ID)') +
    (process.env.NUMBEO_API_KEY   ? '  Numbeo ✓' : '  Numbeo ✗ (no NUMBEO_API_KEY)') + '\n');

  let totalFilled = 0, totalStubs = 0;
  for (const key of keys) {
    const { filled, unfilled } = await fetchForCity(key);
    totalFilled += filled;
    totalStubs  += unfilled;
    await new Promise(r => setTimeout(r, 400)); // gentle rate limiting
  }

  console.log(`\nDone. ${totalFilled} auto-filled excerpts, ${totalStubs} stubs needing manual excerpts.`);
  console.log(`\nNext steps:`);
  console.log(`  1. Fill in the "_note" stubs in seo/sources/*.json with key paragraphs from those URLs`);
  console.log(`  2. npm run pipeline -- --all     (runs A1-A5 LLM synthesis)`);
  console.log(`  3. npm run seo                   (regenerates city pages with rich content)`);
  console.log(`  4. npm run build                 (full rebuild)`);

  console.log(`\nTo unlock more source classes:`);
  console.log(`  NUMBEO_API_KEY=xxx              → numbeo.com/api (paid, ~\$20/mo)`);
  console.log(`  REDDIT_CLIENT_ID + SECRET       → free at reddit.com/prefs/apps`);
  console.log(`  npm install playwright          → JS-rendered sites (OSAC, Vanguard Attaché)`);
}

main().catch(e => { console.error(e); process.exit(1); });

/*
 WHAT EACH UNLOCK ADDS:
 ──────────────────────────────────────────────────────────────────────────
 Nothing (works now):
   US State Dept advisories  — country-level risk level + crime summary
   UK FCDO safety advice     — detailed incident types per country

 REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET (free, reddit.com/prefs/apps):
   Traveller community posts — real visitor accounts, specific street/area tips
   Register an app → "script" type → get client_id and secret

 NUMBEO_API_KEY (paid, numbeo.com/common/api.jsp, ~$20/month):
   Crime index + safety index numbers per city — the only clean numeric
   comparative data point available for all 96 cities

 npm install playwright (free):
   npx playwright install chromium
   Unlocks: OSAC country reports (CloudFront-protected, requires JS)
            Vanguard Attaché city reports (JS-rendered)
            Some LatAm government stats sites (SSP-SP, ISP-RJ, SISC...)
   Write a seo_fetch_playwright.js using playwright.launch() + page.goto()

 PERPLEXITY_API_KEY (pay-as-you-go, ~$5 topup covers all 96 cities):
   Single call per city that web-searches + summarizes all available sources.
   No scraping needed. Add to fetchForCity() above.
   Model: 'llama-3.1-sonar-small-128k-online' already wired in seo_sov.js.
 ──────────────────────────────────────────────────────────────────────────
*/
