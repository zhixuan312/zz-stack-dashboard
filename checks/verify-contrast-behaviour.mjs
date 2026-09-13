// Proves the checker FAILS when it should. A contrast check that only ever passes is
// indistinguishable from no check at all, which is the state this replaces.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs';
const CSS = 'app/globals.css';
const BAK = 'app/globals.css.verify-check-backup';
const run = () => {
  try { execFileSync('node', ['scripts/verify-contrast.mjs'], { stdio: 'pipe' }); return 0; }
  catch (e) { return e.status ?? 1; }
};
let code = 0;
if (run() !== 0) { console.error('FAIL clean tree should exit 0'); code = 1; }
copyFileSync(CSS, BAK);
try {
  // Make the ink almost the same as the ground; every ink pair must now fail.
  const css = readFileSync(CSS, 'utf8');
  const broken = css.replace(/(--(?:c-900|n-900):\s*)#[0-9a-fA-F]{6}/, '$1#f5f6f8');
  if (broken === css) { console.error('FAIL could not find the ink token to break'); code = 1; }
  writeFileSync(CSS, broken);
  if (run() === 0) { console.error('FAIL deliberately broken palette still exited 0'); code = 1; }
} finally {
  copyFileSync(BAK, CSS);
  unlinkSync(BAK);
}
if (run() !== 0) { console.error('FAIL tree not restored cleanly'); code = 1; }
if (!code) console.log('PASS verify-contrast fails when it should, and only then');
process.exitCode = code;
