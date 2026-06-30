# SafetyMaps

Interactive map rating neighbourhood/city safety on a green→red scale, with bias-resistant
crowd input. Currently covers **55 Latin American cities** (34 with district/municipal detail,
21 city-level) — built so it can extend to other regions later.

- **The map** is a single static file (`index.html`, Leaflet) — deploys to GitHub Pages, no server.
- **The crowd backend** (`backend/`, Express + `node:sqlite`) collects ▲ *Felt-safe* and
  ⚑ *Report-an-issue* submissions plus general feedback. It's tiny and runs as one process.

## Why it's built carefully
Crowd "safety" votes are the part most likely to cause harm — see how SketchFactor and "Ghetto
Tracker" became racial-profiling tools. So the design **collects events, not feelings, and never the
people**: ▲ Felt-safe is one tap; negatives must name a concrete incident/condition (no demographic
options); the public map only changes through a **manual human review** every few days. See
[CROWDSOURCING.md](CROWDSOURCING.md) §0.

## Run locally
Node-based (no Python needed):
```bash
npm install
npm run serve      # static map  → http://localhost:8000/index.html
npm run backend    # crowd API   → http://localhost:8787
npm run build      # regenerate index.html from the data layer + template
```
`npm run serve` is just static file hosting; only the backend (`:8787`) is a real server.

### Map provider (MapTiler)
Basemap tiles and search geocoding use **MapTiler**. Put your key in a gitignored `maptiler.key`
file at the repo root (or set `MAPTILER_KEY` in the env); `npm run build` injects it into `index.html`.
The key is origin-restricted in MapTiler, so it's safe to ship in the page. With no key, the app
falls back to OpenStreetMap tiles + Nominatim geocoding (fine for local dev, not for production traffic).

## Repo layout
- `index.html` — the deployed app (generated). `index.template.html` — markup/CSS/JS template.
- `cities.json` / `cmap.json` / `categories.json` — editable data layer, bundled in by `build.js`.
- `scripts/` — data pipeline (extract, clusters, per-city/metro builders, sources, **review**).
- `backend/` — crowd API (`server.js`, `db.js`) + `.env.example`.
- `deploy/` — production deployment (systemd, Caddy auto-HTTPS, backups) → see [deploy/DEPLOY.md](deploy/DEPLOY.md).

## The manual release cycle
Submissions are **stored, not auto-applied**. Every few days:
```bash
npm run review                 # digest of pending reports + feedback (grouped by city/cluster)
# → review for bias, edit scores in cities.json, then:
npm run build                  # rebuild index.html → redeploy to Pages
npm run review -- --release    # mark the batch applied
```

## Honesty rule
Ratings are an **editorial travel-safety synthesis** (directional, not a single crime-rate metric).
Where a city was upgraded to municipal detail, units without confident knowledge **inherit the city's
overall rating** rather than getting invented per-area scores. Boundaries are official open data,
cited per city in the map's Sources panel.

## Docs
- [PROJECT.md](PROJECT.md) — full reference & methodology
- [CROWDSOURCING.md](CROWDSOURCING.md) — authoritative spec for the crowd feature
- [MAP_SOURCES.md](MAP_SOURCES.md) — boundary & safety sources by city
- [deploy/DEPLOY.md](deploy/DEPLOY.md) — backend deployment
