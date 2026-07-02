// One-shot cleanup after add_districts_wave5.js.
// Reverts cities that got over-large or cross-border contaminated district sets,
// and optionally filters individual bad names out of borderline cities.
//
//   node scripts/cleanup_wave5.js

'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'cities.json');
const cities = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// Cities to revert to single circle (too many, too granular, or cross-border contamination):
//   - mendoza: 299 micro-barrios at OSM level 9 (way too many for a choropleth)
//   - bariloche: 80 micro-barrios at OSM level 9
//   - tijuana: 16 districts but mix of US (Chula Vista/San Diego) + Tijuana
// For each, we restore the saved original (cities.json backup) if present,
// otherwise remove the districts array back to the single-circle (pre-wave5) state.

const REVERT_KEYS = [
  'mendoza',   // 299 micro-barrios (OSM level 9, way too granular)
  'bariloche', // 80 micro-barrios (OSM level 9, too granular for this city size)
  'tijuana',   // 16 "colonias" that are mostly US neighborhoods (Chula Vista/San Diego)
  'saltillo',  // 19 colonias all from one residential development (Virreyes area only, not city-wide)
];

// Foz do Iguaçu: drop "23 de Octubre" (Spanish = Argentine, should be "Outubro" in PT).
// Keep "Área X" numbered zones (common Brazilian planning zone naming) and Portuguese names.
const FOZ_EXCLUDE = /^23 de Octubre$/i;

let changed = 0;

// ── Revert to single circle ────────────────────────────────────────────────────

for (const key of REVERT_KEYS) {
  const C = cities[key];
  if (!C) { console.log(`${key}: not found, skipping`); continue; }

  const nd = C.districts ? C.districts.length : 0;
  if (nd <= 1) { console.log(`${key}: already single-circle (${nd} districts), skipping`); continue; }

  // Try to restore from the backup saved before wave5 ran
  const backupFile = `/tmp/${key}_original.json`;
  if (fs.existsSync(backupFile)) {
    const original = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    cities[key] = original;
    console.log(`${key}: restored from backup (was ${nd} districts → ${original.districts ? original.districts.length : 0})`);
  } else {
    // No backup: keep only the first district (the city circle) and remove OSM metadata
    const circle = C.districts[0];
    cities[key] = Object.assign({}, C, {
      tier_level: 'circle',
      districts: [circle],
      note: `${C.name} — city-level safety overview. No verified per-neighbourhood detail available yet.`,
      sources: C.sources && C.sources.basis ? { basis: C.sources.basis } : undefined,
    });
    delete cities[key].sources?.boundary;
    console.log(`${key}: reverted to single-circle (was ${nd} districts, no backup)`);
  }
  changed++;
}

// ── Foz do Iguaçu: filter cross-border names ─────────────────────────────────

const foz = cities['foz-do-iguacu'];
if (foz && foz.districts && foz.districts.length > 1) {
  const before = foz.districts.length;
  foz.districts = foz.districts.filter(d => !FOZ_EXCLUDE.test(d.name));
  const after = foz.districts.length;
  if (before !== after) {
    console.log(`foz-do-iguacu: filtered ${before - after} cross-border districts (${before} → ${after})`);
    // Recompute bbox
    const { bboxOf } = require('./lib/geo');
    foz.bbox = bboxOf(foz.districts);
    changed++;
  } else {
    console.log(`foz-do-iguacu: no cross-border names matched filter, left as ${after} districts`);
  }

  // If too few valid districts remain, revert to single circle
  if (foz.districts.length < 4) {
    const backupFile = '/tmp/foz-do-iguacu_original.json';
    if (fs.existsSync(backupFile)) {
      cities['foz-do-iguacu'] = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      console.log(`foz-do-iguacu: too few after filter, restored from backup`);
    } else {
      cities['foz-do-iguacu'].districts = [foz.districts[0]];
      console.log(`foz-do-iguacu: too few after filter, reverted to circle`);
    }
    changed++;
  }
} else {
  console.log(`foz-do-iguacu: single-circle, nothing to filter`);
}

// ── Write ─────────────────────────────────────────────────────────────────────

if (changed > 0) {
  fs.writeFileSync(FILE, JSON.stringify(cities) + '\n');
  console.log(`\nWrote ${changed} changes to cities.json`);
} else {
  console.log('\nNo changes made');
}
