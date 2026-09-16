/* PROVENANCE AND REPRODUCIBILITY for the runtime assets — the same property
 * `app-icons-rebuilt.ts` holds for the icon script, which was written while this one
 * was not. Every file the browser downloads must derive from a master under
 * `design/in-use/`, and running the script again must produce the identical bytes.
 * A build step that is not reproducible cannot be trusted to have produced what shipped.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const DIR = 'public/assets/brand';
const WANT = ['wordmark.png', 'mascot-hero.png', 'state-empty.png', 'state-welcome.png',
              'state-error.png', 'state-notfound.png',
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
}
/* NO @2x FILES, and their absence is the assertion.
 *
 * They existed, all ten of them, 760 KB and 76% of this directory, referenced by nothing.
 * `@2x` is an Apple / CSS `image-set()` filename convention; `next/image` has none — it
 * builds a srcset against its own optimizer and scales DOWN from the single source. So
 * they could not be requested by any mechanism, and they shipped in every image. */
for (const f of readdirSync(DIR)) {
  if (f.includes('@2x')) { console.error(`FAIL ${f} — next/image never requests a @2x filename`); code = 1; }
}
/* NOTHING SHIPS THAT NOTHING NAMES.
 *
 * `favicon-64.png` was built here and referenced by no component, no manifest and no
 * <link>. It rode into the image anyway, and every check passed: it derived from a
 * master, it rebuilt reproducibly, it was simply pointless. Provenance and
 * reproducibility say an asset is CORRECT; they say nothing about whether it is WANTED.
 *
 * `public/` is downloaded by a browser, so an orphan here is not merely untidy.
 *
 * THIS ONCE EXEMPTED `@2x` FILES, on the reasoning that "they are named by the browser's
 * density selection, not by source". That is true of CSS `image-set()` and of Apple's
 * convention, and false of `next/image`, which is what this app uses — so the exemption
 * hid exactly the orphans it was written to excuse. There is no exemption now: every PNG
 * here must be named by a source file. */
const walkSrc = (d: string, o: string[] = []): string[] => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const q = d + '/' + e.name;
    if (e.isDirectory()) walkSrc(q, o);
    else if (/\.(tsx?|css)$/.test(q)) o.push(readFileSync(q, 'utf8'));
  }
  return o;
};
const sources = [...walkSrc('app'), ...walkSrc('src')].join('\n');
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.png')) continue;
  if (!sources.includes('assets/brand/' + f)) {
    console.error(`FAIL ${f} ships to the browser and nothing references it`); code = 1;
  }
}

const hash = () => Object.fromEntries(readdirSync(DIR).sort()
  .map((f) => [f, createHash('sha256').update(readFileSync(DIR + '/' + f)).digest('hex')]));
const before = hash();
execFileSync('python3', ['scripts/build-brand-assets.py'], { stdio: 'pipe' });
const after = hash();
for (const k of Object.keys(before)) {
  if (before[k] !== after[k]) { console.error('FAIL not reproducible: ' + k); code = 1; }
}
if (!code) console.log(`PASS ${WANT.length} runtime assets derive from a master at 2x, reproducibly, none orphaned`);
process.exitCode = code;
