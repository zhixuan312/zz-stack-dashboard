/* Runs every check, and knows how many there should be.
 *
 * DELIBERATE: EXPECTED is declared here rather than derived from `readdir`. A loop over the
 * directory can only count what is on disk, so a check that was never written is
 * indistinguishable from a check that does not exist.
 *
 * When you add a check, add it to the list. When you delete one, delete it here — the list
 * disagreeing with the directory is the alarm.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { execOutput } from './lib/exec.ts';

const EXPECTED = [
  'app-icons-rebuilt',        // the PWA icon set is reproducible, from the master
  'asset-custody',            // design/ is tracked, ignored by Docker, README present
  'audit-design-runnable',    // puppeteer resolves; audit:design is not silently dead
  'bespoke-surfaces',         // four non-EmptyState mascots; spinner untouched
  'brand-assets-built',       // runtime assets derive from masters, reproducibly
  'chart-series',             // kit pastels cycle, status hues out, every fill edged
  'contrast-formula-agrees',  // the two copies of the WCAG formula agree to 1e-9
  'doc-counts',               // DESIGN-SYSTEM.md's numbers are derived, not typed
  'icon-convention',          // both icon links present in the built html
  'illustration-slots',       // both slots optional and additive
  'mascot-assignment',        // every mascot assignment, plus the root 404
  'no-dark-mode',             // no machinery, and no `dark:` variant
  'one-mark',                 // the brand is drawn in exactly one place
  'one-scroller',             // only the shell scrolls; page grids are Rows
  'cell-content-is-inline',   // a cell's wrapper is inline-level, or its header drifts
  'sparkle-motif',            // one inline sparkle, on the active item, decorative
  'token-layer',              // frozen values, @theme mapping, line budget
  'typography',               // Rubik + Baloo 2, no Inter-only features, tnum kept
  'verify-contrast-behaviour',// the contrast gate fails when it should
];

const onDisk = readdirSync('checks').filter((f) => f.endsWith('.ts')).map((f) => f.slice(0, -3)).sort();
let code = 0;

const missing = EXPECTED.filter((c) => !onDisk.includes(c));
const extra = onDisk.filter((c) => !EXPECTED.includes(c));
if (missing.length) { console.error('MISSING check files: ' + missing.join(', ')); code = 1; }
if (extra.length) { console.error('UNDECLARED check files: ' + extra.join(', ') + ' — add them to EXPECTED'); code = 1; }

let passed = 0;
for (const name of EXPECTED) {
  if (!onDisk.includes(name)) continue;
  process.stdout.write(`  ${name.padEnd(28)}`);
  try {
    execFileSync('node', [`checks/${name}.ts`], { stdio: 'pipe', timeout: 900000 });
    console.log('PASS'); passed += 1;
  } catch (e) {
    console.log('FAIL');
    process.stderr.write(execOutput(e));
    code = 1;
  }
}

console.log(`\n  ${passed}/${EXPECTED.length} checks pass`);
process.exitCode = code;
