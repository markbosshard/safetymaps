// apply_safety_tiers.js — apply per-district safety tier overrides to cities.json.
//
// Each city has a tiers map: { name_substring_lowercase: score }
// Matching is case-insensitive substring on district name.
// A district can match multiple entries; the MOST SPECIFIC (longest key) wins.
//
// Score scale (same as rest of map):
//   2   = quite safe / green
//   4   = moderate caution / yellow
//   6   = elevated caution / orange
//   8   = high risk / red
//   9.5 = extreme risk / deep red
//
// Sources for each city are listed in the SOURCES constant.
//
// Run: node scripts/apply_safety_tiers.js
//      npm run clusters && npm run build

'use strict';
const fs   = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'cities.json');

// ── Tier overrides ────────────────────────────────────────────────────────────
// Keys are lowercase substrings of district names; longest match wins.
// Unmatched districts keep the city's inherited overall score.

const TIERS = {

  // ── Fortaleza (Brazil) ───────────────────────────────────────────────────
  // Sources: brazilsafetravel.com, latitud8.com, sacavoyage.fr, vivareal.com.br, quintoandar.com.br
  fortaleza: {
    // Safer tourist zone (beachfront + upscale residential)
    'meireles':    4,
    'aldeota':     4,
    'varjota':     4,
    'cocó':        4,
    'coco':        4,
    'mucuripe':    5,
    'praia de iracema': 5,
    'iracema':     5,
    'papicu':      5,
    'dionísio torres': 4,
    'dionisio torres': 4,
    'fátima':      4,
    'fatima':      4,
    // Central / mixed
    'centro':      6,
    'benfica':     6,
    'josé bonifácio': 6,
    'jose bonifacio': 6,
    // High-risk areas (western/northern periphery)
    'pirambu':     8,
    'pirambú':     8,
    'barra do ceará': 8,
    'barra do ceara': 8,
    'serviluz':    9,
    'vicente pinzon': 7,
    'vicente pínzon': 7,
    'jacarecanga': 7,
    'jardim iracema': 7,
  },

  // ── Salvador (Brazil) ────────────────────────────────────────────────────
  // Sources: brazilsafetravel.com, braziloffbeat.com, salvadorguidebook.com,
  //          goaskalocal.com, sacavoyage.fr
  salvador: {
    // Safer tourist zones
    'barra':       4,
    'ondina':      4,
    'vitória':     4,
    'vitoria':     4,
    'graça':       4,
    'graca':       4,
    'corredor da vitória': 4,
    'corredor da vitoria': 4,
    // Bohemian / mixed
    'rio vermelho': 5,
    'bonfim':      5,
    'santo antônio': 6,
    'santo antonio': 6,
    // Day-only historic
    'pelourinho':  6,
    'centro histórico': 6,
    'centro historico': 6,
    // Residential mid-tier
    'pituba':      5,
    'itaigara':    4,
    'caminho das árvores': 4,
    'caminho das arvores': 4,
    // High risk (peripheral / subúrbio ferroviário)
    'subúrbio':    8,
    'suburio':     8,
    'nordeste de amaralina': 8,
    'nordeste':    7,
    'periperi':    8,
    'plataforma':  8,
  },

  // ── Natal (Brazil) ───────────────────────────────────────────────────────
  // Sources: brazilsafetravel.com, travelsafe-abroad.com, sacavoyage.fr,
  //          natalriograndedonorte.com
  natal: {
    // Safer tourist zone
    'ponta negra': 4,
    'via costeira': 4,
    'neópolis':    5,
    'neopolis':    5,
    'capim macio': 5,
    'tirol':       5,
    'petrópolis':  5,
    'petropolis':  5,
    'lagoa nova':  5,
    // Central / mixed
    'alecrim':     6,
    'ribeira':     6,
    'cidade alta': 6,
    // High risk (north zone)
    'alvorada':    8,
    'mãe luiza':   7,
    'mae luiza':   7,
    'igapó':       8,
    'igapo':       8,
    'pajuçara':    8,
    'pajucara':    8,
    'potengi':     8,
    'rocas':       7,
  },

  // ── Porto Alegre (Brazil) ────────────────────────────────────────────────
  // Sources: travelsafe-abroad.com, doinbrazil.com, theworldtravelindex.com
  'porto-alegre': {
    // Safer residential / tourist zones
    'moinhos de vento': 4,
    'bela vista':  4,
    'auxiliadora': 4,
    'petrópolis':  4,
    'petropolis':  4,
    'boa vista':   5,
    'higienópolis': 4,
    'higienopolis': 4,
    'mont serrat': 5,
    'santana':     5,
    // Central / mixed
    'centro histórico': 6,
    'centro historico': 6,
    'cidade baixa': 6,
    'bom fim':     5,
    'floresta':    7,
    'independência': 7,
    'independencia': 7,
    // High risk (north zone / periphery)
    'farrapos':    8,
    'rubem berta': 8,
    'sarandi':     7,
    'arquipélago': 7,
    'arquipelago': 7,
    'mario quintana': 7,
  },

  // ── Barranquilla (Colombia) ───────────────────────────────────────────────
  // Sources: qeepl.com, theworldtravelindex.com, bestdistricts.com,
  //          barranquilla.guide, findyourstay.com
  barranquilla: {
    // Safer northern zones
    'el prado':    4,
    'alto prado':  4,
    'riomar':      4,
    'villa country': 4,
    'el golf':     4,
    'ciudad jardín': 4,
    'ciudad jardin': 4,
    // Mid-tier
    'el centro':   6,
    'centro':      6,
    // High risk (southern / western)
    'olaya herrera': 8,
    'rebolo':      7,
    'barranquillita': 7,
  },

  // ── Managua (Nicaragua) ───────────────────────────────────────────────────
  // Sources: managuainn.com, trip101.com, theworldtravelindex.com, bestdistricts.com
  managua: {
    // Safer residential / tourist zones
    'los robles':  4,
    'bolonia':     4,
    'metrocentro': 4,
    'carretera masaya': 5,
    'altamira':    5,
    'las colinas': 5,
    // Mixed / commercial
    'linda vista': 5,
    // High risk (eastern / central periphery)
    'ciudad sandino': 7,
    'batahola':    7,
    'bello horizonte': 6,
  },

  // ── Valparaíso (Chile) ────────────────────────────────────────────────────
  // Sources: theworldtravelindex.com, mychiletravelguide.com, sacavoyage.fr,
  //          tripadvisor.com
  valparaiso: {
    // Safer / tourist cerros
    'cerro alegre': 4,
    'cerro concepción': 4,
    'cerro concepcion': 4,
    // Mixed cerros
    'cerro bellavista': 5,
    'cerro panteón': 5,
    'cerro panteon': 5,
    'cerro florida': 5,
    // El Plan / port area
    'el plan':     6,
    'puerto':      6,
    // Rougher cerros
    'cerro las cañas': 7,
    'cerro las canas': 7,
    'cerro placeres': 7,
  },

  // ── Cartagena (Colombia) — already has 17 UCG districts, apply scoring ────
  // UCG boundaries don't carry names we can substring-match; score by cluster_id instead.
  // UCG 1–4 = walled city / historic centre / Getsemaní.
  // UCG 5–8 ≈ Bocagrande / Castillogrande / El Laguito.
  // UCG 9–15 = outer barrios / periphery.
  // Sources: mycartagenatrip.com, cartagenaexplorer.com, optimostay.com,
  //          colombialuxurygroup.com, two.travel
  cartagena: {
    'boquilla':    5,
  },

  // ── Montevideo (Uruguay) — 10 municipality districts, score by pattern ────
  // Municipalities A–G map roughly to:
  //   A = Ciudad Vieja + Centro     B = Cordón + Palermo
  //   C = Pocitos + Punta Carretas  CH = Malvín + Buceo
  //   D = Carrasco + Punta Gorda    E = Unión + Flor de Maroñas (mixed)
  //   F = Cerro + La Teja           G = Paso de la Arena (peripheral)
  // Sources: kakapo.travel, hersafevoyage.com, thebrokebackpacker.com, theculturetrip.com
  montevideo: {
    'municipality c': 3,   // Pocitos / Punta Carretas — safest for tourists
    'municipality d': 3,   // Carrasco / Punta Gorda — upscale
    'municipality ch': 3,  // Malvín / Buceo — residential, safe
    'municipality b': 4,   // Cordón / Palermo — mixed but OK
    'municipality a': 4,   // Ciudad Vieja / Centro — day OK, night caution
    'municipality e': 5,   // Unión / Flor de Maroñas — more caution
    'municipality f': 7,   // Cerro / La Teja — avoid
    'municipality g': 7,   // Paso de la Arena — peripheral
  },

  // ── Asunción (Paraguay) — 16 districts are metropolitan municipalities ────
  // The city of Asunción itself is "Asuncion" district; others are satellite towns.
  // We can only meaningfully score the satellite municipalities.
  // Sources: movetoparaguay.com, fluidospanish.com, asunciontimes.com
  asuncion: {
    'luque':       4,    // safe suburb
    'san lorenzo': 5,   // mid-tier
    'lambare':     5,   // mid-tier
    'fernando de la mora': 5,
    'ñemby':       5,
    'nemby':       5,
    'capiatá':     6,
    'capiata':     6,
  },

};

// ── UCG scoring for Cartagena (by cluster_id pattern) ─────────────────────────
const CARTAGENA_UCG_SCORES = {
  'ucg-1': 4, 'ucg-2': 4, 'ucg-3': 4, 'ucg-4': 5,  // historic / Getsemaní
  'ucg-5': 4, 'ucg-6': 4, 'ucg-7': 4, 'ucg-8': 4,  // Bocagrande zone
  'ucg-9': 6, 'ucg-10': 6, 'ucg-11': 7, 'ucg-12': 7,
  'ucg-13': 7, 'ucg-14': 7, 'ucg-15': 8,
};

// ── Source citations ──────────────────────────────────────────────────────────
const SOURCES = {
  fortaleza: [
    { text: 'Is Fortaleza Safe for Tourists — Latitud8', url: 'https://latitud8.com/brazil/fortaleza/language-culture/is-fortaleza-safe' },
    { text: 'Is Fortaleza Brazil Safe — brazilsafetravel.com', url: 'https://brazilsafetravel.com/blog/is-natal-brazil-safe' },
    { text: 'Where to Stay in Fortaleza — sacavoyage.fr', url: 'https://sacavoyage.fr/en/ou-loger-a-fortaleza-quartiers-dangereux-et-zones-a-eviter/' },
    { text: 'Bairros mais seguros de Fortaleza — VivaReal', url: 'https://www.vivareal.com.br/blog/cidades/bairros-mais-seguros-de-fortaleza/' },
    { text: 'Bairros mais seguros de Fortaleza — QuintoAndar', url: 'https://www.quintoandar.com.br/guias/cidades/bairros-mais-seguros-de-fortaleza/' },
  ],
  salvador: [
    { text: 'Is Salvador Brazil Safe — brazilsafetravel.com', url: 'https://brazilsafetravel.com/blog/is-salvador-brazil-safe' },
    { text: 'Is Salvador Brazil Safe — Brazil Offbeat', url: 'https://braziloffbeat.com/is-salvador-brazil-safe/' },
    { text: '5 Best Neighborhoods in Salvador — salvadorguidebook.com', url: 'https://salvadorguidebook.com/where-to-stay-in-salvador/' },
    { text: 'Where to Stay in Salvador — goaskalocal.com', url: 'https://goaskalocal.com/blog/where-to-stay-in-salvador-brazil' },
    { text: 'Areas to avoid Salvador — sacavoyage.fr', url: 'https://sacavoyage.fr/en/zones-a-eviter-et-quartiers-dangereux-a-salvador-de-bahia/' },
  ],
  natal: [
    { text: 'Is Natal Brazil Safe — brazilsafetravel.com', url: 'https://brazilsafetravel.com/blog/is-natal-brazil-safe' },
    { text: 'Is Natal Safe — travelsafe-abroad.com', url: 'https://www.travelsafe-abroad.com/brazil/natal/' },
    { text: 'Dangerous Natal neighborhoods — sacavoyage.fr', url: 'https://sacavoyage.fr/en/natal-dangereuse-quartiers-a-eviter-et-les-meilleurs-ou-loger/' },
    { text: 'Natal safety tips — natalriograndedonorte.com', url: 'https://www.natalriograndedonorte.com/natal-brazil-safety-tips-for-a-safe-visit/' },
  ],
  'porto-alegre': [
    { text: 'Is Porto Alegre Safe — travelsafe-abroad.com', url: 'https://www.travelsafe-abroad.com/brazil/porto-alegre/' },
    { text: 'Is Porto Alegre Safe — theworldtravelindex.com', url: 'https://theworldtravelindex.com/en/south-america/brazil/porto-alegre/is-porto-alegre-safe' },
    { text: 'Porto Alegre travel guide — doinbrazil.com', url: 'https://doinbrazil.com/porto-alegre-brazil/' },
  ],
  barranquilla: [
    { text: 'Is Barranquilla Safe — qeepl.com', url: 'https://qeepl.com/en/blog/is-barranquilla-safe-a-tourist-s-guide-to-safety-and-security' },
    { text: 'Is Barranquilla Safe — barranquilla.guide', url: 'https://barranquilla.guide/is-barranquilla-safe-honest-answer-2026/' },
    { text: 'Best Areas to Stay in Barranquilla — bestdistricts.com', url: 'https://bestdistricts.com/best-areas-to-stay-in-barranquilla-colombia/' },
    { text: 'Areas to Avoid in Barranquilla — findyourstay.com', url: 'https://findyourstay.com/stay/barranquilla/areas-to-avoid' },
  ],
  managua: [
    { text: 'Best Areas to Stay in Managua — managuainn.com', url: 'https://managuainn.com/best-areas-to-stay-in-managua/' },
    { text: 'Where To Stay In Managua — trip101.com', url: 'https://trip101.com/article/where-to-stay-managua' },
    { text: 'Is Managua Safe — theworldtravelindex.com', url: 'https://theworldtravelindex.com/en/north-america/nicaragua/managua/is-managua-safe' },
  ],
  valparaiso: [
    { text: 'Is Valparaíso Safe — theworldtravelindex.com', url: 'https://theworldtravelindex.com/en/south-america/chile/valparaiso/is-valparaiso-safe' },
    { text: 'Is Valparaíso Safe — mychiletravelguide.com', url: 'https://mychiletravelguide.com/is-valparaiso-safe/' },
    { text: 'Dangerous Valparaíso — sacavoyage.fr', url: 'https://sacavoyage.fr/en/valparaiso-dangereux-quartiers-a-eviter-et-zone-rouge/' },
    { text: 'Valparaíso Safe Neighborhoods — Tripadvisor', url: 'https://www.tripadvisor.com/ShowTopic-g294291-i1357-k10755851-Valparaiso_Safe_Neighborhoods-Chile.html' },
  ],
  cartagena: [
    { text: 'Is Cartagena Safe — mycartagenatrip.com', url: 'https://mycartagenatrip.com/is-cartagena-safe/' },
    { text: 'Is Cartagena Safe — cartagenaexplorer.com', url: 'https://www.cartagenaexplorer.com/cartagena-safety-tips/' },
    { text: 'Is Cartagena Safe 2026 — colombialuxurygroup.com', url: 'https://colombialuxurygroup.com/is-cartagena-safe-for-travelers/' },
    { text: 'Walled City vs Getsemaní — two.travel', url: 'https://two.travel/cartagena-walled-city-getsemani/' },
  ],
  montevideo: [
    { text: 'Is Montevideo Safe — kakapo.travel', url: 'https://kakapo.travel/blog/city/is-montevideo-uruguay-safe' },
    { text: 'Montevideo Safety Guide — hersafevoyage.com', url: 'https://hersafevoyage.com/destinations/uruguay/montevideo' },
    { text: 'Where to Stay in Montevideo — thebrokebackpacker.com', url: 'https://www.thebrokebackpacker.com/where-to-stay-in-montevideo-uruguay/' },
    { text: 'Coolest Neighborhoods in Montevideo — theculturetrip.com', url: 'https://theculturetrip.com/south-america/uruguay/articles/the-coolest-neighborhoods-in-montevideo-uruguay' },
  ],
  asuncion: [
    { text: 'Best Neighborhoods in Asunción — movetoparaguay.com', url: 'https://www.movetoparaguay.com/en/blog/best-neighborhoods-in-asuncion' },
    { text: '5 Safest neighborhoods for expats — fluidospanish.com', url: 'https://fluidospanish.com/fluido-blog/the-5-safest-neighborhoods-for-expats-in-asunci%C3%B3n' },
    { text: 'Safety in Asunción — asunciontimes.com', url: 'https://asunciontimes.com/asuncion-city-guides/safety-in-asuncion-a-data-driven-look-at-security-in-paraguays-capital/' },
  ],
};

// ── Apply ─────────────────────────────────────────────────────────────────────

function applyTiers(city, key, tiers) {
  let changed = 0;
  for (const d of city.districts) {
    const nameLow = d.name.toLowerCase();

    // Special case: Cartagena UCG scoring by cluster_id
    if (key === 'cartagena') {
      const ucgKey = Object.keys(CARTAGENA_UCG_SCORES).find(k => d.cluster_id && d.cluster_id.includes(k));
      if (ucgKey) { d.score = CARTAGENA_UCG_SCORES[ucgKey]; changed++; continue; }
    }

    // Find longest matching key (most specific wins)
    const match = Object.keys(tiers)
      .filter(k => nameLow.includes(k))
      .sort((a, b) => b.length - a.length)[0];
    if (match !== undefined) { d.score = tiers[match]; changed++; }
  }
  return changed;
}

function main() {
  const cities = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let totalChanged = 0;

  for (const [key, tiers] of Object.entries(TIERS)) {
    const city = cities[key];
    if (!city) { console.log(`${key}: not found, skipping`); continue; }
    if (!city.districts?.length) { console.log(`${key}: no districts, skipping`); continue; }

    const changed = applyTiers(city, key, tiers);

    // Add basis sources
    if (!city.sources) city.sources = {};
    if (!city.sources.basis) city.sources.basis = [];
    const tierSources = SOURCES[key] || [];
    for (const s of tierSources) {
      if (!city.sources.basis.some(b => b.url === s.url)) {
        city.sources.basis.push(s);
      }
    }

    const scores = [...new Set(city.districts.map(d => d.score))].sort((a,b)=>a-b);
    console.log(`${key}: ${changed}/${city.districts.length} districts updated | scores: ${scores.join(', ')}`);
    totalChanged += changed;
  }

  fs.writeFileSync(FILE, JSON.stringify(cities) + '\n');
  console.log(`\nDone — ${totalChanged} districts scored. Run: npm run clusters && npm run build`);
}

main();
