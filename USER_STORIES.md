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

---

## Backlog

**Dropped:** US-17 (overview clustering) — owner decided cities should stay individual markers; the
continent view reads fine as is.

### Open

- **US-12 — Spanish & Portuguese UI (i18n).** Large and quality-sensitive (you wanted native-speaker
  review). Approach: a `STRINGS` dict (`en`/`es`/`pt`) + `t(id)` everywhere + a switcher + `navigator.language`
  auto-detect + `sm_lang`; `categories.json` gains `label_es`/`label_pt`. English fallback so it's never
  half-broken. (An exhaustive string inventory — 136 strings, 45 static / 91 dynamic — is already done and
  parked, ready to execute.)
- **US-9 — Upgrade city-level circles to districts.** Low value for the remaining entries: with no
  per-district signal every district inherits one rating → uniform colour, no better than a clean circle.
  Revisit per city when there's data to differentiate. `scripts/add_metros.js` (geoBoundaries ADM2) is the template.

### Bigger / optional

- **US-7 — Published crime data.** Replace editorial scores with official data (Mexico SESNSP, Brazil
  SSP-SP/ISP-RJ, Chile CEAD, Colombia Policía Nacional…). A multi-country data project — each source has its
  own format/units; needs careful, reviewed per-country work to stay within the honesty rule. Headline future task.
- **US-6 — Surface per-city analytics.** A "most-viewed cities" view from GoatCounter's Paths report. Low
  priority; the data is still new/sparse.
- **US-10 — Release-automation polish.** Optional helper (digest email, or a one-command "apply approved
  deltas") on top of the working manual `npm run review` loop.
