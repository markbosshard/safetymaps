# Deploying the SafetyMap backend (Hetzner / any Linux VPS)

The **map** (`index.html`) is a static file → deploy to **GitHub Pages** (no server).
The **backend** (`backend/server.js`, Express + SQLite) collects ▲ Felt-safe / ⚑ Report-an-issue
and Feedback submissions → runs as **one** small process on your box. It is extremely light
(idles ~50–80 MB RAM; human-paced writes; the public map doesn't even read it live), so the
smallest Hetzner VPS is plenty for a long time.

**Hard requirement:** the backend must be served over **HTTPS**. The map runs on HTTPS (Pages),
and browsers block an HTTPS page from calling an HTTP API (mixed content). Caddy gives you
automatic HTTPS below.

All files referenced here live in this `deploy/` folder.

---

## Map hosting (GitHub Pages, apex domain + pretty paths)
The map is the static `index.html` (+ generated `404.html`). Two domains are involved:
**`latam-safety-map.com`** → the map (GitHub Pages), **`api.latam-safety-map.com`** → the backend (this box).

1. **Repo → Settings → Pages:** Source = *Deploy from a branch*, branch `main`, folder `/ (root)`.
2. **Custom domain:** the repo already contains a root `CNAME` file with `latam-safety-map.com`.
3. **DNS at your registrar:**
   - Apex `latam-safety-map.com` → GitHub Pages **A** records `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153` (and AAAA `2606:50c0:8000::153` … `8003::153` if you want IPv6).
   - `api` → an **A** record to *this box's* IP (for the backend; separate from Pages).
4. Tick **Enforce HTTPS** once GitHub provisions the cert.
5. **Pretty paths** (`/sao-paulo`, `/mexico-city`, …) work because `build.js` emits a `404.html` copy of
   the app — Pages serves it for any unmatched path, and the in-app router renders the city from
   `location.pathname`. Old `#saopaulo` links and `?city=` still resolve.

---

## 0. Prerequisites
- A VPS (Ubuntu 22.04/24.04 assumed below) with a public IP.
- A domain you control. Create a DNS **A record** (and AAAA if you have IPv6) for
  `api.latam-safety-map.com` → the box IP. Do this early so TLS can be issued.
- **Node 22 or newer** (needed for the built-in `node:sqlite`). Node 20 will NOT work.

---

## 1. Install runtime deps (as root / sudo)
```bash
# Node 22 LTS via NodeSource (installs /usr/bin/node)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git sqlite3

# Caddy (reverse proxy + auto HTTPS)
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy

node --version   # must print v22.x or newer
```

## 2. Create the service user + code dir
```bash
useradd --system --home /opt/safetymap --shell /usr/sbin/nologin safetymap
git clone https://github.com/markbosshard/safetymaps.git /opt/safetymap
cd /opt/safetymap
npm ci --omit=dev          # installs express + h3-js (both runtime deps)
chown -R safetymap:safetymap /opt/safetymap
```
> The backend needs `express` **and** `h3-js` (it resolves report locations to clusters via
> `scripts/clusters.js`). `npm ci` installs both from the committed `package-lock.json`.

## 3. Configure environment
```bash
mkdir -p /etc/safetymap
cp /opt/safetymap/deploy/backend.env.example /etc/safetymap/backend.env
# Generate a real IP salt and edit the file:
openssl rand -hex 32        # paste into IP_SALT=
nano /etc/safetymap/backend.env   # set IP_SALT, ALLOWED_ORIGIN (your Pages origin)
chmod 600 /etc/safetymap/backend.env
chown root:root /etc/safetymap/backend.env
```

## 4. Install + start the systemd service
```bash
cp /opt/safetymap/deploy/safetymap-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now safetymap-backend
systemctl status safetymap-backend --no-pager
curl -s http://127.0.0.1:8787/health      # -> {"ok":true,"cities":55}
```
`StateDirectory=safetymap` auto-creates `/var/lib/safetymap` (owned by the service user); the
SQLite DB lives at `/var/lib/safetymap/safetymap.db` (set via `DB_PATH`).

## 5. Put Caddy in front (HTTPS)
```bash
# Edit the domain + email first:
nano /opt/safetymap/deploy/Caddyfile
cp /opt/safetymap/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
# DNS for api.latam-safety-map.com must already point here; Caddy then issues the cert automatically.
curl -s https://api.latam-safety-map.com/health  # -> {"ok":true,...}
```

## 6. Firewall (recommended)
Only expose web ports; keep 8787 internal (Caddy reaches it on localhost).
```bash
ufw allow OpenSSH
ufw allow 80,443/tcp
ufw enable
```

## 7. Map ↔ backend wiring (already set)
The map already calls **`https://api.latam-safety-map.com`** in production (set in
`index.template.html`, baked into `index.html` by `npm run build`). So you only need to make sure:
- `api.latam-safety-map.com` DNS points at this box and `/health` works over HTTPS (steps 0/5), and
- `ALLOWED_ORIGIN=https://latam-safety-map.com` in `/etc/safetymap/backend.env`, then
  `systemctl restart safetymap-backend`.

If you ever move the API to a different host, edit the `API=` line in `index.template.html`, run
`npm run build`, and redeploy. Verify in the browser: open the map, tap ▲ Felt-safe, confirm a 200 to `/report`.

## 8. Backups
```bash
mkdir -p /var/backups/safetymap && chown safetymap:safetymap /var/backups/safetymap
cp /opt/safetymap/deploy/safetymap-backup.cron /etc/cron.d/safetymap-backup
# test it once:
sudo -u safetymap /opt/safetymap/deploy/backup-safetymap.sh
```
Daily online `.backup` of the live DB (safe in WAL mode), keeps the latest 14. For off-box
durability, also copy `/var/backups/safetymap` to object storage, or use Litestream.

---

## The release cycle (runs on the box, where the DB is)
Submissions are **stored, not auto-applied**. Every few days:
```bash
cd /opt/safetymap
sudo -u safetymap DB_PATH=/var/lib/safetymap/safetymap.db node --experimental-sqlite scripts/review.js
#  → review reports/feedback for bias, edit scores in cities.json, then on your dev machine:
#     npm run build  → redeploy index.html (Pages)
sudo -u safetymap DB_PATH=/var/lib/safetymap/safetymap.db node --experimental-sqlite scripts/review.js -- --release
```

## Updating the backend later
```bash
cd /opt/safetymap && sudo -u safetymap git pull && sudo -u safetymap npm ci --omit=dev
systemctl restart safetymap-backend
```

## Logs / troubleshooting
```bash
journalctl -u safetymap-backend -f          # backend logs
journalctl -u caddy -f                      # TLS / proxy logs
```
- `node:sqlite` errors → Node is < 22, or the `--experimental-sqlite` flag is missing.
- CORS errors in the browser → `ALLOWED_ORIGIN` doesn't match the Pages origin exactly.
- Cert not issued → DNS for `api.latam-safety-map.com` isn't pointing at the box yet.

## Scaling note
This is single-node SQLite (WAL) — fine until you have real, sustained traffic. If you ever
outgrow it, the migration is small: move to Postgres and run two app instances behind Caddy.
You are nowhere near needing that to start.
