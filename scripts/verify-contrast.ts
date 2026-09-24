/**
 * The contrast floor, as a failure rather than a printout: it reads the tokens that ship,
 * measures the pairs below, and exits non-zero when one falls under its floor.
 *
 * It needs no browser and no session, which is what makes it usable in a gate — unlike
 * `audit:design`, which drives Puppeteer and requires a logged-in console.
 *
 * DELIBERATE: chart series fills are absent. The kit's pastels measure 1.8–2.4:1 against the
 * cream ground; a chart bar is a large filled area rather than text, and it is separated by a
 * hairline edge rather than by luminance.
 */
import { readFileSync } from 'node:fs';
import { ratio, readTokens } from './lib/contrast.ts';

const AA_TEXT = 4.5;

/** foreground token, background token, the floor it must clear. Anything not listed is out of
 *  scope, by design. */
type Pair = [string, string, number];
const PAIRS: Pair[] = [
  ...['--ink', '--ink-soft', '--ink-faint'].flatMap((fg) =>
    ['--bg', '--surface', '--surface-2'].map((bg): Pair => [fg, bg, AA_TEXT])),
  ...['--accent', '--accent-deep'].flatMap((fg) =>
    ['--bg', '--surface', '--surface-2'].map((bg): Pair => [fg, bg, AA_TEXT])),
  ['--on-accent', '--accent', AA_TEXT],
  ['--on-accent', '--accent-deep', AA_TEXT],
  ['--on-danger', '--danger-fill', AA_TEXT],
  ...['--green-text', '--amber-text', '--red-text'].flatMap((fg) =>
    ['--bg', '--surface'].map((bg): Pair => [fg, bg, AA_TEXT])),
  ['--green-text', '--green-tint', AA_TEXT],
  ['--amber-text', '--amber-tint', AA_TEXT],
  ['--red-text', '--red-tint', AA_TEXT],
  ...['--accent-tint', '--green-tint', '--amber-tint', '--red-tint'].map((bg): Pair => ['--ink', bg, AA_TEXT]),
];

/**
 * DELIBERATE: hairlines are not measured. WCAG 1.4.11's 3:1 applies to UI components and
 * meaningful graphics, and a separator that carries no information and is backed up by spacing
 * is neither.
 *
 * If a border ever becomes the only thing distinguishing a control — an input that is nothing
 * but its outline, say — that border belongs in the list above at AA_UI.
 */

/* The stylesheet to measure, defaulting to the real one. COUPLED:
 * `checks/verify-contrast-behaviour.ts` points it at a temporary copy carrying a broken
 * palette, so proving this script fails never requires editing what the product ships. */
const CSS = process.argv[2] ?? 'app/globals.css';
const tokens = readTokens(readFileSync(CSS, 'utf8'));

let failures = 0;
const rows: (string | number)[][] = [];
for (const [fg, bg, floor] of PAIRS) {
  const a = tokens[fg];
  const b = tokens[bg];
  if (!a || !b) {
    // A pair naming a token the stylesheet does not declare is a failure, never a skip: a
    // skipped pair is how a check passes while measuring nothing.
    rows.push([fg, bg, '—', floor, 'MISSING']);
    failures += 1;
    continue;
  }
  const r = ratio(a, b);
  const ok = r >= floor;
  if (!ok) failures += 1;
  rows.push([fg, bg, r.toFixed(2), floor, ok ? 'pass' : 'FAIL']);
}

const w = (s: string | number, n: number): string => String(s).padEnd(n);
console.log(`${w('foreground', 16)}${w('background', 16)}${w('ratio', 8)}${w('floor', 7)}result`);
for (const [fg, bg, r, floor, res] of rows) {
  console.log(`${w(fg, 16)}${w(bg, 16)}${w(r, 8)}${w(floor, 7)}${res}`);
}

if (failures) {
  console.error(`\n${failures} of ${PAIRS.length} pair(s) below their floor.`);
  console.error('Fix the colour, never the threshold.');
  process.exit(1);
}
console.log(`\nAll ${PAIRS.length} pairs clear their floor.`);
