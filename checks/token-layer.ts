/* THE FROZEN VALUES, read back out of the stylesheet.
 *
 * Reading the file rather than trusting the diff is the point: a token can be declared
 * twice and the last one wins, so `decl()` deliberately takes the LAST match.
 *
 * This is the check that was missing while `--c-500` was silently corrected from the
 * spec's frozen `#7a7080` to `#6e6574` — a correct change (the frozen value measured
 * 4.16:1 against a 4.5:1 floor) that nothing would have caught had it been a typo
 * instead. `verify-contrast.ts` proves the palette is LEGIBLE; this proves it is the
 * palette that was agreed.
 */
import { readFileSync } from 'node:fs';
const css = readFileSync('app/globals.css', 'utf8');
let code = 0;
const decl = (name: string) => {
  const m = [...css.matchAll(new RegExp('(?:^|\\n)\\s*' + name.replace(/-/g, '\\-') + ':\\s*([^;]+);', 'g'))];
  return m.length ? m[m.length - 1][1].trim() : null;
};
const want = {
  '--c-50': '#f8efea', '--c-25': '#fffbf9', '--c-900': '#221b26',
  '--zz-purple': '#7548d8', '--zz-purple-deep': '#5e2bcc', '--zz-purple-tint': '#f1ebff',
  '--zz-lavender': '#a98cf5', '--zz-pink': '#f58fa8', '--zz-blue': '#5fbdf5',
  '--r-sm': '8px', '--r': '10px', '--r-lg': '16px', '--r-pill': '999px',
  '--shadow-sm': 'none', '--shadow': 'none',
};
for (const [k, v] of Object.entries(want)) {
  const got = decl(k);
  if (got !== v) { console.error(`FAIL ${k} is ${got ?? 'absent'}, expected ${v}`); code = 1; }
}
if (/--n-[0-9]/.test(css)) { console.error('FAIL the old neutral ramp is still declared'); code = 1; }
if (/--indigo/.test(css)) { console.error('FAIL --indigo is still declared'); code = 1; }

/* THE TAILWIND MAPPING. A colour absent from `@theme inline` emits no utility at all —
 * the class is accepted, no CSS is produced, and the element keeps its inherited colour.
 * There is no error anywhere; the page just looks slightly wrong. */
const theme = css.slice(css.indexOf('@theme inline'), css.indexOf('}', css.indexOf('@theme inline')));
for (const c of ['--color-zz-lavender', '--color-zz-pink', '--color-zz-blue',
                 '--color-accent', '--color-ink', '--color-surface',
                 '--radius-md', '--radius-pill']) {
  if (!theme.includes(c)) { console.error(`FAIL @theme inline does not map ${c}; it emits no utility`); code = 1; }
}

const lines = css.split('\n').length;
if (lines > 700) { console.error(`FAIL globals.css is ${lines} lines, ceiling is 700`); code = 1; }
if (!code) console.log(`PASS token layer frozen, @theme mapped, within budget (${lines} lines)`);
process.exitCode = code;
