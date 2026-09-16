/* RUNS EVERY CHECK, AND KNOWS HOW MANY THERE SHOULD BE.
 *
 * This exists because of a specific reporting failure, and the failure is more
 * interesting than the script. The plan for the 2026-09 brand adoption declared SIXTEEN
 * task checks. Eleven files were written. Every one of the eleven passed, and the
 * execution was reported as "11/11 checks pass" — a true numerator against a denominator
 * nobody had computed. Five task contracts had simply never been proven, and the report
 * read as complete coverage.
 *
 * Running them one at a time in a shell loop is what made that possible: the loop can
 * only count what is on disk, so a check that was never written is indistinguishable
 * from a check that does not exist. EXPECTED is therefore declared here rather than
 * derived from `readdir`. Deriving it would reproduce the bug exactly.
 *
 * When you add a task check, add it to the list. When you delete one, delete it here and
 * say why in the commit — the list disagreeing with the directory is the alarm.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { execOutput } from './lib/exec.ts';

const EXPECTED = [
  'app-icons-rebuilt',        // I-4  the PWA icon set is reproducible, from the master
  'asset-custody',            // I-1  design/ is tracked, ignored by Docker, README present
  'audit-design-runnable',    // I-3  puppeteer resolves; audit:design is not silently dead
  'bespoke-surfaces',         // I-14 four non-EmptyState mascots; spinner untouched
  'brand-assets-built',       // I-9  runtime assets derive from masters, reproducibly
  'chart-series',             // I-7  kit pastels cycle, status hues out, every fill edged
  'contrast-formula-agrees',  // (extra) the two copies of the WCAG formula agree to 1e-9
  'doc-counts',               // (extra) DESIGN-SYSTEM.md's numbers are derived, not typed
  'icon-convention',          // I-11 both icon links present in the BUILT html
  'illustration-slots',       // I-12 both slots optional and additive
  'mascot-assignment',        // I-13 all nine assignments, plus the root 404
  'no-dark-mode',             // I-5  no machinery, and no `dark:` variant
  'one-mark',                 // I-10 the brand is drawn in exactly one place
  'one-scroller',             // (layout) only the shell scrolls; page grids are Rows
  'sparkle-motif',            // I-15 one inline sparkle, on the active item, decorative
  'token-layer',              // I-6  frozen values, @theme mapping, line budget
  'typography',               // I-8  Rubik + Baloo 2, Inter features gone, tnum kept
  'verify-contrast-behaviour',// I-2  the contrast gate fails when it should
];

/* I-16 declared `checks/visual/all-pages-render.ts`. It is NOT in this list and was
 * never written: its Run command needs a production server on a fixed port that nothing
 * in the plan starts, and its check file sat inside its own task Output, which the plan's
 * own rules forbid. The visual validation happened — all 18 routes, both states, read by
 * eye — but from a scratchpad harness, so it is not re-derivable by a later reader. That
 * is a real gap and it is recorded here rather than quietly absent from the count. */
const KNOWN_MISSING = { 'visual/all-pages-render': 'I-16 — see the comment above' };

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

console.log(`\n  ${passed}/${EXPECTED.length} checks pass` +
  (Object.keys(KNOWN_MISSING).length
    ? `, ${Object.keys(KNOWN_MISSING).length} declared-but-unwritten: ` +
      Object.entries(KNOWN_MISSING).map(([k, v]) => `${k} (${v})`).join('; ')
    : ''));
process.exitCode = code;
