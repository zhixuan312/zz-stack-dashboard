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
for (const f of ['src/components/charts/BarList.tsx', 'src/components/charts/CompositionBar.tsx']) {
  if (!readFileSync(f, 'utf8').includes('CHART_EDGE')) {
    console.error('FAIL ' + f + ' paints a fill without the hairline edge'); code = 1;
  }
}
const vc = readFileSync('scripts/verify-contrast.mjs', 'utf8');
for (const pastel of ['--zz-lavender', '--zz-pink', '--zz-blue']) {
  if (new RegExp("\\['" + pastel).test(vc)) { console.error('FAIL verify-contrast measures ' + pastel); code = 1; }
}
if (!code) console.log('PASS cycle is the kit pastels, status hues excluded, edge present');
process.exitCode = code;
