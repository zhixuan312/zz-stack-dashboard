/* THE DESIGN SYSTEM'S NUMBERS, CHECKED AGAINST THE CODE THEY DESCRIBE.
 *
 * Four separate rounds of review found stale counts in this documentation, and every one
 * was a number a person had typed and nobody could re-derive: "eight sizes" for a
 * seven-rung scale, ".t-micro is 10px" for an 11px class, "5 EmptyState sites" where one
 * file carries two, "38 callers" for 37, contrast ratios transposed between two surfaces.
 * None broke the product. All of them made the document less trustworthy than the code,
 * which for a design system is the whole asset.
 *
 * The pattern is always the same: prose asserts a count, the code moves, nothing
 * disagrees. So the load-bearing counts are derived here and compared. A claim that
 * cannot be derived is not in this list — this checks arithmetic, not judgement.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ratio, readTokens } from '../scripts/lib/contrast.mjs';

const doc = readFileSync('docs/DESIGN-SYSTEM.md', 'utf8');
const css = readFileSync('app/globals.css', 'utf8');
let code = 0;
const fail = (m) => { console.error('FAIL ' + m); code = 1; };

const walk = (d, o = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, o);
    else if (/\.tsx?$/.test(p)) o.push(readFileSync(p, 'utf8'));
  }
  return o;
};
const src = [...walk('app'), ...walk('src')].join('\n');

/* ── the type scale: distinct declared sizes among the .t-* classes ───────── */
const sizes = new Set();
for (const m of css.matchAll(/^\.(t-[a-z]+)\s*\{([^}]*)\}/gm)) {
  const fs = /font-size:\s*([^;]+);/.exec(m[2]);
  if (!fs) continue;
  const rem = [...fs[1].matchAll(/([0-9.]+)rem/g)].pop();
  if (rem) sizes.add(Math.round(parseFloat(rem[1]) * 16));
}
const WORDS = { seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, sixteen: 16, seventeen: 17 };
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

/* ── call-site counts ─────────────────────────────────────────────────────── */
const emptyStates = (src.match(/<EmptyState/g) || []).length;
// Calls only: not the definition, not a mention inside a comment.
const toastCalls = (src.match(/(?<!function )\bshowToast\(\{/g) || []).length;
for (const [what, actual, re] of [
  ['EmptyState call sites', emptyStates, /\*\*(\d+)\*\* were then wired deliberately/],
  ['showToast call sites', toastCalls, /\*\*1 of (\d+)\*\* call sites passes one/],
]) {
  const m = re.exec(doc);
  if (!m) fail(`cannot find the doc's claim about ${what}`);
  else if (Number(m[1]) !== actual) fail(`the doc claims ${m[1]} ${what}; there are ${actual}`);
}

/* ── the contrast figures quoted for --ink-faint ──────────────────────────── */
const tok = readTokens(css);
const quoted = /— ([\d.]+) on surface, ([\d.]+) on bg, ([\d.]+) on the tint/.exec(doc);
if (!quoted) fail('cannot find the --c-500 contrast figures');
else {
  for (const [i, ground] of [['--surface', 1], ['--bg', 2], ['--accent-tint', 3]].map(([g, n]) => [n, g])) {
    const want = Number(quoted[i]);
    const got = Number(ratio(tok['--ink-faint'], tok[ground]).toFixed(2));
    if (Math.abs(want - got) > 0.005) {
      fail(`the doc quotes --ink-faint on ${ground} as ${want}; it measures ${got}`);
    }
  }
}

/* ── the checks' own count ────────────────────────────────────────────────── */
const runner = readFileSync('scripts/run-checks.mjs', 'utf8');
const expected = (runner.match(/^\s{2}'[a-z-]+',/gm) || []).length;
const docChecks = /`pnpm checks` runs all ([a-z]+) and prints `(\d+)\/(\d+)`/.exec(doc);
if (!docChecks) fail('cannot find the doc claim about pnpm checks');
else if (WORDS[docChecks[1]] !== expected || Number(docChecks[3]) !== expected) {
  fail(`the doc says ${docChecks[1]}/${docChecks[3]} checks; run-checks.mjs declares ${expected}`);
}

if (!code) {
  console.log(`PASS doc counts agree with the code (${sizes.size} sizes, ${emptyStates} empty states, ${toastCalls} toasts, ${expected} checks)`);
}
process.exitCode = code;
