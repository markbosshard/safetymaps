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

---

## Backlog

**Dropped:** US-17 (overview clustering) — owner decided cities should stay individual markers; the
continent view reads fine as is.

### Open

- **US-20 — Make "click the map to contribute" discoverable.** *Problem:* people don't realise they can
  tap the map (a district → rating popup, or empty space → a point report). Today the only hint is the
  onboarding overlay, which retires after 3 opens, so returning/most users never learn the gesture.
  *Approach (layered, cheap → richer):*
  (1) an **always-visible call-to-action** — a small floating pill bottom-centre, e.g. "＋ Rate this area —
  tap the map", that fades but returns on idle;
  (2) a **one-time coach-mark**: a pulsing ripple + "Tap here to rate" the first time each city opens
  (separate from the welcome modal, keyed per-session not per-lifetime);
  (3) a **crosshair cursor** over a focused city on desktop, signalling clickability;
  (4) **hover/long-press tooltips** on districts ("Tap to rate · ▲ safe / ⚑ issue");
  (5) an explicit **"＋ Report" mode button** (header or bottom bar) that arms a crosshair + banner
  "Tap where it happened", turning the implicit gesture into an obvious mode for people who won't guess it.
  Recommended first cut: (1) + (2) + (5). Measure with the new GoatCounter events before adding more.
- **US-21 — Reset button inside the menu.** A small circular-arrow (↻ refresh) icon at the **top-left of
  the opened hamburger menu**. Resets all app settings **and** clears localStorage back to defaults —
  **except** an allowlist that survives: the reporter identity/queue (so someone keeps the ability to see &
  withdraw their own reports) and anything GoatCounter uses. So: **clear** `sm_lang`, transparency, basemap,
  toggles (names/borders), onboarding-seen counters, last-city; **keep** the report token + offline report
  queue + GoatCounter keys. Confirm before wiping ("Reset settings to default? Your reports stay."), then
  re-render to defaults. (First step: audit the exact `localStorage` keys in use and split into clear/keep.)
- **US-22 — "Locate me" button (Google-Maps style).** A round button **bottom-right** that uses the device
  geolocation (`navigator.geolocation`, works iOS/Android/Windows). On tap: zoom to a **useful level where
  neighbouring districts are still visible** (roughly the city/district zoom, not max), and drop a **slowly
  pulsing blue dot** (+ soft accuracy halo) at the user's position, like Google Maps. Handle gracefully:
  permission denied → a short toast; location outside our covered cities → recentre to the nearest covered
  city (or a "we don't cover that area yet" note). HTTPS is already in place, which the geolocation API
  requires.
- **US-12 — Spanish & Portuguese UI (i18n).** Large and quality-sensitive (you wanted native-speaker
  review). Approach: a `STRINGS` dict (`en`/`es`/`pt`) + `t(id)` everywhere + a switcher + `navigator.language`
  auto-detect + `sm_lang`; `categories.json` gains `label_es`/`label_pt`. English fallback so it's never
  half-broken. (An exhaustive string inventory — 136 strings, 45 static / 91 dynamic — is already done and
  parked, ready to execute.) The new `lang` collection field will show the real es/pt split to prioritise.
- **US-9 (waves 2+) — District the big single-municipio cities.** Wave 1 (8 cities) shipped. Remaining
  circles are single municipios with no geoBoundaries sub-level, so each needs a bespoke per-country source,
  staged: **Ecuador** parroquias (Quito, Guayaquil) → **Colombia** comunas/localidades (Cali, Cartagena) →
  **Brazil** bairros (Brasília RAs, Manaus, Florianópolis, Foz, Santarém) → **Argentina** barrios (Rosario,
  Córdoba, Mendoza, Bariloche — ADM2 departamentos are too coarse) → **Mexico** colonias/AGEBs (Tijuana,
  Cd Juárez, Torreón, Saltillo, Mexicali, León) + La Paz/Cochabamba, Tegucigalpa. Same verify-then-ship loop
  as wave 1; districts inherit the one overall rating unless a trustworthy source lets us differentiate.

### Bigger / optional

- **US-7 — Published crime data.** Replace editorial scores with official data (Mexico SESNSP, Brazil
  SSP-SP/ISP-RJ, Chile CEAD, Colombia Policía Nacional…). A multi-country data project — each source has its
  own format/units; needs careful, reviewed per-country work to stay within the honesty rule. Headline future task.
- **US-6 — A whole admin backend.** *Needs to be specified.* Grows out of the original "surface per-city
  analytics" idea (most-viewed cities from GoatCounter) into a proper operator console: review/triage of
  incoming reports + feedback, the manual-release workflow, score editing, and analytics — all in one place
  instead of the current CLI (`npm run review`) + hand-edited `cities.json`. Scope, auth, and hosting are
  open; we're not building it yet. Sits with US-7 in the later/bigger area.
