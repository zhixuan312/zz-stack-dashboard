/* The four surfaces that are not EmptyState, plus the one that must stay untouched.
 *
 * `mascot-assignment.ts` pins each of these to its single allowed file; this checks the
 * other half — that the surface still has its mascot and its fallback, and that the
 * blast radius stayed one call site wide.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
let code = 0;
const has = (f: string, ...needles: string[]): string => {
  const src = readFileSync(f, 'utf8');
  for (const n of needles) if (!src.includes(n)) { console.error(`FAIL ${f} missing ${n}`); code = 1; }
  return src;
};
has('app/login/page.tsx', 'mascot-hero', 'AI friend for a brighter you');
has('app/signed-out/page.tsx', 'state-goodbye');
has('src/components/ApproveAction.tsx', 'state-approved');

/* The mascot substitutes for the spinner on the one screen where a person waits on an
 * answer rather than on a button, and a screen-reader-only `Spinner` beside it carries the
 * accessible busy label. */
const ka = has('src/components/KnowledgeAsk.tsx', 'state-thinking');
if (!/Spinner/.test(ka)) { console.error('FAIL KnowledgeAsk dropped the screen-reader Spinner'); code = 1; }

/* DELIBERATE: the spinner primitive itself stays plain: a mascot in here would apply to
 * every screen, and busy-state vocabulary is one decision for the whole product. */
const spinner = readFileSync('src/components/ui/spinner.tsx', 'utf8');
if (/illustration|mascot/.test(spinner)) { console.error('FAIL spinner.tsx carries an illustration; the spinner primitive stays plain'); code = 1; }

/* Exactly one showToast caller may set an illustration. A second setter means somebody
 * generalised a one-file decision; every other call site takes the default branch. */
const walk = (d: string, o: string[] = []): string[] => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, o);
    else if (/\.tsx?$/.test(p)) o.push(p);
  }
  return o;
};
const setters = [...walk('app'), ...walk('src')].filter((f) => {
  const s = readFileSync(f, 'utf8');
  return /showToast\(/.test(s) && /illustration\s*:/.test(s);
});
if (setters.length !== 1 || !setters[0].endsWith('ApproveAction.tsx')) {
  console.error('FAIL toast illustration set by: ' + (setters.join(', ') || 'nobody')
    + '; expected only ApproveAction.tsx');
  code = 1;
}
if (!code) console.log('PASS four bespoke surfaces carry their mascot; spinner untouched; one toast setter');
process.exitCode = code;
