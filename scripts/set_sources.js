// Populate precise, structured sources for every city (MAP_SOURCES.md + the sources used to build
// Lima/Guadalajara/Monterrey here). Each city's `sources` becomes { boundary:[...], basis:[...] },
// items = { text:<short name>, url?:<clickable> }. The renderer also appends a global "General
// references" list (State Dept / OSAC / FCDO / Numbeo) for every city, so those aren't repeated here.
//   node scripts/set_sources.js   (then: npm run build)

const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'cities.json');
const cities = JSON.parse(fs.readFileSync(file, 'utf8'));

const S = {
  'sao-paulo': {
    boundary: [
      { text: 'distritos-sp — codigourbano (96 distritos, ds_nome)', url: 'https://github.com/codigourbano/distritos-sp' },
      { text: 'raw GeoJSON', url: 'https://raw.githubusercontent.com/codigourbano/distritos-sp/master/distritos-sp.geojson' },
      { text: 'Authority: GeoSampa / Prefeitura de São Paulo', url: 'https://geosampa.prefeitura.sp.gov.br/' },
    ],
    basis: [
      { text: 'Vanguard Attaché — São Paulo (risk model)', url: 'https://vanguardattache.com/en/insights/is-sao-paulo-safe-tourists-2026' },
      { text: 'SSP-SP — crime statistics', url: 'https://www.ssp.sp.gov.br/estatistica/' },
      { text: 'FBSP — Fórum Bras. de Segurança Pública', url: 'https://forumseguranca.org.br/' },
      { text: 'OSAC — Brazil', url: 'https://www.osac.gov/Country/Brazil' },
    ],
  },
  'mexico-city': {
    boundary: [
      { text: 'JuveCampos/Shapes_Resiliencia_CDMX_CIDE', url: 'https://github.com/JuveCampos/Shapes_Resiliencia_CDMX_CIDE' },
      { text: 'Poligono_colonias.geojson (central colonias)' },
      { text: 'CDMX_mpal.geojson (outer alcaldías, NOM_MUN)' },
      { text: 'municipios_zmvm.geojson (Edomex metro ring)' },
      { text: 'Authority: INEGI — Marco Geoestadístico', url: 'https://www.inegi.org.mx/' },
    ],
    basis: [
      { text: 'datos.cdmx — FGJ carpetas de investigación', url: 'https://datos.cdmx.gob.mx/' },
      { text: 'OSAC — Mexico', url: 'https://www.osac.gov/Country/Mexico' },
    ],
  },
  'rio-de-janeiro': {
    boundary: [
      { text: 'Limite_Bairro.geojson — gist esperanc (NOME)', url: 'https://gist.github.com/esperanc/db213370dd176f8524ae6ba32433f90a' },
      { text: 'Authority: Data.Rio / Instituto Pereira Passos', url: 'https://www.data.rio/datasets/limite-bairro' },
    ],
    basis: [
      { text: 'Vanguard Attaché — Rio de Janeiro (risk model)', url: 'https://vanguardattache.com/en/insights/is-rio-de-janeiro-safe-tourists-2026' },
      { text: 'ISP-RJ — Instituto de Segurança Pública' },
      { text: 'OSAC — Brazil', url: 'https://www.osac.gov/Country/Brazil' },
    ],
  },
  medellin: {
    boundary: [
      { text: 'medellin.geojson — gist davixcky (NOMBRE, comunas+corregimientos)', url: 'https://gist.github.com/davixcky/ade2468ed713364fd5876a16305608b4' },
      { text: 'Authority: Alcaldía de Medellín / GeoMedellín' },
    ],
    basis: [
      { text: 'SISC — Sistema de Información para la Seguridad y la Convivencia' },
      { text: 'OSAC — Colombia', url: 'https://www.osac.gov/Country/Colombia' },
    ],
  },
  bogota: {
    boundary: [
      { text: 'bogota.geojson — codeforgermany/click_that_hood (name)', url: 'https://github.com/codeforgermany/click_that_hood' },
      { text: 'Authority: Catastro Distrital / Datos Abiertos Bogotá', url: 'https://datosabiertos.bogota.gov.co/' },
    ],
    basis: [
      { text: 'SDSCJ — Secretaría Distrital de Seguridad, Convivencia y Justicia' },
      { text: 'OSAC — Colombia', url: 'https://www.osac.gov/Country/Colombia' },
    ],
  },
  'buenos-aires': {
    boundary: [
      { text: 'caba_barrios.geojson — OpenDataCordoba/barrios (BARRIO)', url: 'https://github.com/OpenDataCordoba/barrios' },
      { text: 'Authority: GCBA — Buenos Aires Data (Barrios)', url: 'https://data.buenosaires.gob.ar/dataset/barrios' },
    ],
    basis: [
      { text: 'Mapa del Delito (GCBA)', url: 'https://data.buenosaires.gob.ar/dataset/delitos' },
      { text: 'OSAC — Argentina', url: 'https://www.osac.gov/Country/Argentina' },
    ],
  },
  santiago: {
    boundary: [
      { text: 'geosantiago.geojson — cilopez/geojson-houm (NOM_COM, 32 comunas)', url: 'https://github.com/cilopez/geojson-houm' },
      { text: 'Authority: INE Chile / municipalidades', url: 'https://www.ine.gob.cl/' },
    ],
    basis: [
      { text: 'CEAD — Centro de Estudios y Análisis del Delito', url: 'https://cead.spd.gov.cl/' },
      { text: 'OSAC — Chile', url: 'https://www.osac.gov/Country/Chile' },
    ],
  },
  lima: {
    boundary: [
      { text: 'peru-geojson — juaneladio (INEI distritos)', url: 'https://github.com/juaneladio/peru-geojson' },
      { text: 'Authority: INEI — Perú', url: 'https://www.inei.gob.pe/' },
    ],
    basis: [
      { text: 'OSAC — Peru', url: 'https://www.osac.gov/Country/Peru' },
      { text: 'Tiers: editorial travel-safety synthesis (advisories + traveller guidance)' },
    ],
  },
  guadalajara: {
    boundary: [
      { text: 'geoBoundaries — MEX ADM2 municipios', url: 'https://www.geoboundaries.org' },
      { text: 'Authority: INEGI — Marco Geoestadístico', url: 'https://www.inegi.org.mx/' },
    ],
    basis: [
      { text: 'OSAC — Mexico', url: 'https://www.osac.gov/Country/Mexico' },
      { text: 'Tiers: editorial travel-safety synthesis (advisories + traveller guidance)' },
    ],
  },
  monterrey: {
    boundary: [
      { text: 'geoBoundaries — MEX ADM2 municipios', url: 'https://www.geoboundaries.org' },
      { text: 'Authority: INEGI — Marco Geoestadístico', url: 'https://www.inegi.org.mx/' },
    ],
    basis: [
      { text: 'OSAC — Mexico', url: 'https://www.osac.gov/Country/Mexico' },
      { text: 'Tiers: editorial travel-safety synthesis (advisories + traveller guidance)' },
    ],
  },
};

// Uniform sources for the 48 city-level entries (single overall rating, indicative circle).
const cityLevel = () => ({
  boundary: [
    { text: 'City centre: geonamescache (most-populous namesake)', url: 'https://github.com/yaph/geonamescache' },
    { text: 'Geometry is an indicative circle, not an admin boundary' },
  ],
  basis: [
    { text: 'Overall rating: editorial travel-security synthesis (OSAC advisories, homicide reputation)' },
  ],
});

// Coordinate-correction credit for the three relocated namesakes (CORRECTIONS.md §A).
const corrected = {
  belem: { text: 'Coordinate corrected to Belém, Pará (verified)', url: 'https://www.geodatos.net/en/coordinates/brazil/belem' },
  campinas: { text: 'Coordinate corrected to Campinas, São Paulo (most-populous namesake)' },
  puebla: { text: 'Coordinate corrected to Puebla, Puebla (most-populous namesake)' },
};

let set = 0;
for (const key of Object.keys(cities)) {
  const C = cities[key];
  if (S[key]) { C.sources = S[key]; }
  else if ((C.tier_level || 'city') === 'city') { C.sources = cityLevel(); }
  else continue;
  if (corrected[key]) C.sources.boundary.unshift(corrected[key]);
  set++;
}

fs.writeFileSync(file, JSON.stringify(cities) + '\n');
console.log(`Set structured sources on ${set} cities.`);
