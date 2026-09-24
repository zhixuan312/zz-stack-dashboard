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
/* All three charts, each in the spelling its own medium allows. TrendChart paints HTML legend
 * swatches and SVG volume bars, and `box-shadow: inset` does nothing to an SVG rect — so the rule
 * that every pastel fill carries an edge needs a second spelling, not an exemption. A kit pastel at
 * 0.2 opacity with no boundary is invisible.
 */
for (const f of ['src/components/charts/BarList.tsx', 'src/components/charts/CompositionBar.tsx']) {
  if (!readFileSync(f, 'utf8').includes('CHART_EDGE')) {
    console.error('FAIL ' + f + ' paints a fill without the hairline edge'); code = 1;
  }
}
const trend = readFileSync('src/components/charts/TrendChart.tsx', 'utf8');
/* The swatch element, not the file: `trend.includes('CHART_EDGE')` is satisfied by the import line
 * alone, so the legend chip could revert to a bare 0.3 opacity and still pass. */
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
/* The SVG form: a filled rect must carry `stroke` and must separate fill opacity from stroke
 * opacity. A bare `opacity=` on the rect fades the edge with the fill, so its absence is what is
 * asserted.
 *
 * One element at a time. `/<rect[\s\S]*?data-role="x"/` starts at the first `<rect` in the file and
 * runs forward, so with two of them the span reaches across both and every assertion is satisfied by
 * whichever rect happens to satisfy it. Splitting on the tag gives each rect its own text. */
const rects = trend.split('<rect').slice(1)
  .map((r) => '<rect' + r.slice(0, r.indexOf('/>') + 2));
const rectFor = (role: string): string | undefined =>
  rects.find((r) => r.includes(`data-role="${role}"`));

/* Every filled shape in this file carries an edge, and each one needs saying: a rule that covers the
 * rect it was written for and not the one added later is a regression test. */
for (const [role, what] of [
  ['volume-bar', 'volume bars'], ['stack-bar', 'stacked columns'],
] as const) {
  const r = rectFor(role);
  if (!r) { console.error(`FAIL cannot find the ${what} rect in TrendChart`); code = 1; continue; }
  if (!/\bstroke=/.test(r)) {
    console.error(`FAIL TrendChart ${what} have no stroke — a pastel fill with no boundary`); code = 1;
  }
  if (!/fillOpacity=/.test(r)) {
    console.error(`FAIL TrendChart ${what} set fill opacity without fillOpacity`); code = 1;
  }
  if (/\sopacity=/.test(r)) {
    console.error(`FAIL TrendChart ${what} use bare opacity=, which fades the stroke with the fill`); code = 1;
  }
}
const vc = readFileSync('scripts/verify-contrast.ts', 'utf8');
for (const pastel of ['--zz-lavender', '--zz-pink', '--zz-blue']) {
  if (new RegExp("\\['" + pastel).test(vc)) { console.error('FAIL verify-contrast measures ' + pastel); code = 1; }
}
if (!code) console.log('PASS cycle is the kit pastels, status hues excluded, edge present');
process.exitCode = code;
