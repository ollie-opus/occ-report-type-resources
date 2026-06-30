# Status Label SVG — Build Specification

A reusable spec for producing **pill-shaped status labels** as self-contained SVGs,
identical in construction to the "Permit: Valid" label. Hand this file to a new chat
along with the three inputs below and it will produce an exact-style variant.

---

## What I will provide (3 inputs)

1. **Colour JSON** — same shape as:
   ```json
   {
     "dark": {
       "bg":     "rgb(0,96,69)",
       "text":   "rgb(208,250,229)",
       "border": "rgb(0,188,125)"
     }
   }
   ```
   (There may be other keys/themes; use the one I point to, default `dark`.)

2. **Icon SVG** — a single icon, e.g. a [Heroicon](https://heroicons.com) solid 16×16:
   ```xml
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
     <path fill-rule="evenodd" d="…" clip-rule="evenodd"/>
   </svg>
   ```

3. **Text** — the label string, e.g. `Permit: Valid`.

---

## Output

- **One self-contained `.svg` file** (and a matching `.dc.html` preview if useful).
- **No font dependency** — the text is converted to **vector outlines**, so it renders
  identically everywhere (browsers, email, Figma, Illustrator). This is deliberate and
  must be preserved; do **not** fall back to a `<text>` element in the final deliverable.
- Default rendered size: **height 30px**, width proportional (see §6). The `viewBox` is
  always the full-resolution coordinate space so it stays crisp at any size.
- Deliver the result **both** as a saved file **and** as raw SVG markup in a code block
  (I usually want to copy it).

---

## Design system (fixed values — do not change unless asked)

All geometry is authored in a **156-unit-tall** coordinate space (the `viewBox` height is
always `156`; the `viewBox` width is computed per §6).

### 1. Pill body
```xml
<rect x="3" y="3" width="{W-6}" height="150" rx="75" ry="75"
      fill="{bg}" stroke="{border}" stroke-width="6"/>
```
- Fully rounded ends (`rx=ry=75` = half of 150).
- `fill` = colour JSON `bg`; `stroke` = colour JSON `border`; stroke width `6`.

### 2. Icon
```xml
<g transform="translate(40,40) scale({76 / iconViewBox})" fill="{text}">
  <path …/>   <!-- the icon's path(s), with fill="currentColor" removed -->
</g>
```
- Target icon size is **76 units**, so `scale = 76 / iconViewBoxSize`
  (16 → `4.75`, 20 → `3.8`, 24 → `3.1667`). Keep `translate(40,40)`.
- This places the icon at x 40–116, vertically centred on y≈78.
- Recolour: the icon inherits `fill="{text}"` from the wrapping `<g>`; strip any
  `fill="currentColor"` / hard-coded fills from the icon's own paths so it picks up `text`.
- Keep `fill-rule`/`clip-rule` attributes on the icon paths intact.

### 3. Label text (as vector outlines)
- **Font: Rubik.** Source the variable font from
  `https://raw.githubusercontent.com/google/fonts/main/ofl/rubik/Rubik%5Bwght%5D.ttf`.
- **Weight: interpolate the variable axis to `wght: 470`.** Rationale: the design weight is
  Rubik **400**, but raw vector outlines render slightly thinner than live hinted font text
  at small sizes, so we thicken to **~470** to match the intended on-screen weight. (If a
  variant needs to look lighter/heavier, adjust this number — 400 = true regular.)
- **Font size: 74.** **Baseline: `translate(138 105.35)`** — x=138 sets the gap after the
  icon; y=105.35 vertically centres Rubik caps on ≈y=79.
- Fill = colour JSON `text`.

```xml
<g transform="translate(138 105.35)" fill="{text}">
  <path d="{generated outline path}"/>
</g>
```

---

## 4. Colour mapping (summary)

| SVG element        | Colour JSON key |
|--------------------|-----------------|
| `rect` fill (pill) | `bg`            |
| `rect` stroke      | `border`        |
| icon `<g>` fill    | `text`          |
| text `<g>` fill    | `text`          |

Use the `rgb(…)` strings verbatim.

---

## 5. Generating the text outline (the critical reproducible step)

Render the string to a single SVG path using **fontkit** in the preview (via `eval_js`),
interpolating the weight axis. The path is built in font units, scaled to font-size 74,
with the y-axis flipped (font y-up → SVG y-down), starting at x=0 / baseline y=0 — the
final position comes from the `translate(138 105.35)` wrapper.

```js
// run in the preview with eval_js
(async () => {
  const fk = (await import('https://cdn.jsdelivr.net/npm/fontkit@2.0.2/+esm'));
  const FK = fk.default || fk;
  const buf = await (await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/rubik/Rubik%5Bwght%5D.ttf')).arrayBuffer();
  const TEXT = 'Permit: Valid';   // <-- the label text
  const WGHT = 470;               // <-- weight (see §3)
  const FS = 74;
  let font = FK.create(new Uint8Array(buf)).getVariation({ wght: WGHT });
  const scale = FS / font.unitsPerEm;
  const run = font.layout(TEXT);
  let d = '', x = 0;
  run.glyphs.forEach((g, idx) => {
    for (const c of g.path.commands) {
      const p = c.args.map((v, i) => i % 2 === 0 ? (x + v) * scale : (-v) * scale);
      if (c.command === 'moveTo')               d += `M${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
      else if (c.command === 'lineTo')          d += `L${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
      else if (c.command === 'quadraticCurveTo') d += `Q${p[0].toFixed(2)} ${p[1].toFixed(2)} ${p[2].toFixed(2)} ${p[3].toFixed(2)}`;
      else if (c.command === 'bezierCurveTo')    d += `C${p[0].toFixed(2)} ${p[1].toFixed(2)} ${p[2].toFixed(2)} ${p[3].toFixed(2)} ${p[4].toFixed(2)} ${p[5].toFixed(2)}`;
      else if (c.command === 'closePath')        d += 'Z';
    }
    x += run.positions[idx].xAdvance;
  });
  window.__d = d;
  return JSON.stringify({ dlen: d.length, advancePx: x * scale });
})()
```
Then read the full string back with `eval_js` → `window.__d`.

> If fontkit's `+esm` URL fails, it's an ESM module — load via dynamic `import()`, not a
> plain `<script>` (the UMD/browser bundles 404). opentype.js does **not** interpolate
> variable axes, so don't use it for weight ≠ 300.

---

## 6. Sizing the pill (maintain padding)

After the text path exists, measure its **rendered right edge** in the 156-space:
`textRight = 138 + bbox.x + bbox.width` (use `getBBox()` on the text `<g>`; note `getBBox`
returns coords *before* the group's own transform, so add the 138).

Then:
```
W (viewBox width)  = textRight + 52      // 46px right padding + 6 stroke/margin
rect width         = W - 6
```
This keeps **~46px right padding**, matching the ~equal left inset before the icon.
(Reference build: textRight ≈ 575 → W = 627, rect width = 621.)

Final `<svg>` render attributes (default height 30):
```
height = 30
width  = round(W * 30 / 156, 1)
viewBox = "0 0 {W} 156"
```
Change `30` if I ask for a different height; width scales to keep the aspect ratio.

---

## 7. Assembly template

```xml
<svg width="{W*h/156}" height="{h}" viewBox="0 0 {W} 156"
     xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{TEXT}">
  <rect x="3" y="3" width="{W-6}" height="150" rx="75" ry="75"
        fill="{bg}" stroke="{border}" stroke-width="6"/>
  <g transform="translate(40,40) scale({76/iconViewBox})" fill="{text}">
    {icon paths}
  </g>
  <g transform="translate(138 105.35)" fill="{text}">
    <path d="{generated outline}"/>
  </g>
</svg>
```
- `role="img"` + `aria-label="{TEXT}"` for accessibility (text is outlines, not readable).
- Self-closing/`</path>` either is fine in a standalone `.svg`; in a `.dc.html` preview
  use explicit closing tags.

---

## 8. Working preferences

- Keep it accurate to this construction; don't redesign, restyle, or "improve" beyond the
  three inputs.
- Use the colours from the JSON exactly — no new colours invented.
- Don't hand-draw or alter the supplied icon geometry; only scale, position, and recolour it.
- Verify the final render (screenshot) and confirm padding before delivering.
- Provide the raw SVG in a copyable code block **and** save the `.svg` file.
- File naming: use **`label`** (not "badge"), e.g. `permit-valid-label.svg`.
- Be concise.

---

## 9. Quick checklist

- [ ] Pull the right theme from the colour JSON (bg / text / border).
- [ ] Strip `fill="currentColor"` from the icon; scale `76/viewBox`, `translate(40,40)`.
- [ ] Generate Rubik **470** outlines at fs 74 via fontkit (§5).
- [ ] Measure `textRight`; set `W = textRight + 52`, rect width `W-6` (§6).
- [ ] Assemble per §7; `width = W*h/156`, default `h = 30`.
- [ ] Screenshot-verify; confirm ~46px right padding.
- [ ] Deliver saved `.svg` + raw markup; name it `…-label.svg`.
