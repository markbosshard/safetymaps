#!/usr/bin/env node
// scripts/seo_sov.js — AI Share-of-Voice tracker (SEO_GEO §G2).
//
//   node scripts/seo_sov.js             run all probes, print summary
//   node scripts/seo_sov.js --log       also append to seo/sov-log.jsonl
//   node scripts/seo_sov.js --cities 5  limit to first N cities
//
// Probes each AI engine with "is {city} safe" for a sample of covered cities,
// looks for "latamcrimemap.com" or "Latam Crime Map" in the response,
// and logs citation presence + timestamp.
//
// Requires ANTHROPIC_API_KEY. Other engines (ChatGPT, Perplexity, Gemini)
// need their own keys: OPENAI_API_KEY, PERPLEXITY_API_KEY.
// Engines with no key are skipped gracefully.

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const ROOT    = path.join(__dirname, '..');
const LOG_FILE = path.join(ROOT, 'seo', 'sov-log.jsonl');
const CITIES  = JSON.parse(fs.readFileSync(path.join(ROOT, 'cities.json'), 'utf8'));

const ARGS     = process.argv.slice(2);
const DO_LOG   = ARGS.includes('--log');
const MAX_CITIES = parseInt((ARGS.find(a => a.startsWith('--cities=')) || '').replace('--cities=','') || (ARGS[ARGS.indexOf('--cities')+1]) || '10', 10) || 10;

// Sample cities to probe (spread across countries and risk tiers)
const PROBE_CITIES = [
  'sao-paulo','mexico-city','buenos-aires','medellin','rio-de-janeiro',
  'bogota','santiago','lima','caracas','havana',
  'guatemalacity','tegucigalpa','panamacity','asuncion','montevideo',
].slice(0, MAX_CITIES);

const SITE_SIGNAL = /latamcrimemap\.com|latam crime map/i;

// ── Engine probes ─────────────────────────────────────────────────────────────

async function probeAnthropic(query) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: query }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve(j.content?.[0]?.text || '');
        } catch { resolve(''); }
      });
    });
    req.on('error', () => resolve(''));
    req.write(body);
    req.end();
  });
}

async function probeOpenAI(query) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    messages: [{ role: 'user', content: query }],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'authorization': `Bearer ${key}`,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve(j.choices?.[0]?.message?.content || '');
        } catch { resolve(''); }
      });
    });
    req.on('error', () => resolve(''));
    req.write(body);
    req.end();
  });
}

async function probePerplexity(query) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;

  const body = JSON.stringify({
    model: 'llama-3.1-sonar-small-128k-online',
    max_tokens: 300,
    messages: [{ role: 'user', content: query }],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.perplexity.ai',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'authorization': `Bearer ${key}`,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve(j.choices?.[0]?.message?.content || '');
        } catch { resolve(''); }
      });
    });
    req.on('error', () => resolve(''));
    req.write(body);
    req.end();
  });
}

const ENGINES = [
  { name: 'Claude (Anthropic)',  probe: probeAnthropic },
  { name: 'ChatGPT (OpenAI)',    probe: probeOpenAI },
  { name: 'Perplexity',          probe: probePerplexity },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const today    = new Date().toISOString().slice(0, 10);
  const results  = [];
  let   cited    = 0;
  let   probed   = 0;
  let   skipped  = 0;

  console.log(`\n▸ AI Share-of-Voice probe — ${today}`);
  console.log(`  Probing ${PROBE_CITIES.length} cities × ${ENGINES.length} engines\n`);

  for (const key of PROBE_CITIES) {
    const city = CITIES[key];
    if (!city) continue;
    const query = `Is ${city.name} safe for tourists?`;

    for (const engine of ENGINES) {
      process.stdout.write(`  ${engine.name.padEnd(22)} ${city.name.padEnd(22)} `);
      const response = await engine.probe(query);

      if (response === null) {
        process.stdout.write('(no key)\n');
        skipped++;
        continue;
      }

      probed++;
      const mentioned = SITE_SIGNAL.test(response);
      if (mentioned) cited++;
      process.stdout.write(mentioned ? '✓ cited\n' : '✗ not cited\n');

      const record = {
        date: today,
        city: key,
        city_name: city.name,
        engine: engine.name,
        query,
        cited: mentioned,
        response_snippet: response.slice(0, 200),
      };
      results.push(record);

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const citedPct = probed ? Math.round(cited / probed * 100) : 0;
  console.log(`\n  Summary: ${cited}/${probed} responses cited Latam Crime Map (${citedPct}%)`);
  if (skipped) console.log(`  ${skipped} probes skipped (no API key)`);
  console.log('\n  Add OPENAI_API_KEY and/or PERPLEXITY_API_KEY to probe those engines.');

  if (DO_LOG && results.length) {
    const logDir = path.join(ROOT, 'seo');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const lines = results.map(r => JSON.stringify(r)).join('\n') + '\n';
    fs.appendFileSync(LOG_FILE, lines);
    console.log(`\n  Appended ${results.length} records to seo/sov-log.jsonl`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
