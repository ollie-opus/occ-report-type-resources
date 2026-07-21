// Generates a standalone form-section heading SVG (icon + Outfit SemiBold text).
// Usage:
//   node build-heading.mjs                          -> "Permit Details", permit-details-heading.svg
//   node build-heading.mjs "Work Description"       -> work-description-heading.svg
//   node build-heading.mjs "Sign-off" sign-off.svg  -> explicit output name
// To change the icon, edit ICON_D / ICON_BOX below (paste a heroicon path).
// See permit-to-work/DESIGN-SPEC.md for the design values.
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import { toD } from './serialize.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.join(HERE, '..', 'permit-to-work');

const TEXT = process.argv[2] || 'Permit Details';
const OUT = process.argv[3] || TEXT.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-heading.svg';

const font = opentype.parse(fs.readFileSync(path.join(HERE, 'Outfit-SemiBold.ttf')).buffer);
const UPM = font.unitsPerEm;
const CAP = font.tables.os2.sCapHeight;

const SIZE = 21;
const CAP_PX = (CAP / UPM) * SIZE;

// Heroicon mini bars-3-bottom-left, 20x20 viewBox.
const ICON_D = 'M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z';
const ICON_BOX = 20;
const ICON_SIZE = 20;          // rendered size in px
const GAP = 9;                 // icon -> text

function textPath(text, x, y, size) {
  const scale = size / UPM;
  let cursor = x;
  let d = '';
  let prev = null;
  const bb = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  for (const ch of text) {
    const glyph = font.charToGlyph(ch);
    if (prev) cursor += font.getKerningValue(prev, glyph) * scale;
    const p = glyph.getPath(cursor, y, size);
    const gb = p.getBoundingBox();
    if (gb.x1 !== 0 || gb.x2 !== 0) {
      bb.x1 = Math.min(bb.x1, gb.x1); bb.y1 = Math.min(bb.y1, gb.y1);
      bb.x2 = Math.max(bb.x2, gb.x2); bb.y2 = Math.max(bb.y2, gb.y2);
    }
    d += toD(p.commands);
    cursor += glyph.advanceWidth * scale;
    prev = glyph;
  }
  return { d, advance: cursor - x, bb };
}

const PAD = 1;                 // hairline margin so nothing clips
// Provisional layout at origin, then shift everything into view.
const probe = textPath(TEXT, 0, 0, SIZE);
const ascent = -probe.bb.y1;   // ink above baseline
const descent = Math.max(0, probe.bb.y2);

const H = Math.ceil(ascent + descent + PAD * 2);
const baseline = PAD + ascent;

const iconY = baseline - CAP_PX / 2 - ICON_SIZE / 2 + (1.6 / ICON_BOX) * ICON_SIZE;
// ^ heroicon ink is optically high in its box (bars span y=4..15.75, center 9.875
//   vs box center 10); the last term nudges it back onto the cap midline.

const textX = PAD + ICON_SIZE + GAP;
const { d } = textPath(TEXT, textX, baseline, SIZE);
const W = Math.ceil(textX + probe.advance + PAD);

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${TEXT}">
  <style>
    .ink { fill: #172032; }
    @media (prefers-color-scheme: dark) {
      .ink { fill: rgb(230,234,242); }
    }
  </style>
  <g class="ink">
    <g transform="translate(${PAD},${Math.round(iconY * 10) / 10}) scale(${ICON_SIZE / ICON_BOX})"><path fill-rule="evenodd" d="${ICON_D}" clip-rule="evenodd"></path></g>
    <path d="${d}"></path>
  </g>
</svg>
`;

fs.writeFileSync(path.join(REPO, OUT), svg);
console.log(`${OUT}: ${W}x${H} baseline=${baseline.toFixed(1)}`);
