// Crowd backend for the Latin America City Safety Map (CROWDSOURCING.md §9).
//   node backend/server.js     (or: npm run backend)
//
// Scope of THIS build (per locked decisions, 2026-06-29):
//   - Collects reports (▲ Felt-safe / ⚑ Report an issue) and generic feedback into SQLite.
//   - NO LLM gate, NO automatic score movement. The public map changes only via MANUAL release
//     (scripts/review.js digest -> edit cities.json -> rebuild -> redeploy).
//   - Keeps the structural bias protections: negatives REQUIRE a non-demographic category;
//     raw free text is stored for manual review only and is never served by a public endpoint.

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const dbm = require('./db');
const { clusterIdForPoint, slugify } = require('../scripts/clusters');

const ROOT = path.join(__dirname, '..');
const CITIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'cities.json'), 'utf8'));
const CATS = JSON.parse(fs.readFileSync(path.join(ROOT, 'categories.json'), 'utf8'));

const PORT = parseInt(process.env.PORT || '8787', 10);
const IP_SALT = process.env.IP_SALT || 'dev-insecure-salt-change-me';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || '';   // empty => skip bot check (local dev)
const MAX_REPORTS_PER_IP_DAY = parseInt(process.env.MAX_REPORTS_PER_IP_DAY || '60', 10);
const MAX_FEEDBACK_PER_IP_DAY = parseInt(process.env.MAX_FEEDBACK_PER_IP_DAY || '10', 10);
const MAX_EVENTS_PER_IP_DAY = parseInt(process.env.MAX_EVENTS_PER_IP_DAY || '3000', 10);

const THANKS = 'Many thanks for becoming a part of the Latam Crime Map community! ' +
  'We update our maps every few days to reflect on feedback.';
const REJECT_PEOPLE = 'This map rates incidents and conditions, not who lives somewhere. ' +
  'Tell us what happened — e.g. a theft, a threat, bad lighting.';

const CAT_BY_KEY = Object.fromEntries(CATS.categories.map(c => [c.key, c]));
const WHEN_BY_KEY = Object.fromEntries(CATS.when_buckets.map(w => [w.key, w]));

// ---- helpers ---------------------------------------------------------------

function clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket.remoteAddress || '0.0.0.0';
}
// Salted hash of IP + UTC day. Never store or log the raw IP (§7, §10).
function ipHash(req) {
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(IP_SALT + '|' + clientIp(req) + '|' + day).digest('hex');
}
function dayStartIso() { return new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'; }

// Low-sensitivity request context (no raw IP, no PII): coarse device class, browser language tag, and the
// referrer's host only. Helps understand who/where reports come from (and which languages to prioritise).
function reqContext(req) {
  const ua = String(req.headers['user-agent'] || '');
  const device = /Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile' : (/iPad|Tablet/i.test(ua) ? 'tablet' : (ua ? 'desktop' : null));
  const lang = (String(req.headers['accept-language'] || '').split(',')[0].split('-')[0].trim().toLowerCase() || null) || null;
  let referer = null;
  try { const r = req.headers.referer || req.headers.referrer; if (r) referer = new URL(r).host; } catch (e) {}
  return { device, lang: lang ? lang.slice(0, 8) : null, referer: referer ? referer.slice(0, 120) : null };
}

async function turnstileOk(req, token) {
  if (!TURNSTILE_SECRET) return true;             // disabled in dev
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: clientIp(req) }),
    });
    const j = await r.json();
    return !!j.success;
  } catch { return false; }                        // fail-closed
}

// Provisional weight (§5): base × first_hand × recency. reason_factor is left to manual review
// (no LLM bucket yet). 'safe' reports carry a small fixed weight.
function computeWeight({ kind, category, first_hand, when_bucket }) {
  if (kind === 'safe') return 0.5;
  const base = CAT_BY_KEY[category] ? CAT_BY_KEY[category].base_weight : 0;
  const fh = first_hand === false ? 0.5 : (first_hand === true ? 1.0 : 0.5);
  const rec = when_bucket && WHEN_BY_KEY[when_bucket] ? WHEN_BY_KEY[when_bucket].recency : 0.6;
  return +(base * fh * rec).toFixed(3);
}

// Resolve & validate the cluster for a report. Prefer authoritative server-side computation from
// lat/lng; fall back to a client-provided cluster_id only if it is known for that city.
function resolveCluster(city, body) {
  const { lat, lng, cluster_id } = body;
  if (typeof lat === 'number' && typeof lng === 'number') {
    return clusterIdForPoint(city, lat, lng);
  }
  if (cluster_id) {
    const slug = city.slug || slugify(city.name);
    if (city.cluster_res && (cluster_id.startsWith(`${slug}:h3:`) || cluster_id === `${slug}:overall`)) return cluster_id;
    if ((city.districts || []).some(d => d.cluster_id === cluster_id)) return cluster_id;
  }
  return null;
}

// ---- app -------------------------------------------------------------------

const app = express();
app.use(express.json({ limit: '16kb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => res.json({ ok: true, cities: Object.keys(CITIES).length }));

app.post('/report', async (req, res) => {
  const b = req.body || {};
  const { city: cityKey, kind, category, first_hand, when_bucket, reason, token, turnstile_token } = b;

  if (!token || typeof token !== 'string') return res.status(400).json({ ok: false, error: 'missing token' });
  if (kind !== 'safe' && kind !== 'issue') return res.status(400).json({ ok: false, error: 'bad kind' });

  const city = CITIES[cityKey];
  if (!city) return res.status(400).json({ ok: false, error: 'unknown city' });

  // HARD RULE (§1): a negative report cannot be submitted without a valid, non-demographic category.
  if (kind === 'issue') {
    if (!category || !CAT_BY_KEY[category]) {
      return res.status(422).json({ ok: false, error: 'category required', message: REJECT_PEOPLE });
    }
  }
  if (when_bucket && !WHEN_BY_KEY[when_bucket]) return res.status(400).json({ ok: false, error: 'bad when_bucket' });

  if (!(await turnstileOk(req, turnstile_token))) return res.status(403).json({ ok: false, error: 'bot check failed' });

  const iph = ipHash(req);
  if (dbm.countReportsByIp.get(iph, dayStartIso()).n >= MAX_REPORTS_PER_IP_DAY) {
    return res.status(429).json({ ok: false, error: 'rate limit' });
  }

  const cluster_id = resolveCluster(city, b);
  if (!cluster_id) return res.status(400).json({ ok: false, error: 'cannot resolve cluster (need lat/lng or valid cluster_id)' });

  const row = {
    city: cityKey, cluster_id, kind,
    category: kind === 'issue' ? category : null,
    first_hand: first_hand === true ? 1 : (first_hand === false ? 0 : null),
    when_bucket: when_bucket || null,
    reason: (typeof reason === 'string' && reason.trim()) ? reason.trim().slice(0, 1000) : null,
    weight: computeWeight({ kind, category, first_hand, when_bucket }),
    email: (typeof b.email === 'string' && b.email.includes('@')) ? b.email.trim().slice(0, 200) : null,
    lat: typeof b.lat === 'number' ? b.lat : null,
    lng: typeof b.lng === 'number' ? b.lng : null,
    token: token.slice(0, 64), ip_hash: iph,
    created_at: new Date().toISOString(),
    ...reqContext(req),
  };
  dbm.upsertReport.run(row);

  res.json({ ok: true, cluster_id, message: THANKS });
});

app.post('/feedback', async (req, res) => {
  const b = req.body || {};
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim().slice(0, 200) : null;
  if (!text) return res.status(400).json({ ok: false, error: 'empty feedback' });
  if (!(await turnstileOk(req, b.turnstile_token))) return res.status(403).json({ ok: false, error: 'bot check failed' });

  const iph = ipHash(req);
  if (dbm.countFeedbackByIp.get(iph, dayStartIso()).n >= MAX_FEEDBACK_PER_IP_DAY) {
    return res.status(429).json({ ok: false, error: 'rate limit' });
  }
  dbm.insertFeedback.run({
    text: text.slice(0, 4000), email: email || null,
    token: typeof b.token === 'string' ? b.token.slice(0, 64) : null,
    ip_hash: iph, created_at: new Date().toISOString(),
    ...reqContext(req),
  });
  res.json({ ok: true, message: THANKS });
});

// First-party usage event (privacy-preserving). Sent by the client via sendBeacon as text/plain (a "simple"
// request → no CORS preflight), so parse the raw text here. Anonymous token only; no PII; never a raw IP.
app.post('/event', express.text({ type: '*/*', limit: '2kb' }), (req, res) => {
  let b = {};
  try { b = JSON.parse(req.body || '{}'); } catch (e) { return res.status(400).json({ ok: false }); }
  const token = typeof b.token === 'string' ? b.token.slice(0, 64) : '';
  const kind = b.kind;
  if (!token || (kind !== 'session' && kind !== 'view' && kind !== 'end' && kind !== 'search')) return res.status(400).json({ ok: false });
  const iph = ipHash(req);
  if (dbm.countEventsByIp.get(iph, dayStartIso()).n >= MAX_EVENTS_PER_IP_DAY) return res.json({ ok: true }); // over cap: drop quietly
  dbm.insertEvent.run({
    token,
    session: typeof b.session === 'string' ? b.session.slice(0, 64) : null,
    kind,
    city: (typeof b.city === 'string' && CITIES[b.city]) ? b.city : null,
    ms: (typeof b.ms === 'number' && b.ms >= 0) ? Math.min(Math.round(b.ms), 86400000) : null,
    meta: (b.meta && typeof b.meta === 'object') ? JSON.stringify(b.meta).slice(0, 2000) : null,
    ip_hash: iph, ts: new Date().toISOString(),
    ...reqContext(req),
  });
  res.json({ ok: true });
});

// Public aggregate: COUNTS ONLY, never raw text, never a moved score (manual release moves scores).
app.get('/reports', (req, res) => {
  const cityKey = req.query.city;
  if (!CITIES[cityKey]) return res.status(400).json({ ok: false, error: 'unknown city' });
  const out = {};
  for (const r of dbm.aggByCity.all(cityKey)) {
    out[r.cluster_id] = {
      reports: r.issues + r.safes,
      reporters: r.reporters,
      top_categories: dbm.topCategories.all(cityKey, r.cluster_id).map(c => c.category),
      suppressed: true,           // scores never move live; editorial/manual rating stands
    };
  }
  res.json(out);
});

// A reporter can list and withdraw THEIR OWN pending reports (token-scoped; no PII, never raw reason).
app.get('/my-reports', (req, res) => {
  const token = req.query.token;
  if (!token || typeof token !== 'string') return res.status(400).json({ ok: false, error: 'missing token' });
  const reports = dbm.myReports.all(token.slice(0, 64)).map(r => ({
    id: r.id, city: r.city, kind: r.kind, category: r.category, when_bucket: r.when_bucket, created_at: r.created_at,
    city_name: (CITIES[r.city] && CITIES[r.city].name) || r.city,
    category_label: (r.category && CAT_BY_KEY[r.category]) ? CAT_BY_KEY[r.category].label : null,
  }));
  res.json({ ok: true, reports });
});
app.delete('/report/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const token = (req.body && req.body.token) || req.query.token;
  if (!id || !token || typeof token !== 'string') return res.status(400).json({ ok: false, error: 'missing id/token' });
  const info = dbm.deleteMyReport.run(id, token.slice(0, 64));
  if (!info.changes) return res.status(404).json({ ok: false, error: 'not found' });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Crowd backend on http://localhost:${PORT}  (DB: ${dbm.DB_PATH})`);
  if (IP_SALT.startsWith('dev-')) console.log('  ! using insecure dev IP_SALT — set IP_SALT in production');
  if (!TURNSTILE_SECRET) console.log('  ! Turnstile disabled (no TURNSTILE_SECRET) — dev mode');
});
