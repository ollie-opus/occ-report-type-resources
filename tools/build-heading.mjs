// Generates a standalone form-section heading SVG (icon + Outfit SemiBold text).
// Usage:
//   node build-heading.mjs                                -> "Permit Details", default icon
//   node build-heading.mjs "Work Description"             -> work-description-heading.svg
//   node build-heading.mjs "Sign-off" sign-off.svg        -> explicit output name
//   node build-heading.mjs "Work Description" --icon icon.svg
//   node build-heading.mjs "Work Description" --icon '<svg viewBox="0 0 20 20">...</svg>'
// The --icon value is a heroicon (or any single-color icon): either a path to an
// .svg file or the full SVG markup pasted inline. Multi-path icons are fine.
// See permit-to-work/DESIGN-SPEC.md for the design values.
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import { toD } from './serialize.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.join(HERE, '..', 'permit-to-work');

// ---- CLI ---------------------------------------------------------------
const argv = process.argv.slice(2);
let iconArg = null;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--icon') iconArg = argv[++i];
  else positional.push(argv[i]);
}
const TEXT = positional[0] || 'Permit Details';
const OUT = positional[1] || TEXT.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-heading.svg';

// ---- icon --------------------------------------------------------------
// Default: heroicon mini bars-3-bottom-left, 20x20 viewBox.
const DEFAULT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clip-rule="evenodd"/></svg>';

let iconSrc = DEFAULT_ICON;
if (iconArg) {
  iconSrc = iconArg.trimStart().startsWith('<') ? iconArg : fs.readFileSync(iconArg, 'utf8');
}

const vb = iconSrc.match(/viewBox="([\d.\s-]+)"/);
if (!vb) throw new Error('icon has no viewBox');
const ICON_BOX = parseFloat(vb[1].trim().split(/\s+/)[3]);

// Keep each <path> verbatim (preserves fill-rule/clip-rule), but strip fills so
// the icon inherits the heading ink color.
const iconPaths = [...iconSrc.matchAll(/<path\b[^>]*?\/?>(?:<\/path>)?/g)]
  .map(m => m[0]
    .replace(/\s*fill="[^"]*"/g, '')
    .replace(/\s*\/>$/, '></path>')
    .replace(/><\/path>$/, '></path>'));
if (!iconPaths.length) throw new Error('icon has no <path> elements');

// Approximate ink bounding box from path endpoints/control points (good enough
// for optical centering; arc curvature extremes are ignored).
function approxPathBBox(d) {
  let x = 0, y = 0, sx = 0, sy = 0;
  let minY = Infinity, maxY = -Infinity;
  const see = py => { minY = Math.min(minY, py); maxY = Math.max(maxY, py); };
  const tokens = [...d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[+-]?\d+)?)/gi)];
  let i = 0;
  const num = () => parseFloat(tokens[i++][2]);
  let cmd = null;
  while (i < tokens.length) {
    if (tokens[i][1]) { cmd = tokens[i++][1]; if (cmd === 'Z' || cmd === 'z') { x = sx; y = sy; continue; } }
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M': x = rel ? x + num() : num(); y = rel ? y + num() : num(); sx = x; sy = y; see(y); cmd = rel ? 'l' : 'L'; break;
      case 'L': x = rel ? x + num() : num(); y = rel ? y + num() : num(); see(y); break;
      case 'H': x = rel ? x + num() : num(); break;
      case 'V': y = rel ? y + num() : num(); see(y); break;
      case 'C': { const y1 = rel ? y + (num(), num()) : (num(), num()); see(y1); const y2 = rel ? y + (num(), num()) : (num(), num()); see(y2); x = rel ? x + num() : num(); y = rel ? y + num() : num(); see(y); break; }
      case 'S': case 'Q': { const y1 = rel ? y + (num(), num()) : (num(), num()); see(y1); x = rel ? x + num() : num(); y = rel ? y + num() : num(); see(y); break; }
      case 'T': x = rel ? x + num() : num(); y = rel ? y + num() : num(); see(y); break;
      case 'A': { num(); num(); num(); num(); num(); x = rel ? x + num() : num(); y = rel ? y + num() : num(); see(y); break; }
    }
  }
  return { minY, maxY };
}

let inkMinY = Infinity, inkMaxY = -Infinity;
for (const p of iconPaths) {
  const d = p.match(/\bd="([^"]+)"/)[1];
  const b = approxPathBBox(d);
  inkMinY = Math.min(inkMinY, b.minY);
  inkMaxY = Math.max(inkMaxY, b.maxY);
}
const inkCenterY = (inkMinY + inkMaxY) / 2;

// ---- text --------------------------------------------------------------
const font = opentype.parse(fs.readFileSync(path.join(HERE, 'Outfit-SemiBold.ttf')).buffer);
const UPM = font.unitsPerEm;
const CAP = font.tables.os2.sCapHeight;

const SIZE = 21;
const CAP_PX = (CAP / UPM) * SIZE;
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
const probe = textPath(TEXT, 0, 0, SIZE);
const ascent = -probe.bb.y1;   // ink above baseline
const descent = Math.max(0, probe.bb.y2);

const H = Math.ceil(ascent + descent + PAD * 2);
const baseline = PAD + ascent;

// Optical alignment: the icon's INK (not its box) is centered on the cap
// midline, then dropped 0.07em — mixed-case text has its visual mass below the
// cap midline, so a mathematically centered icon reads slightly high.
const capMidline = baseline - CAP_PX / 2;
const DROP = 0.07 * SIZE;
const iconScale = ICON_SIZE / ICON_BOX;
const iconY = capMidline + DROP - inkCenterY * iconScale;

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
    <g transform="translate(${PAD},${Math.round(iconY * 10) / 10}) scale(${iconScale})">${iconPaths.join('')}</g>
    <path d="${d}"></path>
  </g>
</svg>
`;

fs.writeFileSync(path.join(REPO, OUT), svg);
console.log(`${OUT}: ${W}x${H} baseline=${baseline.toFixed(1)} iconInkY=${inkMinY.toFixed(1)}..${inkMaxY.toFixed(1)}`);
