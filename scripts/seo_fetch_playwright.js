#!/usr/bin/env node
// scripts/seo_fetch_playwright.js — fetch JS-rendered safety sources via Playwright + stealth.
//
//   node scripts/seo_fetch_playwright.js             fetch all cities (skips existing playwright excerpts)
//   node scripts/seo_fetch_playwright.js sao-paulo   fetch one city
//   node scripts/seo_fetch_playwright.js --audit      print coverage
//   node scripts/seo_fetch_playwright.js --force     overwrite existing
//
// Uses playwright-extra + puppeteer-extra-plugin-stealth to bypass bot detection.
//
// Sources fetched:
//   [advisory]    Australia Smartraveller (stealth required — blocked curl)
//   [advisory]    OSAC — still returns 500 even with stealth; keep for future
//   [index]       Numbeo web — blocked even with stealth; use NUMBEO_API_KEY instead
//
// NOTE: SSP-SP (São Paulo state crime stats) turned out to have a direct REST API —
//       it is handled in seo_fetch_sources.js instead (no browser needed).

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'seo', 'sources');
const CITIES  = JSON.parse(fs.readFileSync(path.join(ROOT, 'cities.json'), 'utf8'));

const FORCE  = process.argv.includes('--force');
const AUDIT  = process.argv.includes('--audit');
const TARGET = process.argv.find(a => !a.startsWith('-') && a !== __filename.split('/').pop() && CITIES[a]);

const SAFETY_WORDS = /crime|theft|robbery|murder|kidnap|safety|danger|risk|assault|pickpocket|scam|violent|secure|warn|caution|precaution|incident|arrest|homicide/i;

function extractSafety(text, maxChars = 1200) {
  const sentences = text.replace(/\s+/g,' ').split(/(?<=[.!?])\s+/);
  const picked = sentences.filter(s => s.length > 60 && s.length < 400 && SAFETY_WORDS.test(s));
  let out = '';
  for (const s of picked) {
    if (out.length + s.length > maxChars) break;
    out += (out ? ' ' : '') + s.trim();
  }
  return out;
}

// ── Australia Smartraveller ───────────────────────────────────────────────────
// Blocked by curl (HTTP/2 protocol error) but works with stealth Playwright.
// URL pattern: /destinations/americas/{slug}
// Content is in .layout-content; safety section between "Safety" and "Health" headings.

const AUSTRALIA_SLUGS = {
  br:'brazil',mx:'mexico',ar:'argentina',co:'colombia',pe:'peru',cl:'chile',
  ec:'ecuador',bo:'bolivia',ve:'venezuela',hn:'honduras',gt:'guatemala',
  sv:'el-salvador',ni:'nicaragua',cr:'costa-rica',pa:'panama',cu:'cuba',
  do:'dominican-republic',pr:'puerto-rico',ht:'haiti',uy:'uruguay',py:'paraguay',
};

async function fetchAustralia(browser, country) {
  const slug = AUSTRALIA_SLUGS[country];
  if (!slug) return null;
  const url = `https://www.smartraveller.gov.au/destinations/americas/${slug}`;
  const page = await browser.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (!resp || resp.status() !== 200) return null;

    const text = await page.evaluate(() => {
      const main = document.querySelector('.layout-content');
      return main ? main.innerText : document.body.innerText;
    });

    // Extract the safety section (between "Safety" heading and "Health" heading)
    const safetyIdx = text.search(/\nSafety\n/);
    const healthIdx = text.search(/\nHealth\n/);
    const section = safetyIdx >= 0
      ? text.slice(safetyIdx, healthIdx > safetyIdx ? healthIdx : safetyIdx + 3000)
      : text;

    const excerpt = extractSafety(section);
    if (!excerpt) return null;

    return {
      id: `australia_dfat_${country}`,
      source_name: 'Australia DFAT Smartraveller — Safety',
      source_class: 'advisory',
      url,
      published_date: new Date().toISOString().slice(0,7),
      license: 'Creative Commons Attribution 3.0 Australia',
      excerpt: excerpt.slice(0, 1200),
    };
  } catch (e) {
    console.warn(`      australia_${country}: ${e.message.slice(0,80)}`);
    return null;
  } finally {
    await page.close();
  }
}

// ── OSAC ─────────────────────────────────────────────────────────────────────

const OSAC_COUNTRY_SLUGS = {
  br:'Brazil',mx:'Mexico',ar:'Argentina',co:'Colombia',pe:'Peru',cl:'Chile',
  ec:'Ecuador',bo:'Bolivia',ve:'Venezuela',hn:'Honduras',gt:'Guatemala',
  sv:'El-Salvador',ni:'Nicaragua',cr:'Costa-Rica',pa:'Panama',cu:'Cuba',
  do:'Dominican-Republic',pr:'Puerto-Rico',ht:'Haiti',uy:'Uruguay',py:'Paraguay',
};

async function fetchOsac(browser, country) {
  const name = OSAC_COUNTRY_SLUGS[country];
  if (!name) return null;
  const url = `https://www.osac.gov/Country/${name}/Content`;
  console.log(`    OSAC ${country}…`);
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const text = await page.evaluate(() => document.body.innerText);
    const excerpt = extractSafety(text);
    if (!excerpt) return null;
    return {
      id: `osac_${country}`,
      source_name: 'OSAC — Overseas Security Advisory Council',
      source_class: 'advisory',
      url,
      published_date: new Date().toISOString().slice(0,7),
      license: 'US Government public domain',
      excerpt: excerpt.slice(0, 1200),
    };
  } catch (e) {
    console.warn(`      OSAC ${country}: ${e.message.slice(0,80)}`);
    return null;
  } finally {
    await page.close();
  }
}

// ── Numbeo (web scrape fallback when no API key) ──────────────────────────────

async function fetchNumbeoWeb(browser, cityName, country) {
  if (process.env.NUMBEO_API_KEY) return null; // handled by seo_fetch_sources.js
  const slug = cityName.replace(/ /g, '-');
  const url  = `https://www.numbeo.com/crime/in/${encodeURIComponent(slug)}`;
  console.log(`    Numbeo web ${cityName}…`);
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
    // Extract crime index and safety index from the rendered table
    const data = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table.table_indices tr'));
      const result = {};
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const label = cells[0].textContent.trim();
          const val   = cells[1].textContent.trim();
          if (/crime index/i.test(label))  result.crime  = val;
          if (/safety index/i.test(label)) result.safety = val;
        }
      }
      const contrib = document.querySelector('.contributor_info');
      result.contributors = contrib ? contrib.textContent.trim() : '';
      return result;
    });
    if (!data.crime) return null;
    const excerpt = `Numbeo crime index for ${cityName}: ${data.crime} (higher = more crime; world range 0–100). Safety index: ${data.safety || 'n/a'}. ${data.contributors}`.trim();
    return {
      id: `numbeo_web_${country}`,
      source_name: 'Numbeo Crime & Safety Index (web)',
      source_class: 'index',
      url: `https://www.numbeo.com/crime/in/${slug}`,
      published_date: new Date().toISOString().slice(0,7),
      license: 'Numbeo — attributed, not reproduced verbatim',
      excerpt: excerpt.slice(0, 600),
    };
  } catch (e) {
    console.warn(`      Numbeo ${cityName}: ${e.message.slice(0,80)}`);
    return null;
  } finally {
    await page.close();
  }
}

// ── Government crime stats (selected cities) ──────────────────────────────────
// SSP-SP, ISP-RJ, MinDefensa, PDI-Chile, Uruguay OSP → seo_fetch_sources.js (REST/CSV).
// Everything below needs JS rendering or was blocked by curl.

// Shared page-text cache — avoids scraping the same country portal N times.
const _pageCache = {};
async function cachedText(browser, url, waitMs = 3000) {
  if (_pageCache[url]) return _pageCache[url];
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(waitMs);
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g,' '));
    _pageCache[url] = text || '';
    return _pageCache[url];
  } catch { return ''; } finally { await page.close(); }
}

// Pull the most crime-relevant sentences (up to maxChars) from raw text.
function pickLines(text, keywords, maxChars = 900) {
  const re = new RegExp(keywords.join('|'), 'i');
  const sentences = text.split(/(?<=[.!?])\s+|;\s+|\n/);
  let out = '';
  for (const s of sentences) {
    const t = s.trim();
    if (t.length > 30 && t.length < 500 && re.test(t)) {
      if (out.length + t.length > maxChars) break;
      out += (out ? ' ' : '') + t;
    }
  }
  return out;
}

const CRIME_KW = ['homicid','femicid','robo','hurto','delito','criminalidad','secuestro','extorsión',
  'murder','theft','robbery','crime','safety','homicide','kidnap','assault'];

// ── Peru ──────────────────────────────────────────────────────────────────────
// INEI crime-stats index page — lists all crime categories tracked nationally.
const INEI_URL = 'https://www.inei.gob.pe/estadisticas/indice-tematico/crimes/';

// ── Central America ───────────────────────────────────────────────────────────
// sitiooij.poder-judicial.go.cr/estadisticas/ → 404; use the main OIJ portal instead.
const OIJ_URL    = 'https://www.poder-judicial.go.cr/oij/';
const PNC_GT_URL = 'https://www.pnc.gob.gt/';
const IUDPAS_URL = 'https://iudpas.unah.edu.hn/';

// Extract INEI category titles as a structured excerpt (page is an index, not raw data).
function ineiExtract(cityKw) {
  return async (browser, page) => {
    const rawText = page
      ? await page.evaluate(() => document.body.innerText).catch(() => '')
      : '';
    const text = rawText.length > 50 ? rawText : await cachedText(browser, INEI_URL);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 15 && l.length < 200);
    const crimeLines = lines.filter(l => /delito|denuncia|homicid|robo|crimen|víctima|violencia|femicid|secuestro/i.test(l));
    if (!crimeLines.length) return null;
    return 'INEI Perú — Estadísticas de Seguridad: ' + crimeLines.slice(0, 8).join('; ');
  };
}

const GOV_SOURCES = {

  // ── Peru: INEI national crime-statistics index ────────────────────────────────
  'lima':      { url: INEI_URL, source_name: 'INEI — Instituto Nacional de Estadística e Informática (Seguridad)', extract: ineiExtract('Lima') },
  'arequipa':  { url: INEI_URL, source_name: 'INEI — Instituto Nacional de Estadística e Informática (Seguridad)', extract: ineiExtract('Arequipa') },
  'cusco':     { url: INEI_URL, source_name: 'INEI — Instituto Nacional de Estadística e Informática (Seguridad)', extract: ineiExtract('Cusco') },
  'trujillo':  { url: INEI_URL, source_name: 'INEI — Instituto Nacional de Estadística e Informática (Seguridad)', extract: ineiExtract('Trujillo') },

  // ── Costa Rica: OIJ portal ────────────────────────────────────────────────────
  'sanjose': {
    url: OIJ_URL,
    source_name: 'OIJ — Organismo de Investigación Judicial (Costa Rica)',
    extract: async (browser, page) => {
      let text = await page.evaluate(() => document.body.innerText.replace(/\s+/g,' ')).catch(() => '');
      if (!text || text.length < 100) text = await cachedText(browser, OIJ_URL);
      return pickLines(text, ['homicid','San Jos','delito','robo','denuncia','violencia'], 900);
    },
  },

  // ── Guatemala: PNC national police portal ─────────────────────────────────────
  'guatemalacity': {
    url: PNC_GT_URL,
    source_name: 'PNC — Policía Nacional Civil de Guatemala',
    extract: async (browser, page) => {
      const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g,' ')).catch(() => '');
      return pickLines(text, ['homicid','Guatemala','delito','denuncia','robo','crimen','violencia'], 900);
    },
  },
  'antigua-guatemala': {
    url: PNC_GT_URL,
    source_name: 'PNC — Policía Nacional Civil de Guatemala',
    extract: async (browser) => {
      const text = await cachedText(browser, PNC_GT_URL);
      return pickLines(text, ['Antigua','Sacatep','homicid','delito','violencia'], 900);
    },
  },

  // ── Honduras: IUDPAS violence observatory ─────────────────────────────────────
  'tegucigalpa': {
    url: IUDPAS_URL,
    source_name: 'IUDPAS-UNAH — Observatorio de la Violencia (Honduras)',
    extract: async (browser, page) => {
      const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g,' ')).catch(() => '');
      return pickLines(text, ['homicid','Tegucigalpa','Francisco Moraz','violencia','muertes','delito'], 900);
    },
  },
};

async function fetchGovStat(browser, cityKey) {
  const cfg = GOV_SOURCES[cityKey];
  if (!cfg) return null;
  process.stdout.write(`    gov:${cityKey}…`);
  const page = await browser.newPage();
  let excerpt = null;
  try {
    await page.goto(cfg.url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);
    // extract(browser, page) — browser for cachedText calls, page for direct eval
    excerpt = await cfg.extract(browser, page);
  } catch (e) {
    console.warn(` FAIL: ${e.message.slice(0,80)}`);
  } finally {
    await page.close().catch(() => {});
  }
  if (!excerpt || excerpt.trim().length < 40) { console.log(' no data'); return null; }
  console.log(` OK (${excerpt.length} chars)`);
  return {
    id: `gov_${cityKey.replace(/-/g,'_')}`,
    source_name: cfg.source_name,
    source_class: 'crime_data',
    url: cfg.url,
    published_date: new Date().toISOString().slice(0,7),
    license: 'Official government data — public domain',
    excerpt: excerpt.slice(0, 1100),
  };
}

// ── Per-city assembly ─────────────────────────────────────────────────────────

const countryCache = {};

async function fetchForCity(browser, key) {
  const city    = CITIES[key];
  const country = city.country;
  process.stdout.write(`  ${key}…`);

  if (!countryCache[country]) {
    countryCache[country] = {};
    const [osac, au] = await Promise.all([
      fetchOsac(browser, country),
      fetchAustralia(browser, country),
    ]);
    if (osac) countryCache[country].osac = osac;
    if (au)   countryCache[country].australia = au;
  }

  const newSources = Object.values(countryCache[country]).filter(Boolean);

  // City-specific: Numbeo web (blocked even with stealth — kept for future)
  const numbeo = await fetchNumbeoWeb(browser, city.name, country);
  if (numbeo) newSources.push(numbeo);

  // City-specific: gov stats (selected cities only)
  const gov = await fetchGovStat(browser, key);
  if (gov) newSources.push(gov);

  if (!newSources.length) {
    console.log(' no new sources');
    return 0;
  }

  // Merge into existing source file
  const existingPath = path.join(OUT_DIR, `${key}.json`);
  let existing = [];
  if (fs.existsSync(existingPath)) {
    try { existing = JSON.parse(fs.readFileSync(existingPath, 'utf8')); } catch {}
  }

  // Append only new sources (by id)
  const existingIds = new Set(existing.map(s => s.id));
  for (const s of newSources) {
    if (!existingIds.has(s.id) || FORCE) {
      existing = existing.filter(e => e.id !== s.id);
      existing.push(s);
    }
  }

  fs.writeFileSync(existingPath, JSON.stringify(existing, null, 2));
  const added = newSources.length;
  console.log(` +${added} new sources (total ${existing.length})`);
  return added;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { chromium } = require('playwright-extra');
  const stealth = require('puppeteer-extra-plugin-stealth');
  chromium.use(stealth());

  if (AUDIT) {
    console.log('\n▸ Playwright source coverage audit\n');
    const keys = Object.keys(CITIES);
    for (const k of keys) {
      const p = path.join(OUT_DIR, `${k}.json`);
      if (!fs.existsSync(p)) continue;
      const src = JSON.parse(fs.readFileSync(p,'utf8'));
      const pw_src = src.filter(s => ['australia_dfat','osac_','numbeo_web_','gov_'].some(pfx => s.id.startsWith(pfx)));
      if (pw_src.length) console.log(`  ${k.padEnd(28)} ${pw_src.map(s=>s.id).join(', ')}`);
    }
    return;
  }

  const keys = TARGET ? [TARGET] : Object.keys(CITIES).filter(k => {
    if (FORCE) return true;
    const p = path.join(OUT_DIR, `${k}.json`);
    if (!fs.existsSync(p)) return true;
    const src = JSON.parse(fs.readFileSync(p,'utf8'));
    return !src.find(s => s.id.startsWith('australia_dfat'));
  });

  if (!keys.length) {
    console.log('All cities already have Playwright sources. Use --force to re-fetch.');
    return;
  }

  console.log(`\nLaunching Playwright (Chromium headless + stealth)…`);
  const browser = await chromium.launch({ headless: true });

  let total = 0;
  try {
    for (const key of keys) {
      const added = await fetchForCity(browser, key);
      total += added;
      await new Promise(r => setTimeout(r, 800));
    }
  } finally {
    await browser.close();
  }

  console.log(`\nDone. ${total} new Playwright-fetched sources added across ${keys.length} cities.`);
  console.log('Re-run seo_synthesize.js or npm run pipeline to incorporate new sources.');
}

main().catch(e => { console.error(e); process.exit(1); });
