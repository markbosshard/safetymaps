# Latam Crime Map — user stories

Updated 2026-06-30. Live: `https://latamcrimemap.com` (map, GitHub Pages) + `https://api.latamcrimemap.com`
(crowd backend, Hetzner). Two parts: **Delivered** and **Backlog** (with status notes).

---

## ✅ Delivered

- **HTTPS + Enforce HTTPS** (US-1) · **www DNS** (US-11, owner) · **Rebrand to "Latam Crime Map"** (US-4).
- **Land-mask water guard** (US-3) — `landmask.json` (Natural Earth 10m, point-in-land + ~2km dilation);
  fixed the forest-near-Brasília false positive; bays/ocean/lakes still rejected.
- **Coastal clipping to land** (US-2) — Salvador's bay removed; 10 coastal city circles trimmed.
- **14 tourism cities** (69 total) — Cancún, Punta Cana, Cusco, Florianópolis, Foz do Iguaçu, Los Cabos,
  Mendoza, Montevideo, Oaxaca City, Playa del Carmen, Puerto Vallarta, San Juan (PR), Bariloche, Antigua GT.
- **Fuzzy city search + typable City combobox** + **near-duplicate place dedup** (US-5).
- **Returning-traveller persistence** (city/transparency/basemap/toggles) + welcome-3×-then-retire + auto-focus.
- **Transparency slider** (renamed + inverted).
- **Per-city "More resources" links** in the Sources panel.
- **Social/SEO meta + share image** (US-13) — OpenGraph/Twitter tags + `og-image.png`.
- **"Ratings refreshed <date>"** freshness line (US-19).
- **Graceful backend-down UX** (US-14) — offline/429/5xx copy + a localStorage report queue that re-sends
  on the next load.
- **Accessibility pass** (US-16) — modal focus trap + restore, ARIA combobox/listbox/option, focus-visible rings.
- **Report withdrawal** (US-15) — token-scoped `GET /my-reports` + `DELETE /report/:id`; a "My reports"
  modal to withdraw your own pending pins.
- **Uptime monitoring** (US-18) — GitHub Actions healthcheck every ~15 min; failure emails the owner.
- **Tourist-core zones** (US-8) — Cancún, Playa del Carmen, Los Cabos, Puerto Vallarta now show a safer
  beachfront resort core vs the rest of the city, derived from clusters of OSM coastal hotels (honest
  label: approximate, not an official boundary). Punta Cana skipped (OSM under-mapped there).
- **Districts, wave 1** (US-9) — 8 single-circle cities upgraded to clickable district choropleths (all
  districts inherit the one honest overall rating): Oaxaca City (30), Antigua GT (14), Montevideo (10),
  Maracay (7), Mérida (6), San José CR (28), San Juan PR (26), Cusco (6). New `scripts/add_districts.js`
  generalises geoBoundaries ADM2/ADM3 + the Peru INEI distrito source.
- **Contribute call-to-action** (US-20) — a dismissible "👆 Tap any area to rate it" pill in city view +
  crosshair cursor; retires after dismiss or a first successful report. Fixes "people don't know they can tap".
- **Menu reset button** (US-21) — ↻ at the top-left of the opened menu; clears all settings/localStorage
  except the reporter identity + queue (keeps report-withdrawal ability) and GoatCounter keys.
- **"Locate me" button** (US-22) — Google-style bottom-right button; device geolocation → zoom with
  neighbouring districts still visible + slow-pulsing blue dot & accuracy halo; focuses the user's city.
- **Districts, wave 2** (US-9) — Quito → 17 DMQ parroquias (urban Quito + Calderón, Cumbayá, Tumbaco,
  Conocoto…), inheriting the overall rating. Source: DMQ open parroquias (flandrade/quito-crime-map).
- **Districts, waves 3–4** (US-9) — Guayaquil (15 parroquias urbanas), Cali (22 comunas), Cartagena (17
  UCGs), Brasília (31 Regiões Administrativas), all inheriting the overall rating. Sources: municipal
  ArcGIS / IPE.DF GeoServer open data (verified live) + Douglas-Peucker simplification (~44 m) so full-res
  boundaries don't bloat the bundle (Cali 27k→660 verts).
- **27 missing 1M+ metros added** (69 → 96 cities) — Caracas/Maracaibo/Valencia/Barquisimeto (VE), Porto
  Alegre, Santos, Sorocaba, Natal, São Luís, João Pessoa, Teresina, Ribeirão Preto, Joinville, Londrina,
  Cuiabá, Aracaju (BR), Valparaíso/Concepción (CL), Barranquilla/Cúcuta (CO), Santa Cruz (BO), Trujillo (PE),
  Culiacán (MX), San Pedro Sula (HN), Managua (NI), Santiago de los Caballeros (DO), Port-au-Prince (HT).
  Honest city-level circles with editorial overall ratings (`scripts/add_missing_metros.js` → bubbles →
  clipland → clusters); no invented neighbourhood detail. Adds Nicaragua & Haiti to the country set.
- **Double-tap fix** (US-25) — debounced the district-layer and periphery click handlers with a 250 ms
  timer cancelled by `map.on('dblclick')`, so a double-tap does only Leaflet's native one-level zoom with
  no pin and no snap to PIN_ZOOM.
- **Search drops only grey pin** (US-24) — `selectResult` for non-city geocoder results now does only
  `dropPin` (grey `searchPin`) + `zoomToPin`, matching "Locate me". No report sheet or `reportPin` is
  opened; the user taps the exact spot themselves.
- **Spanish & Portuguese UI (i18n)** (US-12) — all previously-English strings wired through `t()` with
  es + pt translations in `STRINGS`: issue sheet (title, sub, When/First-hand chips, reason label/ph,
  email hint, Submit), submitErr messages, thanksModal (Applied text, email hint, Notify-me, email-ok),
  geolocation toasts, map-click toasts (outside-city, water), withdrawReport modal, when-bucket chips via
  `catLabel()`. `lang` analytics field shows the real language split.
- **First-party usage analytics** (feeds US-6) — privacy-preserving event stream keyed by the anonymous
  browser token: `session`/`view`/`end` beacons → `event` table, with a rich per-session `meta` summary
  (pans, zooms, favourite zoom level, active dwell, districts opened, report left?, search/locate used,
  settings changed, menu closed?, legend/sources opened?, welcome/thanks/CTA shown-vs-dismissed, modal
  left open?). `npm run stats` renders it (journeys, dwell, returning, explorers, top cities, behaviour).
  No PII, no raw IP, respects Do-Not-Track.

---

## Backlog

**Dropped:** US-17 (overview clustering) — owner decided cities should stay individual markers; the
continent view reads fine as is.

### Open

- **US-9 (waves 5+) — District the remaining single-municipio cities.** Done: waves 1–2 (8 cities + Quito),
  waves 3–4 (Guayaquil, Cali, Cartagena, Brasília). Remaining, each needing a bespoke per-country source:
  **Brazil** — Manaus & Florianópolis via OSM Overpass (needs relation ring-assembly — verified sources exist,
  the official Manaus IMPLURB ArcGIS returns null geometry so OSM is the path), plus Foz do Iguaçu, Santarém →
  **Argentina** barrios (Rosario, Córdoba, Mendoza, Bariloche — ADM2 departamentos are too coarse) →
  **Mexico** colonias/AGEBs (Tijuana, Cd Juárez, Torreón, Saltillo, Mexicali, León) + La Paz/Cochabamba,
  Tegucigalpa. Same verify-then-ship loop; districts inherit the one overall rating unless a trustworthy
  source differentiates them. `scripts/add_districts.js` now supports geoBoundaries, direct GeoJSON, ArcGIS
  query endpoints, merge-by-name, and DP simplification.

- **US-23 — Crowdsourcing-health metrics — FIRST SLICE DELIVERED.** The three new instrumentation pieces
  are shipped: (1) `logSearchMiss` now wraps `{q,hit:0}` in `meta` so queries are actually persisted in the
  event table (was a bug — data was silently dropped); `selectResult` emits `search {meta:{hit:1}}` for
  successful picks. (2) `openIssueSheet` sets `_curModal='issue'`; `closeModal` increments
  `jr.issueAbandoned` when the sheet is dismissed without submitting — included in `journeySummary`. (3)
  `stats.js` shows explicit abandonment count in the Funnel section, plus new Contributions lines for
  contributor retention (2+ report-days) and contribution latency (first session → first report).
  **Remaining / future:** districts with ≥1/≥3 reports cold-map; per-token spam heat; bot-share
  cross-check with GoatCounter; contributor retention chart over time. No PII added.

### Bigger / optional

- **US-7 — Published crime data.** Replace editorial scores with official data (Mexico SESNSP, Brazil
  SSP-SP/ISP-RJ, Chile CEAD, Colombia Policía Nacional…). A multi-country data project — each source has its
  own format/units; needs careful, reviewed per-country work to stay within the honesty rule. Headline future task.
- **US-6 — A whole admin backend.** *Needs full spec; not building yet.* A web operator console that
  replaces the CLIs (`npm run review` / `npm run stats`) + hand-edited `cities.json`: report/feedback
  **triage**, the **manual-release** workflow, **score editing**, and an **analytics dashboard**. The
  analytics **collection layer is already built** (see Delivered — the token-keyed `event` stream + rich
  per-session journey `meta`); this story is its **visualiser**.
  **Analytics sourcing — we keep BOTH, with a clear split:**
  - **Our own `event` DB** = the primary source: per-visitor **anonymous journeys** (returns, cities opened,
    dwell, pans/zooms/favourite zoom, which UI they touched, whether they rated) — keyed by `sm_token`, so
    it can join to actual report data. GoatCounter structurally *can't* do this (it's sessionless).
  - **GoatCounter stays** for what it's hardened at and we shouldn't rebuild: **bot/spider filtering** and
    hosted geo/browser/OS/referrer/campaign counts. Pull via its API for those aggregates.
  - Caveat to handle in the dashboard: our stream is **not** bot-filtered → cross-check volumes against
    GoatCounter (a later step could add light bot heuristics). Sits with US-7 in the later/bigger area.

---

## 🌎 1M+ metros — ✅ NOW ADDED (was: still missing)

*All of the below (and ~20 more 1M–2M metros) were added as city-level circles — see the Delivered entry
"27 missing 1M+ metros added". Kept here as the record of the gap that was closed.*

**The glaring ones (2M+ metros we didn't have — now added):**
- 🇻🇪 **Caracas** (~2.9M) — *the capital; we oddly have Maracay but not Caracas*
- 🇧🇷 **Porto Alegre** (~4.1M) — RS capital, one of Brazil's biggest
- 🇻🇪 **Maracaibo** (~2.2M) · **Valencia** (~2.0M)
- 🇨🇴 **Barranquilla** (~2.2M)
- 🇧🇴 **Santa Cruz de la Sierra** (~2.0M) — Bolivia's largest city
- 🇭🇹 **Port-au-Prince** (~2.7M) — *if you count Haiti as LatAm*
