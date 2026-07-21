# Permit-to-Work SVG Assets — Design Spec

Covers the three asset types in this folder and how to regenerate or extend them.
Supersedes `LABEL-DESIGN-SPEC.md` (its pill construction is carried over in §4).

| Asset | Files | Built by |
|---|---|---|
| Status tile | `permit-*-label.svg` (5) | `tools/build-labels.mjs` |
| Section heading | `*-heading.svg` | `tools/build-heading.mjs` |
| Status pill | lives *inside* each tile | legacy process, §4 — **never regenerated** |

---

## 1. Shared rules (all assets)

- **All text is vector outlines.** No `<text>` elements, no font dependencies. Text is
  baked to a single `<path>` at build time. Every SVG must render identically in
  browsers, LMS embeds, Figma, email.
- **Chrome font: Outfit SemiBold (600).** The exact file is committed at
  `tools/Outfit-SemiBold.ttf` (static instance of the Outfit variable font, from Google
  Fonts, OFL-licensed — see `tools/OFL.txt`). Do not substitute a re-downloaded copy
  without re-checking output; glyph coordinates must stay stable.
- **Dark mode** via an inline `<style>` block: light values on classes, dark overrides in
  `@media (prefers-color-scheme: dark)`. No JS, no external CSS.
- **Accessibility**: `role="img"` + `aria-label` with the human-readable text (the
  tile keeps the colon form, e.g. `"Permit Status: Valid"`).
- **Plain SVG 1.1 only**: `rect`, `path`, `g`, `style`. No filters, masks, gradients, or
  external references (keeps LMS/Storyline compatibility).
- Simple geometry values are rounded to 1 decimal; path data to 2.

### Color tokens

| Role | Light | Dark |
|---|---|---|
| Tile surface | `#FBFCFD` | `#172032` |
| Tile border | `rgb(228,230,235)` | `rgb(66,77,96)` |
| Tile label (eyebrow) | `rgb(102,112,133)` | `rgb(167,176,191)` |
| Heading ink | `#172032` | `rgb(230,234,242)` |

Pill colors are per-status and live only in the pill (§4). Light-mode heading ink
deliberately reuses the dark tile surface color to tie the family together.

---

## 2. Status tile (`permit-*-label.svg`)

50px-tall rounded card: quiet eyebrow label + status pill. Hierarchy is deliberate —
the pill (the value) dominates; the label recedes. Do not make the label bolder,
darker, or larger without revisiting that decision.

- Tile: height 50, `rx` 12, 1px border (rect inset 0.5 so the stroke isn't clipped).
- Eyebrow: `PERMIT STATUS` caps, Outfit SemiBold, em size **11.5**, letterspacing
  **9% of em**, no colon. Kerned + tracked per-glyph, manual layout.
- Vertical: label cap-height is optically centered on the pill's midline
  (baseline = pillCenterY + capHeight/2).
- Horizontal rhythm: **16px** left pad → label → **13px** gap → pill → **10px** right pad.
  Tile width is computed, so it varies per status.
- Pill: rendered 30px tall at y=10 (native 156-unit space × scale 0.192308).

**The pill is sacred.** `build-labels.mjs` extracts the `<rect class="pill">`, both
`<g class="ink">` groups, and the `.pill`/`.ink` style rules from the *existing* file
byte-for-byte and re-wraps them. After any rebuild, verify:

```sh
for f in permit-to-work/permit-*-label.svg; do
  diff <(git show HEAD:"$f" | grep -o '<g class="ink".*</g>') \
       <(grep -o '<g class="ink".*</g>' "$f") && echo "$f OK"
done
```

## 3. Section heading (`*-heading.svg`)

Standalone heading for splitting form sections. Transparent background, no container.

- Three sizes, selected with `--size` (default **h2**):

  | Level | Em size | Icon | Gap |
  |---|---|---|---|
  | h1 | 24 | 22.9px | 10.3px |
  | h2 | 21 | 20px | 9px |
  | h3 | 17.5 | 16.7px | 7.5px |

  Icon and gap scale linearly with the em size (h2 is the reference: 20px icon, 9px gap).
- Text: mixed case (NOT caps — caps is the *label* treatment; headings need word-shape
  for scanning), Outfit SemiBold, no extra tracking.
- Icon: square-viewBox heroicon scaled to the level's icon size, placed before the text.
  The icon's *ink* (measured by sampling every path segment, arcs included) is centered
  on the type's cap midline; ink taller than the cap height overflows the band evenly.
  Shares the text fill so it recolors with the theme, unless
  `--icon-color "<light>:<dark>"` is given — then only the icon takes those fills (used
  for the amber warning icon on `missing-information-heading.svg`:
  `#D97706` light / `#FBBF24` dark).
- Canvas: **8px top padding, 0 sides and bottom** — the ink is flush with the left,
  right, and bottom edges (bar sub-pixel rounding). Width/height computed from the
  measured bounding box of the text *and* the icon, so a tall icon grows the canvas
  instead of clipping.

## 4. Status pill (inside tiles) — legacy construction

The pills were built in an earlier process and are only ever *carried forward*. For a
**new** status you build a new pill once, then let the tile wrap it. Construction
(from the original spec, still accurate):

- Authored in a **156-unit-tall** space:
  `<rect x="3" y="3" width="{W-6}" height="150" rx="75" stroke-width="6">`.
- Icon: heroicon scaled to **76 units** (`scale = 76/iconViewBox`), at `translate(40,40)`.
- Text: **Rubik**, variable axis interpolated to **wght 470**, font-size **74**, baseline
  `translate(138 105.35)` — generated with fontkit (opentype.js can't interpolate
  variable axes). Rubik source:
  `https://raw.githubusercontent.com/google/fonts/main/ofl/rubik/Rubik%5Bwght%5D.ttf`
- Width: `W = textRight + 52` (≈46-unit right pad); rect width `W-6`.
- Colors per status as `.pill` (bg/stroke) + `.ink` (icon & text fill), light + dark.
- In the tile it's wrapped as `<g transform="translate(x,10) scale(0.192308)">`.

## 5. Tooling

```sh
cd tools && npm install        # once; opentype.js pinned exactly (see Gotchas)

node build-labels.mjs                      # rebuilds all 5 tiles in place
node build-heading.mjs                     # rebuilds permit-details-heading.svg
node build-heading.mjs "Work Description"  # new heading -> work-description-heading.svg
node build-heading.mjs "Sign-off" out.svg  # explicit output name

# custom icon: paste the heroicon SVG inline, or point at an .svg file
node build-heading.mjs "Person Responsible" --icon '<svg viewBox="0 0 20 20" ...>...</svg>'
node build-heading.mjs "Person Responsible" --icon person.svg

node build-heading.mjs "Missing Information" --size h1           # h1/h2/h3, default h2
node build-heading.mjs "Hazards" --icon-color '#D97706:#FBBF24'  # icon-only light:dark fills
node build-heading.mjs "Permit to Work" --size h1 --no-icon      # text only
```

- `build-labels.mjs` regenerates tile chrome around the preserved pills. Run it after
  changing any tile design value, then run the pill verification in §2.
- `build-heading.mjs` takes the heading text, an optional output filename, an
  optional `--icon` (full SVG markup inline, or a path to an .svg file; multi-path
  icons fine; fills are stripped so it inherits the ink color), an optional `--size`
  (`h1`/`h2`/`h3`, default `h2`), and an optional `--icon-color`
  (`"<light>"` or `"<light>:<dark>"`, icon only). Without `--icon` it uses the bars
  icon; `--no-icon` omits the icon entirely (text starts at the left edge). Icon ink
  is auto-centered on the cap midline and the canvas grows to fit it, so any
  square-viewBox heroicon drops in without alignment tweaks.
- Dark-forced previews are written to `tools/preview/` (gitignored — never commit;
  the real files switch via media query).

## 6. Gotchas (hard-won)

- **opentype.js `toPathData()` emits literal `NaN`** for some coordinates (seen on
  Outfit's lowercase "s"). Never use it — `tools/serialize.mjs` serializes path
  commands instead. Symptom: a glyph silently missing from the render.
- **opentype.js version changes glyph coordinates.** 1.3.4 and 2.0.0 parse the same
  font to slightly different floats (visually identical, byte-different files). The
  dependency is pinned **exactly** at 2.0.0; don't bump it casually — a bump makes
  every regenerated file diff even with no design change.
- **opentype.js text shaping crashes on some fonts** (GSUB features it can't parse,
  e.g. Inter). Both scripts lay out per-glyph with `charToGlyph` + `getKerningValue`
  and never call `font.getPath(string)`.
- **macOS `qlmanage` follows the system appearance** when resolving
  `prefers-color-scheme` — a "light" render on a dark-mode Mac silently comes out
  dark. For previews, flatten the media query (strip it for light, apply overrides
  unconditionally for dark) as `build-labels.mjs` does for `tools/preview/`.
