// SQLite layer for the crowd backend (CROWDSOURCING.md §3). Uses Node 24's built-in node:sqlite
// (no native build step). Stores reports + generic feedback. Raw `reason`/`text` are kept for the
// MANUAL review-and-release cycle only and are NEVER served by a public endpoint (§1, §10).

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'safetymap.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS report (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    city        TEXT NOT NULL,
    cluster_id  TEXT NOT NULL,
    kind        TEXT NOT NULL,              -- 'safe' | 'issue'
    category    TEXT,                       -- null for 'safe'; else a categories.json key
    first_hand  INTEGER,                    -- 1 | 0 | null
    when_bucket TEXT,                       -- 'today'|'week'|'month'|'older'|null
    reason      TEXT,                       -- raw free text — review-only, never served publicly
    reason_class TEXT DEFAULT 'none',       -- reserved for a future gate; 'none' for now
    weight      REAL DEFAULT 0,             -- provisional weight (§5), finalised at manual review
    email       TEXT,                       -- optional: notify this reporter when the map updates (PII, never served)
    lat         REAL,
    lng         REAL,
    token       TEXT NOT NULL,              -- anonymous browser UUID
    ip_hash     TEXT NOT NULL,              -- salted hash of IP+day — NEVER raw IP
    created_at  TEXT NOT NULL,
    released    INTEGER NOT NULL DEFAULT 0, -- 0 = pending manual release, 1 = applied to cities.json
    UNIQUE (city, cluster_id, token, kind)  -- one SAFE and one ISSUE per area per browser (a felt-safe and an issue are different signals; don't overwrite each other)
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    text        TEXT NOT NULL,
    email       TEXT,
    token       TEXT,
    ip_hash     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    released    INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_report_city ON report(city);
  CREATE INDEX IF NOT EXISTS idx_report_pending ON report(released);
  CREATE INDEX IF NOT EXISTS idx_feedback_pending ON feedback(released);
`);

// Idempotent migrations for DBs created before a column existed. `device`/`lang`/`referer` are derived
// from request headers (UA class, Accept-Language tag, referrer host) — context, no extra PII, no raw IP.
try { db.exec('ALTER TABLE report ADD COLUMN email TEXT'); } catch (e) { /* exists */ }
for (const col of ['device', 'lang', 'referer']) {
  try { db.exec(`ALTER TABLE report ADD COLUMN ${col} TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE feedback ADD COLUMN ${col} TEXT`); } catch (e) {}
}

// Migration: widen the report uniqueness from (city,cluster_id,token) to (city,cluster_id,token,kind) so a
// "felt-safe" tap and an "issue" report in the SAME area no longer overwrite each other. SQLite can't alter
// a UNIQUE constraint in place, so rebuild the table (only when the old 3-column constraint is present).
const reportDDL = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='report'").get();
if (reportDDL && /UNIQUE\s*\(\s*city\s*,\s*cluster_id\s*,\s*token\s*\)/i.test(reportDDL.sql)) {
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE report_mig (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        city TEXT NOT NULL, cluster_id TEXT NOT NULL, kind TEXT NOT NULL,
        category TEXT, first_hand INTEGER, when_bucket TEXT, reason TEXT,
        reason_class TEXT DEFAULT 'none', weight REAL DEFAULT 0, email TEXT,
        lat REAL, lng REAL, token TEXT NOT NULL, ip_hash TEXT NOT NULL,
        created_at TEXT NOT NULL, released INTEGER NOT NULL DEFAULT 0,
        device TEXT, lang TEXT, referer TEXT,
        UNIQUE (city, cluster_id, token, kind)
      );
      INSERT INTO report_mig (id,city,cluster_id,kind,category,first_hand,when_bucket,reason,reason_class,weight,email,lat,lng,token,ip_hash,created_at,released,device,lang,referer)
        SELECT id,city,cluster_id,kind,category,first_hand,when_bucket,reason,reason_class,weight,email,lat,lng,token,ip_hash,created_at,released,device,lang,referer FROM report;
      DROP TABLE report;
      ALTER TABLE report_mig RENAME TO report;
    `);
    db.exec('COMMIT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_report_city ON report(city); CREATE INDEX IF NOT EXISTS idx_report_pending ON report(released);');
    console.log('  migrated report uniqueness to (city,cluster_id,token,kind)');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// Upsert: newest report from a token replaces its older one for the same area (§5 de-dupe).
const upsertReport = db.prepare(`
  INSERT INTO report (city, cluster_id, kind, category, first_hand, when_bucket, reason, weight, email, lat, lng, token, ip_hash, created_at, device, lang, referer)
  VALUES (@city, @cluster_id, @kind, @category, @first_hand, @when_bucket, @reason, @weight, @email, @lat, @lng, @token, @ip_hash, @created_at, @device, @lang, @referer)
  ON CONFLICT (city, cluster_id, token, kind) DO UPDATE SET
    kind=@kind, category=@category, first_hand=@first_hand, when_bucket=@when_bucket,
    reason=@reason, weight=@weight, email=@email, lat=@lat, lng=@lng, ip_hash=@ip_hash, created_at=@created_at,
    device=@device, lang=@lang, referer=@referer, released=0
`);

const insertFeedback = db.prepare(`
  INSERT INTO feedback (text, email, token, ip_hash, created_at, device, lang, referer)
  VALUES (@text, @email, @token, @ip_hash, @created_at, @device, @lang, @referer)
`);

// Rate-limit counters (per ip_hash / token within the caller-provided day window).
const countReportsByIp = db.prepare(`SELECT COUNT(*) n FROM report WHERE ip_hash=? AND created_at>=?`);
const countFeedbackByIp = db.prepare(`SELECT COUNT(*) n FROM feedback WHERE ip_hash=? AND created_at>=?`);

// Public aggregate: counts only — NEVER raw reason. Score is not moved here (manual release only).
const aggByCity = db.prepare(`
  SELECT cluster_id,
         SUM(CASE WHEN kind='issue' THEN 1 ELSE 0 END) AS issues,
         SUM(CASE WHEN kind='safe'  THEN 1 ELSE 0 END) AS safes,
         COUNT(DISTINCT token) AS reporters
  FROM report WHERE city=? GROUP BY cluster_id
`);
const topCategories = db.prepare(`
  SELECT category, COUNT(*) n FROM report
  WHERE city=? AND cluster_id=? AND kind='issue' AND category IS NOT NULL
  GROUP BY category ORDER BY n DESC LIMIT 2
`);

// A reporter's OWN pending reports (token-scoped). No PII, no raw `reason` — just enough to recognise
// and withdraw a pin.
const myReports = db.prepare(`
  SELECT id, city, cluster_id, kind, category, when_bucket, created_at
  FROM report WHERE token=? AND released=0 ORDER BY created_at DESC LIMIT 100
`);
const deleteMyReport = db.prepare(`DELETE FROM report WHERE id=? AND token=? AND released=0`);

module.exports = {
  db, DB_PATH,
  upsertReport, insertFeedback,
  countReportsByIp, countFeedbackByIp,
  aggByCity, topCategories,
  myReports, deleteMyReport,
};
