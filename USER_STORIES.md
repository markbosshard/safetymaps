# Latam Crime Map — user stories

Consolidated 2026-06-30. Two parts: **Delivered** (shipped, for the record) and **Backlog**
(prioritized, each with Why / Acceptance / where-to-start). The live app is `https://latamcrimemap.com`
(map, GitHub Pages) + `https://api.latamcrimemap.com` (crowd backend, Hetzner).

---

## ✅ Delivered

- **HTTPS + Enforce HTTPS** (US-1) — apex cert issued, `https://latamcrimemap.com` → 200, Enforce HTTPS on.
- **Rebrand to "Latam Crime Map"** (US-4) — title, headers, welcome, THANKS, README all aligned to the domain.
- **Water guard via a real land mask** (US-3) — `landmask.json` (Natural Earth 10m, point-in-land + ~2km
  dilation) replaced the brittle reverse-geocode heuristic; fixed the false "looks like water" on the
  forest SE of Brasília; bays/ocean/lakes still rejected.
- **Coastal clipping to land** (US-2) — Salvador's Baía de Todos os Santos fill removed; 10 indicative
  city-level circles trimmed to the coast. Detailed choropleths deliberately left untouched.
- **14 top-tourism cities added** — Cancún, Punta Cana, Cusco, Florianópolis, Foz do Iguaçu, Los Cabos,
  Mendoza, Montevideo, Oaxaca City, Playa del Carmen, Puerto Vallarta, San Juan (PR), Bariloche, Antigua
  Guatemala — city-level circles with conservative editorial overalls (69 cities total).
- **Find the cities we cover** — top search now matches our cities (accent-insensitive, typo-tolerant —
  "Cuzco" → Cusco); the City `<select>` is now a typable filtering combobox with a "Select a city…"
  placeholder on home (partially covers US-5).
- **Returning-traveller UX** — persist transparency, basemap, district-names, borders and last city;
  from the 2nd load auto-focus the remembered city; welcome modal shows on the first 3 loads then retires.
- **"Transparency" slider** — renamed from "Risk fill" and inverted (drag right = more see-through).

---

## Backlog

### P0 — small, pending

#### US-11 — `www.latamcrimemap.com` resolves
**Why:** No `www` DNS record; GitHub keeps flagging "www improperly configured." Apex works without it.
**Acceptance:** `www.` serves the site (or 301s to apex); the warning clears.
**Where to start:** Add `CNAME www → markbosshard.github.io.` at Namecheap (needs the user logged in —
the session expired last attempt), then "Check again" in Pages settings.

### P1 — product / UX

#### US-12 — Spanish & Portuguese UI (i18n)
**Why:** The audience is overwhelmingly ES/PT speakers; English-only limits trust and reach — and trust
matters doubly for a safety product.
**Acceptance:** UI strings (header, legend, report sheet, categories, toasts, welcome) in ES + PT,
auto-selected from browser language with a manual switcher; disclaimer wording reviewed by a native speaker.
**Where to start:** Externalise strings to a dictionary; `categories.json` labels need localised variants.
Keep the bias-safe phrasing intact across translations.

#### US-13 — Social / SEO meta tags
**Why:** A crowdsourced map spreads by sharing; bare links convert poorly. Also helps search.
**Acceptance:** `og:title/description/image`, `twitter:card`, canonical URL, real `<meta name=description>`
in `index.html`/`404.html`; a static share image checked in.
**Where to start:** Inject in `build.js`; per-city OG (`/mexico-city`) is a stretch goal.

#### US-14 — Graceful behaviour when the backend is down
**Why:** Single VPS; if it's down or rate-limiting, the UX just says "try later."
**Acceptance:** Clear failure state; optional local queue + retry so a report isn't lost on a flaky
connection; 429s explain the limit.
**Where to start:** `postReport()`/`reportSafe()`/issue submit + the red `toast(...,true)` already exist;
add retry/queue and distinct copy per failure (offline vs 429 vs 5xx).

#### US-15 — Reporters can see / withdraw their own pending reports
**Why:** Trust + self-correction; a mis-placed pin can't currently be undone.
**Acceptance:** A token-scoped "my reports" list with a withdraw action; withdrawn items excluded from
the review digest.
**Where to start:** Reports already carry the localStorage `token`; add `GET /my-reports` +
`DELETE /report/:id` (token-checked) and surface in the UI. Keep raw text private.

#### US-16 — Accessibility pass
**Why:** Not audited; modals, the report sheet and the two dropdowns need focus management + ARIA.
**Acceptance:** Keyboard-operable dropdowns (the city combobox + search already have roving nav), modals
trap+restore focus, visible focus rings, sufficient contrast on the teal/terracotta chrome.
**Where to start:** Audit with axe; extend the existing keyboard nav to proper ARIA roles.

#### US-17 — Overview marker overlap at low zoom
**Why:** On the continent view, dense clusters (SE Brazil, Caribbean coast — now denser with 69 cities)
overlap and are hard to tap.
**Acceptance:** Overlapping markers cluster/spiderfy so each city is reachable.
**Where to start:** Leaflet.markercluster on the overview layer only (keep city choropleths as-is).

#### US-5 — Geocoder result quality (remainder)
**Why:** City matching is done; MapTiler place results can still return near-duplicates.
**Acceptance:** Better dedup of near-identical place results; bias ranking inside the focused city bbox.
**Where to start:** `runSuggest()` / `geocodeList()`.

#### US-6 — Surface per-city analytics
**Why:** We already count per-city pageviews in GoatCounter (Paths report).
**Acceptance:** A "most-viewed cities" view, or use it to prioritise which city-level entries to upgrade.

### P2 — data depth & ops

#### US-9 — Upgrade city-level entries to district detail
**Why:** 35 cities (incl. the 14 new tourism ones) are single circles.
**Acceptance:** District choropleths where reliable boundary + signal exist; cite sources; inherit the
overall rating where genuinely uncertain (honesty rule).
**Where to start:** geoBoundaries ADM2 / national distrito sources; `scripts/add_metros.js` is the template.

#### US-8 — Hand-drawn tourist-zone polygons for beach towns
**Why:** Resort cities (Cancún, Playa del Carmen, Puerto Vallarta, Los Cabos, Punta Cana, Tulum) have a
safe zona hotelera distinct from the rest — a single circle hides that.
**Acceptance:** zona-hotelera vs rest polygons for the main resort towns.

#### US-7 — Replace editorial scores with published crime data
**Why:** Move from editorial synthesis to official data where available.
**Acceptance:** Mexico SESNSP, Brazil SSP-SP/ISP-RJ, Chile CEAD, Colombia Policía Nacional, etc.;
normalise per-capita → 1–10; cache + refresh. Honour the honesty rule.

#### US-18 — Backend uptime monitoring + alert
**Why:** Single process on one VPS; a silent outage means lost reports.
**Acceptance:** External check pings `/health` on a schedule and alerts on failure (systemd `Restart=`
already covers crashes; this covers box/network outages).
**Where to start:** UptimeRobot-style monitor or a tiny cron from another host.

#### US-19 — "Last updated" freshness signal
**Why:** Trust + honesty; ratings move only on manual release every few days.
**Acceptance:** A subtle "ratings updated <date>" line; ties into `npm run review -- --release`.
**Where to start:** Stamp a release date during build; surface in the Sources panel footer.

#### US-10 — Crowd-report release automation polish
**Why:** The manual review → edit → rebuild → redeploy loop works but is manual.
**Acceptance (optional):** A digest email, or a one-command "apply approved deltas" helper.
