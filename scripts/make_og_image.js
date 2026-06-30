// Render the social share image (og-image.png, 1200x630) from an inline SVG.
// Run: node scripts/make_og_image.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const W = 1200, H = 630;
// green -> red scale dots (matches the legend feel)
const scale = ['#2e9e5b', '#7fbf3f', '#d8c13a', '#e08a2e', '#c0392b'];
const dots = scale.map((c, i) => `<circle cx="${110 + i * 64}" cy="470" r="22" fill="${c}" stroke="#ffffff" stroke-width="3"/>`).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0F6E56"/><stop offset="1" stop-color="#0b5946"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="14" fill="#C15A37"/>
  <text x="100" y="210" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="92" font-weight="800" fill="#ffffff">Latam Crime Map</text>
  <text x="104" y="285" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="40" font-weight="500" fill="#cfeee4">Neighbourhood &amp; city safety across Latin America</text>
  ${dots}
  <text x="430" y="482" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="34" font-weight="600" fill="#eaf6f1">safe &#8594; high risk</text>
  <text x="100" y="566" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="30" font-weight="500" fill="#9fd6c6">69 cities · synthesized from multiple sources · latamcrimemap.com</text>
</svg>`;

sharp(Buffer.from(svg)).png().toFile(path.join(__dirname, '..', 'og-image.png'))
  .then(info => console.log('og-image.png:', info.width + 'x' + info.height, (info.size / 1024).toFixed(0) + ' KB'))
  .catch(e => { console.error(e); process.exit(1); });
