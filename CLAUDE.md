# CLAUDE.md

This is the **Latin America — City Safety Map**: a single-file Leaflet web app
(`index.html`) rating neighbourhood/city safety on a green→red scale across 55 LatAm cities.

**The full project reference and handoff brief is [PROJECT.md](PROJECT.md). Read it first.**
It documents the data schema, the scoring methodology and honesty rules, the build pipeline,
the frontend features, and the follow-up task backlog.

**For the crowd-input feature, [CROWDSOURCING.md](CROWDSOURCING.md) is authoritative and supersedes
PROJECT.md.** It replaces the old symmetric up/down voting (Task B / the "Felt-safe / Felt-sketchy"
terms in PROJECT.md §7, §10) with an asymmetric, bias-resistant "collect events, not feelings" design:
one-tap **▲ Felt-safe**, but negatives go through **⚑ Report an issue** (named category + optional
free text passed through a server-side **LLM bias gate**). Read its §0 before touching anything here —
the whole design exists to avoid the SketchFactor/"Ghetto Tracker" racial-profiling failure mode.

## Quick facts
- `index.html` — the entire app; all city data is embedded as a `CITIES` JS object. No build step
  is needed to *run* it (deploys as a static file).
- `cities.json` / `cmap.json` — extracted editable data layer (see `build.py`).
- `build.py` — regenerates `index.html` from `cities.json` + `cmap.json`.

## Run locally
Python isn't installed here; the pipeline is **Node**.
```
npm install
npm run serve      # static map at http://localhost:8000/index.html  (routes: #saopaulo, …)
npm run backend    # crowd API at http://localhost:8787  (Express + node:sqlite)
npm run build      # regenerate index.html from index.template.html + cities.json + cmap.json + categories.json
npm run clusters   # re-annotate cities.json with cluster_ids (Task C)
```

## Crowd input & the manual-release cycle
Crowd submissions (▲ Felt-safe / ⚑ Report an issue) and the **Feedback** form post to the backend and
are **stored, not auto-applied**. The public map changes only when we release manually every few days:
```
npm run review                 # digest of pending reports + feedback, grouped by city/cluster
# → review for bias, edit scores in cities.json for approved changes
npm run build                  # rebuild index.html
# → redeploy index.html (GitHub Pages)
npm run review -- --release    # mark that batch applied
```
There is **no LLM gate and no admin web UI** (by design): the human review step is the bias filter.
Deploy config: set `IP_SALT`, `ALLOWED_ORIGIN`, optional `TURNSTILE_SECRET` (see `backend/.env.example`),
and replace the `REPLACE-WITH-PROD-API` URL in `index.template.html` with the deployed backend origin.

## Honesty rule (do not break)
Ratings are editorial travel-safety synthesis (except São Paulo's continuous model). **Never fabricate
per-neighbourhood ratings for a city you don't actually know** — city-level overall is honest; inventing
colonia-level detail is not. See PROJECT.md §5.
