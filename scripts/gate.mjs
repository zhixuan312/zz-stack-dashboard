#!/usr/bin/env node
/**
 * The console's gate.
 *
 * WHY THIS EXISTS. zz-stack catches a whole class of fault before it ships because every
 * failure that reached a person became a check. This repository had `tsc` and nothing else,
 * and the difference showed: seven bugs in one afternoon, every one found by the stakeholder
 * rather than by us, and every one the same shape — the screen asserting something the data
 * does not say. A type checker cannot see any of them. These can.
 *
 * Each check below is a bug that actually shipped. Adding one is how a bug stops recurring.
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let failed = 0;
const check = (name, fn) => {
  const why = fn();
  console.log(why ? `  \x1b[31m✗\x1b[0m ${name}\n      ${why}` : `  \x1b[32m✓\x1b[0m ${name}`);
  if (why) failed++;
};

/** Every .tsx/.ts under app/ and src/, with its text. */
function sources() {
  const out = [];
  const walk = (d) => {
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
  // The API sends ISO 8601 in UTC. Printed straight into a cell that is
  // `2026-09-05T04:59:00Z` on screen, and before that it was a UTC wall-clock with no zone
  // — which a reader in Singapore read as their own time and was eight hours out.
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

check('no map is keyed by the names of one flow, block or skill', () => {
  // Eight copies of "every initiative runs ops-flow" shipped at once: stage lists, gate
  // positions, document subtitles, a per-skill table and a per-block table. Each was correct
  // for the thing it was written against and wrong for everything else.
  const bad = [];
  for (const [f, s] of sources()) {
    if (f.endsWith('components/Flow.tsx')) continue;   // its STAGES is the declared fallback
    for (const m of s.matchAll(/Record<string,[^>]*>\s*=\s*\{([^}]{0,600})\}/g)) {
      if (/'(ops|zz|sdlc|casebox)-[a-z-]+':|^\s*(casebox|bookit|rulemill|platform):/m.test(m[1])) {
        bad.push(`${f}: a map keyed by specific ${/-/.test(m[1]) ? 'skill/flow' : 'block'} names`);
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
      const lead = line.trim().slice(0, 2);
      if (['//', '*', '/*', '{/'].includes(lead)) continue;   // prose in a comment
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

/* THE SAME CEILING THE PLATFORM REPOSITORY HOLDS, and it is here rather than only there
 * because the rule is about code somebody has to reuse and this is half the code.
 *
 * 700 lines, measured rather than chosen: it is the line above which every source file in
 * either repository turned out to hold a second subject. This console has never had one over
 * it — the largest is src/lib/api.ts at 531 — so today the check is a floor under a healthy
 * tree rather than a demand, which is exactly when a rule is worth writing down.
 *
 * It finds "definitely too big" and cannot find "more than one subject". No exemption list:
 * a file that cannot get under it is telling you something, not asking for a waiver.
 */
check('no source file is larger than one subject usually is', () => {
  const LIMIT = 700;
  const over = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(tsx?|mjs|js)$/.test(p)) continue;
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

/* THE PROPERTY THAT MOVED REPOS WHEN /app DID.
 *
 * zz-stack used to serve its own knowledge page and its gate checked, line by line, that
 * every interpolation into that page's HTML was escaped. That page is deleted — the console
 * is the only front end now — and the check went with it.
 *
 * But the PROPERTY did not go anywhere. This app renders markdown that a team member pasted
 * in through `add_source`, which is text out of a document nobody here wrote. It is safe for
 * exactly one reason, stated in src/lib/safe-markdown.ts: react-markdown with remark-gfm and
 * NO rehype-raw, so raw HTML arrives as inert text and `<script>` never becomes a node. That
 * file deliberately does not escape `<` and `>`, because escaping corrupts code spans.
 *
 * So the whole defence is the ABSENCE of one plugin, and an absence is what nobody notices
 * adding. Somebody wanting an inline image or a table with markup reaches for rehype-raw, it
 * works, and the property is gone with nothing red. This is that check.
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
    // COMMENTS STRIPPED FIRST. safe-markdown.ts NAMES rehype-raw in the paragraph explaining
    // why it is absent, and the first version of this check read that as using it — the same
    // mistake as a check that cannot tell a command from a sentence about one, and it fires
    // on exactly the files that explain themselves best.
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

check('the build passes', () => {
  try { execSync('npx next build', { stdio: 'pipe' }); return null; }
  catch (err) { return String(err.stdout ?? err.message).split('\n').slice(-6).join(' ').slice(0, 300); }
});

console.log(`\n  ${'─'.repeat(56)}`);
console.log(failed ? `  \x1b[31mGATE FAILED — ${failed} check(s)\x1b[0m\n` : '  \x1b[32mGATE PASSED\x1b[0m\n');
process.exit(failed ? 1 : 0);
