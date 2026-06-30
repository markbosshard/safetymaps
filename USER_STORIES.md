# User stories / backlog

Captured for later work. Roughly priority-ordered within each section. Each story has
**Why**, **Acceptance**, and **Notes / where to start**.

---

## P0 — Launch blockers / in-flight

### US-1 — Apex HTTPS goes live + Enforce HTTPS — ✅ DONE (2026-06-30)
Cert issued (`CN=latamcrimemap.com`), `https://latamcrimemap.com` → 200, **Enforce HTTPS** enabled.
Root cause was the cert covering apex+www stalling; re-saving the custom domain in Pages settings
unstuck issuance.
**As a** visitor, **I want** `https://latamcrimemap.com` to load without a certificate warning.
**Why:** GitHub Pages is still serving its default `*.github.io` cert >1h after DNS resolved.
Diagnosed: DNS is correct (apex → 185.199.108–111.153), **no CAA records** blocking Let's Encrypt.
Most likely cause: the custom domain was set via API *before* DNS resolved, so GitHub's first
ACME attempt failed and it's on a slow/stuck retry.
**Acceptance:**
- `openssl s_client -connect latamcrimemap.com:443` shows `CN=latamcrimemap.com` (not `*.github.io`).
- Settings → Pages → **Enforce HTTPS** is checked.
**Notes / where to start:** Re-trigger issuance: Settings → Pages → remove the custom domain → Save →
wait ~1 min → re-enter `latamcrimemap.com` → Save (GitHub's documented fix for a stuck cert). Then
tick Enforce HTTPS once the padlock is clean. Can also be driven via the browser MCP.

---

## P1 — Data correctness

### US-2 — Clip coastal districts to landmass (Salvador first)
**As a** user, **I want** city polygons to cover only land, **so that** no district bleeds across
open water.
**Why:** Salvador's `Salvador` district is the IBGE municipal boundary, which extends far into the
Baía de Todos os Santos — 25 of its 95 outer-ring vertices sit west of lon −38.55 (in the bay).
Reported by the product owner as "a massive district over the ocean."
**Acceptance:**
- Salvador's painted area follows the coastline; the bay is not filled.
- Other coastal cities audited the same way (candidates: Cartagena, Rio bay side, Maracaibo,
  Panama City, Guayaquil, Montevideo, Buenos Aires river edge).
**Notes / where to start:** Needs a coastline/landmass layer to intersect against — e.g. OSM
`natural=coastline` or Natural Earth land polygons — then `polygon ∩ land` per district. Add a
`scripts/clip_to_land.js` step (idempotent, like `scale_bubbles.js`). Avoid hand-editing vertices.

### US-3 — Tune / audit the water guard on point reports
**As a** reporter, **I want** the "that looks like water" guard to be accurate.
**Why:** Currently a heuristic: reverse-geocode the click; >2.2 km to nearest feature (or none) →
treated as water. Validated on a handful of points (land ≤1.1 km, water ≥4.6 km) but not exhaustive.
**Acceptance:** No false "water" rejections on legitimate sparse-land peripheries across a sample of
all 55 cities; large bays/lakes still rejected.
**Notes:** `isWater()` in `index.template.html`. Could add the place-type signal (land returns
`address`; water returns `major_landform`/`subregion`/`country`).

---

## P2 — Product / UX

### US-4 — Resolve in-app name vs domain ("Safety Map" vs "crime map")
**As a** visitor, **I want** consistent naming. App says "… — Safety Map" / "SafetyMaps Community";
domain is `latamcrimemap.com`. Decide one voice and align titles, `<title>`, feedback copy,
GoatCounter site, and READMEs.

### US-5 — Geocoder result quality
Improve dedup of near-identical MapTiler results (e.g. a borough returning 4 centroids) and bias
ranking toward results inside the focused city's bbox. `runSuggest()` / `geocodeList()`.

### US-6 — Per-city analytics surfaced
We count per-city pageviews in GoatCounter (Paths report). Optionally surface a "most-viewed
cities" list, or use it to prioritise which city-level entries to upgrade to detailed.

---

## P3 — Bigger features (from PROJECT.md backlog)

### US-7 — Replace editorial scores with published crime data (Task D)
Mexico SESNSP, Brazil SSP-SP/ISP-RJ, Chile CEAD, Colombia Policía Nacional, etc.; normalise
per-capita → 1–10; cache + refresh. Honour the honesty rule (no fabricated colonia-level detail).

### US-8 — Hand-drawn tourist-zone polygons for beach towns (Task E)
Cancún, Tulum, Puerto Vallarta, Zipolite — zona hotelera vs the rest.

### US-9 — Upgrade more city-level entries to district detail (Task F continuation)
geoBoundaries ADM2 / national distrito sources; always cite sources; inherit overall rating where
genuinely uncertain.

### US-10 — Crowd-report release automation polish
The manual `npm run review` → edit `cities.json` → rebuild → redeploy loop works. Optional: a small
digest email, or a one-command "apply approved deltas" helper.

---

## P0/P1 — added 2026-06-30

### US-11 — `www.latamcrimemap.com` resolves
**As a** visitor who types `www.`, **I want** the site to load (not error).
**Why:** No `www` DNS record exists; GitHub Pages also keeps flagging "www improperly configured."
**Acceptance:** `www.latamcrimemap.com` serves the site (or 301s to apex); GitHub's www warning clears.
**Notes:** Add `CNAME www → markbosshard.github.io.` at Namecheap. *(In progress — being added.)*

### US-12 — Spanish & Portuguese UI (i18n)
**As a** Latin American visitor, **I want** the interface in my language.
**Why:** The audience is overwhelmingly ES/PT speakers; an English-only UI limits trust and reach,
and trust matters doubly for a safety/crime product.
**Acceptance:** UI strings (header, legend, report sheet, categories, toasts, welcome) available in
ES + PT, auto-selected from browser language with a manual switcher; honesty/disclaimer text reviewed
by a native speaker.
**Notes:** Externalise strings to a small dictionary; `categories.json` labels need localised variants.
Keep the bias-safe wording intact across translations.

### US-13 — Social / SEO meta tags
**As a** person seeing a shared link, **I want** a rich preview (title, description, map image).
**Why:** A crowdsourced map spreads by sharing; bare links convert poorly. Also helps search.
**Acceptance:** `og:title/description/image`, `twitter:card`, canonical URL, and a real `<meta
name=description>` in `index.html`/`404.html`; a static share image checked in.
**Notes:** `build.js` can inject these; per-city OG (e.g. `/mexico-city`) is a stretch goal.

### US-14 — Graceful behaviour when the backend is down
**As a** reporter, **I want** a clear message (not a silent failure) if a submission can't be sent.
**Why:** Single VPS; if it's down or rate-limiting, the current UX just shows "try later."
**Acceptance:** Submission failures show a clear, friendly state; optional local queue + retry so a
report isn't lost on a flaky connection; 429s explain the limit.
**Notes:** `postReport()` / `reportSafe()` / issue submit + `toast(...,true)` error styling already
exist; add retry/queue and distinct copy per failure (offline vs 429 vs 5xx).

### US-15 — Reporters can see / withdraw their own pending reports
**As a** reporter, **I want** to review or remove something I submitted.
**Why:** Builds trust and self-correction; mistaken pins (wrong spot) currently can't be undone.
**Acceptance:** A token-scoped "my reports" view lists this browser's pending submissions with a
withdraw action; withdrawn items are excluded from the review digest.
**Notes:** Reports already carry the localStorage `token`; add `GET /my-reports` + `DELETE /report/:id`
(token-checked), and surface in the UI. Keep raw text private.

### US-16 — Accessibility pass
**As a** keyboard or screen-reader user, **I want** to use the map and report flow.
**Why:** Not audited; modals, the report sheet, and the search dropdown need focus management/ARIA.
**Acceptance:** Keyboard-operable search dropdown, modals trap focus + restore on close, visible focus
rings, sufficient contrast on the teal/terracotta chrome, map has a non-visual alternative path to
pick a city (the city `<select>` already helps).
**Notes:** Audit with axe; the search dropdown has roving keyboard nav already — extend to ARIA roles.

### US-17 — Overview marker overlap at low zoom
**As a** user on the continent view, **I want** to pick clustered coastal cities without zooming a lot.
**Why:** On the home overview, dense clusters (e.g. SE Brazil, Caribbean coast) overlap and are hard
to tap individually.
**Acceptance:** Overlapping markers cluster or spiderfy so each city is reachable; tooltips don't fight.
**Notes:** Consider Leaflet.markercluster for the overview layer only (keep city choropleths as-is).

### US-18 — Backend uptime monitoring + alert
**As the** operator, **I want** to know if `api.latamcrimemap.com` goes down.
**Why:** Single process on one VPS; a silent outage means lost reports and a broken submit flow.
**Acceptance:** An external check pings `/health` on a schedule and alerts (email/push) on failure;
systemd `Restart=` already covers crashes — this covers box/network outages.
**Notes:** Cheap external monitor (UptimeRobot-style) or a tiny cron from another host.

### US-19 — "Last updated" freshness signal
**As a** visitor, **I want** to know how current the ratings are.
**Why:** Trust + honesty; ratings move only on manual release every few days.
**Acceptance:** A subtle "ratings updated <date>" line (global, or per city from the last release that
touched it); ties into the `npm run review -- --release` step.
**Notes:** Stamp a release date during build; surface in the Sources panel footer.
