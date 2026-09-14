// Two claims: the icons came from the master (not the old 183x179 crop), and the build is
// reproducible. Reproducibility is the one that rots silently — a script that emits a new
// timestamp or a re-dithered pixel each run cannot be trusted to have produced what shipped.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
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
const before = hash();
execFileSync('python3', ['scripts/build-app-icon.py'], { stdio: 'pipe' });
const after = hash();
for (const k of Object.keys(before)) {
  if (before[k] !== after[k]) { console.error('FAIL not reproducible: ' + k); code = 1; }
}
if (Object.keys(after).length !== 8) {
  console.error('FAIL expected 8 icons, found ' + Object.keys(after).length); code = 1;
}
if (!code) console.log('PASS 8 app icons rebuilt from the 1254px master, reproducibly');
process.exitCode = code;
