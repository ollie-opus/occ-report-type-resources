// opentype.js toPathData(2) emits NaN for some coordinates; serialize ourselves.
const n = v => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};
export function toD(commands) {
  let d = '';
  for (const c of commands) {
    if (c.type === 'M') d += `M${n(c.x)} ${n(c.y)}`;
    else if (c.type === 'L') d += `L${n(c.x)} ${n(c.y)}`;
    else if (c.type === 'Q') d += `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
    else if (c.type === 'C') d += `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
    else if (c.type === 'Z') d += 'Z';
  }
  return d;
}
