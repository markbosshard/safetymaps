# Latin America — City Safety Map

Interactive single-file web map that rates neighbourhood/city safety across Latin America on a
green→red scale. This document is the full project reference **and** the handoff brief for continuing
in Claude Code. (Drop a short `CLAUDE.md` in the repo root pointing at this file, or rename this to
`CLAUDE.md`.)

---

## 1. What it is

- One self-contained `index.html` (~530 KB) — Leaflet map, all data embedded as a JS object, no build
  step required to *run* it. Deploys as a static file (GitHub Pages).
- **55 cities** in two tiers:
  - **7 "detailed"** cities — real administrative polygons, per-neighbourhood ratings.
  - **48 "city-level"** cities — one honest overall rating each, drawn as a labelled zone.
- Features: city selector (grouped), OSM/satellite/dark/light basemaps, opacity + labels + borders
  toggles, address/neighbourhood search (offline name match + Nominatim geocode), collapsible
  Legend and Sources panels, hash-based URL routing, GoatCounter analytics, and a prepared
  up/down vote UI (front-end stub only).

---

## 2. Files

| File | Role |
|---|---|
| `index.html` (delivered as `sao_paulo_risk_zoning.html`) | The app. HEAD (markup+CSS) + embedded `CITIES` JSON + TAIL (JS). |
| `cities.json` | The data bundle for all cities (see schema below). Embedded into the HTML at build time. |
| `cmap.json` | Green→red safety colormap as `[[value,hex],…]` for values 1..10. Source of the gradient + tier swatches. |
| `scored.json` | São Paulo only: 96 districts with the **continuous** Vanguard-derived scores + geometry. |
| `geo/*.geojson` | Downloaded raw boundary files per city (working data). |
| `build_cities.py` | Builds the 5 original tier cities (CDMX/Rio/Medellín/BA + SP from `scored.json`) → `cities.json`. |
| `patch_cdmx.py` | Rebuilds Mexico City at colonia level (central boroughs) + outer alcaldías + Edomex metro ring. |
| `add_cities.py` | Adds Bogotá (localidades) + Santiago (comunas). |
| `build_more.py` | Adds the 48 city-level entries (coords from `geonamescache`, circle geometry, editorial overall tiers). |
| The HTML generator | Currently an inline Python heredoc that reads `cities.json` + `cmap.json` and writes the HTML. **TODO: consolidate into `build.py`.** |

> The four build scripts ran in sequence (`build_cities` → `patch_cdmx` → `add_cities` → `build_more` → HTML generator). They are idempotent on `cities.json`. First Claude Code task is to merge them into one `build.py`.

---

## 3. Architecture

- **Rendering**: Leaflet 1.9.4 (CDN). Each city's areas are GeoJSON polygons added as layers, styled by score.
- **Data**: the entire `CITIES` object is inlined into the HTML (no fetch). Switching city swaps layers,
  refits bounds, updates title/sub/sources, and rewrites the URL hash.
- **Colour**: `color(score)` interpolates `CMAP` (t = (score−1)/9). Tier bands: Safe <2.5, Moderate <5,
  Caution <7.5, Avoid ≥7.5.
- **No backend.** Search uses public Nominatim; analytics via GoatCounter. Everything else is client-side.

### `CITIES` / `cities.json` schema
```jsonc
{
  "sao-paulo": {
    "name": "São Paulo",
    "country": "br",            // ISO-2, used to bias Nominatim geocoding
    "model": "continuous",      // "continuous" | "tier" | "city"
    "slug": "saopaulo",         // URL hash slug
    "tier_level": "detailed",   // "detailed" | "city"  (drives the selector optgroup)
    "bbox": [W, S, E, N],       // geocode viewbox
    "districts": [
      { "name": "Pinheiros", "score": 4.2, "geom": {GeoJSON Polygon/MultiPolygon}, "label": [lon, lat] }
    ],
    "note": "…shown in the Sources panel…",
    "sources": [ { "text": "…", "url": "…optional…" } ]
  }
}
```
- **model**:
  - `continuous` → São Paulo only; popup shows `score/10`.
  - `tier` → detailed cities scored on the 4-tier editorial scale; popup shows the tier name.
  - `city` → the 48 overall-rating cities; single "district" = a circle; popup says "overall · city-level".
- **Tier → score** mapping used everywhere: `T1=2.0, T2=4.0, T3=6.0, T4=8.5` (so tiers land on the same gradient as the continuous model).

---

## 4. How the data is gathered (the pipeline)

### 4.0 The colormap
`cmap.json` was sampled from the colorbar of the original **Vanguard Attaché** São Paulo risk
choropleth — a green→amber→red ramp digitised to `[value,hex]` for 1..10. The whole app's colour and
the legend swatches derive from it.

### 4.1 São Paulo — continuous (the gold standard)
1. District polygons: `codigourbano/distritos-sp` (96 distritos, field `ds_nome`).
2. Score: the Vanguard Attaché choropleth **image** was georeferenced onto those polygons; each
   district's fill colour was sampled and inverted against the colorbar to a continuous 1–10 score.
3. Result stored in `scored.json` (name, score, simplified geom, label point). This is the only
   image-derived, continuous-scored city.

### 4.2 Detailed cities — administrative polygons + editorial 4-tier scoring
Boundaries fetched from GitHub-hosted GeoJSON (raw / gist-raw / codeload tarball, because the sandbox
only allows github.com, raw.githubusercontent.com, codeload.github.com, pypi, npm). Each unit is
assigned a tier (1–4) from curated dictionaries reflecting **visitor** risk (not raw crime rate),
defaulting unlisted units to a sensible level.

| City | Unit (count) | Source | Name field | Default tier |
|---|---|---|---|---|
| Mexico City | colonias central + alcaldías outer + Edomex ring (181) | `JuveCampos/Shapes_Resiliencia_CDMX_CIDE` (codeload tarball) | `nombre_colonia`+`nom_mun` / `NOM_MUN` | see §4.3 |
| Rio de Janeiro | bairros (162) | gist `esperanc/db213370dd176f8524ae6ba32433f90a` → `Limite_Bairro.geojson` | `NOME` | 3 (caution) |
| Medellín | comunas+corregimientos (21) | gist `davixcky/ade2468ed713364fd5876a16305608b4` → `medellin.geojson` | `NOMBRE` | 3 |
| Buenos Aires | barrios (48) | `OpenDataCordoba/barrios/main/caba_barrios.geojson` | `BARRIO` | 2 |
| Bogotá | localidades (18) | `cilopez/geojson-houm` → `geobogota.geojson` | `NOMBRE` | 3 |
| Santiago | comunas (32) | `cilopez/geojson-houm` → `geosantiago.geojson` | `NOM_COM` | 3 |

Tier dicts live in the build scripts (e.g. BA: Palermo/Recoleta/Puerto Madero/Belgrano/Núñez = T1;
Lugano/Soldati/Riachuelo = T4). All geometry simplified (`shapely.simplify`, tol ≈ 0.0004–0.0006) and
coordinates rounded to 5 dp to keep the bundle small.

### 4.3 Mexico City — the colonia method (template for upgrading other cities)
- **Central boroughs** Cuauhtémoc, Miguel Hidalgo, Benito Juárez are *exploded* into colonias from
  `Poligono_colonias.geojson` (1,815 colonias, fields `nombre_colonia`+`nom_mun`), then **dissolved by
  cleaned name** (e.g. "ROMA NORTE I/II/III" → one "Roma Norte"), with curated overrides
  (Roma/Condesa/Polanco/Del Valle = safe; Centro/Guerrero = caution; Doctores/Morelos[Tepito] = avoid).
  Unlisted colonias inherit their borough's default tier.
- **Outer 13 alcaldías** stay as whole polygons (`CDMX_mpal.geojson`, `NOM_MUN`).
- **Metro extension**: a curated ring of Estado de México municipios (`municipios_zmvm.geojson`) —
  Ecatepec/Chimalhuacán/Chalco = avoid, Neza/Naucalpan/Tlalnepantla = caution, Huixquilucan = moderate.

### 4.4 City-level 48 — overall ratings
- **Coordinates**: `geonamescache` (pip, offline) → city centroid lat/lon. A couple of fallbacks were
  hardcoded (León, Querétaro, Panama City).
- **Geometry**: a circle (46-point polygon, radius 5–10 km by rough metro size) centred on the city —
  it is a *marker for "this city,"* not a boundary claim.
- **Score**: one editorial **overall** tier per city from general travel-security knowledge
  (advisories/OSAC + homicide reputation). Examples: Mérida = Safe; Curitiba/Havana = Moderate;
  Tijuana/Juárez/Guatemala City/Rosario/Cali/Guayaquil/Recife/Fortaleza/Salvador = high.
- Marked `model:"city"`, `tier_level:"city"`, and labelled "city-level · neighbourhoods not yet mapped"
  in the popup and Sources panel.

---

## 5. Scoring methodology & honesty rules (do not break these)

- Ratings are **editorial travel-safety synthesis**, not a single crime-rate metric — except São Paulo
  (sampled continuous model). Cross-city comparison is directional, not exact.
- **Never fabricate per-neighbourhood ratings for a city you don't actually know.** That was the
  explicit line: city-level overall is honest; inventing colonia-level detail for, say, Toluca is not.
- Mixed granularity is intentional and disclosed per-city in the Sources panel.
- A few ratings are genuinely contested and flagged (e.g. San Salvador rated caution given the recent
  homicide collapse; Cartagena "caution overall" despite a safe tourist core).

---

## 6. Frontend features (implementation notes)
- **Basemaps**: OSM (default), Esri imagery, CARTO dark/light. Tiles are often blocked in the
  claude.ai preview sandbox → a red "open in a browser" hint appears on repeated tile errors; works
  fine when deployed.
- **Search**: exact/prefix/substring match against the active city's district names first (offline);
  else Nominatim geocode biased to the city bbox + country, drops a pin, resolves the containing
  district by point-in-polygon.
- **Labels**: permanent tooltips, shown always if ≤50 areas else at zoom ≥13; white text on dark bases.
- **Panels**: Map controls = header dropdown (see §7). Legend + Sources = collapsible launchers
  (bottom-right / bottom-left).
- **Dark-reader lock** + `color-scheme` meta to stop page-recolouring extensions from breaking styles.
- **Analytics**: GoatCounter (`citysafety-proj`). Self-exclude via `…#toggle-goatcounter`.

---

## 7. UI — header / hamburger (current state)
The hamburger (`#menuBtn`) is the **first element in the header**, before the city title. Clicking it
opens `#ctrl` as a **downward dropdown** anchored to the header's bottom-left (`position:absolute;
top:100%`), animated (opacity + scaleY). It's a child of `<header>` so it stays attached even when the
bar wraps on mobile. Zoom control moved to **top-right** to avoid the dropdown. Menu closes on city select.

---

## 8. URL routing
Single-file friendly (no folders). Hash is the primary scheme; `?city=` also accepted.
- `…/index.html#saopaulo`, `#mexicocity`, `#bogota`, `#santiago`, `#rio`, `#medellin`, `#buenosaires`,
  and every city-level slug (`#tijuana`, `#havana`, `#belohorizonte`, …). Slug = name lowercased,
  no spaces/accents (`CITIES[key].slug`).
- Aliases: `#cdmx`, `#mexico`, `#riodejaneiro`, `#ba`, `#sp`.
- `buildCity()` writes the hash via `history.replaceState`; `hashchange` listener handles back/forward
  and shared links. **True `/santiago` pretty-paths** would need either a folder+`index.html` per city
  or a `404.html` SPA-redirect — not implemented (hash is the clean single-file answer).

---

## 9. Network/source gotchas (sandbox vs Claude Code)
- The **chat sandbox** can only fetch from github.com, raw.githubusercontent.com, codeload.github.com,
  pypi, npm. **geoBoundaries is Git-LFS**, so raw fetch returns pointer files → unusable here.
- **In Claude Code on your machine there is no such restriction.** That unlocks
  **geoBoundaries** (`wmgeolab/geoBoundaries`, ADM2 = municipality in most of LatAm, uniform
  `shapeName` field; ADM3 where available) as the go-to source to upgrade the 48 city-level entries
  to **real municipal polygons** and to get sub-city units. This is the single biggest data upgrade.

---

# 10. CLAUDE CODE — follow-up tasks

### Setup
1. **Consolidate** the four build scripts + the inline HTML generator into one `build.py`
   (`fetch → score → bundle cities.json → emit index.html`). Keep tier dicts in a `scoring/` module.
2. Add a `Makefile`/`npm script`: `build`, `serve`, `deploy`.
3. Re-fetch geometry via **geoBoundaries** where it improves on the current ad-hoc sources.

### Task A — All cities visible when zoomed out (+ lazy loading)  *(requested)*
- At low zoom (world/continent), render **all cities at once**: every detailed city as its polygons is
  too heavy (CDMX alone is 181 polys, plus Rio 162…), so at low zoom show **one representative
  marker/centroid per city** coloured by its overall rating; only load a city's full polygon layer
  when it's selected **or** when zoomed in past a threshold over it.
- The **selector becomes "focus + lazy-load trigger"**, not the only way to see a city.
- Implementation sketch: keep a lightweight `OVERVIEW` layer (1 point/city, from `bbox` centre +
  an overall score — for detailed cities compute an area-weighted mean or a chosen headline tier).
  On `zoomend`/`moveend`, for cities whose bounds intersect the viewport at zoom ≥ N, lazily build
  their full polygon layer (cache it); drop layers for out-of-view cities to save memory.
- Consider marker clustering (`Leaflet.markercluster`) for the overview at very low zoom.

### Task B — Voting (front-end stub already in place)  *(requested)*
- **Terms chosen**: ▲ **Felt-safe** / ▼ **Felt-sketchy** (dashed two-word, reads as a personal report).
  Single-word alternatives if preferred: **Safer / Sketchier**. (Avoid raw "Upvote/Downvote" — the
  semantic is *perceived safety*, not popularity.)
- Current code: `castVote()` + in-memory `VOTES` object + `.vote` UI in every popup. **No persistence.**
- **Backend (no heavy identity).** Layered, anonymous, low-friction:
  1. One vote per browser via a random `localStorage` UUID token (generated first visit).
  2. Server-side **IP rate-limit**: store a *salted hash* of IP (+ area + day), never raw IP.
  3. Bot protection: **Cloudflare Turnstile** / hCaptcha, challenge only suspicious traffic.
  4. Optional later: Google/Apple sign-in as a *trust booster* (weight signed-in votes), never a gate.
- Endpoints (FastAPI/Express/PHP on the Hetzner box, SQLite/Postgres):
  - `POST /vote {city, cluster_id, dir, token}` → `UNIQUE(city, cluster_id, token)` upsert (vote is changeable).
  - `GET /votes?city=…` → tallies per cluster.
  - Display community signal as a **delta vs the editorial score**, only after ≥5 votes.
- **Zero-backend shortcut**: Supabase free tier — Postgres + REST + **anonymous auth** (durable anon
  id with no user friction) + RLS + rate limits.

### Task C — Fine-grained district clusters for **every** city  *(requested — required for voting)*
Voting needs stable, granular `cluster_id`s for **all** cities, including the 48 currently single-rating ones.
- **Detailed cities**: use the existing district polygons as clusters (`cluster_id = slug + ":" + districtName`).
- **City-level cities**: subdivide. Options, best first:
  1. **Real neighbourhood polygons** where fetchable (geoBoundaries ADM3, OSM `place=suburb/neighbourhood`
     via Overpass, or per-city open data). Cleanest, human-readable ids.
  2. **H3 hex grid** (uber/h3) at res ~8–9 over each city's footprint — uniform, needs no boundary data,
     `cluster_id = h3 index`. Great fallback for the long tail.
- **Seed each cluster's editorial tier before crowdsourcing** by *researching* it: r/<city> and
  r/solotravel threads, OSAC reports, Numbeo, local news — extract "avoid X / Y is fine at night".
  This raises accuracy per cluster and gives voters a sensible starting colour to confirm or correct.
  Keep the honesty rule: where research is thin, leave the cluster "unrated" rather than guessing.
- Store clusters in `cities.json` the same way detailed districts are stored, so the renderer is unchanged.

### Task D — Replace editorial scores with real data where published
- **Mexico**: SESNSP municipal incidence (monthly CSVs). **Brazil**: state SSP feeds (e.g. SSP-SP,
  ISP-RJ). **Chile** (CEAD), **Colombia** (Policía Nacional / datos.gov.co), **Argentina**, **Ecuador**.
- Normalise to a per-capita rate → map to the 1–10 scale; this removes editorial judgement for a big
  chunk of the map and scales to hundreds of areas. Cache + schedule refresh.

### Task E — Beach / tourist towns (bespoke zones)  *(from the original list)*
Puerto Vallarta, Cancún, Tulum, Zipolite aren't well served by admin districts. Build **hand-drawn
tourist-zone polygons**: safe walkable core / hotel zone / "where the tourist area ends." (Cancún:
Zona Hotelera vs downtown SMs; Tulum: pueblo / beach road / Aldea Zama; Zipolite: the beach strip + its ends.)

### Task F — Granularity upgrades
- **Medellín → barrios**, **Bogotá → barrios** (the cilopez repo also has `Bogota-neighbors.geojson`
  ~1,143 barrios and `Santiago-neighbors.geojson` ~1,642). Add **Lima** (distritos), **Belo Horizonte**,
  **Guadalajara** (ZMG), **Monterrey** (AMM) as full detailed choropleths (they're currently city-level).

---

## 11. Appendix — exact data sources
- SP districts: `https://raw.githubusercontent.com/codigourbano/distritos-sp/master/distritos-sp.geojson`
- CDMX repo (tarball): `https://codeload.github.com/JuveCampos/Shapes_Resiliencia_CDMX_CIDE/tar.gz/refs/heads/master`
  - `…/Shape Ciudad de México/geojsons CDMX/CDMX_mpal.geojson` (16 alcaldías, `NOM_MUN`)
  - `…/geojsons/Division Politica/Poligono_colonias.geojson` (1,815 colonias)
  - `…/geojsons/Division Politica/municipios_zmvm.geojson` (76 ZMVM municipios)
- Rio: gist `esperanc/db213370dd176f8524ae6ba32433f90a` → `Limite_Bairro.geojson` (`NOME`)
- Medellín: gist `davixcky/ade2468ed713364fd5876a16305608b4` → `medellin.geojson` (`NOMBRE`)
- Buenos Aires: `https://raw.githubusercontent.com/OpenDataCordoba/barrios/main/caba_barrios.geojson` (`BARRIO`)
- Bogotá + Santiago (+ neighbour files): `https://codeload.github.com/cilopez/geojson-houm/tar.gz/refs/heads/main`
  → `geobogota.geojson` (`NOMBRE`), `geosantiago.geojson` (`NOM_COM`), `Bogota-neighbors.geojson`, `Santiago-neighbors.geojson`
- City-level centroids: `geonamescache` (pip)
- Upgrade source (Claude Code only, not LFS-blocked there): `https://github.com/wmgeolab/geoBoundaries` (ADM2/ADM3, field `shapeName`)
- Gist raw pattern that works behind the sandbox: `https://raw.githubusercontent.com/gist/<user>/<id>/raw/<commit>/<file>`

---

## 12. Deploy
- Static: push `index.html` to a GitHub Pages repo (or a `/` folder). No server needed for the map itself.
- Analytics: GoatCounter script already embedded.
- Backend (voting / data feeds): Hetzner box — FastAPI/Express + SQLite/Postgres, CORS to the Pages origin,
  or Supabase free tier to skip server ops.
