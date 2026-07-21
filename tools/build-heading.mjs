// Generates a standalone form-section heading SVG (icon + Outfit SemiBold text).
// Usage:
//   node build-heading.mjs                                -> "Permit Details", default icon
//   node build-heading.mjs "Work Description"             -> work-description-heading.svg
//   node build-heading.mjs "Sign-off" sign-off.svg        -> explicit output name
//   node build-heading.mjs "Work Description" --icon icon.svg
//   node build-heading.mjs "Work Description" --icon '<svg viewBox="0 0 20 20">...</svg>'
//   node build-heading.mjs "Missing Information" --size h1
//   node build-heading.mjs "Hazards" --icon-color '#D97706:#FBBF24'
//   node build-heading.mjs "Permit to Work" --no-icon
// The --icon value is a heroicon (or any single-color icon): either a path to an
// .svg file or the full SVG markup pasted inline. Multi-path icons are fine.
// --size is h1 (31.5px), h2 (21px, default) or h3 (17.5px); icon and gap scale with it.
// --icon-color is "<light>" or "<light>:<dark>" and colors only the icon (text stays ink).
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
let sizeArg = 'h2';
let iconColorArg = null;
let noIcon = false;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--icon') iconArg = argv[++i];
  else if (argv[i] === '--size') sizeArg = argv[++i];
  else if (argv[i] === '--icon-color') iconColorArg = argv[++i];
  else if (argv[i] === '--no-icon') noIcon = true;
  else positional.push(argv[i]);
}
const SIZES = { h1: 31.5, h2: 21, h3: 17.5 };
if (!(sizeArg in SIZES)) throw new Error(`--size must be one of: ${Object.keys(SIZES).join(', ')}`);
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

// Ink bounding box (vertical) by sampling every segment, including curve and
// arc interiors — endpoint-only scanning badly misjudges circle-based icons
// (e.g. an ellipsis circle whose arc endpoints all sit near the middle).
const SAMPLES = 24;

function sampleArcY(x1, y1, rx, ry, phiDeg, largeArc, sweep, x2, y2, see) {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (!rx || !ry) { see(y2); return; }
  const phi = (phiDeg * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, (rx * rx * ry * ry - den) / den));
  if (largeArc === sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry, cyp = (-coef * ry * x1p) / rx;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy, len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    return (ux * vy - uy * vx < 0) ? -a : a;
  };
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dth > 0) dth -= 2 * Math.PI;
  if (sweep && dth < 0) dth += 2 * Math.PI;
  for (let t = 0; t <= SAMPLES; t++) {
    const th = th1 + (dth * t) / SAMPLES;
    see(sin * rx * Math.cos(th) + cos * ry * Math.sin(th) + cy);
  }
}

function approxPathBBox(d) {
  let x = 0, y = 0, sx = 0, sy = 0;
  let cx = null, cy = null, qx = null, qy = null;   // last cubic/quad control point
  let minY = Infinity, maxY = -Infinity;
  const see = py => { minY = Math.min(minY, py); maxY = Math.max(maxY, py); };
  const cubicY = (y0, y1, y2, y3) => {
    for (let t = 0; t <= SAMPLES; t++) {
      const u = t / SAMPLES, a = 1 - u;
      see(a * a * a * y0 + 3 * a * a * u * y1 + 3 * a * u * u * y2 + u * u * u * y3);
    }
  };
  const quadY = (y0, y1, y2) => {
    for (let t = 0; t <= SAMPLES; t++) {
      const u = t / SAMPLES, a = 1 - u;
      see(a * a * y0 + 2 * a * u * y1 + u * u * y2);
    }
  };
  const tokens = [...d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[+-]?\d+)?)/gi)];
  let i = 0;
  const num = () => parseFloat(tokens[i++][2]);
  let cmd = null;
  while (i < tokens.length) {
    if (tokens[i][1]) { cmd = tokens[i++][1]; if (cmd === 'Z' || cmd === 'z') { x = sx; y = sy; continue; } }
    const rel = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();
    if (upper !== 'C' && upper !== 'S') { cx = null; cy = null; }
    if (upper !== 'Q' && upper !== 'T') { qx = null; qy = null; }
    switch (upper) {
      case 'M': x = rel ? x + num() : num(); y = rel ? y + num() : num(); sx = x; sy = y; see(y); cmd = rel ? 'l' : 'L'; break;
      case 'L': x = rel ? x + num() : num(); y = rel ? y + num() : num(); see(y); break;
      case 'H': x = rel ? x + num() : num(); break;
      case 'V': y = rel ? y + num() : num(); see(y); break;
      case 'C': {
        const x1 = rel ? x + num() : num(), y1 = rel ? y + num() : num();
        const x2 = rel ? x + num() : num(), y2 = rel ? y + num() : num();
        const x3 = rel ? x + num() : num(), y3 = rel ? y + num() : num();
        cubicY(y, y1, y2, y3); cx = x2; cy = y2; x = x3; y = y3; break;
      }
      case 'S': {
        const y1 = cy !== null ? 2 * y - cy : y;
        const x2 = rel ? x + num() : num(), y2 = rel ? y + num() : num();
        const x3 = rel ? x + num() : num(), y3 = rel ? y + num() : num();
        cubicY(y, y1, y2, y3); cx = x2; cy = y2; x = x3; y = y3; break;
      }
      case 'Q': {
        const x1 = rel ? x + num() : num(), y1 = rel ? y + num() : num();
        const x2 = rel ? x + num() : num(), y2 = rel ? y + num() : num();
        quadY(y, y1, y2); qx = x1; qy = y1; x = x2; y = y2; break;
      }
      case 'T': {
        const y1 = qy !== null ? 2 * y - qy : y;
        qx = qx !== null ? 2 * x - qx : x; qy = y1;
        const x2 = rel ? x + num() : num(), y2 = rel ? y + num() : num();
        quadY(y, y1, y2); x = x2; y = y2; break;
      }
      case 'A': {
        const rx = num(), ry = num(), rot = num(), laf = num(), swf = num();
        const x2 = rel ? x + num() : num(), y2 = rel ? y + num() : num();
        sampleArcY(x, y, rx, ry, rot, laf, swf, x2, y2, see);
        x = x2; y = y2; break;
      }
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

const SIZE = SIZES[sizeArg];
const CAP_PX = (CAP / UPM) * SIZE;
// Icon and gap scale with the em size; at the h2 reference size they are the
// original 20px icon and 9px gap.
const ICON_SIZE = Math.round(SIZE * (20 / 21) * 10) / 10;
const GAP = Math.round(SIZE * (9 / 21) * 10) / 10;

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

// The icon's INK (not its box) is centered on the type's cap midline. An icon
// taller than the cap height overflows the cap band symmetrically, and the
// canvas grows to contain it — icon ink is never clipped.
let baseline = PAD + ascent;
const iconScale = ICON_SIZE / ICON_BOX;
let iconY = (baseline - CAP_PX / 2) - inkCenterY * iconScale;

if (!noIcon) {
  const iconTop = iconY + inkMinY * iconScale;
  const shift = Math.max(0, PAD - iconTop);   // icon pokes above the text ink
  baseline += shift;
  iconY += shift;
}
const iconBottom = noIcon ? 0 : iconY + inkMaxY * iconScale;

const H = Math.ceil(Math.max(baseline + descent, iconBottom) + PAD);

const textX = noIcon ? PAD : PAD + ICON_SIZE + GAP;
const { d } = textPath(TEXT, textX, baseline, SIZE);
const W = Math.ceil(textX + probe.advance + PAD);

const [iconLight, iconDark] = iconColorArg ? iconColorArg.split(':') : [];
const iconClass = iconColorArg ? 'icon' : 'ink';
const iconLightRule = iconColorArg ? `\n    .icon { fill: ${iconLight}; }` : '';
const iconDarkRule = iconColorArg ? `\n      .icon { fill: ${iconDark || iconLight}; }` : '';

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${TEXT}">
  <style>
    .ink { fill: #172032; }${iconLightRule}
    @media (prefers-color-scheme: dark) {
      .ink { fill: rgb(230,234,242); }${iconDarkRule}
    }
  </style>
  <g class="ink">${noIcon ? '' : `
    <g class="${iconClass}" transform="translate(${PAD},${Math.round(iconY * 10) / 10}) scale(${iconScale})">${iconPaths.join('')}</g>`}
    <path d="${d}"></path>
  </g>
</svg>
`;

fs.writeFileSync(path.join(REPO, OUT), svg);
console.log(`${OUT}: ${W}x${H} baseline=${baseline.toFixed(1)} iconInkY=${inkMinY.toFixed(1)}..${inkMaxY.toFixed(1)}`);
