// Attach curated, city-specific "More resources" links (local crime dashboards, news trackers, civic
// tools) to the Sources panel. The link TEXT is the resource's descriptive name; it click-throughs to
// the URL. Add more cities/links to RESOURCES and re-run. Idempotent (overwrites a city's resources).
// Run: node scripts/add_resources.js   then  npm run build
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'cities.json');

const RESOURCES = {
  'sao-paulo': [
    { text: 'Dados Crime SP — interactive São Paulo State crime-data dashboard (SSP-SP)', url: 'https://dadoscrimesp.com.br/' },
    { text: 'G1 Monitor da Violência — vehicle theft & robbery across Greater São Paulo', url: 'https://especiais.g1.globo.com/monitor-da-violencia/2023/furtos-e-roubos-de-veiculos-na-grande-sp/' },
  ],
  'rio-de-janeiro': [
    { text: 'Onde Tem Tiroteio (OTT) — community real-time shooting / crossfire alerts, Rio', url: 'https://ondetemtiroteio.com/website/ott/index.html' },
  ],
};

const cities = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let n = 0;
for (const [key, res] of Object.entries(RESOURCES)) {
  if (!cities[key]) { console.log('no such city:', key); continue; }
  cities[key].resources = res; n++;
}
fs.writeFileSync(FILE, JSON.stringify(cities));
console.log('set "More resources" on', n, 'cities');
