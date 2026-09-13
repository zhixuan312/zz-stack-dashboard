// Proves the checker FAILS when it should. A contrast check that only ever passes is
// indistinguishable from no check at all, which is the state this replaces.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CSS = 'app/globals.css';
const run = (file) => {
  try { execFileSync('node', ['scripts/verify-contrast.mjs', file], { stdio: 'pipe' }); return 0; }
  catch (e) { return e.status ?? 1; }
};
let code = 0;
if (run(CSS) !== 0) { console.error('FAIL clean tree should exit 0'); code = 1; }

/* A TEMPORARY COPY, never the real stylesheet.
 *
 * This used to back up `app/globals.css`, write a broken palette OVER it, and restore in a
 * `finally`. It worked, and it meant that for a few hundred milliseconds of every run the
 * product's own stylesheet was corrupt — and that a SIGKILL, an OOM kill or a CI timeout in
 * that window left the working tree with an unreadable `--c-900` and a stray backup file,
 * announced by nothing except contrast failing afterwards for the wrong reason.
 *
 * A check that proves a failure mode must not be able to CAUSE one. The verifier now takes
 * the stylesheet as argv[1], so the broken copy lives in the OS temp directory and the real
 * file is never opened for writing at all. */
const tmp = join(tmpdir(), `zz-contrast-broken-${process.pid}.css`);
try {
  const css = readFileSync(CSS, 'utf8');
  // Make the ink almost the same as the ground; every ink pair must now fail.
  const broken = css.replace(/(--(?:c-900|n-900):\s*)#[0-9a-fA-F]{6}/, '$1#f5f6f8');
  if (broken === css) { console.error('FAIL could not find the ink token to break'); code = 1; }
  writeFileSync(tmp, broken);
  if (run(tmp) === 0) { console.error('FAIL deliberately broken palette still exited 0'); code = 1; }
} finally {
  try { unlinkSync(tmp); } catch { /* already gone */ }
}
if (readFileSync(CSS, 'utf8').includes('#f5f6f8')) {
  console.error('FAIL the real stylesheet was modified; it must never be'); code = 1;
}

if (!code) console.log('PASS verify-contrast fails when it should, and only then');
process.exitCode = code;
