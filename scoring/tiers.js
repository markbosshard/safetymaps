// Scoring constants — the editorial 4-tier scale and its mapping onto the 1-10 gradient.
// Source of truth: PROJECT.md §3 ("Tier -> score") and §4 (per-city default tiers).
//
// NOTE: the original per-unit tier dictionaries (which neighbourhood = which tier) lived
// in the now-missing build scripts (build_cities.py / patch_cdmx.py / add_cities.py).
// Those decisions are already baked into the scores stored in cities.json. This module is
// the home for re-deriving or extending scoring when cities are rebuilt from raw geometry
// (Tasks D & F). Until then, cities.json is authoritative.

// Editorial tier -> continuous score, so tiers land on the same green->red gradient
// as the São Paulo continuous model.
const TIER_SCORE = { 1: 2.0, 2: 4.0, 3: 6.0, 4: 8.5 };

// Tier band thresholds used by the UI / popups (see color() in the app).
const BANDS = [
  { name: 'Safe', max: 2.5 },
  { name: 'Moderate', max: 5.0 },
  { name: 'Caution', max: 7.5 },
  { name: 'Avoid', max: Infinity },
];

// Per-city default tier for units not explicitly listed in a curated dictionary (PROJECT.md §4.2).
const DEFAULT_TIER = {
  rio: 3, medellin: 3, 'buenos-aires': 2, bogota: 3, santiago: 3,
};

function tierName(score) {
  return (BANDS.find(b => score < b.max) || BANDS[BANDS.length - 1]).name;
}

module.exports = { TIER_SCORE, BANDS, DEFAULT_TIER, tierName };
