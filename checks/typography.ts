import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const layout = readFileSync('app/layout.tsx', 'utf8');
const css = readFileSync('app/globals.css', 'utf8');
let code = 0;
if (!/Rubik\(/.test(layout)) { console.error('FAIL Rubik is not loaded'); code = 1; }
if (!/Baloo_2\(/.test(layout)) { console.error('FAIL Baloo 2 is not loaded'); code = 1; }
// DELIBERATE: match the font call, not the word, so prose in layout.tsx mentioning Inter
// does not trip this.
if (/\bInter\(/.test(layout) || /from 'next\/font\/google'[^\n]*\bInter\b/.test(layout)) {
  console.error('FAIL Inter is still loaded'); code = 1;
}
if (!/JetBrains_Mono\(/.test(layout)) { console.error('FAIL JetBrains Mono was dropped'); code = 1; }
if (!/display\.variable/.test(layout)) { console.error('FAIL the display family is not applied to <html>'); code = 1; }
// ss01/cv05 are Inter-only: against Rubik they resolve to nothing, silently.
const walk = (d: string, hit: string[] = []): string[] => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, hit);
    else if (/\.(ts|tsx|css)$/.test(p) && /ss01|cv05/.test(readFileSync(p, 'utf8'))) hit.push(p);
  }
  return hit;
};
const stale = [...walk('app'), ...walk('src')];
if (stale.length) { console.error('FAIL ss01/cv05 still present in: ' + stale.join(', ')); code = 1; }
// tabular-nums is why these two faces were chosen; it must survive.
if (!/tabular-nums/.test(css)) { console.error('FAIL tabular-nums was removed from .t-stat'); code = 1; }
// display family confined to the two display classes
const stat = css.slice(css.indexOf('.t-stat {'), css.indexOf('}', css.indexOf('.t-stat {')));
const disp = css.slice(css.indexOf('.t-display {'), css.indexOf('}', css.indexOf('.t-display {')));
for (const [n, block] of [['.t-stat', stat], ['.t-display', disp]]) {
  if (!/--font-display-family/.test(block)) { console.error(`FAIL ${n} does not use the display family`); code = 1; }
}
/* The Tailwind mapping. A family is usable as a utility only if `@theme inline` lists it;
 * repoint this one at the sans family and `font-display` silently resolves to the body face
 * with no error anywhere, while both display classes still pass by referencing the raw
 * variable directly. */
if (!/--font-display:\s*var\(--font-display-family\)/.test(css)) {
  console.error('FAIL @theme inline no longer maps --font-display to the display family'); code = 1;
}
const uses = (css.match(/--font-display-family/g) || []).length;
if (uses > 3) { console.error(`FAIL the display family is referenced ${uses} times; it belongs on two classes`); code = 1; }
if (!code) console.log('PASS Rubik + Baloo 2 wired, Inter features gone, numerals preserved');
process.exitCode = code;
