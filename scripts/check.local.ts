/**
 * The console's own rules, run by the gate beside Meridian's check.ts.
 *
 *   node scripts/check.local.ts
 *
 * - A timestamp is never printed raw, no map is keyed by one flow's or skill's names, a gate count has no hardcoded
 *   denominator, and a hand-built table that can be empty says so.
 * - No `__html` from anything but a literal or the pre-paint script: the second way raw HTML could get in.
 * - Every webfont face states a `display` and a `fallback` that ends in a generic family, so a failed face leaves a
 *   real font rather than the browser's initial one.
 * - No source file over 700 lines: past that a file holds two things, and the split is agreed before it grows.
 * - Every page in the console's shell says what it tells the assistant: its spec has "### What the agent reads" under
 *   "## Agents", and names the context function it shares; and every page a view tool module names says what the agent
 *   does there, "### What the agent does here".
 * - Every page in the console's shell is a server page that asks the gate before anything else, for a feature the
 *   console has.
 * - Every file `next.config.ts` traces into a route is inside the Docker build context, so the image does not ship
 *   without a file the code reads with `node:fs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { nav } from '../src/app.config.ts';
import { FEATURES } from '../src/data/features.ts';
import { agentSection, pageSpecs, viewToolPages } from './lib/routes.ts';

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
// Product code only: Meridian's own layers are checked by check.ts. A page's content is the client view it renders,
// under src/views/pages.
for (const f of SOURCE.filter((x) => /^(app|src\/console|src\/lib|src\/nav|src\/views\/pages\/)/.test(x))) {
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

// ── The navigation ────────────────────────────────────────────────────────────────────────────────────
// `nav` in `src/app.config.ts` is what the rail draws (narrowed by `src/nav.ts`) and what `scripts/lib/routes.ts`
// walks for verify's navigation smoke, so a bad href is a broken check as much as a broken link. Meridian's check.ts
// holds each item's `needs` to the shape the rail can read; this holds the route itself, and that each one appears
// once: the rail lights up the longest match, so two entries with the same href are two links to the same page.
{
  const seen = new Map<string, number>();
  for (const item of nav.flatMap((g) => g.items)) {
    if (!item.href.startsWith('/')) problems.push(`src/app.config.ts: nav item ${item.href} is not a same-origin path`);
    else if (item.href.length > 1 && item.href.endsWith('/')) problems.push(`src/app.config.ts: nav item ${item.href} has a trailing slash`);
    seen.set(item.href, (seen.get(item.href) ?? 0) + 1);
  }
  for (const [href, n] of seen) {
    if (n > 1) problems.push(`src/app.config.ts: nav item ${href} is listed ${n} times`);
  }
}

// ── The prerender is not given away ──────────────────────────────────────────────────────────────────
/* Reading Next's search params costs the route its prerender. In this version `useSearchParams` client-renders
 * every Client Component up to the nearest Suspense boundary, and a console page has none — so the WHOLE route
 * stopped being prerendered and painted its own masthead only once hydration finished. Measured on `/teams` at the
 * phone profile `scripts/vitals.ts` uses: LCP 2212ms while it read the hook, 632ms once it did not, beside the
 * console pages that never read it at 620ms throughout. View state comes from `src/lib/address.ts`, which reads the
 * address directly and says the same thing at length. A file may still call the hook if it carries its own Suspense
 * boundary — `app/login/page.tsx` does, for the two parameters a signed-out visitor arrives with. */
/** A rule about what a file DOES must not fire on a sentence naming the thing it does: a doc block that
 *  quotes `useSearchParams()` to explain this very rule is not a file that reads search params. Comments are
 *  blanked for the call test only — the import test needs the quoted module path, which a string-stripper eats. */
const withoutComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const READS_SEARCH_PARAMS = /import\s*(?:type\s*)?\{[^}]*\buseSearchParams\b[^}]*\}\s*from\s*['"]next\/navigation['"]/;
for (const f of [...walk('app', /\.tsx?$/), ...walk('src', /\.tsx?$/)]) {
  const src = read(f);
  if (!READS_SEARCH_PARAMS.test(src) && !/\buseSearchParams\s*\(/.test(withoutComments(src))) continue;
  if (!/<Suspense/.test(src)) {
    problems.push(`${f}: reads Next's search params with no Suspense boundary of its own, which costs the route its prerender`);
  }
}

// ── Every console page says what the assistant reads ──────────────────────────────────────────────────
// Meridian's check.ts asks this of `app/(dashboard)/`, the template's own route group; this console's is `(dash)`, so
// the release's rule matches nothing here and would pass a page that shares no context. `ConsolePage` already refuses
// to compile without one (its `context` prop is required); this holds the page's spec to the same thing, so what the
// assistant is told is written down where a person reads what the page is.
for (const f of walk('app/(dash)', /^README\.md$/)) {
  const md = read(f);
  if (!/^## Agents\n[\s\S]*?^### What the agent reads$/m.test(md)) problems.push(`${f}: no "### What the agent reads" under ## Agents`);
  const named = /`(\w+Context)` in `(src\/views\/[\w-]+\.ts)`/.exec(md);
  if (!named) problems.push(`${f}: its Agents section does not name the context function the page shares`);
  else if (!fs.existsSync(path.join(ROOT, named[2])) || !new RegExp(`export function ${named[1]}\\b`).test(read(named[2]))) problems.push(`${f}: names ${named[1]} in ${named[2]}, which does not export it`);
}

// ── Every page a view tool renders says what the agent does there ─────────────────────────────────────
// Meridian's check.ts reads the view tools' `page`s from `src/views/tools.ts` alone, where this console's tools are
// imported from a module each under `src/views/tools/`, so the release's rule finds no page here. This reads every
// module with the release's own reader and holds each page's spec to the release's own section.
{
  const pages = new Set(walk('src/views/tools', /\.ts$/).flatMap((f) => viewToolPages(read(f)) ?? []).map((v) => v.page));
  if (!pages.size) problems.push('src/views/tools/: no view tool names its page');
  for (const { file, route } of pageSpecs().filter((p) => pages.has(p.route))) {
    const section = agentSection(read(file));
    if (!section) problems.push(`${file}: no "### What the agent does here" under ## Agents`);
    else if (!section.protagonist) problems.push(`${file}: "### What the agent does here" has no "Protagonist: <the card's name>." line`);
    else if (section.questions.length < 3) problems.push(`${file}: "### What the agent does here" has ${section.questions.length} of the three questions it needs`);
    pages.delete(route);
  }
  for (const page of pages) problems.push(`${page}: a view tool names it, and no page specification describes it`);
}

// ── Raw HTML stays inert ─────────────────────────────────────────────────────────────────────────────
// check.ts keeps rehype-raw out; this closes the other way in.
for (const f of SOURCE) {
  for (const m of code(read(f)).matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g)) {
    const expr = m[1].trim();
    if (!/^[`'"]/.test(expr) && expr !== 'PREPAINT') problems.push(`${f} sets __html from ${expr.slice(0, 40)}`);
  }
}

// ── Every webfont face lands on a real family when it fails ───────────────────────────────────────────
// next/font generates its metric fallback from `local("Arial")` alone. On a machine without Arial — every Linux
// server, and the CI runner's own Chrome — that generated face errors, and a face that names no `fallback` of its
// own then leaves the browser's INITIAL font, a serif, in its place until the real one arrives. The swap reflows
// the page, which is why /this-page-does-not-exist measured CLS 0.117 on Linux and 0.000 on a laptop: the laptop has
// Arial, so its generated fallback works and there is nothing to reflow to. Only `scripts/vitals.ts` on a machine
// without Arial can see the shift; this catches the font stack that makes it possible.
const GENERIC = /^(sans-serif|serif|monospace|system-ui|ui-sans-serif|ui-monospace|cursive|fantasy|math|emoji)$/;
/** The props of every `SomeFace({ … })` call, brace-balanced so a nested array or object is kept whole. */
function faceProps(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/=\s*[A-Z]\w*\(\{/g)) {
    let depth = 0, j = m.index! + m[0].length - 1;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) break;
    }
    out.push(src.slice(m.index! + m[0].length - 1, j + 1));
  }
  return out;
}
for (const f of SOURCE) {
  const src = code(read(f));
  if (!/from 'next\/font\//.test(src)) continue;
  for (const props of faceProps(src)) {
    const family = /variable:\s*'([^']+)'/.exec(props)?.[1] ?? props.slice(0, 30);
    if (!/display:\s*'/.test(props)) problems.push(`${f}: ${family} states no font-display`);
    const list = /fallback:\s*\[([^\]]*)\]/.exec(props)?.[1];
    if (!list) problems.push(`${f}: ${family} names no fallback, so a failed generated fallback leaves a serif`);
    else if (!GENERIC.test((list.match(/'([^']+)'/g)?.pop() ?? "''").replace(/'/g, ''))) problems.push(`${f}: ${family}'s fallback does not end in a generic family`);
  }
}

// ── Live data: a page that reads declares what it reads ───────────────────────────────────────────────
/* The console keeps every tab fresh with one stream that says which collection changed, and a tab is told only about the
 * collections its components declared (`useLive`). A page that reads and declares nothing is invisible to that stream:
 * nothing corrects it when the data moves, and nothing says so — the page simply shows what it read on arrival, for as
 * long as it is open.
 *
 * This is a rule rather than a review because it is exactly how the bell was missed: `src/console/frame.tsx` reads
 * `/initiatives?waiting=1` and declared nothing, so on fourteen of sixteen pages a gate approved in another tab left
 * the count stale. The sweep that found it was by hand; this is what stops the next one.
 *
 * Only the console's own pages, and only when they read: `/login`, `/enrol` and `/signed-out` are outside the group
 * whose layout mounts the provider, so declaring there would register into nothing. A page that composes panels reading
 * for it (`/settings`) declares the collection those panels read, and the components in `src/console/` are declared for
 * by the page that renders them (`version-chain.tsx` reads a document revision; the document page registers
 * `document`). A page's reads are in the client view it renders, under `src/views/pages/`, so both are scanned. */
for (const f of [...walk('app/(dash)', /\.tsx?$/).filter((x) => /\/page\.tsx$/.test(x)), ...walk('src/views/pages', /\.tsx$/)]) {
  const src = code(read(f));
  if (/useConsole[<(]/.test(src) && !/useLive\(/.test(src)) {
    problems.push(`${f}: reads through useConsole and declares nothing with useLive, so the live stream never corrects it`);
  }
}

// ── A page asks the gate before anything else ─────────────────────────────────────────────────────────
/* The rail hiding a destination forbids nothing: what stops a read is the page's own `gate`. So every page in the
 * console's shell is a server page whose default export opens with `const denied = await gate('<feature>');` and
 * `if (denied) return denied;`, with nothing awaited before it: a person who does not hold the feature is shown
 * NoAccess, and the client view that reads is never rendered. `tests/page-gate.test.ts` holds each page to the feature
 * its address is given; this holds the shape, and that the feature is one `src/data/features.ts` has. */
const GATE_FIRST = /\)\s*(?::[^{;]*)?\{\s*const\s+denied\s*=\s*await\s+gate\(\s*'([a-z-]+)'\s*\)\s*;\s*if\s*\(\s*denied\s*\)\s*return\s+denied\s*;/;
for (const f of walk('app/(dash)', /^page\.tsx$/)) {
  const src = code(read(f));
  if (/['"]use client['"]/.test(src)) problems.push(`${f}: is a Client Component; a page is a server page that asks the gate first`);
  const at = src.search(/export\s+default\s+async\s+function\b/);
  const rest = at < 0 ? '' : src.slice(at);
  const opens = GATE_FIRST.exec(rest);
  if (!opens || rest.slice(0, opens.index + opens[0].length).match(/\bawait\b/g)?.length !== 1) {
    problems.push(`${f}: does not open with \`const denied = await gate('<feature>'); if (denied) return denied;\`, so it can render before it is allowed to`);
  } else if (!Object.hasOwn(FEATURES, opens[1])) {
    problems.push(`${f}: asks the gate for '${opens[1]}', which src/data/features.ts does not have`);
  }
}

// ── A truncated value keeps a way back ────────────────────────────────────────────────────────────────
/* `DataTable`'s `truncate` adds `max-w-0 truncate` and nothing else: no title, no expansion, no wrap. So a cut value is
 * cut everywhere on the page, and where the value identifies a record — a slug, a path, an id, an address, a stable key
 * — the part an ellipsis eats is usually the part that tells two of them apart. `2026-09-22-payout-schedule` is the
 * shape: the date at the front survives and the name that distinguishes it does not.
 *
 * The rule is one line: an element whose own class truncates carries `title`, or it does not truncate. Where the column
 * has room the better answer is to wrap (`whitespace-normal [overflow-wrap:anywhere]`) and need no title at all; this
 * check refuses only the silent cut, which is the one with no answer for the reader.
 *
 * `initiative.tsx` wrote this rule for its own slug and it did not travel: the team slug, a member's address, the bell's
 * entry and the evaluator's stable key were all still cutting. A rule written where it is first needed is a rule the
 * second use misses, so it is a check now. Only the console's own files are scanned — Meridian's are not ours to edit,
 * and a hit there is a finding to report rather than a failure to fix. */
const noComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Every opening JSX tag, as its own text. A `>` inside `{…}` (an arrow, a comparison) does not end a tag, so this
 *  tracks brace depth and quotes rather than matching to the first `>` — which is the bug that would make a naive
 *  version of this check pass a tag whose `title` came after an `onClick={() => …}`. */
function openTags(src: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '<' || !/[A-Za-z]/.test(src[i + 1] ?? '')) continue;
    let depth = 0;
    let quote = '';
    for (let j = i + 1; j < src.length; j++) {
      const ch = src[j];
      if (quote) { if (ch === quote) quote = ''; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) { out.push(src.slice(i, j + 1)); i = j; break; }
    }
  }
  return out;
}

const TRUNCATES = /(^|["'\s])truncate(["'\s]|$)/;
for (const f of [...walk('app', /\.tsx$/), ...walk('src/views/pages', /\.tsx$/), ...walk('src/console', /\.tsx$/)]) {
  for (const tag of openTags(noComments(read(f)))) {
    if (!TRUNCATES.test(tag) || /\btitle=/.test(tag)) continue;
    problems.push(`${f}: an element truncates with no \`title\`, so the whole value is nowhere on the page — carry it in \`title\`, or wrap with \`whitespace-normal [overflow-wrap:anywhere]\``);
  }
}

// ── A count agrees with its noun ──────────────────────────────────────────────────────────────────────
/* `src/console/words.ts` is the one place a plural is decided. **Seventeen sites hand-rolled it anyway** — and writing
 * the module down is what did not stop them, which is the whole reason this check exists rather than another note.
 *
 * That is the mechanism this round keeps meeting: a rule written where it is first needed is a rule the second use
 * re-derives. **The first draft of this check was too narrow and the measurement says so:** it refused only
 * `=== 1 ? '' : 's'` and a `.length` choosing between two quoted forms, and against the ten sites already known it
 * caught **two**. A guard that catches a fifth of its class is decoration, and its green line is indistinguishable from
 * a real one.
 *
 * What replaced it: a `=== 1 ? '…' : '…'` is a plural when its two branches **differ the way a plural differs from its
 * singular** — one is the other with `s`, `es`, or `y`→`ies`. That is the whole rule, decided at run time rather than by
 * pattern-matching the left operand, and it needs no list of nouns. Fed every site the sweep had found, it fires on
 * every `-s` pair; fed the product's innocent numeric ternaries it stays clean, because `active`/`idle` is not a plural
 * pair.
 *
 * **The residue, named rather than papered over:** an irregular (`it`/`them`, `version is`/`versions are`,
 * `gate needs`/`gates need`) is not a `-s` pair and is not caught. Both `(s)`-style patterns tried for it were thrown
 * away: `'…(s)…'` fired on six files containing no plural at all, because between two single quotes anywhere in a file
 * `(s)` is far more often an arrow function's parameter, `filter((s) => …)`. **A scanner that reads two statements as
 * one is worse than no scanner: it is loud, it is wrong, and it gets switched off.** The irregulars are left to a
 * reader — which is how all seventeen were found.
 *
 * `words.ts` is exempt: it is where the ternary belongs. */
const TERNARY = /===\s*1\s*\?\s*(['"])([^'"\n]*)\1\s*:\s*(['"])([^'"\n]*)\3/g;

/** One branch is the other with a plural suffix — `s`, `es`, or a `y` that becomes `ies`. */
function isPluralPair(a: string, b: string): boolean {
  const grows = (x: string, y: string) => y === `${x}s` || y === `${x}es` || (x.endsWith('y') && y === `${x.slice(0, -1)}ies`);
  return grows(a, b) || grows(b, a);
}

for (const f of [...walk('app', /\.tsx?$/), ...walk('src/views/pages', /\.tsx?$/), ...walk('src/console', /\.tsx?$/)]) {
  if (f === 'src/console/words.ts') continue;
  const src = noComments(read(f));
  for (let m = TERNARY.exec(src); m; m = TERNARY.exec(src)) {
    if (!isPluralPair(m[2], m[4])) continue;
    problems.push(`${f}: decides a plural itself (${JSON.stringify(m[0])}) — use \`plural(n, '${m[2] || m[4]}')\` from \`src/console/words.ts\`, which is the one place it is decided`);
  }
}

// ── What the image traces has to be in the build context ─────────────────────────────────────────────
// The build's own two halves are each valid on their own and wrong together, which is why nothing
// caught this. `next.config.ts` names the files the standalone build must carry beside the code —
// `outputFileTracingIncludes` — and the Docker build gets its files through `.dockerignore`. A file
// traced there and excluded here is absent at build time, so the trace includes nothing, the image
// ships without it, and the reader of it fails silently rather than loudly.
//
// This bit `docs/brief.md`, which the assistant route traces: `.dockerignore` excluded `docs`, the
// shipped console carried no brief, and `readBrief` returns '' instead of throwing — so every reply
// in production was written without the Product, Users and Glossary sections the README says they
// carry, and no test, check or reader could tell.
//
// Only the head segment is compared, and only against a plain pattern: that is the shape the two
// files are written in, and a matcher with more of gitignore's semantics than that would report
// cases a person would have to argue with.
{
  const tracing = /outputFileTracingIncludes\s*:\s*\{([\s\S]*?)\}/.exec(read('next.config.ts'))?.[1] ?? '';
  const traced = [...tracing.matchAll(/['"]\.\/([^'"]+)['"]/g)].map((m) => m[1]);
  const ignored = read('.dockerignore').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const t of traced) {
    const head = t.split('/')[0];
    if (ignored.includes(head) || ignored.includes(t)) {
      problems.push(`.dockerignore: "${head}" is excluded from the build context, but next.config.ts traces "${t}" into a route — the image ships without it`);
    }
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
