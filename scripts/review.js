// Manual-release digest (no admin web UI). Run this every few days to review crowd input, then
// fold approved changes into cities.json, rebuild, redeploy, and mark the batch released.
//
//   npm run review                 # show all pending reports + feedback
//   npm run review -- --city rio   # filter to one city key
//   npm run review -- --release    # mark all currently-pending rows as released (after you apply them)
//
// This is a PRIVATE local tool — it may show raw report text (which public endpoints never serve),
// because raw text exists precisely for this human review / bias check (CROWDSOURCING.md §1, §4, §10).

const fs = require('fs');
const path = require('path');
const { db } = require('../backend/db');

const args = process.argv.slice(2);
const cityFilter = (() => { const i = args.indexOf('--city'); return i >= 0 ? args[i + 1] : null; })();
const doRelease = args.includes('--release');

const ROOT = path.join(__dirname, '..');
const CITIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'cities.json'), 'utf8'));
const cityName = (k) => (CITIES[k] ? CITIES[k].name : k);

const where = cityFilter ? 'AND city = ?' : '';
const params = cityFilter ? [cityFilter] : [];

if (doRelease) {
  const r = db.prepare(`UPDATE report SET released=1 WHERE released=0 ${where}`).run(...params);
  const f = db.prepare(`UPDATE feedback SET released=1 WHERE released=0`).run();
  console.log(`Marked released: ${r.changes} report(s), ${f.changes} feedback item(s).`);
  process.exit(0);
}

const reports = db.prepare(
  `SELECT * FROM report WHERE released=0 ${where} ORDER BY city, cluster_id, created_at`
).all(...params);
const feedback = db.prepare(`SELECT * FROM feedback WHERE released=0 ORDER BY created_at`).all();

console.log('SafetyMap — pending crowd input (manual release)');
console.log('Generated ' + new Date().toISOString());
console.log('');

// ---- reports, grouped by city -> cluster ----
console.log('=== REPORTS (pending) ===');
if (!reports.length) console.log('  (none)');

const byCity = {};
for (const r of reports) (byCity[r.city] ||= []).push(r);

let totIssues = 0, totSafe = 0, totClusters = 0;
for (const city of Object.keys(byCity)) {
  console.log(`\nCity: ${city} (${cityName(city)})`);
  const byCluster = {};
  for (const r of byCity[city]) (byCluster[r.cluster_id] ||= []).push(r);
  for (const cid of Object.keys(byCluster)) {
    totClusters++;
    const rows = byCluster[cid];
    const issues = rows.filter(r => r.kind === 'issue');
    const safes = rows.filter(r => r.kind === 'safe');
    totIssues += issues.length; totSafe += safes.length;
    const reporters = new Set(rows.map(r => r.token)).size;
    console.log(`  cluster ${cid} — ${rows.length} report(s) from ${reporters} reporter(s)`);
    if (safes.length) console.log(`     safe: ${safes.length}`);
    if (issues.length) {
      const cat = {}; const whenB = {}; let fh = 0, fhKnown = 0;
      for (const r of issues) {
        cat[r.category] = (cat[r.category] || 0) + 1;
        if (r.when_bucket) whenB[r.when_bucket] = (whenB[r.when_bucket] || 0) + 1;
        if (r.first_hand !== null) { fhKnown++; if (r.first_hand) fh++; }
      }
      const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}×${v}`).join(', ');
      console.log(`     issue: ${issues.length}  [${fmt(cat)}]` +
        (Object.keys(whenB).length ? `  when: ${fmt(whenB)}` : '') +
        (fhKnown ? `  first-hand: ${fh}/${fhKnown}` : ''));
      const withText = issues.filter(r => r.reason);
      if (withText.length) {
        console.log('     reasons (review for bias before applying):');
        for (const r of withText) {
          console.log(`       - "${r.reason}"  (${r.category}, ${r.when_bucket || 'when?'}, ${r.first_hand ? 'first-hand' : 'heard'})`);
        }
      }
    }
  }
}
console.log(`\nTotals: ${reports.length} report(s) — ${totIssues} issue, ${totSafe} safe across ${totClusters} cluster(s).`);

// ---- feedback ----
console.log('\n=== FEEDBACK (pending) ===');
if (!feedback.length) console.log('  (none)');
for (const f of feedback) {
  console.log(`  [${f.created_at.slice(0, 10)}] ${f.email || '(no email)'}: "${f.text}"`);
}
console.log(`\nTotals: ${feedback.length} feedback item(s).`);

// ---- notify emails (reporters who opted in to be told when the map updates) ----
const emails = db.prepare(
  `SELECT DISTINCT email FROM report WHERE released=0 AND email IS NOT NULL AND email<>'' ${where} ORDER BY email`
).all(...params).map(r => r.email);
console.log('\n=== NOTIFY EMAILS (opted in via a report) ===');
if (!emails.length) console.log('  (none)');
else { emails.forEach(e => console.log('  ' + e)); console.log(`\n  ${emails.length} address(es) to email after this release.`); }

console.log('\nNext: edit cities.json for approved changes → `npm run build` → redeploy → `npm run review -- --release`.');
