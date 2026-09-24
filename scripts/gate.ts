#!/usr/bin/env node
/**
 * The console's gate.
 *
 * Each check below is a fault a type checker cannot see: the screen asserting something the
 * data does not say. Adding one is how a bug stops recurring.
 */
import { execSync } from 'node:child_process';
import { asExecError, execOutput } from './lib/exec.ts';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let failed = 0;
const check = (name: string, fn: () => string | null): void => {
  const why = fn();
  console.log(why ? `  \x1b[31m✗\x1b[0m ${name}\n      ${why}` : `  \x1b[32m✓\x1b[0m ${name}`);
  if (why) failed++;
};

/** Every .tsx/.ts under app/ and src/, as [path relative to the root, text]. */
function sources(): [string, string][] {
  const out: [string, string][] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (/\.tsx?$/.test(p)) out.push([p.slice(root.length + 1), readFileSync(p, 'utf8')]);
    }
  };
  for (const top of ['app', 'src']) { try { statSync(join(root, top)); walk(join(root, top)); } catch { /* absent */ } }
  return out;
}

console.log('\n  \x1b[1mconsole gate\x1b[0m\n');

check('a timestamp is rendered through <Time>, never printed raw', () => {
  // The API sends ISO 8601 in UTC. Printed straight into a cell, that is
  // `2026-09-05T04:59:00Z` on screen, or a wall-clock a reader takes for their own time.
  const bad = [];
  for (const [f, s] of sources()) {
    if (f.endsWith('ui/time.tsx')) continue;
    for (const m of s.matchAll(/\{(?:[a-z]\w*)\.(updated|updated_at|ts|expires|last_used|judged_at|ran|started)\}/g)) {
      const line = s.slice(s.lastIndexOf('\n', m.index) + 1, s.indexOf('\n', m.index));
      // A key is not a render, and a value handed to <Time> is exactly the right thing.
      if (/key=|<Time |value=\{/.test(line)) continue;
      bad.push(`${f}: ${m[0]}`);
    }
  }
  return bad.length ? bad.join('; ') : null;
});

check('no map is keyed by the names of one flow or skill', () => {
  // A flow's stage list, gate positions and document subtitles written as constants are each
  // correct for the flow they were written against and wrong for every other one.
  const bad = [];
  for (const [f, s] of sources()) {
    if (f.endsWith('components/Flow.tsx')) continue;   // its STAGES is the declared fallback
    for (const m of s.matchAll(/Record<string,[^>]*>\s*=\s*\{([^}]{0,600})\}/g)) {
      if (/'(ops|zz|sdlc)-[a-z-]+':/.test(m[1])) {
        bad.push(`${f}: a map keyed by specific skill/flow names`);
      }
    }
  }
  return bad.length ? [...new Set(bad)].join('; ') : null;
});

check('a count of gates or stages has no hardcoded denominator', () => {
  // "0 of 4" on a flow with one gate. The denominator is the flow's, and a literal is a
  // claim about a flow the reader is probably not looking at.
  const bad = [];
  for (const [f, s] of sources()) {
    for (const m of s.matchAll(/\bof \d+\b/g)) {
      const line = s.slice(s.lastIndexOf('\n', m.index) + 1, s.indexOf('\n', m.index));
      /* Prose in a comment is not a denominator. Match the opener rather than slicing two
       * characters off the trimmed line: a JSDoc body line trims to `* …`, which no list of
       * two-character openers holds. */
      if (/^(\/\/|\*|\/\*|\{\/)/.test(line.trim())) continue;
      bad.push(`${f}: "${m[0]}"`);
    }
  }
  return bad.length ? bad.join('; ') : null;
});

check('a table that can be empty says so', () => {
  const bad = [];
  for (const [f, s] of sources()) {
    if (!s.includes('<TableBody>')) continue;
    // The kit's own table components are where empty states come FROM.
    if (f.startsWith('src/components/ui/')) continue;
    if (/length === 0|EmptyState|\.length \?|isEmpty/.test(s)) continue;
    bad.push(f);
  }
  return bad.length ? bad.join('; ') : null;
});

/* The same ceiling the platform repository holds, because the rule is about code somebody has
 * to reuse and this is half the code.
 *
 * It finds "definitely too big" and cannot find "more than one subject". DELIBERATE: no
 * exemption list — a file that cannot get under it is telling you something, not asking for a
 * waiver.
 */
check('no source file is larger than one subject usually is', () => {
  const LIMIT = 700;
  const over: [string, number][] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.tsx?$/.test(p)) continue;
      const n = readFileSync(p, 'utf8').split('\n').length;
      if (n > LIMIT) over.push([p.slice(root.length + 1), n]);
    }
  };
  for (const top of ['app', 'src', 'scripts', 'tests']) {
    try { statSync(join(root, top)); walk(join(root, top)); } catch { /* absent */ }
  }
  over.sort((a, b) => b[1] - a[1]);
  return over.length
    ? over.map(([f, n]) => `${f} is ${n} lines`).join('; ') +
      ` — over ${LIMIT}. Split it by what it is about, not by line count.`
    : null;
});

/* This app renders markdown a team member pasted in through `source_add`, which is text out
 * of a document nobody here wrote. It is safe for one reason, stated in
 * src/lib/safe-markdown.ts: react-markdown with remark-gfm and no rehype-raw, so raw HTML
 * arrives as inert text and `<script>` never becomes a node. That file does not escape `<` and
 * `>`, because escaping corrupts code spans.
 *
 * COUPLED: the whole defence is the absence of one plugin. Adding rehype-raw works and takes
 * the property with it, so this check watches for it.
 */
check('markdown is rendered with raw HTML inert', () => {
  const bad = [];
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const d of Object.keys(deps)) {
    if (/^rehype-raw$|^rehype-dangerous|^remark-html$/.test(d)) {
      bad.push(`package.json depends on ${d} — raw HTML would stop being inert`);
    }
  }
  const files = sources();
  if (!files.length) return 'no source files found — this check is reading nothing';
  let renderers = 0;
  for (const [rel, src] of files) {
    // Comments stripped first: safe-markdown.ts names rehype-raw in the paragraph explaining
    // why it is absent, and a sentence about a plugin is not a use of it.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    if (/\brehype-raw\b|\brehypeRaw\b/.test(code)) {
      bad.push(`${rel} reaches for rehype-raw`);
    }
    // dangerouslySetInnerHTML anywhere that is not a literal is a second way in.
    for (const m of code.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g)) {
      const expr = m[1].trim();
      if (!/^[`'"]/.test(expr)) bad.push(`${rel} sets __html from ${expr.slice(0, 40)}`);
    }
    if (/<ReactMarkdown\b|from 'react-markdown'/.test(code)) renderers++;
  }
  if (!renderers) return 'nothing renders markdown here — this check is reading nothing';
  return bad.length ? bad.join('; ') : null;
});

/* `scripts/verify-contrast.ts` and the `checks/*.ts` suite are reachable from a package.json
 * script a person has to remember, and `release.ts` runs typecheck, lint, test and gate
 * without touching either.
 *
 * COUPLED: these two entries are what puts them on the enforced path, and they go here rather
 * than in `release.ts` because `pnpm run gate` is already on it.
 */
check('the palette clears its contrast floors', () => {
  try { execSync('node scripts/verify-contrast.ts', { stdio: 'pipe' }); return null; }
  catch (err) {
    const fails = execOutput(err).split('\n').filter((l) => /fail/i.test(l));
    return (fails.length ? fails : [asExecError(err).message]).join('; ').slice(0, 300);
  }
});

check('every declared design-system check exists and passes', () => {
  try { execSync('node scripts/run-checks.ts', { stdio: 'pipe' }); return null; }
  catch (err) {
    const bad = execOutput(err).split('\n').filter((l) => /FAIL|MISSING|UNDECLARED/.test(l));
    return (bad.length ? bad : [asExecError(err).message]).join('; ').slice(0, 300);
  }
});

check('the build passes', () => {
  try { execSync('npx next build', { stdio: 'pipe' }); return null; }
  catch (err) { const e = asExecError(err); return (e.stdout ?? e.message).split('\n').slice(-6).join(' ').slice(0, 300); }
});

console.log(`\n  ${'─'.repeat(56)}`);
console.log(failed ? `  \x1b[31mGATE FAILED — ${failed} check(s)\x1b[0m\n` : '  \x1b[32mGATE PASSED\x1b[0m\n');
process.exit(failed ? 1 : 0);
