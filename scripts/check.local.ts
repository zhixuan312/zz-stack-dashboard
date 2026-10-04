/**
 * The console's own rules, run by the gate beside Meridian's check.ts.
 *
 *   node scripts/check.local.ts
 *
 * - A timestamp is never printed raw, no map is keyed by one flow's or skill's names, a gate count has no hardcoded
 *   denominator, and a hand-built table that can be empty says so.
 * - No `__html` from anything but a literal or the pre-paint script: the second way raw HTML could get in.
 * - No source file over 700 lines: past that a file holds two things, and the split is agreed before it grows.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const problems: string[] = [];

function walk(dir: string, ext: RegExp, out: string[] = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const n of fs.readdirSync(abs)) {
    const p = path.join(dir, n);
    if (fs.statSync(path.join(ROOT, p)).isDirectory()) walk(p, ext, out);
    else if (ext.test(n)) out.push(p);
  }
  return out;
}

const SOURCE = [...walk('src', /\.tsx?$/), ...walk('app', /\.tsx?$/)];
/** Code only: a comment that names a pattern to explain why it is absent is not a use. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

// ── The console's pages ──────────────────────────────────────────────────────────────────────────────
// Product code only: Meridian's own layers are checked by check.ts.
for (const f of SOURCE.filter((x) => /^(app|src\/console|src\/lib|src\/nav)/.test(x))) {
  const c = code(read(f));
  // The API sends ISO 8601 in UTC; printed into a cell it is `2026-09-05T04:59:00Z`, or a wall clock a reader takes
  // for their own. A time goes through <When> or src/lib/format-date.
  for (const m of c.matchAll(/(?<!\$)\{(?:[a-z]\w*)\.(updated|updated_at|ts|expires|last_used|lastRun|created_at|createdAt)\}/g)) {
    const line = c.slice(c.lastIndexOf('\n', m.index) + 1, c.indexOf('\n', m.index));
    if (!/key=|at=\{|dateTime=\{/.test(line)) problems.push(`${f}: ${m[0]} prints a raw timestamp (use <When at>)`);
  }
  // A flow's stages or a skill's names written as map keys are right for one flow and wrong for every other.
  for (const m of c.matchAll(/Record<string,[^>]*>\s*=\s*\{([^}]{0,600})\}/g)) {
    if (/'(ops|zz|sdlc)-[a-z-]+':/.test(m[1])) problems.push(`${f}: a map keyed by specific flow or skill names`);
  }
  // "0 of 4" on a flow with one gate: the denominator is the flow's, never a literal.
  for (const m of c.matchAll(/\bof \d+\b/g)) problems.push(`${f}: "${m[0]}" is a hardcoded denominator`);
  // A hand-built table (not Meridian's DataTable, which has its empty states) must say when it has nothing.
  if (c.includes('<TableBody>') && !/length === 0|EmptyState|\.length \?|!\w+\.length/.test(c)) problems.push(`${f}: a table that can be empty does not say so`);
}

// ── Raw HTML stays inert ─────────────────────────────────────────────────────────────────────────────
// check.ts keeps rehype-raw out; this closes the other way in.
for (const f of SOURCE) {
  for (const m of code(read(f)).matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g)) {
    const expr = m[1].trim();
    if (!/^[`'"]/.test(expr) && expr !== 'PREPAINT') problems.push(`${f} sets __html from ${expr.slice(0, 40)}`);
  }
}

// ── Size: the console's ceiling ──────────────────────────────────────────────────────────────────────
const CEILING = 700;
for (const f of [...SOURCE, ...walk('scripts', /\.tsx?$/), ...walk('tests', /\.tsx?$/)]) {
  const n = read(f).split('\n').length;
  if (n > CEILING) problems.push(`${f}: ${n} lines, over the ${CEILING}-line ceiling (split it)`);
}

console.log(problems.join('\n') || 'check.local: ok');
console.log(`${problems.length} problems · ${SOURCE.length} source files`);
process.exit(problems.length ? 1 : 0);
