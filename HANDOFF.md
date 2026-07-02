# HANDOFF — continuing the Latam Crime Map

A self-contained brief so another Claude Code instance (e.g. on the Hetzner box) can pick up the work,
build, verify, commit and push **without any prior context from this session**. Nothing secret is in this
file — see [§7 Secrets](#7-secrets--never-commit-these).

Live: map → https://latamcrimemap.com (GitHub Pages, static) · backend → https://api.latamcrimemap.com
(Express + SQLite on the Hetzner box).

---

## 1. Read these first (in order)

1. [`CLAUDE.md`](CLAUDE.md) — project rules, run commands, the **honesty rule**, the manual-release cycle.
2. [`PROJECT.md`](PROJECT.md) — full reference: data schema, scoring methodology, build pipeline, features.
3. [`CROWDSOURCING.md`](CROWDSOURCING.md) — authoritative for the crowd-input design (bias-resistant; supersedes
   PROJECT.md §7/§10). Read its §0 before touching report/feedback flows.
4. [`USER_STORIES.md`](USER_STORIES.md) — the backlog. **The two tasks below are US-24 and US-25 there.**
5. [`deploy/DEPLOY.md`](deploy/DEPLOY.md) — backend deploy (systemd, Caddy, env, backups).

**The honesty rule (do not break):** ratings are editorial travel-safety synthesis (except São Paulo's
continuous model). Never fabricate per-neighbourhood ratings for a city you don't know — city-level overall
is honest; inventing colonia-level detail is not.

---

## 2. Get the repo

Public repo — clone read-only over HTTPS, or with a credential if you'll push (see §6):

```bash
git clone https://github.com/markbosshard/safetymaps.git
cd safetymaps
```

> On the Hetzner box there is already a **deploy** clone at `/opt/safetymap` owned by the `safetymap`
> service user — that one is for *pulling* (backend deploy), not for dev work. For coding, make a **fresh
> clone in your home dir** so you don't disturb the running service, then push from there.

Toolchain: **Node** (v20+; the box runs Node 22). Python is NOT used for the build. Then:

```bash
npm install
```

---

## 3. How the app is built (single-file app + data layer)

`index.html` is **generated** — never edit it by hand. Source of truth:

- [`index.template.html`](index.template.html) — the entire app (HTML + CSS + JS + i18n `STRINGS`).
- `cities.json` / `cmap.json` / `categories.json` — the data layer.
- [`build.js`](build.js) — injects the data + build date/year + MapTiler key into the template and writes
  `index.html`, `404.html`, and 20 per-city share pages (`sao-paulo.html`, …).

```bash
npm run build      # regenerate index.html (+404.html +20 city pages) from the template + data
npm run serve      # static server at http://localhost:8000/index.html  (routes: #lima, /sao-paulo, …)
npm run backend    # crowd API at http://localhost:8787  (only needed to exercise report/feedback)
```

The MapTiler key is optional for dev: if `maptiler.key` / `$MAPTILER_KEY` is absent, the map falls back to
OSM tiles — the build still succeeds and everything is testable.

**Every commit of a frontend change includes the regenerated `index.html` + `404.html` + the 20 city
`*.html` pages** (23 files total). Always `npm run build` before committing, then `git add -A`.

### Verifying a change
Serve locally and confirm behaviour in a browser. In this project we verify DOM/behaviour directly (measure
state, check `map.getZoom()`, assert pins exist) rather than trusting a screenshot, because animated
`setView` reads mid-flight. Check the browser console for errors before pushing.

---

## 4. TASK US-25 — double-tap must not drop a pin or over-zoom (bug, do this first)

**Symptom:** double-tapping the map to zoom also drops a report pin and snaps to the close street zoom
(`PIN_ZOOM` = 16). A double-tap should do Leaflet's normal one-level zoom, **no pin, no jump**.

**Cause:** this is a regression from the pin-drop-zoom feature (commit `97b33d7`). Leaflet emits a `click`
for *each* tap of a double-tap, and our click handler drops a pin + calls `zoomToPin`.

**Where:** `index.template.html`
- `map.on('click', async e=> …)` — the periphery/point-report handler (search for `openPointReport(ll)`).
- `lyr.on('click', e=>openDistrict(d,e.latlng))` — inside `buildCity()`; districts cover most of the map,
  so a double-tap **on a district** hits this path and must be guarded too.
- `zoomToPin(lat,lng)` and the `PIN_ZOOM` / `PIN_KEEP_Z` constants (search for `PIN_ZOOM`).

**Suggested approach:** debounce single-vs-double. On `click`, start a ~250 ms timer that runs the
report/openDistrict logic; on `dblclick`, cancel the timer so only the native double-click zoom happens.
Apply the same guard to both the map-level and the district-layer click paths (factor the report logic into
one function both call). Confirm: double-tap → zoom +1, **no pin**; single-tap → pin + zoom-to-16 as today
(a ~250 ms delay on single-tap is acceptable).

## 4b. TASK US-24 — searching an address shouldn't pre-drop a rating pin

**Want:** picking a geocoder result should behave like **"Locate me"** — zoom in and drop only the single
neutral location pin (the grey `searchPin`), **without** opening the report sheet or the `reportPin`. The
user then taps the exact spot to rate.

**Where:** `selectResult(it)` in `index.template.html` (search for `function selectResult`). Today, for a
non-city result it does `dropPin(...)` + `zoomToPin(...)` and **then** calls `openDistrict(...)` / opens a
point-report popup. Drop those report branches so it ends after `dropPin` + `zoomToPin` (city results still
`focusCity` and return). Leave `dropPin` (grey `searchPin`) and the zoom in place.

**Watch for:** dead code after the change (`popupCtx` / `reportPopup` lines that were only for the removed
branches), and that the "×" clear button still removes the `searchPin` (`updateSearchClear`).

---

## 5. Commit conventions

- Work on `main` (this repo deploys `main`). Small, focused commits.
- Message: a concise summary line + a short body explaining the *why*. End every commit with:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- `git add -A` (this sweeps in the regenerated `index.html` + `404.html` + 20 city pages). Sanity-check
  `git status` shows only expected files — never `node_modules/`, `maptiler.key`, `backend/*.db`, or `.env`.

---

## 6. How to push + how it deploys

Pushing needs a **GitHub credential with write access** to `markbosshard/safetymaps` — it is NOT in the repo
and must be supplied by the owner (a Personal Access Token for HTTPS, or an SSH deploy key with write). Once
configured:

```bash
git push origin main
```

**Deploy is automatic for frontend changes:** GitHub Pages rebuilds from `main` on every push (custom domain
`latamcrimemap.com` via the committed `CNAME`). US-24/US-25 are pure `index.template.html` → **push is all
that's needed**; give Pages a few minutes, then hard-refresh (the Fastly CDN can briefly serve the old copy).

**Backend / data changes** (only if you touch `backend/**` or `cities.json` that the running API uses) also
need the box to pull and restart:

```bash
ssh hetzner 'cd /opt/safetymap && sudo -u safetymap git pull --ff-only && systemctl restart safetymap-backend'
```

(You are already on the box — use the local equivalent without the `ssh hetzner` prefix.)

---

## 7. Secrets — NEVER commit these

The repo is public. Keep it that way. These are gitignored / live only on the box, and must never be added:

| Secret | Where it lives | Notes |
|---|---|---|
| `maptiler.key` | gitignored file / `$MAPTILER_KEY` env | Map tiles. Build falls back to OSM without it. |
| `IP_SALT` | `/etc/safetymap/backend.env` (chmod 600) | Salts IP hashes; the app never stores raw IPs. |
| `TURNSTILE_SECRET` | same env file | Cloudflare bot check; empty = disabled. |
| GitHub push token / SSH key | your shell / `~/.ssh` | Never in the repo. |

The committed `backend/.env.example` and `deploy/backend.env.example` show the variable **names** with
placeholder values only — that's intentional and safe. If you ever need a real value, ask the owner; do not
paste it into a tracked file, a commit message, or this doc.

---

## 8. Quick checklist for the two tasks

1. Fresh clone in your home dir; `npm install`.
2. Edit `index.template.html` for US-25, then US-24.
3. `npm run build` → `npm run serve` → verify in a browser (console clean; double-tap zooms with no pin;
   search drops only the grey pin).
4. `git add -A` → commit (with the `Co-Authored-By` trailer) → `git push origin main`.
5. Move US-24/US-25 from **Open** to **Delivered** in `USER_STORIES.md` and commit that too.
6. Wait a few minutes, hard-refresh https://latamcrimemap.com, confirm live.
