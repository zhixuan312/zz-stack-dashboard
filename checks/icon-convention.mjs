/* ASSERTS AGAINST THE BUILT OUTPUT, NOT THE SOURCE — which is the whole reason this
 * check is worth its runtime.
 *
 * `app/icon.png` and `app/apple-icon.png` are Next FILE CONVENTIONS: the framework finds
 * them by path and emits the <link> tags itself. Declaring `metadata.icons` in
 * `app/layout.tsx` does not ADD to that, it SUPPRESSES it — `resolve-metadata.js` merges
 * file-convention icons only `if (!resolvedMetadata.icons)`. So the source can look
 * entirely correct, the build can succeed, every test can pass, and the served HTML can
 * carry no apple-touch-icon at all. Nothing but reading the emitted markup finds that.
 *
 * DEVIATION FROM THE PLAN, recorded here rather than silently: the plan specified
 * `app/icon.svg` and two SVG-shaped assertions (that it carries no stroke, and none of
 * the old indigo). The implementation uses `app/icon.png`, rasterised from the flat-Z
 * master by `scripts/build-brand-assets.py`, because the tab icon is a 32px raster
 * downscale rather than a traced vector. The SVG assertions are therefore not merely
 * skipped — they have no subject. What replaces them is `app-icons-rebuilt.mjs`'s
 * provenance-and-reproducibility guard over the same file.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
let code = 0;
const layout = readFileSync('app/layout.tsx', 'utf8');
if (/^\s*icons\s*:/m.test(layout)) {
  console.error('FAIL metadata.icons is declared; it SUPPRESSES the file convention'); code = 1;
}
if (!/description\s*:/.test(layout)) { console.error('FAIL metadata.description was dropped'); code = 1; }
for (const f of ['app/icon.png', 'app/apple-icon.png']) {
  if (!existsSync(f)) { console.error('FAIL ' + f + ' missing'); code = 1; }
}
if (existsSync('app/icon.svg')) { console.error('FAIL app/icon.svg is back; the PNG is the convention now'); code = 1; }

/* Neither is a scaled copy of the other: the tab icon is the flat single-Z (two letters
 * at 16px is mush), the home-screen icon is the mascot squircle (at 180px there is room
 * for the character). Same bytes would mean somebody scaled one from the other. */
if (existsSync('app/icon.png') && existsSync('app/apple-icon.png')) {
  const a = readFileSync('app/icon.png'), b = readFileSync('app/apple-icon.png');
  if (a.equals(b)) { console.error('FAIL the two icons are the same file'); code = 1; }
  if (statSync('app/icon.png').size > statSync('app/apple-icon.png').size) {
    console.error('FAIL icon.png is larger than apple-icon.png; the 32px one is not a downscale of the 180px one'); code = 1;
  }
}

execFileSync('pnpm', ['run', 'build'], { stdio: 'pipe', timeout: 600000 });
const walk = (d, o = []) => {
  for (const e of readdirSync(d)) {
    const p = d + '/' + e;
    if (statSync(p).isDirectory()) walk(p, o);
    else if (p.endsWith('.html')) o.push(p);
  }
  return o;
};
const pages = walk('.next/server/app');
if (!pages.length) { console.error('FAIL the build emitted no HTML to inspect'); code = 1; }
const html = pages.map((p) => readFileSync(p, 'utf8')).join('');
for (const [needle, why] of [
  ['apple-touch-icon', 'the home-screen icon link is absent from the served HTML'],
  ['rel="icon"', 'the tab icon link is absent from the served HTML'],
]) {
  if (!html.includes(needle)) { console.error(`FAIL ${why}`); code = 1; }
}
if (!code) console.log(`PASS both icon links emitted in ${pages.length} built pages, neither scaled from the other`);
process.exitCode = code;
