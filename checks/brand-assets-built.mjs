/* PROVENANCE AND REPRODUCIBILITY for the runtime assets — the same property
 * `app-icons-rebuilt.mjs` holds for the icon script, which was written while this one
 * was not. Every file the browser downloads must derive from a master under
 * `design/in-use/`, and running the script again must produce the identical bytes.
 * A build step that is not reproducible cannot be trusted to have produced what shipped.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const DIR = 'public/assets/brand';
const WANT = ['wordmark.png', 'mascot-hero.png', 'state-empty.png', 'state-welcome.png',
              'state-done.png', 'state-error.png', 'state-notfound.png',
              'state-approved.png', 'state-goodbye.png', 'state-thinking.png'];
let code = 0;
const src = readFileSync('scripts/build-brand-assets.py', 'utf8');
if (!src.includes('design/in-use')) { console.error('FAIL script does not read design/in-use'); code = 1; }
if (/design\/reference/.test(src)) { console.error('FAIL script reads a contact sheet, not a master'); code = 1; }
/* D-14: there is no `state-working`. A spinner already says "working", and an
 * illustration that appears for 400ms and vanishes is a flicker, not reassurance. The
 * decision was to hold it unbuilt rather than invent a home for it. */
if (/state-working/.test(src)) { console.error('FAIL script builds state-working; D-14 holds it unbuilt'); code = 1; }
/* The script must refuse to upscale — a soft image is worse than a missing one. */
if (!/upscal/i.test(src)) { console.error('FAIL script has no upscale guard'); code = 1; }
for (const f of WANT) {
  if (!existsSync(DIR + '/' + f)) { console.error('FAIL missing ' + f); code = 1; }
  if (!existsSync(DIR + '/' + f.replace('.png', '@2x.png'))) { console.error('FAIL missing @2x for ' + f); code = 1; }
}
const hash = () => Object.fromEntries(readdirSync(DIR).sort()
  .map((f) => [f, createHash('sha256').update(readFileSync(DIR + '/' + f)).digest('hex')]));
const before = hash();
execFileSync('python3', ['scripts/build-brand-assets.py'], { stdio: 'pipe' });
const after = hash();
for (const k of Object.keys(before)) {
  if (before[k] !== after[k]) { console.error('FAIL not reproducible: ' + k); code = 1; }
}
if (!code) console.log(`PASS ${WANT.length} runtime assets + @2x derive from a master, reproducibly`);
process.exitCode = code;
