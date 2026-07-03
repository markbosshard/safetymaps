#!/usr/bin/env node
// scripts/seo_pages.js — generate SEO/GEO content pages for every city.
//
//   node scripts/seo_pages.js           emit all city pages + robots/sitemap/llms.txt
//   node scripts/seo_pages.js --dry     print list of pages that would be emitted, don't write
//
// Architecture (SEO_GEO.md §2B):
//   /{city}           → {city}.html   city content page (replaces the SPA-copy)
//   /method/          → method/index.html
//   /sitemap.xml      → sitemap.xml
//   /llms.txt         → llms.txt
//   robots.txt        → copied from robots.txt (already exists)
//
// Content tiers:
//   "rich"    — seo/content/{city}.json present (LLM-synthesized via seo_pipeline.js)
//   "limited" — no LLM content; page shows tier + source links + FAQ from district data
//
// The "limited" tier is still genuinely useful (honest safety tier, named districts,
// real source links, country advisory) and satisfies A3. "Rich" layers on top when
// sources and ANTHROPIC_API_KEY are available (see scripts/seo_pipeline.js).

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..');
const SEO_DIR = path.join(ROOT, 'seo');
const SITE    = 'https://latamcrimemap.com';
const BUILD_DATE = (process.env.BUILD_DATE || new Date().toISOString().slice(0, 10));

const DRY = process.argv.includes('--dry');

// ── Load data ──────────────────────────────────────────────────────────────────

const CITIES     = JSON.parse(fs.readFileSync(path.join(ROOT, 'cities.json'), 'utf8'));
const CITY_KEYS  = Object.keys(CITIES);

// ── Country context (US State Dept advisory levels, as of 2025) ────────────────

const ADVISORIES = {
  br: { level: 2, label: 'Exercise Increased Caution', theme: 'crime, particularly in urban areas' },
  mx: { level: 2, label: 'Exercise Increased Caution', theme: 'crime and kidnapping in certain regions' },
  ar: { level: 1, label: 'Exercise Normal Precautions', theme: 'petty crime in tourist areas' },
  co: { level: 2, label: 'Exercise Increased Caution', theme: 'crime, civil unrest, and terrorism' },
  pe: { level: 2, label: 'Exercise Increased Caution', theme: 'crime and civil unrest' },
  cl: { level: 2, label: 'Exercise Increased Caution', theme: 'civil unrest and petty crime' },
  ec: { level: 2, label: 'Exercise Increased Caution', theme: 'crime' },
  bo: { level: 2, label: 'Exercise Increased Caution', theme: 'crime and civil unrest' },
  ve: { level: 4, label: 'Do Not Travel',               theme: 'crime, civil unrest, kidnapping, and arbitrary arrest' },
  hn: { level: 3, label: 'Reconsider Travel',           theme: 'crime' },
  gt: { level: 3, label: 'Reconsider Travel',           theme: 'crime' },
  sv: { level: 2, label: 'Exercise Increased Caution', theme: 'crime' },
  ni: { level: 2, label: 'Exercise Increased Caution', theme: 'crime and civil unrest' },
  cr: { level: 2, label: 'Exercise Increased Caution', theme: 'crime' },
  pa: { level: 2, label: 'Exercise Increased Caution', theme: 'crime' },
  cu: { level: 2, label: 'Exercise Increased Caution', theme: 'arbitrary enforcement of local laws' },
  do: { level: 2, label: 'Exercise Increased Caution', theme: 'crime' },
  pr: { level: 0, label: 'US Territory',               theme: 'same precautions as any major US city' },
  ht: { level: 4, label: 'Do Not Travel',               theme: 'kidnapping, crime, and civil unrest' },
  uy: { level: 1, label: 'Exercise Normal Precautions', theme: 'petty crime in urban areas' },
  py: { level: 1, label: 'Exercise Normal Precautions', theme: 'crime in certain areas' },
};

const COUNTRY_NAMES = {
  br:'Brazil',mx:'Mexico',ar:'Argentina',co:'Colombia',pe:'Peru',cl:'Chile',
  ec:'Ecuador',bo:'Bolivia',ve:'Venezuela',hn:'Honduras',gt:'Guatemala',
  sv:'El Salvador',ni:'Nicaragua',cr:'Costa Rica',pa:'Panama',cu:'Cuba',
  do:'Dominican Republic',pr:'Puerto Rico',ht:'Haiti',uy:'Uruguay',py:'Paraguay',
};

// ── Scoring helpers ────────────────────────────────────────────────────────────

function cityScore(city) {
  const scores = city.districts.map(d => d.score).filter(s => s != null);
  if (!scores.length) return null;
  const uniq = [...new Set(scores)];
  if (uniq.length === 1) return uniq[0];
  // continuous / multi-tier: average
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function tierName(s) {
  if (s == null) return 'Not assessed';
  if (s <= 2.5)  return 'Safe';
  if (s <= 5)    return 'Moderate';
  if (s <= 7.5)  return 'Caution';
  return 'Avoid';
}

function tierColor(s) {
  if (s == null) return '#5b6472';
  if (s <= 2.5)  return '#16b87f';
  if (s <= 5)    return '#d6b609';
  if (s <= 7.5)  return '#f38b10';
  return '#c83233';
}

function tierProse(score, cityName, country) {
  const adv = ADVISORIES[country] || ADVISORIES['br'];
  if (score == null) return `${cityName} is included on the Latam Crime Map. Consolidated safety data is being compiled.`;
  if (score <= 2.5) return `${cityName} is among the safer destinations in Latin America. The US State Dept advises "${adv.label}" for ${COUNTRY_NAMES[country] || 'this country'} overall, though city-level conditions here are generally more favourable than the country average.`;
  if (score <= 5)   return `${cityName} has a moderate safety profile. The US State Dept advises "${adv.label}" for ${COUNTRY_NAMES[country] || 'this country'} due to ${adv.theme}. Many visitor-friendly areas exist, but awareness of surroundings is warranted.`;
  if (score <= 7.5) return `${cityName} requires heightened vigilance. The US State Dept advises "${adv.label}" for ${COUNTRY_NAMES[country] || 'this country'} due to ${adv.theme}. Specific neighbourhoods and times of day vary significantly — check district-level detail before travelling.`;
  return `${cityName} is rated high-risk by major travel safety sources. The US State Dept advises "${adv.label}" for ${COUNTRY_NAMES[country] || 'this country'} due to ${adv.theme}. Extra precautions are strongly recommended; consult the sources listed below before travel.`;
}

// ── District helpers ──────────────────────────────────────────────────────────

function districtSummary(city) {
  const districts = city.districts;
  if (!districts || districts.length <= 1) return null;
  const scored = districts.filter(d => d.score != null);
  if (!scored.length) return null;
  const uniqScores = [...new Set(scored.map(d => d.score))];
  if (uniqScores.length === 1) {
    // all same score — just mention count
    return { type: 'uniform', count: districts.length, score: uniqScores[0] };
  }
  const safest  = [...scored].sort((a, b) => a.score - b.score).slice(0, 3).map(d => ({ name: d.name, score: d.score }));
  const highest = [...scored].sort((a, b) => b.score - a.score).slice(0, 3).map(d => ({ name: d.name, score: d.score }));
  return { type: 'varied', count: districts.length, safest, highest };
}

// ── FAQ builder ───────────────────────────────────────────────────────────────

function buildFAQ(city, key, score, ds) {
  const name = city.name;
  const tier = tierName(score);
  const adv  = ADVISORIES[city.country] || {};
  const faq  = [];

  // Q1: safe for tourists?
  let a1;
  if (score == null)  a1 = `${name} is on our radar but full consolidated data is still being compiled. Check our primary sources below for the latest official guidance.`;
  else if (score <= 2.5) a1 = `${name} is generally considered safe for tourists by most major travel advisories. Standard urban precautions — keeping valuables out of sight and being aware of your surroundings — are sufficient for most visitors.`;
  else if (score <= 5)   a1 = `${name} is safe for tourists who exercise reasonable vigilance. Stay in well-visited areas, avoid displaying expensive electronics or jewellery, and be cautious after dark in less-familiar neighbourhoods.`;
  else if (score <= 7.5) a1 = `${name} requires heightened awareness for tourists. Opportunistic theft is the most common risk. Stick to established tourist areas, use registered taxis or ride-hailing apps, and avoid unfamiliar areas at night.`;
  else                   a1 = `${name} is considered high-risk by major travel authorities. Travellers should thoroughly research current conditions, stay in vetted accommodations, use private transport, and minimise unnecessary movement, especially after dark.`;
  faq.push({ q: `Is ${name} safe for tourists?`, a: a1 });

  // Q2: safe at night?
  let a2;
  if (score == null)      a2 = `Nighttime safety in ${name} varies by area. Consult the sources below for current guidance.`;
  else if (score <= 2.5)  a2 = `${name} is generally walkable at night in its central and tourist areas. As with any city, exercise normal caution and avoid isolated or poorly-lit streets late at night.`;
  else if (score <= 5)    a2 = `${name} is reasonably safe at night in well-known tourist and residential areas. Avoid displaying valuables, use reputable transport, and be cautious in unfamiliar neighbourhoods after dark.`;
  else if (score <= 7.5)  a2 = `Night-time safety in ${name} varies significantly by neighbourhood. Stick to established areas, use ride-hailing apps rather than hailing taxis on the street, and avoid unfamiliar areas after dark.`;
  else                    a2 = `${name} is considered high-risk at night. Minimise unnecessary travel after dark, use trusted private transport, and stay in secure, well-reviewed accommodations.`;
  faq.push({ q: `Is ${name} safe at night?`, a: a2 });

  // Q3: safest areas / neighbourhoods (if we have district data)
  if (ds && ds.type === 'varied' && ds.safest.length) {
    const safeNames = ds.safest.map(d => d.name).join(', ');
    const a3 = `Based on incident data consolidated across our sources, ${safeNames} are among the areas rated safer in ${name}. Always verify current conditions with the sources listed below, as conditions can change.`;
    faq.push({ q: `What are the safest neighbourhoods in ${name}?`, a: a3 });
  } else if (ds && ds.type === 'uniform') {
    const a3 = `${name}'s ${ds.count} mapped districts share a similar overall risk profile on Latam Crime Map. For specific neighbourhood recommendations, consult the travel advisories and community sources listed below.`;
    faq.push({ q: `What are the safest areas in ${name}?`, a: a3 });
  }

  // Q4: areas to avoid (if varied scores)
  if (ds && ds.type === 'varied' && ds.highest.length) {
    const riskNames = ds.highest.map(d => d.name).join(', ');
    const a4 = `${riskNames} are rated with elevated caution on our map. This reflects patterns from consolidated advisory and incident sources — conditions vary and can change, so check current guidance before travelling.`;
    faq.push({ q: `Which areas of ${name} should travellers be cautious about?`, a: a4 });
  }

  // Q5: main risks
  let a5;
  const theme = adv.theme || 'crime';
  if (score == null || score <= 5)
    a5 = `The primary risks for visitors to ${name} are opportunistic theft, phone snatching, and pickpocketing in crowded areas. ${COUNTRY_NAMES[city.country] || 'This country'} authorities note ${theme}.`;
  else
    a5 = `${name} sees higher rates of robbery, vehicle theft, and in some areas more serious incidents. Official sources highlight ${theme} as key concerns in ${COUNTRY_NAMES[city.country] || 'this country'}.`;
  faq.push({ q: `What are the main safety risks for visitors to ${name}?`, a: a5 });

  return faq;
}

// ── HTML helpers ──────────────────────────────────────────────────────────────

const esc = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function advisoryBadge(adv) {
  if (!adv || adv.level === 0) return '';
  const colors = { 1:'#16b87f',2:'#d6b609',3:'#f38b10',4:'#c83233' };
  const bg = colors[adv.level] || '#5b6472';
  return `<span class="adv-badge" style="background:${bg}">${esc(adv.label)}</span>`;
}

function sourcesHtml(basis) {
  if (!basis || !basis.length) return '<p>Sources being compiled — check back soon.</p>';
  return basis.map(s => `<li>${s.url
    ? `<a href="${esc(s.url)}" rel="noopener noreferrer" target="_blank">${esc(s.text)}</a>`
    : esc(s.text)}</li>`).join('\n    ');
}

function faqHtml(faq) {
  return faq.map(({q,a}) => `
    <div class="faq-item">
      <h3>${esc(q)}</h3>
      <p>${esc(a)}</p>
    </div>`).join('');
}

function districtHtml(ds, cityName) {
  if (!ds) return '';
  if (ds.type === 'uniform') {
    return `<p>The live map shows <strong>${ds.count} mapped districts</strong> in ${esc(cityName)}, all carrying the same overall safety rating. Explore them on the interactive map to see the geographic spread.</p>`;
  }
  const safeList = ds.safest.map(d => `<strong>${esc(d.name)}</strong> (${tierName(d.score)})`).join(', ');
  const riskList = ds.highest.map(d => `<strong>${esc(d.name)}</strong> (${tierName(d.score)})`).join(', ');
  return `
    <p>The map covers <strong>${ds.count} districts</strong> with differentiated risk ratings:</p>
    <div class="district-bands">
      <div class="band safe-band">
        <span class="band-label">Generally safer</span>
        <span>${safeList}</span>
      </div>
      <div class="band risk-band">
        <span class="band-label">Exercise extra caution</span>
        <span>${riskList}</span>
      </div>
    </div>
    <p class="district-note">Ratings are consolidated from the sources below, not real-time. Conditions can change — verify before travel.</p>`;
}

// ── JSON-LD builder ───────────────────────────────────────────────────────────

function buildJsonLd(city, key, faq, score, basis) {
  const name = city.name;
  const url  = `${SITE}/${key}`;

  const faqSchema = {
    '@type': 'FAQPage',
    mainEntity: faq.map(({q,a}) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Latam Crime Map', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: name, item: url },
    ],
  };

  const webpage = {
    '@type': 'WebPage',
    name: `Is ${name} safe for travelers?`,
    url,
    description: `Consolidated safety guidance for ${name} — official advisories, crime indices, and traveler reports synthesized into one incident-based read.`,
    dateModified: BUILD_DATE,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'Latam Crime Map', url: SITE + '/' },
    breadcrumb,
    isBasedOn: (basis || []).filter(s => s.url).map(s => ({
      '@type': 'WebPage',
      name: s.text,
      url: s.url,
    })),
  };

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [faqSchema, breadcrumb, webpage] }, null, 2);
}

// ── Page template ──────────────────────────────────────────────────────────────

function cityPageHtml({ key, city, score, tier, tierCol, prose, faq, ds, basis, richContent, jsonLd }) {
  const name    = city.name;
  const country = city.country;
  const adv     = ADVISORIES[country] || {};
  const countryName = COUNTRY_NAMES[country] || '';
  const hasShare = [
    'sao-paulo','mexico-city','rio-de-janeiro','buenos-aires','lima','bogota',
    'santiago','medellin','belohorizonte','guadalajara','monterrey','salvador',
    'recife','curitiba','fortaleza','havana','santodomingo','panamacity',
    'guatemalacity','puebla',
  ].includes(key);
  const ogImage = hasShare ? `${SITE}/share/${key}.png` : `${SITE}/og-image.png`;

  const title  = `Is ${name} Safe for Travelers? — Latam Crime Map`;
  const desc   = `Consolidated safety overview for ${name}: official government advisories, crime indices, and traveler reports synthesized into one incident-based read. ${tier} overall.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<link rel="canonical" href="${SITE}/${key}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="Latam Crime Map"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:url" content="${SITE}/${key}"/>
<meta property="og:image" content="${ogImage}"/>
<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
<meta name="twitter:image" content="${ogImage}"/>
<script type="application/ld+json">${jsonLd}</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  background:#0d1426;color:#e8eef6;line-height:1.6}
a{color:#1aa37c;text-decoration:none}
a:hover{text-decoration:underline}
.site-header{background:#0F6E56;padding:10px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.site-header a{color:#fff;font-weight:600;font-size:15px}
.site-header .back{font-size:13px;opacity:.85}
.site-header .live-link{margin-left:auto;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);
  color:#fff;padding:5px 13px;border-radius:7px;font-size:13px;white-space:nowrap}
.site-header .live-link:hover{background:rgba(255,255,255,.25);text-decoration:none}
main{max-width:780px;margin:0 auto;padding:24px 20px 60px}
h1{font-size:clamp(22px,4vw,30px);font-weight:700;line-height:1.25;margin-bottom:14px;color:#f0f4fa}
h2{font-size:19px;font-weight:700;margin:32px 0 12px;color:#d8e2f0;border-bottom:1px solid #1e2d48;padding-bottom:6px}
h3{font-size:15px;font-weight:650;margin:16px 0 6px;color:#c8d6ea}
p{margin-bottom:12px;color:#c8d6ea;font-size:15px}
.verdict-block{background:#101a2e;border:1px solid #1e2d48;border-radius:10px;padding:16px 18px;margin-bottom:28px}
.verdict-block .tier-badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:13px;
  font-weight:700;color:#0c1320;margin-bottom:10px}
.verdict-block p{margin:0;font-size:15.5px;color:#dde8f5}
.adv-badge{display:inline-block;font-size:12px;font-weight:600;color:#0c1320;padding:2px 9px;border-radius:12px;margin-left:8px;vertical-align:middle}
.map-facade{margin:24px 0;border-radius:10px;overflow:hidden;position:relative;background:#0a1220}
.map-facade img{width:100%;height:auto;display:block;opacity:.85}
.map-facade .open-map{position:absolute;bottom:14px;right:14px;background:#0F6E56;color:#fff;
  border:none;padding:9px 18px;border-radius:8px;font-size:14px;font-weight:650;cursor:pointer;
  text-decoration:none;display:inline-block}
.map-facade .open-map:hover{background:#16916d;text-decoration:none}
.limited-notice{background:#1a2540;border:1px solid #263654;border-radius:8px;padding:10px 14px;
  font-size:13.5px;color:#9aabca;margin-bottom:16px}
.limited-notice strong{color:#b8c9e0}
.faq-item{margin-bottom:20px}
.faq-item h3{margin-bottom:5px}
.faq-item p{margin:0}
.district-bands{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}
@media(max-width:540px){.district-bands{grid-template-columns:1fr}}
.band{background:#101a2e;border:1px solid #1e2d48;border-radius:8px;padding:12px}
.band-label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.6px;
  color:#6b7d9a;margin-bottom:5px;font-weight:700}
.safe-band .band-label{color:#1aa37c}
.risk-band .band-label{color:#f38b10}
.district-note{font-size:13px;color:#6b7d9a;margin-top:8px}
.sources-list{list-style:none;display:flex;flex-direction:column;gap:6px}
.sources-list li{font-size:14px}
.sources-list a{color:#7db8e8}
.sources-list a:hover{color:#a8d0f0}
.meta-line{font-size:13px;color:#5b6c87;margin-top:20px;border-top:1px solid #1a2540;padding-top:14px}
.meta-line a{color:#6b8ab0}
</style>
</head>
<body>
<header class="site-header">
  <a href="/" class="back">← Latam Crime Map</a>
  <span style="color:rgba(255,255,255,.4);font-size:13px">/ ${esc(name)}</span>
  <a href="/?city=${key}" class="live-link">Open live map →</a>
</header>
<main>
  <h1>Is ${esc(name)} safe for travelers?</h1>

  <div class="verdict-block">
    <span class="tier-badge" style="background:${tierCol}">${esc(tier)}</span>${adv.level != null && adv.level > 0 ? `${advisoryBadge(adv)} <small style="color:#7a8da8;font-size:12px">US State Dept — ${esc(countryName)}</small>` : ''}
    <p>${esc(prose)}</p>
  </div>

  <div class="map-facade">
    <img src="${ogImage}" alt="${esc(name)} safety map showing incident risk by district" width="1200" height="630" loading="lazy"/>
    <a href="/?city=${key}" class="open-map">Explore interactive map →</a>
  </div>

${richContent ? richContent : `
  <h2>What the sources say</h2>
  <div class="limited-notice"><strong>Consolidated profile in progress.</strong> We're building a full multi-source synthesis for ${esc(name)}. In the meantime, the safety tier above reflects our editorial assessment and the district-level data on the interactive map. The sources below are where we drew that assessment from.</div>
  ${ds ? `<div>${districtHtml(ds, name)}</div>` : ''}
`}

  <h2>Common questions</h2>
  ${faqHtml(faq)}

  <h2>Sources consulted</h2>
  <ul class="sources-list">
    ${sourcesHtml(basis)}
  </ul>
  <div class="meta-line">
    Last updated ${BUILD_DATE} &middot; <a href="/method/">Methodology</a> &middot; <a href="/">All cities</a>
  </div>
</main>
</body>
</html>`;
}

// ── Method page ───────────────────────────────────────────────────────────────

function methodPageHtml() {
  const title = 'How we assess city safety — Latam Crime Map';
  const desc  = 'Our methodology for rating city and neighbourhood safety across Latin America: multiple official and community sources, reconciled into one incident-based, bias-filtered read.';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: title,
        url: `${SITE}/method/`,
        description: desc,
        isPartOf: { '@type': 'WebSite', name: 'Latam Crime Map', url: SITE + '/' },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Latam Crime Map', item: SITE + '/' },
            { '@type': 'ListItem', position: 2, name: 'Methodology', item: `${SITE}/method/` },
          ],
        },
      },
    ],
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<link rel="canonical" href="${SITE}/method/"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="Latam Crime Map"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:url" content="${SITE}/method/"/>
<meta property="og:image" content="${SITE}/og-image.png"/>
<script type="application/ld+json">${jsonLd}</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  background:#0d1426;color:#e8eef6;line-height:1.7}
a{color:#1aa37c}
a:hover{text-decoration:underline}
.site-header{background:#0F6E56;padding:10px 20px;display:flex;align-items:center;gap:16px}
.site-header a{color:#fff;font-weight:600;font-size:15px}
main{max-width:720px;margin:0 auto;padding:32px 20px 60px}
h1{font-size:clamp(22px,4vw,28px);font-weight:700;margin-bottom:20px;color:#f0f4fa;line-height:1.3}
h2{font-size:18px;font-weight:700;margin:30px 0 10px;color:#d8e2f0;border-bottom:1px solid #1e2d48;padding-bottom:5px}
p{margin-bottom:14px;color:#c8d6ea;font-size:15px}
ul,ol{margin:0 0 14px 22px;color:#c8d6ea;font-size:15px}
li{margin-bottom:6px}
strong{color:#dde8f5}
.rule{background:#101a2e;border:1px solid #1e2d48;border-radius:9px;padding:14px 16px;margin-bottom:14px}
.rule p{margin:0}
.meta-line{font-size:13px;color:#5b6c87;margin-top:28px;border-top:1px solid #1a2540;padding-top:14px}
</style>
</head>
<body>
<header class="site-header">
  <a href="/">← Latam Crime Map</a>
  <span style="color:rgba(255,255,255,.4);font-size:13px">/ Methodology</span>
</header>
<main>
<h1>How we assess city safety</h1>

<p><strong>Latam Crime Map</strong> consolidates every major travel-safety source for Latin America — government advisories, official crime data, crime indices, and traveller reports — into one consistent, incident-based read per city and neighbourhood. It rates places by reported events and conditions, never by who lives there.</p>

<h2>What "consolidated" means</h2>
<p>Each city is assessed by merging these source classes and reconciling them — where sources agree and where they conflict, both are stated:</p>
<ul>
  <li><strong>Official government advisories</strong> — US State Department travel advisory level, US OSAC crime reports, UK FCDO advice per country.</li>
  <li><strong>Official crime data</strong> — published police and ministerial statistics where available: SSP-SP (São Paulo), ISP-RJ (Rio), SISC (Medellín), Mapa del Delito (Buenos Aires), FGJ-CDMX (Mexico City), and others.</li>
  <li><strong>Crime indices</strong> — Numbeo's crime/safety index as a comparative data point (attributed, not reproduced).</li>
  <li><strong>Traveller communities</strong> — recurring practical patterns from Reddit, Wikivoyage, and established forums, filtered through an events-not-feelings discipline.</li>
  <li><strong>Editorial safety maps</strong> — peer-reviewed models such as Vanguard Attaché where they cover a city at district level.</li>
</ul>

<h2>The honesty rule</h2>
<div class="rule"><p>We never fabricate per-neighbourhood ratings for a city we don't have verified data for. A city-level overall rating is honest; inventing district-level detail without sources is not. Pages without sufficient source data display a <em>limited consolidated data</em> notice and link directly to the primary sources instead of asserting a verdict we can't support.</p></div>

<h2>Events, not feelings — never the people</h2>
<p>Every claim describes <strong>incidents and conditions</strong>, not the people who live somewhere. Assessments like "high rates of phone snatching on commercial streets after dark" are allowed; demographic or socioeconomic characterisations of residents are not. This isn't just an ethical rule — it produces more accurate, actionable guidance and avoids the racial-profiling failure modes of earlier safety-map products.</p>

<h2>Safety tiers</h2>
<ul>
  <li><strong>Safe (1–2.5)</strong> — Generally lower risk; standard urban precautions sufficient.</li>
  <li><strong>Moderate (2.5–5)</strong> — Reasonable vigilance warranted; specific conditions matter.</li>
  <li><strong>Caution (5–7.5)</strong> — Heightened awareness recommended; area and time of day vary significantly.</li>
  <li><strong>Avoid (7.5–10)</strong> — High-risk environment; major travel authorities advise extra precautions or reconsider travel.</li>
</ul>
<p>Scores are on a 1–10 scale (1 = safest). For cities with a continuous model (e.g. São Paulo), district scores are sampled from a peer-reviewed risk surface. For cities with a tier model, districts share the city's overall rating unless a trustworthy source differentiates them.</p>

<h2>Source standards</h2>
<ul>
  <li>Every published claim traces to a named, linked source.</li>
  <li>Sources are paraphrased and attributed — never reproduced verbatim.</li>
  <li>Dates and recency are tracked; pages show a last-updated date.</li>
  <li>A source is only used where we have an actual excerpt to verify — world-knowledge gaps are acknowledged, not filled with invention.</li>
</ul>

<h2>What this map is not</h2>
<ul>
  <li>Not a real-time crime feed — ratings are updated periodically, not live.</li>
  <li>Not a guarantee — consolidated guidance, based on reported incidents and cited sources, not a prediction of individual outcomes.</li>
  <li>Not comprehensive at neighbourhood level everywhere — many cities have a single overall rating; district detail is added only where verified sources exist.</li>
</ul>

<div class="meta-line">
  Last updated ${BUILD_DATE} &middot; <a href="/">All cities</a>
</div>
</main>
</body>
</html>`;
}

// ── llms.txt ──────────────────────────────────────────────────────────────────

function buildLlmsTxt() {
  const cityLinks = CITY_KEYS.map(k => `- [${CITIES[k].name}](${SITE}/${k})`).join('\n');
  return `# Latam Crime Map — LLM index
# https://latamcrimemap.com/llms.txt

## About

LatamCrimeMap consolidates every major travel-safety source for Latin America — government advisories, official crime data, crime indices, and traveler reports — into one consistent, incident-based read per city and neighbourhood. It rates places by reported events and conditions, never by who lives there.

The map covers ${CITY_KEYS.length} Latin American cities across Brazil, Mexico, Argentina, Colombia, Peru, Chile, Ecuador, Bolivia, Venezuela, Honduras, Guatemala, El Salvador, Nicaragua, Costa Rica, Panama, Cuba, Dominican Republic, Puerto Rico, Haiti, Uruguay, and Paraguay.

## Key pages

- [Home / full interactive map](${SITE}/)
- [Methodology](${SITE}/method/)

## City pages (${CITY_KEYS.length} cities)

${cityLinks}

## Data notes

- Safety ratings are 1–10 (1 = safest). Tiers: Safe 1–2.5, Moderate 2.5–5, Caution 5–7.5, Avoid 7.5–10.
- Sources: US State Dept advisories, OSAC, UK FCDO, Numbeo, official crime statistics (SSP-SP, ISP-RJ, SISC, Mapa del Delito, FGJ-CDMX), traveller communities.
- Content is consolidated synthesis of cited sources — not AI-generated world knowledge. Every factual claim traces to a named source.
- Events and conditions only — no demographic or people-characterising language anywhere.
- Last built: ${BUILD_DATE}
`;
}

// ── sitemap.xml ───────────────────────────────────────────────────────────────

function buildSitemap(cityKeys) {
  const urlEntry = (loc, priority = '0.8') =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${BUILD_DATE}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

  const entries = [
    urlEntry(`${SITE}/`, '1.0'),
    urlEntry(`${SITE}/method/`, '0.6'),
    ...cityKeys.map(k => urlEntry(`${SITE}/${k}`, '0.8')),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;
}

// ── Root JSON-LD for index.html ───────────────────────────────────────────────
// Written as a separate snippet file; build.js injects it into index.html.

function buildRootJsonLd(cityCount) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'Latam Crime Map',
        url: SITE + '/',
        description: `Consolidated travel-safety map for ${cityCount} Latin American cities. Rates city and neighbourhood safety by reported incidents and conditions — synthesized from official advisories, crime data, and traveller sources.`,
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/?city={city}` },
          'query-input': 'required name=city',
        },
      },
      {
        '@type': 'Dataset',
        name: 'Latam Crime Map — city and neighbourhood safety ratings',
        description: `Consolidated incident-based safety ratings for ${cityCount} cities across Latin America, derived from official government advisories, crime statistics, crime indices, and traveller community reports.`,
        url: SITE + '/',
        creator: { '@type': 'Organization', name: 'Latam Crime Map', url: SITE + '/' },
        license: 'https://latamcrimemap.com/method/',
        dateModified: BUILD_DATE,
        spatialCoverage: { '@type': 'Place', name: 'Latin America' },
        variableMeasured: 'Travel safety by reported incidents and conditions (1–10 scale)',
      },
    ],
  }, null, 2);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function run() {
  let written = 0;

  // Method page
  const methodDir = path.join(ROOT, 'method');
  if (!DRY) {
    if (!fs.existsSync(methodDir)) fs.mkdirSync(methodDir, { recursive: true });
    fs.writeFileSync(path.join(methodDir, 'index.html'), methodPageHtml());
    console.log('  → method/index.html');
    written++;
  } else {
    console.log('[dry] method/index.html');
  }

  // llms.txt
  if (!DRY) {
    fs.writeFileSync(path.join(ROOT, 'llms.txt'), buildLlmsTxt());
    console.log('  → llms.txt');
  } else {
    console.log('[dry] llms.txt');
  }

  // sitemap.xml
  if (!DRY) {
    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), buildSitemap(CITY_KEYS));
    console.log(`  → sitemap.xml (${CITY_KEYS.length + 2} URLs)`);
  } else {
    console.log(`[dry] sitemap.xml`);
  }

  // Root JSON-LD snippet (build.js will inject this into index.html)
  if (!DRY) {
    if (!fs.existsSync(SEO_DIR)) fs.mkdirSync(SEO_DIR, { recursive: true });
    fs.writeFileSync(path.join(SEO_DIR, 'root-jsonld.json'), buildRootJsonLd(CITY_KEYS.length));
    console.log('  → seo/root-jsonld.json');
  }

  // City pages
  for (const key of CITY_KEYS) {
    const city    = CITIES[key];
    const score   = cityScore(city);
    const tier    = tierName(score);
    const tierCol = tierColor(score);
    const prose   = tierProse(score, city.name, city.country);
    const ds      = districtSummary(city);
    const basis   = city.sources && city.sources.basis ? city.sources.basis : [];
    const faq     = buildFAQ(city, key, score, ds);
    const jsonLd  = buildJsonLd(city, key, faq, score, basis);

    // Check for rich LLM content
    const richPath = path.join(SEO_DIR, 'content', `${key}.json`);
    let richContent = null;
    if (fs.existsSync(richPath)) {
      try {
        const rich = JSON.parse(fs.readFileSync(richPath, 'utf8'));
        if (rich.verdict && rich.reconciliation) {
          richContent = `
  <h2>What the sources say</h2>
  <p>${esc(rich.verdict.text)}</p>
  ${(rich.reconciliation || []).map(r => `<p>${esc(r.text)}</p>`).join('')}
  ${ds ? `<div>${districtHtml(ds, city.name)}</div>` : ''}`;
        }
      } catch (e) { /* malformed — fall through to limited */ }
    }

    const html = cityPageHtml({ key, city, score, tier, tierCol, prose, faq, ds, basis, richContent, jsonLd });

    if (DRY) {
      console.log(`[dry] ${key}.html  (${tier}, ${ds ? ds.count + ' districts' : 'no districts'})`);
    } else {
      fs.writeFileSync(path.join(ROOT, `${key}.html`), html);
      written++;
    }
  }

  if (!DRY) console.log(`\nSEO pages: wrote ${written} files (+ ${CITY_KEYS.length} city pages)`);
}

run();
