// First-party usage analytics report (from the `event` table). Privacy-preserving: everything is keyed by
// the anonymous browser token — "a person does X", never who. No PII, no raw IP.
//   npm run stats                         (reads backend/safetymap.db)
//   DB_PATH=/var/lib/safetymap/safetymap.db node scripts/stats.js   (on the box)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'safetymap.db');
const db = new DatabaseSync(DB_PATH);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);
const fmtMs = (ms) => ms == null ? '—' : (ms < 60000 ? Math.round(ms / 1000) + 's' : (ms / 60000).toFixed(1) + 'm');
const bar = (n, max, w = 24) => '█'.repeat(Math.max(0, Math.round((n / (max || 1)) * w)));

// exists?
const has = one("SELECT name FROM sqlite_master WHERE type='table' AND name='event'");
if (!has) { console.log('No `event` table yet — usage analytics starts after the tracking build is deployed.'); process.exit(0); }

const tot = one(`SELECT COUNT(*) events, COUNT(DISTINCT token) visitors, COUNT(DISTINCT session) sessions,
  MIN(ts) first, MAX(ts) last FROM event`);
console.log('\n══════════ Latam Crime Map — usage ══════════');
console.log(`window   : ${(tot.first || '—').slice(0, 16)}  →  ${(tot.last || '—').slice(0, 16)} (UTC)`);
console.log(`visitors : ${tot.visitors}   sessions: ${tot.sessions}   events: ${tot.events}`);

// ---- Cities opened per SESSION (breadth of a single visit) ----
const perSess = all(`SELECT session, COUNT(DISTINCT city) nc FROM event
  WHERE kind='view' AND city IS NOT NULL GROUP BY session`);
const b = { '1': 0, '2-3': 0, '4-6': 0, '7+': 0 };
perSess.forEach(r => { b[r.nc === 1 ? '1' : r.nc <= 3 ? '2-3' : r.nc <= 6 ? '4-6' : '7+']++; });
const multi = perSess.filter(r => r.nc > 1).length;
const avgCities = perSess.length ? (perSess.reduce((a, r) => a + r.nc, 0) / perSess.length).toFixed(2) : '0';
console.log(`\n▸ Cities opened per visit   (avg ${avgCities}; ${multi}/${perSess.length} visits opened >1)`);
const mx = Math.max(1, ...Object.values(b));
for (const k of ['1', '2-3', '4-6', '7+']) console.log(`   ${k.padEnd(4)} ${String(b[k]).padStart(4)}  ${bar(b[k], mx)}`);

// ---- Dwell (active time) per session ----
const dwell = all(`SELECT session, MAX(ms) m FROM event WHERE kind='end' AND ms IS NOT NULL GROUP BY session`)
  .map(r => r.m).filter(m => m != null).sort((a, x) => a - x);
if (dwell.length) {
  const sum = dwell.reduce((a, x) => a + x, 0);
  const med = dwell[Math.floor(dwell.length / 2)];
  console.log(`\n▸ Time on site (active)     sessions w/ dwell: ${dwell.length}`);
  console.log(`   median ${fmtMs(med)}   avg ${fmtMs(Math.round(sum / dwell.length))}   longest ${fmtMs(dwell[dwell.length - 1])}`);
}

// ---- Behaviour, from the per-session journey summary (meta on 'end' events) ----
const ends = all(`SELECT meta FROM event WHERE kind='end' AND meta IS NOT NULL`)
  .map(r => { try { return JSON.parse(r.meta); } catch (e) { return null; } }).filter(Boolean);
if (ends.length) {
  const n = ends.length;
  const avg = (f) => (ends.reduce((a, m) => a + (f(m) || 0), 0) / n);
  const pct = (f) => Math.round(ends.filter(f).length / n * 100);
  const favz = {}; ends.forEach(m => { if (m.favZoom != null) favz[m.favZoom] = (favz[m.favZoom] || 0) + 1; });
  const favEntries = Object.entries(favz).sort((a, b) => b[1] - a[1]);
  console.log(`\n▸ Behaviour  (${n} summarised sessions)`);
  console.log(`   moved (pans) avg ${avg(m => m.pans).toFixed(1)}   zoom-changes avg ${avg(m => m.zooms).toFixed(1)}   deepest zoom ${Math.max(0, ...ends.map(m => m.zmax || 0))}`);
  console.log(`   favourite zoom      : ` + (favEntries.slice(0, 4).map(([z, c]) => `z${z}·${c}`).join('  ') || '—'));
  console.log(`   left a report       : ${pct(m => m.reports > 0)}%      opened a district: ${pct(m => m.districts > 0)}%`);
  console.log(`   used search / locate: ${pct(m => m.searches > 0)}% / ${pct(m => m.locates > 0)}%`);
  console.log(`   changed a setting   : base ${pct(m => m.setBase)}%  transparency ${pct(m => m.setTransp)}%  labels ${pct(m => m.setLabels)}%  borders ${pct(m => m.setBorders)}%`);
  console.log(`   closed the menu     : ${pct(m => m.menuClosed)}%      opened legend ${pct(m => m.legendOpened)}%   opened sources ${pct(m => m.sourcesOpened)}%`);
  console.log(`   welcome shown/dismissed: ${pct(m => m.welcome && m.welcome[0])}% / ${pct(m => m.welcome && m.welcome[1])}%   left a modal open: ${pct(m => m.modalLeftOpen)}%   CTA dismissed: ${pct(m => m.ctaDismiss)}%`);
}

// ---- Returning visitors (same token across ≥2 UTC days) ----
const ret = all(`SELECT token, COUNT(DISTINCT substr(ts,1,10)) d, COUNT(DISTINCT session) s
  FROM event GROUP BY token`);
const returning = ret.filter(r => r.d >= 2).length;
const multiSessTokens = ret.filter(r => r.s >= 2).length;
console.log(`\n▸ Loyalty`);
console.log(`   returning (≥2 days) : ${returning}/${ret.length} visitors`);
console.log(`   multi-visit tokens  : ${multiSessTokens}/${ret.length}`);

// ---- Cities opened per VISITOR (lifetime breadth) ----
const perTok = all(`SELECT token, COUNT(DISTINCT city) nc FROM event
  WHERE kind='view' AND city IS NOT NULL GROUP BY token ORDER BY nc DESC`);
const explorers = perTok.filter(r => r.nc >= 3).length;
console.log(`   explorers (≥3 cities): ${explorers}/${perTok.length} visitors` +
  (perTok[0] ? `   (max ${perTok[0].nc} cities by one visitor)` : ''));

// ---- Top cities ----
const top = all(`SELECT city, COUNT(*) v, COUNT(DISTINCT token) u FROM event
  WHERE kind='view' AND city IS NOT NULL GROUP BY city ORDER BY v DESC LIMIT 15`);
if (top.length) {
  const mv = top[0].v;
  console.log(`\n▸ Top cities  (views · unique visitors)`);
  top.forEach(r => console.log(`   ${r.city.padEnd(20)} ${String(r.v).padStart(4)} · ${String(r.u).padStart(3)}  ${bar(r.v, mv)}`));
}

// ---- Funnel & demand ----
if (ends.length) {
  const n = ends.length;
  const sum = (f) => ends.reduce((a, m) => a + (f(m) || 0), 0);
  const io = sum(m => m.issueOpened), is = sum(m => m.issueSubmitted);
  console.log(`\n▸ Funnel`);
  console.log(`   issue sheet opened ${io} → submitted ${is}` + (io ? `   (abandoned ${Math.round((1 - is / io) * 100)}%)` : ''));
  console.log(`   sessions with a dead-end search: ${ends.filter(m => m.searchMiss > 0).length}/${n}`);
}
const misses = all(`SELECT meta FROM event WHERE kind='search'`)
  .map(r => { try { return JSON.parse(r.meta); } catch (e) { return null; } }).filter(m => m && m.hit === 0 && m.q);
if (misses.length) {
  const freq = {}; misses.forEach(m => { const q = String(m.q).toLowerCase().trim(); freq[q] = (freq[q] || 0) + 1; });
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`\n▸ Top search MISSES  (looked for, not found → demand-ranked build list)`);
  top.forEach(([q, c]) => console.log(`   ${String(c).padStart(3)} ×  ${q}`));
}
const sessRows = all(`SELECT session, MIN(CASE WHEN kind='view' THEN ts END) firstView, MIN(ts) firstTs
  FROM event WHERE session IS NOT NULL GROUP BY session`);
if (sessRows.length) {
  const bounced = sessRows.filter(s => !s.firstView).length;
  const ttf = sessRows.filter(s => s.firstView).map(s => (new Date(s.firstView) - new Date(s.firstTs))).filter(x => x >= 0).sort((a, b) => a - b);
  console.log(`\n▸ Landing`);
  console.log(`   bounced (no city opened): ${bounced}/${sessRows.length} (${Math.round(bounced / sessRows.length * 100)}%)` +
    (ttf.length ? `   time-to-first-city median ${fmtMs(ttf[Math.floor(ttf.length / 2)])}` : ''));
}

// ---- Contributions & data health (from the `report` table) ----
const hasReport = one("SELECT name FROM sqlite_master WHERE type='table' AND name='report'");
if (hasReport) {
  const rt = one(`SELECT COUNT(*) n, COUNT(DISTINCT token) contributors,
    SUM(CASE WHEN kind='safe' THEN 1 ELSE 0 END) safe, SUM(CASE WHEN kind='issue' THEN 1 ELSE 0 END) issue,
    SUM(CASE WHEN first_hand=1 THEN 1 ELSE 0 END) fh, SUM(CASE WHEN first_hand IS NOT NULL THEN 1 ELSE 0 END) fhk,
    SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) withemail FROM report`);
  if (rt && rt.n) {
    console.log(`\n▸ Contributions  (report table)`);
    console.log(`   ${rt.n} reports · ${rt.contributors} contributors · safe ${rt.safe} / issue ${rt.issue}` +
      (rt.fhk ? ` · first-hand ${Math.round(rt.fh / rt.fhk * 100)}%` : '') + ` · left email ${Math.round(rt.withemail / rt.n * 100)}%`);
    const repeat = all(`SELECT COUNT(*) c FROM report GROUP BY token HAVING c>=2`);
    console.log(`   repeat contributors (≥2 reports): ${repeat.length}/${rt.contributors}` + (repeat.length ? `  (max ${Math.max(...repeat.map(r => r.c))} by one)` : ''));
    const cats = all(`SELECT category, COUNT(*) c FROM report WHERE kind='issue' AND category IS NOT NULL GROUP BY category ORDER BY c DESC LIMIT 6`);
    if (cats.length) console.log(`   top issue categories: ` + cats.map(c => `${c.category}·${c.c}`).join('  '));
    const cityCov = all(`SELECT city, COUNT(*) c, COUNT(DISTINCT cluster_id) d FROM report GROUP BY city ORDER BY c DESC LIMIT 8`);
    console.log(`   coverage (city·reports/areas): ` + cityCov.map(r => `${r.city}·${r.c}/${r.d}`).join('  '));
    const conflict = all(`SELECT city FROM report GROUP BY city, cluster_id HAVING SUM(kind='safe')>0 AND SUM(kind='issue')>0`);
    console.log(`   safe↔issue conflict areas: ${conflict.length}`);
    const now = Date.now(), day = 86400000, buckets = { '<1d': 0, '<7d': 0, '<30d': 0, '30d+': 0 };
    all(`SELECT created_at FROM report`).forEach(r => { const a = now - new Date(r.created_at); if (a >= 0) buckets[a < day ? '<1d' : a < 7 * day ? '<7d' : a < 30 * day ? '<30d' : '30d+']++; });
    console.log(`   report age: ` + Object.entries(buckets).map(([k, v]) => `${k} ${v}`).join('  '));
  }
}

// ---- Device / language mix (from the event context) ----
const dev = all(`SELECT COALESCE(device,'?') d, COUNT(DISTINCT token) u FROM event GROUP BY d ORDER BY u DESC`);
const lang = all(`SELECT COALESCE(lang,'?') l, COUNT(DISTINCT token) u FROM event GROUP BY l ORDER BY u DESC LIMIT 6`);
console.log(`\n▸ Visitors by device : ` + dev.map(r => `${r.d} ${r.u}`).join('   '));
console.log(`▸ Visitors by lang   : ` + lang.map(r => `${r.l} ${r.u}`).join('   '));
console.log('');
