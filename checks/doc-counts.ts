/* The design system's numbers, checked against the code they describe.
 *
 * Prose asserts a count, the code moves, nothing disagrees — so the load-bearing counts are
 * derived here and compared. A claim that cannot be derived is not in this list: this checks
 * arithmetic, not judgement.
 */
import { readFileSync } from 'node:fs';
import { ratio, readTokens } from '../scripts/lib/contrast.ts';

const doc = readFileSync('docs/DESIGN-SYSTEM.md', 'utf8');
const css = readFileSync('app/globals.css', 'utf8');
let code = 0;
const fail = (m: string): void => { console.error('FAIL ' + m); code = 1; };

/* The type scale: distinct declared sizes among the .t-* classes */
const sizes = new Set<number>();
for (const m of css.matchAll(/^\.(t-[a-z]+)\s*\{([^}]*)\}/gm)) {
  const fs = /font-size:\s*([^;]+);/.exec(m[2]);
  if (!fs) continue;
  const rem = [...fs[1].matchAll(/([0-9.]+)rem/g)].pop();
  if (rem) sizes.add(Math.round(parseFloat(rem[1]) * 16));
}
const WORDS: Record<string, number> = { seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
const claimed = /### Type — three families, ([a-z]+) sizes/.exec(doc);
if (!claimed) fail('cannot find the type-scale heading');
else if (WORDS[claimed[1]] !== sizes.size) {
  fail(`the doc claims ${claimed[1]} type sizes; the stylesheet declares ${sizes.size} (${[...sizes].sort((a, b) => b - a).join('/')})`);
}
/* Every px in the doc's type table must be a size the stylesheet actually declares. */
for (const row of doc.matchAll(/^\| (\d+) \| [a-z]+ \|/gm)) {
  const px = Number(row[1]);
  if (!sizes.has(px)) fail(`the type table lists ${px}px, which no .t-* class declares`);
}

/* The contrast figures quoted for --ink-faint */
const tok = readTokens(css);
const quoted = /— ([\d.]+) on surface, ([\d.]+) on bg, ([\d.]+) on the tint/.exec(doc);
if (!quoted) fail('cannot find the --c-500 contrast figures');
else {
  const GROUNDS: [number, string][] = [[1, '--surface'], [2, '--bg'], [3, '--accent-tint']];
  for (const [i, ground] of GROUNDS) {
    const want = Number(quoted[i]);
    // readTokens answers `null` for a var() chain ending at a token the stylesheet never
    // declares. Handed to ratio() that died with a TypeError three frames from the cause; a
    // token this doc quotes and the stylesheet lacks is a finding and reads as one.
    const fg = tok['--ink-faint'];
    const bgv = tok[ground];
    if (fg === null || fg === undefined || bgv === null || bgv === undefined) {
      fail(`the doc quotes --ink-faint on ${ground}, but the stylesheet declares no such token`);
      continue;
    }
    const got = Number(ratio(fg, bgv).toFixed(2));
    if (Math.abs(want - got) > 0.005) {
      fail(`the doc quotes --ink-faint on ${ground} as ${want}; it measures ${got}`);
    }
  }
}

/* The checks' own count */
const runner = readFileSync('scripts/run-checks.ts', 'utf8');
const expected = (runner.match(/^\s{2}'[a-z-]+',/gm) || []).length;
const docChecks = /`pnpm checks` runs all ([a-z]+) and prints `(\d+)\/(\d+)`/.exec(doc);
if (!docChecks) fail('cannot find the doc claim about pnpm checks');
else if (WORDS[docChecks[1]] !== expected || Number(docChecks[3]) !== expected) {
  fail(`the doc says ${docChecks[1]}/${docChecks[3]} checks; run-checks.ts declares ${expected}`);
}

if (!code) {
  console.log(`PASS doc counts agree with the code (${sizes.size} sizes, ${expected} checks)`);
}
process.exitCode = code;
