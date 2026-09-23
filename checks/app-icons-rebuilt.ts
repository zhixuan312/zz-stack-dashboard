// Two claims: the icons came from the master (not the old 183x179 crop), and the build is
// reproducible. Reproducibility is the one that rots silently — a script that emits a new
// timestamp or a re-dithered pixel each run cannot be trusted to have produced what shipped.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
const DIR = 'public/assets/app-icon';
const hash = () => Object.fromEntries(readdirSync(DIR).filter((f) => f.endsWith('.png'))
  .sort().map((f) => [f, createHash('sha256').update(readFileSync(DIR + '/' + f)).digest('hex')]));
let code = 0;
const src = readFileSync('scripts/build-app-icon.py', 'utf8');
if (!src.includes('design/in-use/app-icon-squircle.png')) {
  console.error('FAIL build-app-icon.py does not read the master'); code = 1;
}
if (/^SHEET = ROOT \/ 'public\/assets\/brand-kit-sheet/m.test(src)) {
  console.error('FAIL build-app-icon.py still reads the contact sheet'); code = 1;
}
const readme = readFileSync(DIR + '/README.md', 'utf8');
if (/^## Resolution caveat/m.test(readme)) {
  console.error('FAIL the obsolete resolution caveat is still a section in the README'); code = 1;
}
/* A STALE CLAIM IN PROSE, which the heading check above could not see.
 *
 * The brand adoption rewrote this README's first two sections and left its closing
 * paragraph behind, still telling the reader the tab icon was "the indigo hexagon at
 * app/icon.svg" — a file the same change deleted. The check passed, because it was looking
 * for one heading.
 *
 * So: no document here may name a deleted file as though it were current. The rule is
 * narrow on purpose — it fires on `app/icon.svg` written as a live path, and not on a
 * sentence that quotes what the file USED to say, which is history worth keeping. */
for (const m of readme.matchAll(/`app\/icon\.svg`/g)) {
  const around = readme.slice(Math.max(0, m.index - 200), m.index + 60);
  const historical = /used to|no longer|is deleted|was deleted|It said|is gone/i.test(around);
  if (!historical) {
    console.error('FAIL the README names `app/icon.svg` as current; that file was deleted'); code = 1;
  }
}
/* MTIME, BECAUSE A STALE FILE IS INDISTINGUISHABLE FROM A FRESH ONE BY CONTENT.
 *
 * Membership in the directory is not the claim; being WRITTEN BY THIS RUN is. A file the
 * script has stopped emitting sits on disk with its old bytes, hashes identically before
 * and after, and satisfies every other line here — so the set below would go on asserting
 * that the script builds something it abandoned. Caught exactly that way: renaming the 64px
 * output left `app-icon-64.png` behind, passing as a current product of a script that no
 * longer mentions it. Recorded before the run so a clock that does not move cannot help. */
const written = () => Object.fromEntries(readdirSync(DIR).filter((f) => f.endsWith('.png'))
  .map((f) => [f, statSync(DIR + '/' + f).mtimeMs]));
const before = hash();
const stamps = written();
execFileSync('python3', ['scripts/build-app-icon.py'], { stdio: 'pipe' });
const after = hash();
const fresh = written();
for (const k of Object.keys(before)) {
  if (before[k] !== after[k]) { console.error('FAIL not reproducible: ' + k); code = 1; }
}
/* THE SCRIPT'S OUTPUT IS A NAMED SET, not a count.
 *
 * This asserted `length !== 8` against the whole directory, which conflated two different
 * questions: what the script produces, and what happens to be sitting here. A count passes
 * unchanged if the script drops `app-icon-64` and emits one junk file, and it fails on a
 * file the script never claimed — which is exactly how it fell over when a documented,
 * deliberately-kept stray arrived. Naming them is the pattern `brand-assets-built.ts`
 * already uses, and it is the stronger claim. */
const BUILT = ['app-icon-1024.png', 'app-icon-512.png', 'app-icon-192.png',
               'app-icon-maskable-1024.png', 'app-icon-maskable-512.png',
               'app-icon-maskable-192.png', 'apple-touch-icon-180.png', 'app-icon-64.png'];
for (const f of BUILT) {
  if (!(f in after)) { console.error('FAIL the script did not produce ' + f); code = 1; }
  else if (fresh[f] === stamps[f]) {
    console.error(`FAIL ${f} was not written by this run; the script has stopped emitting it`);
    code = 1;
  }
}
/* AND EVERY OTHER PNG HERE IS NAMED BY THE README'S TABLE.
 *
 * The README says so itself — "a file in this directory that the table does not name is the
 * thing this README exists to prevent" — and until now that was prose nobody enforced. A
 * file the script does not build is allowed to live here, but only on the record: the
 * alternative is a directory that accumulates exports whose origin nobody can reconstruct.
 * This is the register for them, because unlike `assets/brand/` nothing in the app
 * references ANY of these yet, so "referenced by a source file" cannot be the test. */
for (const f of Object.keys(after)) {
  if (BUILT.includes(f)) continue;
  /* A TABLE ROW, not a mention. `readme.includes()` would be satisfied by a sentence
   * saying the file was deleted — the same loophole the `app/icon.svg` clause above needed
   * a `historical` test to close, arrived at from the other direction. The table is the
   * register; prose about a file is not an entry in it. */
  if (!new RegExp('^\\| `' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`', 'm').test(readme)) {
    console.error(`FAIL ${f} is not built by the script and the README table does not name it`);
    code = 1;
  }
}
if (!code) console.log(`PASS ${BUILT.length} app icons rebuilt from the 1254px master, ` +
                       `reproducibly; ${Object.keys(after).length - BUILT.length} documented stray(s)`);
process.exitCode = code;
