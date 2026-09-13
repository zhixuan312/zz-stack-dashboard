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
