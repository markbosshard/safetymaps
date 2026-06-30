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
    UNIQUE (city, cluster_id, token)        -- one active report per area per browser (upsert)
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

// Migration for DBs created before the `email` column existed (idempotent).
try { db.exec('ALTER TABLE report ADD COLUMN email TEXT'); } catch (e) { /* column already exists */ }

// Upsert: newest report from a token replaces its older one for the same area (§5 de-dupe).
const upsertReport = db.prepare(`
  INSERT INTO report (city, cluster_id, kind, category, first_hand, when_bucket, reason, weight, email, lat, lng, token, ip_hash, created_at)
  VALUES (@city, @cluster_id, @kind, @category, @first_hand, @when_bucket, @reason, @weight, @email, @lat, @lng, @token, @ip_hash, @created_at)
  ON CONFLICT (city, cluster_id, token) DO UPDATE SET
    kind=@kind, category=@category, first_hand=@first_hand, when_bucket=@when_bucket,
    reason=@reason, weight=@weight, email=@email, lat=@lat, lng=@lng, ip_hash=@ip_hash, created_at=@created_at, released=0
`);

const insertFeedback = db.prepare(`
  INSERT INTO feedback (text, email, token, ip_hash, created_at)
  VALUES (@text, @email, @token, @ip_hash, @created_at)
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

module.exports = {
  db, DB_PATH,
  upsertReport, insertFeedback,
  countReportsByIp, countFeedbackByIp,
  aggByCity, topCategories,
};
