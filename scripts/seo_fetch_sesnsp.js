#!/usr/bin/env node
// scripts/seo_fetch_sesnsp.js — Download and parse SESNSP state-level crime data for all Mexican cities.
// Uses Playwright to authenticate with SharePoint, downloads the ZIP, parses with Python.
//
//   node scripts/seo_fetch_sesnsp.js          parse and update all Mexican city source files
//   node scripts/seo_fetch_sesnsp.js --dry     print excerpts, don't write

'use strict';

const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT    = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'seo', 'sources');
const DRY     = process.argv.includes('--dry');

function execAsync(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 60000, ...opts }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message).slice(0, 300)));
      resolve(stdout);
    });
  });
}

// State → array of city keys (those in cities.json)
const STATE_CITIES = {
  'Aguascalientes':     ['aguascalientes'],
  'Baja California':    ['tijuana', 'mexicali'],
  'Baja California Sur':['los-cabos'],
  'Chihuahua':          ['ciudadjuarez'],
  'Ciudad de México':   ['mexico-city'],
  'Coahuila de Zaragoza':['saltillo', 'torreon'],
  'Guanajuato':         ['leon'],
  'Jalisco':            ['guadalajara', 'puerto-vallarta'],
  'Morelos':            ['cuernavaca'],
  'Nuevo León':         ['monterrey'],
  'Oaxaca':             ['oaxaca-city'],
  'Puebla':             ['puebla'],
  'Querétaro':          ['queretaro'],
  'Quintana Roo':       ['cancun', 'playa-del-carmen'],
  'San Luis Potosí':    ['sanluispotosi'],
  'Sinaloa':            ['culiacan'],
  'México':             ['toluca'],
  'Yucatán':            ['merida'],
};

// City names for display (state → city name for description)
const CITY_NAME = {
  'Baja California':     { 'tijuana':'Tijuana', 'mexicali':'Mexicali' },
  'Coahuila de Zaragoza':{ 'saltillo':'Saltillo', 'torreon':'Torreón' },
  'Jalisco':             { 'guadalajara':'Guadalajara', 'puerto-vallarta':'Puerto Vallarta' },
  'Quintana Roo':        { 'cancun':'Cancún', 'playa-del-carmen':'Playa del Carmen' },
  'San Luis Potosí':     { 'san-luis-potosi':'San Luis Potosí', 'sanluispotosi':'San Luis Potosí' },
};

const SESNSP_SHAREPOINT = 'https://sspcgob-my.sharepoint.com/:u:/g/personal/cni_sspc_gob_mx/IQAr2ntQkV64Qp9ay-j9gPcpAZpdYGHlBWmQcKXw6gZ5hlI?e=kvbjyH';
const SESNSP_URL_CANONICAL = 'https://www.gob.mx/sesnsp/acciones-y-programas/datos-abiertos-de-incidencia-delictiva';
const ZIP_PATH = '/tmp/sesnsp_estatal.zip';

async function downloadViaPlaywright() {
  const { chromium } = require('playwright-extra');
  const stealth = require('puppeteer-extra-plugin-stealth');
  chromium.use(stealth());

  console.log('Launching browser to download SESNSP data...');
  const br = await chromium.launch({ headless: true });
  const ctx = await br.newContext({ acceptDownloads: true });
  const pg = await ctx.newPage();
  try {
    await pg.goto(SESNSP_SHAREPOINT, { waitUntil: 'networkidle', timeout: 30000 });
    await pg.waitForTimeout(3000);
    const dlUrl = SESNSP_SHAREPOINT + '&download=1';
    const resp = await pg.request.get(dlUrl, { timeout: 120000 });
    const body = await resp.body();
    if (body.length < 10000 || body[0] !== 0x50) throw new Error('Download returned HTML instead of ZIP');
    fs.writeFileSync(ZIP_PATH, body);
    console.log(`Downloaded ${body.length} bytes → ${ZIP_PATH}`);
    return true;
  } finally {
    await pg.close().catch(() => {});
    await br.close().catch(() => {});
  }
}

async function parseCSV() {
  const pyScript = `
import sys, csv, io, json, collections
from zipfile_deflate64 import ZipFile

z = ZipFile('${ZIP_PATH}')
fname = z.namelist()[0]
data = z.read(fname)
text = data.decode('latin-1')
reader = csv.DictReader(io.StringIO(text))
rows = list(reader)

MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

def sum_year(state_rows, tipo_re, year):
    total = 0
    for r in state_rows:
        if r.get('Año') == year and tipo_re.lower() in r.get('Subtipo de delito','').lower():
            for m in MONTHS:
                try: total += int(r.get(m) or 0)
                except: pass
    return total

# Group by state
by_state = collections.defaultdict(list)
for r in rows:
    by_state[r['Entidad']].append(r)

result = {}
for state, srows in by_state.items():
    hom24 = sum_year(srows, 'homicidio doloso', '2024')
    hom25 = sum_year(srows, 'homicidio doloso', '2025')
    rob24 = sum_year(srows, 'robo con violencia', '2024') + sum_year(srows, 'robo a transeúnte', '2024')
    rob25 = sum_year(srows, 'robo con violencia', '2025') + sum_year(srows, 'robo a transeúnte', '2025')
    sec24 = sum_year(srows, 'secuestro', '2024')
    sec25 = sum_year(srows, 'secuestro', '2025')
    ext24 = sum_year(srows, 'extorsión', '2024')
    ext25 = sum_year(srows, 'extorsión', '2025')
    result[state] = {
        'hom24': hom24, 'hom25': hom25,
        'rob24': rob24, 'rob25': rob25,
        'sec24': sec24, 'sec25': sec25,
        'ext24': ext24, 'ext25': ext25,
    }

print(json.dumps(result))
`;
  const pyPath = '/tmp/parse_sesnsp.py';
  fs.writeFileSync(pyPath, pyScript);
  const out = await execAsync(`python3 "${pyPath}"`);
  return JSON.parse(out.trim());
}

function buildExcerpt(state, data, cityNote) {
  const { hom24, hom25, rob24, rob25, sec24, sec25, ext24, ext25 } = data;
  const trend = hom25 < hom24 ? '↓' : hom25 > hom24 ? '↑' : '→';
  let s = `SESNSP — ${state}${cityNote ? ` (${cityNote})` : ''}: `;
  s += `Homicidios dolosos: 2025: ${hom25} (2024: ${hom24}) ${trend}.`;
  if (rob25 > 0) s += ` Robos con violencia: 2025: ${rob25} (2024: ${rob24}).`;
  if (sec25 > 0 || sec24 > 0) s += ` Secuestros: 2025: ${sec25} (2024: ${sec24}).`;
  if (ext25 > 0 || ext24 > 0) s += ` Extorsiones: 2025: ${ext25} (2024: ${ext24}).`;
  s += ' Fuente: Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública (SESNSP), Registro Nacional de Incidencia Delictiva.';
  return s;
}

async function run() {
  // Use cached ZIP if recent (< 7 days)
  const zipExists = fs.existsSync(ZIP_PATH);
  const zipAge = zipExists ? (Date.now() - fs.statSync(ZIP_PATH).mtimeMs) / 86400000 : 999;
  if (!zipExists || zipAge > 7) {
    await downloadViaPlaywright();
  } else {
    console.log(`Using cached ZIP (${zipAge.toFixed(1)} days old)`);
  }

  console.log('Parsing SESNSP CSV...');
  const stateData = await parseCSV();
  console.log(`Parsed ${Object.keys(stateData).length} states`);

  const CITIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'cities.json'), 'utf8'));
  let updated = 0;

  for (const [state, cities] of Object.entries(STATE_CITIES)) {
    const data = stateData[state];
    if (!data) { console.warn(`  No data for state: ${state}`); continue; }

    for (const cityKey of cities) {
      if (!CITIES[cityKey]) continue; // city not in our dataset
      const cityNames = CITY_NAME[state];
      const cityNote = cityNames ? cityNames[cityKey] : null;
      const excerpt = buildExcerpt(state, data, cityNote);

      if (DRY) {
        console.log(`\n${cityKey}:\n  ${excerpt}`);
        continue;
      }

      const srcPath = path.join(SRC_DIR, `${cityKey}.json`);
      let sources = [];
      if (fs.existsSync(srcPath)) {
        try { sources = JSON.parse(fs.readFileSync(srcPath, 'utf8')); } catch {}
      }

      const id = `sesnsp_mx_${state.toLowerCase().replace(/[^a-z]/g,'_').replace(/_+/g,'_')}`;
      sources = sources.filter(s => s.id !== id);
      sources.push({
        id,
        source_name: `SESNSP — Incidencia Delictiva Fuero Común (${state})`,
        source_class: 'crime_data',
        url: SESNSP_URL_CANONICAL,
        published_date: new Date().toISOString().slice(0, 7),
        license: 'Datos Abiertos — Secretariado Ejecutivo SESNSP (CC BY 4.0)',
        excerpt,
      });
      fs.writeFileSync(srcPath, JSON.stringify(sources, null, 2));
      console.log(`  ✓ ${cityKey} — ${state}`);
      updated++;
    }
  }

  if (!DRY) {
    console.log(`\nUpdated ${updated} city source files.`);
    console.log('Run: node scripts/seo_synthesize.js && npm run build');
  }
}

run().catch(e => { console.error(e); process.exit(1); });
