# User stories / backlog

Captured for later work. Roughly priority-ordered within each section. Each story has
**Why**, **Acceptance**, and **Notes / where to start**.

---

## P0 — Launch blockers / in-flight

### US-1 — Apex HTTPS goes live + Enforce HTTPS
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
