# Latam Crime Map — user stories

Updated 2026-07-03 (SEO/GEO first pass delivered). Live: `https://latamcrimemap.com` (map, GitHub Pages) + `https://api.latamcrimemap.com`
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
- **Districts, wave 5** (US-9) — 7 more single-circle cities upgraded via OSM Overpass ring-assembly
  (`scripts/add_districts_wave5.js`): Manaus (51 bairros), Florianópolis (7 distritos), Rosario (52
  barrios), Córdoba (21 barrios), La Paz (9 macrodistritos, already done), Cochabamba (8 distritos),
  Tegucigalpa (12 distritos). Reverted to single circle: Mendoza/Bariloche (OSM level 9 returns 299/80
  micro-barrios — too granular), Tijuana (bbox overlap pulls US/San Diego neighbourhoods), Saltillo
  (only one residential estate mapped), Foz do Iguaçu (relations are Ciudad del Este/PY, not Brazil).
  Santarém, Ciudad Juárez, Torreón, Mexicali, León: no OSM administrative boundary data at any level.
  `scripts/cleanup_wave5.js` handles post-run reverts from backups.
- **Crowdsourcing-health metrics** (US-23) — `npm run stats` additions: spam heat (top tokens by report
  count, flags burst submitters); district cold-map (% of choropleth districts with ≥1/≥3 crowd reports,
  cross-referenced via `cluster_id`); daily contributor retention chart (last 14 days); GoatCounter
  bot-share cross-check via `GC_SITE`/`GC_TOKEN` env vars to flag inflated event counts. All four
  remaining items shipped on top of the first-slice instrumentation (search-miss fix, abandonment tracking,
  contribution-latency lines).
- **SEO & GEO discoverability layer** (Epics B–E, H2, US-26) — full first-pass discoverability stack:
  **96 city content pages** replacing SPA copies — each `/{city}` is now a proper HTML content page with
  `<h1>="Is {City} safe for travelers?"`, definition-first safety tier verdict, named safest/highest-risk
  districts for 19 cities with differentiated scores, US State Dept advisory per country, Q&A block, and
  source links. Content is in raw HTML (no JS injection). **Technical SEO**: `robots.txt` (explicit Allow
  for GPTBot/ClaudeBot/OAI-SearchBot/PerplexityBot/Google-Extended), `llms.txt` (LLM index with
  positioning statement + all 96 city links), auto-generated `sitemap.xml` (98 URLs, regenerates every
  build). **Structured data**: `FAQPage` + `BreadcrumbList` + `WebPage/isBasedOn` JSON-LD on every city
  page; root `Dataset` + `WebSite` JSON-LD in `index.html`. **`/method/` page**: authoritative methodology
  page explaining events-not-feelings, source classes, and honesty rule — linked from every city page.
  **Map UX (H2)**: "See city overview →" muted link in district popup, below report actions, tracked as
  `drilldownClicks` in journey meta. **Feedback nudge (US-26)**: after 5 min active dwell, CSS arrow
  tooltip pointing at feedback button; 8 s auto-dismiss; fires once per browser (`sm_fb_nudged`).
  **Pipeline scaffolding (A1–A5)**: `scripts/seo_pipeline.js` — 4-stage grounded synthesis + entailment
  critic + bias filter + confidence gating; ready to run when `ANTHROPIC_API_KEY` +
  `seo/sources/{city}.json` exist. **AI SoV tracker (G2)**: `npm run sov` probes Claude/ChatGPT/
  Perplexity with "is {city} safe" queries and logs citation presence.

---

## Backlog

**Dropped:** US-17 (overview clustering) — owner decided cities should stay individual markers; the
continent view reads fine as is.

### Open

*(US-26 delivered in SEO/GEO commit above. No remaining open small-medium stories.)*

- **US-26 — Feedback nudge for engaged users.** ✅ Delivered — see Delivered section above. After 5 minutes of cumulative active dwell on the map
  (using the existing active-ms tracking, not wall-clock time), show a small tooltip-style popover with a
  CSS arrow pointing at the feedback (✉) button in the top-right corner. Copy: *"Please drop an honest
  feedback and help us improve the map — thanks a lot in advance!"* Behaviour: auto-dismisses after 8 s
  (enough time to read and decide); also dismissed immediately by any map click, Escape, or clicking the
  button itself. Fires **once per browser ever** (localStorage flag `sm_fb_nudged`) so returning visitors
  never see it again. Does not fire if the feedback modal is already open. The nudge counts as a UI
  interaction in the journey `meta` (`feedbackNudgeShown`, `feedbackNudgeClicked`) so stats can track
  conversion. No i18n needed for v1 (English only); add es/pt strings in a follow-up if uptick warrants it.

### SEO & GEO — Discoverability (full spec: `SEO_GEO.md` + `SEO_GEO_USER_STORIES.md`)

**Positioning:** LatamCrimeMap as *the consolidator* — one place that reconciles government advisories,
official crime feeds, crime indices, and traveler reports into a single incident-based read per city/district.
Defensible from day one because the *sources* exist for every city, even without proprietary ratings yet.
Full build order and acceptance criteria in the spec docs; summary below by epic.

**Epic A — Trustworthy consolidated content (build first — gates all of B–H)**
- **A1 — Grounded synthesis only.** LLM generator receives *only* the place's `sources.json` excerpts
  (no world-knowledge path). Every claim in the output tags ≥1 `source_id`; untagged claims are dropped
  at build time and logged as coverage failures.
- **A2 — Entailment double-check.** A *separate* critic LLM call checks each `(claim, cited_excerpt)` pair:
  `yes | partial | no`. `no` drops the claim; too many drops on one page marks it `confidence: limited`.
  Self-grading in one pass doesn't count — must be a distinct call.
- **A3 — Honest limited-data pages.** When source density is too low or verification strips too much, ship a
  `limited` page (banner + primary-source links, no confident verdict, no risk-coloured map). A neighborhood
  with nothing to synthesize is not generated at all. `limited` is a valid shipped state, not a failure.
- **A4 — Bias-filtered prose.** Generated draft is run through the CROWDSOURCING §4 `rejected` classifier;
  people-characterization strips and regenerates that passage. If regeneration still fails → drop, don't ship.
- **A5 — Source conflict surfaced, not smoothed.** When sources disagree, the output names both sides and
  attributes each. The reconciliation rubric fails a page that concatenates without noting conflict → regenerate
  or downgrade. This is the anti-scraper guarantee; reconciliation is the original value.

**Epic B — Crawlable, addressable pages**
- **B1 — One URL per place.** `/{city}` per covered city; `/{city}/{district}` only where A3 clears.
  Slugs = human-readable, mapped to `cluster_id`. Each page: exactly one `<h1>` = the exact question.
- **B2 — Content in raw HTML.** `view-source:` shows the verdict + full prose. Nothing citable is JS-injected.
  Pre-render regression here silently un-does the entire project — needs a CI check.
- **B3 — Definition-first answer.** First sentence = reconciled verdict. A `<h2>` Q&A block covers the real
  sub-questions (§3 templates), each answered direct-first in 1–3 sentences.

**Epic C — AI citability (GEO)**
- **C1 — Self-contained, attributed passages.** Every factual paragraph names its source(s) inline
  ("per OSAC…", "Numbeo's index puts…") and makes sense lifted out of context. No "as above" dependencies.
- **C2 — Crawler access + `llms.txt`.** `robots.txt` explicitly `Allow`s GPTBot, OAI-SearchBot, ClaudeBot,
  PerplexityBot, Google-Extended. `llms.txt` at root leads with the positioning statement + links to
  `/method/`, `/sources/`, all city pages. Verify Cloudflare bot mode isn't silently blocking these.
- **C3 — Machine-readable provenance.** `isBasedOn`/`citation` JSON-LD per page listing sources used.
  Visible sources list must match per-claim provenance from A1 exactly.
- **C4 — Comparison & "safest area" pages.** `{hood} vs {hood}` and "safest areas in {city}" pages where
  both places clear A3, drawing only on verified data. Maps to real §3 query templates.

**Epic D — Visual discovery (Google Images)**
- **D1 — Real choropleth render for map searches.** A real map render (not the OG social card) embedded on
  each city page: descriptive filename (`sao-paulo-crime-safety-map.png`), place-specific alt text, caption,
  ≥1200px, entry in image sitemap. The OG card and the real render are separate files with separate jobs.
- **D2 — Image provenance & attribution.** `ImageObject` JSON-LD per map. OSM/CARTO/Esri attribution baked
  into the image or caption where basemap tiles are used.
- **D3 — No risk colour where data is thin.** `limited`-confidence areas render as neutral "insufficient data"
  style. A coloured polygon is a safety claim and follows the same A2/A3 verification gate as prose.

**Epic E — Structured data & technical SEO**
- **E1 — `FAQPage` schema.** Every city/neighborhood page: valid `FAQPage` JSON-LD wrapping its Q&A block;
  passes Google Rich Results test.
- **E2 — Auto-generated sitemaps.** `sitemap.xml` (incl. `<image:image>` entries) regenerates every build
  with `<lastmod>` = build date; submitted to Search Console + Bing; IndexNow pings changed URLs on build.
- **E3 — Site-level entity markup.** Root: `Dataset` + `WebSite`. Every page: `BreadcrumbList` +
  self-`canonical` + OG tags.

**Epic F — Localization**
- **F1 — PT/ES variants.** `/pt/…` and `/es/…` for covered cities, with `hreflang` + self-canonical per
  variant. Query templates use the localized set (§3: "é seguro", "zonas peligrosas"…).
- **F2 — No thin translations.** A variant is emitted only where the source place cleared A3. No machine-
  translated stub is generated. Thin translated shells get demoted by Google; don't ship them.

**Epic G — Measurement, audit & safety**
- **G1 — Deterministic, auditable build.** Same `sources.json` in ⇒ byte-stable pages. Per-page log:
  sources used, claims dropped, confidence tier. The build must fail loudly, never silently.
- **G2 — AI Share-of-Voice tracking.** Scheduled job prompts ChatGPT/Perplexity/Claude/Gemini with §3
  queries for covered cities; logs citation presence + AI-referred traffic over time.
- **G3 — Thin-content & divergence watch.** Search Console + Bing wired; low-engagement pages flagged;
  CROWDSOURCING §8 divergence check runs when crowd deltas exist (crowd signal drifting toward demographics).
- **G4 — Correction/takedown path.** Any challenged claim traceable to its source, correctable or removable;
  page rebuilds; change logged. This is a safety requirement, not a nicety.
- **G5 — Source-clarity audit.** Per-city pass: displayed sources == `sources.json` provenance (no phantoms,
  no silent omissions). Each shown source has a name, recency date, and working outbound link. Outputs a
  per-city mismatch report.

**Epic H — Map ↔ page linking & UX**
- **H1 — No orphan pages.** `/` links full city list; each `/{city}` links its districts; each district page
  has breadcrumbs up + sibling links sideways. Every page ≤3 crawlable clicks from `/`, with no JS/popup
  dependency for discovery.
- **H2 — Popup drilldown without cannibalising reports.** Report actions stay visually dominant. District
  popup adds: name + one-line consolidated read, then a muted "See full breakdown →" link *below* the actions.
  Both instrumented; if report rate drops when the link is present, demote its placement further.
- **H3 — Page → map façade.** Static choropleth render (§4A) as hero — no Leaflet JS on initial load, verdict
  text above the fold, LCP unaffected. Clicking the façade loads the live map in place (no navigation, no
  hash/route change) with report popups working. A naive always-live Leaflet embed above the fold is
  explicitly rejected — it kills the SEO it's meant to support.
- **H4 — Sources box reflects real provenance.** Sources dialog lists, per city, each source *actually used*:
  name, date/recency, outbound link. Matches C3 provenance. Limited-data cities say so explicitly. Verified
  by G5 — not a static generic list.

**Suggested sprint order (per spec):**
Sprint 1: A1–A4 · Sprint 2: B1–B3, E1–E3, C2, H1 · Sprint 3: C1, C3, C4, D1–D3, H2–H4 · Sprint 4: F1–F2, A5, G1–G5

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
