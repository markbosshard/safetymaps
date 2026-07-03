#!/usr/bin/env node
// scripts/seo_pipeline.js — A1–A5 LLM consolidation + verification pipeline.
//
//   node scripts/seo_pipeline.js [city-key]   run for one city
//   node scripts/seo_pipeline.js --all        run for all cities with source files
//   node scripts/seo_pipeline.js --audit      print coverage report (no generation)
//
// Requires:
//   ANTHROPIC_API_KEY env var
//   seo/sources/{city}.json — per-city source excerpts (see format below)
//
// Outputs:
//   seo/content/{city}.json — verified, structured content (consumed by seo_pages.js)
//   seo/logs/{city}-{date}.json — per-run audit log (sources used, claims dropped, confidence)
//
// Source file format (seo/sources/{city}.json):
// [
//   {
//     "id": "osac_brazil",
//     "source_name": "OSAC — Brazil",
//     "url": "https://www.osac.gov/Country/Brazil",
//     "published_date": "2025-01",
//     "license": "public domain",
//     "excerpt": "Armed robbery and vehicle hijacking remain the most reported crimes..."
//   },
//   ...
// ]
//
// Output schema (seo/content/{city}.json):
// {
//   "city": "sao-paulo",
//   "confidence": "high" | "limited",
//   "generated_at": "2026-07-03",
//   "verdict": { "text": "...", "sources": ["osac_brazil", "ssp_sp"] },
//   "reconciliation": [ { "text": "...", "sources": ["numbeo"] } ],
//   "qa": [ { "q": "Is {city} safe at night?", "a": "...", "sources": ["reddit","fcdo"] } ],
//   "coverage": { "classes_present": [...], "gaps": [...] },
//   "claims_dropped": 0,
//   "bias_rejects": 0
// }
//
// Pipeline stages (SEO_GEO.md §2A):
//   Stage 1 — Ingest & normalize sources (source density, recency, class mapping)
//   Stage 2 — Grounded synthesis (LLM generator, excerpts-only, no world knowledge)
//   Stage 3 — Verify / double-check (entailment critic, bias filter, reconciliation check)
//   Stage 4 — Emit verified structured content

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

const ROOT    = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'seo', 'sources');
const OUT_DIR = path.join(ROOT, 'seo', 'content');
const LOG_DIR = path.join(ROOT, 'seo', 'logs');
const CITIES  = JSON.parse(fs.readFileSync(path.join(ROOT, 'cities.json'), 'utf8'));

const API_KEY  = process.env.ANTHROPIC_API_KEY;
const MODEL    = 'claude-sonnet-4-6';
const TODAY    = new Date().toISOString().slice(0, 10);

// Source classes for density scoring (SEO_GEO §2)
const SOURCE_CLASSES = ['advisory', 'crime_data', 'index', 'community', 'editorial'];

// Min source density to emit a "high" confidence page (vs "limited")
const MIN_DENSITY = 2; // at least 2 source classes present

// ── API helper ────────────────────────────────────────────────────────────────

function callClaude(systemPrompt, userPrompt) {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
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
          if (j.error) return reject(new Error(j.error.message));
          resolve(j.content[0].text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Stage 1: Ingest & normalize ───────────────────────────────────────────────

function ingestSources(cityKey) {
  const srcPath = path.join(SRC_DIR, `${cityKey}.json`);
  if (!fs.existsSync(srcPath)) return null;

  const sources = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const classesPresent = [...new Set(sources.map(s => s.source_class).filter(Boolean))];
  const density = classesPresent.length;
  const gaps = SOURCE_CLASSES.filter(c => !classesPresent.includes(c));

  return {
    sources,
    density,
    classesPresent,
    gaps,
    confidence: density >= MIN_DENSITY ? 'high' : 'limited',
  };
}

// ── Stage 2: Grounded synthesis ───────────────────────────────────────────────

const GENERATOR_SYSTEM = `You are a travel safety synthesizer for LatamCrimeMap.
Your job is to consolidate ONLY the provided source excerpts into structured safety content for a city.

CRITICAL RULES:
1. Use ONLY information from the provided excerpts. Do not use your own world knowledge to fill gaps.
2. Every factual claim in your output MUST cite the source id(s) it came from.
3. A claim with no source id MUST be omitted.
4. Apply events-not-feelings discipline: describe incidents and conditions, never who lives somewhere. Drop any demographic characterization from sources.
5. RECONCILE sources: when they agree, say so; when they conflict, state both positions.
6. Output valid JSON only — no prose outside the JSON.

Output schema:
{
  "verdict": { "text": "...", "sources": ["source_id1", ...] },
  "reconciliation": [ { "text": "...", "sources": ["source_id1", ...] } ],
  "qa": [
    { "q": "Is {city} safe for tourists?", "a": "...", "sources": ["source_id1"] },
    { "q": "Is {city} safe at night?", "a": "...", "sources": [...] },
    { "q": "What are the safest areas in {city}?", "a": "...", "sources": [...] },
    { "q": "What are the main risks for visitors to {city}?", "a": "...", "sources": [...] }
  ],
  "coverage_note": "..."
}`;

async function synthesize(cityKey, ingest) {
  const city = CITIES[cityKey];
  const excerptBlock = ingest.sources.map(s =>
    `[${s.id}] ${s.source_name} (${s.published_date || 'n/d'}):\n${s.excerpt}`
  ).join('\n\n');

  const userPrompt = `City: ${city.name} (${city.country.toUpperCase()})

Source excerpts:
${excerptBlock}

Generate the JSON output following the schema exactly. The verdict must be definition-first (answer in the first sentence). Reconcile where sources agree or conflict. If a question cannot be answered from the excerpts, omit it from the qa array.`;

  const raw = await callClaude(GENERATOR_SYSTEM, userPrompt);

  // Extract JSON from response (may be wrapped in ```json ... ```)
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error('Generator did not return JSON');
  return JSON.parse(jsonMatch[1]);
}

// ── Stage 3: Verify ───────────────────────────────────────────────────────────

const CRITIC_SYSTEM = `You are a fact-checking critic for travel safety content.
For each claim + cited excerpt pair, determine if the excerpt actually supports the claim.
Output valid JSON only.

For each item return:
{ "verdict": "yes" | "partial" | "no", "reason": "one sentence" }`;

async function entailmentCheck(claim, excerpts, sourceMap) {
  if (!claim.sources || !claim.sources.length) return { verdict: 'no', reason: 'no source cited' };

  const excerptText = claim.sources.map(id => {
    const src = sourceMap[id];
    return src ? `[${id}]: ${src.excerpt}` : `[${id}]: NOT FOUND`;
  }).join('\n\n');

  const userPrompt = `Claim: "${claim.text}"

Cited excerpts:
${excerptText}

Does the cited excerpt support this claim? Output: { "verdict": "yes"|"partial"|"no", "reason": "..." }`;

  const raw = await callClaude(CRITIC_SYSTEM, userPrompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { verdict: 'partial', reason: 'critic parse error' };
  return JSON.parse(jsonMatch[0]);
}

const BIAS_PATTERN = /\b(people|residents|locals|population|demographics|ethnic|race|racial|class|wealthy|poor|slum|ghetto|favela residents|gang members|criminal element|who live(s)? there)\b/i;

function biasCheck(text) {
  return BIAS_PATTERN.test(text);
}

async function verify(generated, ingest) {
  const sourceMap = {};
  ingest.sources.forEach(s => { sourceMap[s.id] = s; });

  let claimsDropped = 0;
  let biasRejects   = 0;

  // Check verdict
  const verdictCheck = await entailmentCheck(generated.verdict, ingest.sources, sourceMap);
  if (verdictCheck.verdict === 'no') {
    generated.verdict.text = ''; // will trigger limited downgrade
    claimsDropped++;
  }
  if (biasCheck(generated.verdict.text)) {
    generated.verdict.text = generated.verdict.text.replace(BIAS_PATTERN, '[conditions in the area]');
    biasRejects++;
  }

  // Check reconciliation paragraphs
  const verifiedReconciliation = [];
  for (const r of (generated.reconciliation || [])) {
    const check = await entailmentCheck(r, ingest.sources, sourceMap);
    if (check.verdict === 'no') { claimsDropped++; continue; }
    if (biasCheck(r.text)) { r.text = r.text.replace(BIAS_PATTERN, '[conditions in the area]'); biasRejects++; }
    verifiedReconciliation.push(r);
  }
  generated.reconciliation = verifiedReconciliation;

  // Check Q&A
  const verifiedQA = [];
  for (const qa of (generated.qa || [])) {
    const check = await entailmentCheck({ text: qa.a, sources: qa.sources }, ingest.sources, sourceMap);
    if (check.verdict === 'no') { claimsDropped++; continue; }
    if (biasCheck(qa.a)) { qa.a = qa.a.replace(BIAS_PATTERN, '[conditions in the area]'); biasRejects++; }
    verifiedQA.push(qa);
  }
  generated.qa = verifiedQA;

  // Downgrade if too much was dropped
  const totalOriginal = 1 + (generated.reconciliation?.length || 0) + (generated.qa?.length || 0) + claimsDropped;
  const dropRate = claimsDropped / Math.max(totalOriginal, 1);
  const confidence = !generated.verdict.text || dropRate > 0.4 ? 'limited' : ingest.confidence;

  return { claimsDropped, biasRejects, confidence };
}

// ── Stage 4: Emit ─────────────────────────────────────────────────────────────

function emit(cityKey, generated, ingest, verifyResult) {
  const output = {
    city: cityKey,
    confidence: verifyResult.confidence,
    generated_at: TODAY,
    verdict: generated.verdict,
    reconciliation: generated.reconciliation || [],
    qa: generated.qa || [],
    coverage: {
      classes_present: ingest.classesPresent,
      gaps: ingest.gaps,
      coverage_note: generated.coverage_note || '',
    },
    claims_dropped: verifyResult.claimsDropped,
    bias_rejects: verifyResult.biasRejects,
  };

  for (const dir of [OUT_DIR, LOG_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(path.join(OUT_DIR, `${cityKey}.json`), JSON.stringify(output, null, 2));

  const log = {
    city: cityKey,
    run_at: new Date().toISOString(),
    confidence: verifyResult.confidence,
    claims_dropped: verifyResult.claimsDropped,
    bias_rejects: verifyResult.biasRejects,
    sources_used: ingest.sources.map(s => s.id),
    classes_present: ingest.classesPresent,
    gaps: ingest.gaps,
  };
  fs.writeFileSync(path.join(LOG_DIR, `${cityKey}-${TODAY}.json`), JSON.stringify(log, null, 2));

  return output;
}

// ── Coverage audit ────────────────────────────────────────────────────────────

function audit() {
  const keys = Object.keys(CITIES);
  let withSources = 0, withContent = 0, limited = 0;

  console.log('\n▸ SEO pipeline coverage audit\n');
  console.log('  City                     Sources  Content  Confidence');
  console.log('  ─────────────────────────────────────────────────────');

  for (const key of keys) {
    const hasSrc = fs.existsSync(path.join(SRC_DIR, `${key}.json`));
    const contentPath = path.join(OUT_DIR, `${key}.json`);
    const hasCont = fs.existsSync(contentPath);

    if (hasSrc) withSources++;
    if (hasCont) {
      withContent++;
      const c = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
      if (c.confidence === 'limited') limited++;
    }

    if (hasSrc || hasCont) {
      const conf = hasCont ? JSON.parse(fs.readFileSync(contentPath, 'utf8')).confidence : '—';
      console.log(`  ${key.padEnd(25)} ${hasSrc ? '✓' : '✗'}        ${hasCont ? '✓' : '✗'}       ${conf}`);
    }
  }

  console.log(`\n  Total cities: ${keys.length}`);
  console.log(`  With source files: ${withSources}`);
  console.log(`  With generated content: ${withContent} (${limited} limited)`);
  console.log(`  Without sources (limited pages): ${keys.length - withSources}`);
  console.log('\n  To add a city: create seo/sources/{city}.json with source excerpts,');
  console.log('  then run: node scripts/seo_pipeline.js {city}');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runCity(cityKey) {
  if (!CITIES[cityKey]) { console.error(`Unknown city: ${cityKey}`); process.exit(1); }

  console.log(`\n[pipeline] ${cityKey} — ${CITIES[cityKey].name}`);

  // Stage 1
  const ingest = ingestSources(cityKey);
  if (!ingest) {
    console.log(`  Stage 1: no source file at seo/sources/${cityKey}.json — skipping`);
    return;
  }
  console.log(`  Stage 1: ${ingest.sources.length} sources, density ${ingest.density}/${SOURCE_CLASSES.length}, classes: ${ingest.classesPresent.join(', ')}`);
  if (ingest.gaps.length) console.log(`           gaps: ${ingest.gaps.join(', ')}`);

  if (!API_KEY) {
    console.log('  Stage 2: ANTHROPIC_API_KEY not set — skipping synthesis (will emit limited page)');
    return;
  }

  // Stage 2
  console.log('  Stage 2: synthesizing…');
  let generated;
  try {
    generated = await synthesize(cityKey, ingest);
  } catch (e) {
    console.error('  Stage 2 error:', e.message);
    return;
  }

  // Stage 3
  console.log('  Stage 3: verifying claims…');
  const verifyResult = await verify(generated, ingest);
  console.log(`           dropped ${verifyResult.claimsDropped} claims, ${verifyResult.biasRejects} bias fixes, confidence: ${verifyResult.confidence}`);

  // Stage 4
  const output = emit(cityKey, generated, ingest, verifyResult);
  console.log(`  Stage 4: wrote seo/content/${cityKey}.json (${output.confidence})`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--audit')) {
    audit();
    return;
  }

  if (args.includes('--all')) {
    const keys = Object.keys(CITIES).filter(k => fs.existsSync(path.join(SRC_DIR, `${k}.json`)));
    if (!keys.length) {
      console.log('No source files found in seo/sources/. Add {city}.json files to run the pipeline.');
      audit();
      return;
    }
    for (const key of keys) await runCity(key);
    return;
  }

  const cityKey = args[0];
  if (!cityKey) {
    console.log('Usage:');
    console.log('  node scripts/seo_pipeline.js <city-key>   run for one city');
    console.log('  node scripts/seo_pipeline.js --all        run for all cities with source files');
    console.log('  node scripts/seo_pipeline.js --audit      print coverage report');
    audit();
    return;
  }

  await runCity(cityKey);
}

main().catch(e => { console.error(e); process.exit(1); });
