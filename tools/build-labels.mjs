// Rebuilds the five permit status tile SVGs in permit-to-work/.
// The status pills inside each tile are extracted from the existing files
// byte-for-byte and re-wrapped; only the tile chrome is generated here.
// See permit-to-work/DESIGN-SPEC.md for the design values.
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import { toD } from './serialize.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.join(HERE, '..', 'permit-to-work');
const PREVIEW = path.join(HERE, 'preview', 'dark');
fs.mkdirSync(PREVIEW, { recursive: true });

const font = opentype.parse(fs.readFileSync(path.join(HERE, 'Outfit-SemiBold.ttf')).buffer);
const UPM = font.unitsPerEm;
const CAP = font.tables.os2.sCapHeight;

// ---- label geometry ----------------------------------------------------
const LABEL_TEXT = 'PERMIT STATUS';
const FONT_SIZE = 11.5;                    // px em size
const TRACK = FONT_SIZE * 0.09;            // letterspacing in px
const CAP_PX = (CAP / UPM) * FONT_SIZE;    // cap height in px

const TILE_H = 50;
const PILL_Y = 10;                         // pill group y (30px tall pill)
const PILL_H = 30;
const PAD_L = 16;
const GAP = 13;
const PAD_R = 10;

// Baseline so caps are optically centered on the pill center.
const BASELINE = PILL_Y + PILL_H / 2 + CAP_PX / 2;

// Manual glyph layout (opentype.js shaping chokes on some fonts' GSUB tables).
function labelPath(text, x, y, size) {
  const scale = size / UPM;
  let cursor = x;
  let d = '';
  let prev = null;
  for (const ch of text) {
    const glyph = font.charToGlyph(ch);
    if (prev) cursor += font.getKerningValue(prev, glyph) * scale;
    d += toD(glyph.getPath(cursor, y, size).commands);
    cursor += glyph.advanceWidth * scale + TRACK;
    prev = glyph;
  }
  return { d, width: cursor - TRACK - x };
}

// ---- shared style block ------------------------------------------------
// .pill/.ink values are re-emitted verbatim from each source file.
function styleBlock(pillLight, inkLight, pillDark, inkDark) {
  return `  <style>
    .tile  { fill: #FBFCFD; stroke: rgb(228,230,235); }
    .label { fill: rgb(102,112,133); }
    .pill  { ${pillLight} }
    .ink   { ${inkLight} }
    @media (prefers-color-scheme: dark) {
      .tile  { fill: #172032; stroke: rgb(66,77,96); }
      .label { fill: rgb(167,176,191); }
      .pill  { ${pillDark} }
      .ink   { ${inkDark} }
    }
  </style>`;
}

const files = [
  'permit-valid-label.svg',
  'permit-invalid-label.svg',
  'permit-expired-label.svg',
  'permit-in-progress-label.svg',
  'permit-future-label.svg',
];

const round1 = n => Math.round(n * 10) / 10;

for (const name of files) {
  const src = fs.readFileSync(path.join(REPO, name), 'utf8');

  // -- extract everything that must be preserved byte-for-byte -----------
  const aria = src.match(/aria-label="([^"]+)"/)[1];
  const pillRule = src.match(/\.pill\s*\{\s*([^}]*?)\s*\}/)[1];
  const inkRule = src.match(/\.ink\s*\{\s*([^}]*?)\s*\}/)[1];
  const darkBlock = src.match(/@media[^{]*\{([\s\S]*?)\n\s*\}\n\s*<\/style>/)[1];
  const pillRuleDark = darkBlock.match(/\.pill\s*\{\s*([^}]*?)\s*\}/)[1];
  const inkRuleDark = darkBlock.match(/\.ink\s*\{\s*([^}]*?)\s*\}/)[1];
  const pillRect = src.match(/<rect class="pill"[^>]*><\/rect>/)[0];
  const inkGroups = src.match(/<g class="ink"[\s\S]*?<\/g>/g);
  if (inkGroups.length !== 2) throw new Error(`${name}: expected 2 ink groups`);
  const pillGroupScale = 0.192308;
  const pillW = parseFloat(pillRect.match(/width="([\d.]+)"/)[1]);
  // Rendered pill width: rect width + 2*x-offset(3) for the stroke inset, times scale.
  const pillRenderW = (pillW + 6) * pillGroupScale;

  // -- label --------------------------------------------------------------
  const { d, width: labelW } = labelPath(LABEL_TEXT, 0, 0, FONT_SIZE);

  const pillX = PAD_L + labelW + GAP;
  const tileW = round1(pillX + pillRenderW + PAD_R);

  const svg = `<svg width="${tileW}" height="${TILE_H}" viewBox="0 0 ${tileW} ${TILE_H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}">
${styleBlock(pillRule, inkRule, pillRuleDark, inkRuleDark)}
  <rect class="tile" x="0.5" y="0.5" width="${round1(tileW - 1)}" height="${TILE_H - 1}" rx="12" ry="12" stroke-width="1"></rect>
  <g class="label" transform="translate(${PAD_L},${round1(BASELINE)})"><path d="${d}"></path></g>
  <g transform="translate(${round1(pillX)},${PILL_Y}) scale(${pillGroupScale})">
    ${pillRect}
    ${inkGroups[0]}
    ${inkGroups[1]}
  </g>
</svg>
`;

  fs.writeFileSync(path.join(REPO, name), svg);

  // dark-forced copy for preview only (never commit these)
  const dark = svg
    .replace(/\.tile  \{ fill: #FBFCFD; stroke: rgb\(228,230,235\); \}/, '.tile  { fill: #172032; stroke: rgb(66,77,96); }')
    .replace(/\.label \{ fill: rgb\(102,112,133\); \}/, '.label { fill: rgb(167,176,191); }')
    .replace(`.pill  { ${pillRule} }`, `.pill  { ${pillRuleDark} }`)
    .replace(`.ink   { ${inkRule} }`, `.ink   { ${inkRuleDark} }`);
  fs.writeFileSync(path.join(PREVIEW, name), dark);

  console.log(`${name}: tileW=${tileW} labelW=${round1(labelW)} pillX=${round1(pillX)} pillRenderW=${round1(pillRenderW)}`);
}
