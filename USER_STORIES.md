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

- **US-12 — Spanish & Portuguese UI (i18n).** Large and quality-sensitive (you wanted native-speaker
  review). Approach: a `STRINGS` dict (`en`/`es`/`pt`) + `t(id)` everywhere + a switcher + `navigator.language`
  auto-detect + `sm_lang`; `categories.json` gains `label_es`/`label_pt`. English fallback so it's never
  half-broken. (An exhaustive string inventory — 136 strings, 45 static / 91 dynamic — is already done and
  parked, ready to execute.) The new `lang` collection field will show the real es/pt split to prioritise.
- **US-9 (waves 2+) — District the big single-municipio cities.** Wave 1 (8 cities) + wave 2 (Quito)
  shipped. Remaining circles are single municipios with no geoBoundaries sub-level, so each needs a bespoke
  per-country source, staged: **Ecuador** — Guayaquil still pending (its urban core is one parroquia in the
  open 2012 DPA layer; needs a parroquias-urbanas source) → **Colombia** comunas/localidades (Cali, Cartagena) →
  **Brazil** bairros (Brasília RAs, Manaus, Florianópolis, Foz, Santarém) → **Argentina** barrios (Rosario,
  Córdoba, Mendoza, Bariloche — ADM2 departamentos are too coarse) → **Mexico** colonias/AGEBs (Tijuana,
  Cd Juárez, Torreón, Saltillo, Mexicali, León) + La Paz/Cochabamba, Tegucigalpa. Same verify-then-ship loop
  as wave 1; districts inherit the one overall rating unless a trustworthy source lets us differentiate.

- **US-23 — Grow tracking into a "crowdsourcing-health" system.** Builds on the delivered event stream
  (Delivered) — the metrics that actually steer a *growing* crowd map (the flywheel: visitors → contributors
  → data density → better map). Surface via `npm run stats` sections now, and the US-6 dashboard later. Most
  of this is **already sitting in the `report`/`event` tables** — only search-miss + issue-sheet abandonment
  need new instrumentation. Grouped:
  - **Contribution funnel.** Issue-sheet opened-but-not-submitted = **abandonment** *(new flag on the sheet)*;
    **contribution latency** (first visit → first report) *(free)*; **repeat-contributor** distribution
    (reports per token — broad participation vs power users) *(free)*.
  - **Demand / growth compass.** **Search-miss logging** — a `search` event with a hit/miss flag + the missed
    query kept review-only (like report `reason`), so uncovered cities/areas people search for become a
    demand-ranked **build list** *(new)*; **bounce** (session, never opened a city) + **time-to-first-city**
    *(mostly free from timestamps)*.
  - **Data health & coverage.** Reports per city/district; districts with ≥1 / ≥3 reports (a **cold-map** of
    where to seed); safe/issue ratio, category mix, first-hand share; **safe↔issue conflict** per district;
    report **freshness** (age distribution) *(all free from `report`)*.
  - **Trust / abuse.** Reports per token & per ip_hash/day (spam), **rejected** submissions (the bias-gate),
    **bot-share** estimate by cross-checking volumes against GoatCounter *(mostly free)*.
  - **Retention.** New-vs-returning over time; **contributor retention** (contributors who return *and*
    contribute again) *(free)*.
  Privacy stays as-is: anonymous token, no PII, no raw IP, DNT-respected; search-miss queries are review-only
  and never served. First cheap slice: search-miss + issue-sheet abandonment + a "data-health & funnel"
  stats section.

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
