import { readFileSync } from 'node:fs';
let code = 0;
const tints = readFileSync('src/lib/tints.ts', 'utf8');
for (const v of ['--accent', '--zz-lavender', '--zz-pink', '--zz-blue']) {
  if (!tints.includes(v)) { console.error('FAIL tints.ts does not map ' + v); code = 1; }
}
// The categorical cycle must not hand out status hues.
const m = tints.match(/const TINT_CYCLE: readonly Tint\[\] = \[([^\]]*)\]/);
if (!m) { console.error('FAIL cannot find TINT_CYCLE'); code = 1; }
else {
  const cycle = m[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
  for (const status of ['sage', 'amber', 'rose']) {
    if (cycle.includes(status)) { console.error(`FAIL status hue '${status}' is in the categorical cycle`); code = 1; }
  }
  const want = ['accent', 'lavender', 'pink', 'blue'];
  if (cycle.join(',') !== want.join(',')) {
    console.error(`FAIL cycle is [${cycle}], expected [${want}]`); code = 1;
  }
}
/* ALL THREE CHARTS, each in the spelling its own medium allows.
 *
 * This used to name two of them and say nothing about the third, which reads as an
 * oversight and was worse than one: TrendChart paints HTML legend swatches AND SVG
 * volume bars, and `box-shadow: inset` does nothing to an SVG rect. So the rule that
 * every pastel fill carries an edge needed a second spelling, not an exemption — and
 * while the check was quiet about it, TrendChart's bars were rendering at 0.2 opacity
 * with no boundary at all. A status hue at 0.2 was quiet; a kit pastel at 0.2 is gone.
 */
for (const f of ['src/components/charts/BarList.tsx', 'src/components/charts/CompositionBar.tsx']) {
  if (!readFileSync(f, 'utf8').includes('CHART_EDGE')) {
    console.error('FAIL ' + f + ' paints a fill without the hairline edge'); code = 1;
  }
}
const trend = readFileSync('src/components/charts/TrendChart.tsx', 'utf8');
/* THE SWATCH ELEMENT, not the file. `trend.includes('CHART_EDGE')` was satisfied by the
 * import line alone, so the legend chip could revert to a bare 0.3 opacity and still pass. */
const swatch = trend.match(/<i\s[^>]*rounded-\[var\(--r-sm\)\][\s\S]{0,200}?\/>/);
if (!swatch) { console.error('FAIL cannot find the bar legend swatch in TrendChart'); code = 1; }
else {
  if (!/CHART_EDGE/.test(swatch[0])) {
    console.error('FAIL the TrendChart legend swatch has no hairline edge'); code = 1;
  }
  if (/opacity:/.test(swatch[0])) {
    console.error('FAIL the legend swatch is faded; it identifies a colour and must be full strength'); code = 1;
  }
}
/* The SVG form: a filled rect must carry `stroke` and must separate fill opacity from
 * stroke opacity. A bare `opacity=` on the rect fades the edge with the fill, which is
 * the exact bug this replaced — so its ABSENCE is what is asserted. */
const bar = trend.match(/<rect[\s\S]*?data-role="volume-bar"[\s\S]*?\/>/);
if (!bar) { console.error('FAIL cannot find the volume-bar rect in TrendChart'); code = 1; }
else {
  if (!/\bstroke=/.test(bar[0])) {
    console.error('FAIL TrendChart volume bars have no stroke — a pastel fill with no boundary'); code = 1;
  }
  if (!/fillOpacity=/.test(bar[0])) {
    console.error('FAIL TrendChart volume bars set fill opacity without fillOpacity'); code = 1;
  }
  if (/\sopacity=/.test(bar[0])) {
    console.error('FAIL TrendChart volume bars use bare opacity=, which fades the stroke with the fill'); code = 1;
  }
}
const vc = readFileSync('scripts/verify-contrast.mjs', 'utf8');
for (const pastel of ['--zz-lavender', '--zz-pink', '--zz-blue']) {
  if (new RegExp("\\['" + pastel).test(vc)) { console.error('FAIL verify-contrast measures ' + pastel); code = 1; }
}
if (!code) console.log('PASS cycle is the kit pastels, status hues excluded, edge present');
process.exitCode = code;
