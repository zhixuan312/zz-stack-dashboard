/**
 * Consistency gate: the system holds itself to its own contract.
 *
 *   node scripts/check.ts
 *
 * - Every card folder has its README.md and preview.tsx, and every README follows the card anatomy.
 * - Every page specification exists and follows the page anatomy.
 * - Every token a specification names in backticks, and every var(--x) or (--x) a component uses, exists.
 * - No literal colour (hex, rgb, hsl) and no Tailwind default palette in the layers: colours come from roles.
 * - No dormant code: every export of src/lib and src/data is imported by a file a product keeps.
 * - No source file over 700 lines: past that a file holds two things, and the split is agreed before it grows.
 * - The console's own rules: a timestamp is never printed raw, no map is keyed by one flow's or skill's names, a
 *   gate count has no hardcoded denominator, a hand-built table that can be empty says so, and markdown renders raw
 *   HTML inert.
 */
import fs from 'node:fs';
import path from 'node:path';
import { APP_DIR } from './lib/routes.ts';
import { cards } from './registry.ts';

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

// ── Tokens that exist ────────────────────────────────────────────────────────────────────────────────
const css = read('src/styles/tokens.css') + read('src/styles/base.css') + read('src/styles/motion.css');
const defined = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
/** Local custom properties a component sets for itself, and the host's bridged variables. */
const LOCAL = /^(i|w|m-len|safe-(top|right|bottom|left)|font-face-(sans|mono)|color-[a-z-]+|border-radius-[a-z]+|tw-.*|radix-.*)$/;

// ── Cards ────────────────────────────────────────────────────────────────────────────────────────────
const CARD_SECTIONS = ['## Surfaces', '## Agents', '## Accessibility'];
for (const c of cards()) {
  if (!c.hasPreview) problems.push(`${c.dir}: no preview.tsx`);
  const md = read(`${c.dir}/README.md`);
  if (!/^# .+\n\n[^#\n].+/.test(md)) problems.push(`${c.dir}/README.md: must open with "# Name" and a one-sentence summary`);
  if (!/^Status: (draft|beta|stable)$/m.test(md)) problems.push(`${c.dir}/README.md: no "Status: draft|beta|stable" line`);
  for (const s of CARD_SECTIONS) if (!md.includes(s)) problems.push(`${c.dir}/README.md: missing ${s}`);
}

// ── Pages ────────────────────────────────────────────────────────────────────────────────────────────
const PAGE_SPECS = walk(APP_DIR, /^README\.md$/);
for (const p of PAGE_SPECS) {
  const md = read(p);
  if (!/^# .+\n\n[^#\n].+/.test(md)) problems.push(`${p}: must open with "# Name" and a one-sentence summary`);
  for (const s of ['## Structure', '## States']) if (!md.includes(s)) problems.push(`${p}: missing ${s}`);
}

// ── Token names in specifications ────────────────────────────────────────────────────────────────────
const TOKEN_LIKE = /`((?:ground|frame|surface|line|fill|ink|accent|on-accent|on-critical|positive|warning|critical|series|chart|shadow|highlight|glow|edge|text|weight|leading|tracking|space|radius|control|row-height|card-pad|stack-gap|rail|data-width|reading-width|gutter|layer|dur|stagger|ease|stretch)(?:-[a-z0-9-]+)?)`/g;
const NOT_TOKENS = new Set(['leading', 'trailing', 'fill', 'text-wrap', 'text-pretty', 'text-balance', 'line-clamp', 'ease-out', 'ease-in-out', 'ease-spring', 'layer-1', 'text-left', 'text-right', 'text-center', 'surface-sunk/60', 'fill-hover', 'glow', 'edge', 'chart', 'series', 'shadow', 'surface', 'line', 'ink', 'accent', 'frame', 'ground']);
const SPECS = [...cards().map((c) => `${c.dir}/README.md`), ...PAGE_SPECS, ...walk('docs', /\.md$/), 'README.md', 'CONTRIBUTING.md'].filter((f) => fs.existsSync(path.join(ROOT, f)));
for (const f of SPECS) {
  const md = read(f).replace(/```[\s\S]*?```/g, '');
  for (const m of new Set([...md.matchAll(TOKEN_LIKE)].map((x) => x[1]))) {
    if (!defined.has(m) && !NOT_TOKENS.has(m)) problems.push(`${f}: names \`${m}\`, which is not a token`);
  }
}

// ── Hand-written styles: motion from tokens ──────────────────────────────────────────────────────────
for (const f of ['src/styles/base.css', 'src/styles/motion.css']) {
  read(f).split('\n').forEach((line, i) => {
    if (!/\b(?:animation|transition)(?:-duration|-delay)?\s*:/.test(line) && !/animation-delay/.test(line)) return;
    const lit = line.replace(/0\.01ms|\b0m?s\b/g, '').match(/\b\d+(?:\.\d+)?m?s\b/);
    if (lit) problems.push(`${f}:${i + 1}: literal duration ${lit[0]} (use a --dur-* or --stagger* token)`);
  });
}

// ── Components: variables and colours ────────────────────────────────────────────────────────────────
// Every source file of the product and the template, wherever it lives, so a new route is checked without being listed.
const LAYERS = [...new Set([APP_DIR, 'src'])].flatMap((d) => walk(d, /\.tsx?$/)).filter((f) => !/^src\/styles\//.test(f));
const PALETTE = /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|shadow|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/;
for (const f of LAYERS) {
  const src = read(f);
  src.split('\n').forEach((line, i) => {
    if (/allow-literal-colour/.test(line)) return;
    if (f === 'src/system/page-stage.tsx' && /HOST_STYLES|--color-|--border-radius|#2A2A30|#EDEDF0/.test(line)) return; // a simulated foreign host's own colours
    const at = `${f}:${i + 1}`;
    const lit = line.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])|\brgba?\(\s*\d|\bhsla?\(/);
    if (lit && !/^\s*(\*|\/\/|\/\*)/.test(line)) problems.push(`${at}: literal colour ${lit[0]} (use a role)`);
    // Meridian resets Tailwind's scales; a utility outside them emits no CSS and fails silently.
    const dead = line.match(/\b(?:font-(?:normal|light|bold|extrabold|black|thin)|rounded-(?:2xl|3xl)|shadow-(?:sm|md|lg|xl|2xl)|text-(?:3xl|4xl|5xl))\b/);
    if (dead) problems.push(`${at}: ${dead[0]} is outside Meridian's scale and renders nothing (use font-regular, rounded-xl, shadow-card…)`);
    // Blur names its token (blur-sm, blur-md, blur-xl) or an arbitrary value; a bare or other name emits no filter.
    const blur = line.match(/\b(?:backdrop-)?blur(?:-(?!sm\b|md\b|xl\b|\[|\()[a-z0-9]+)?(?![-\w[(])/);
    if (blur && !/glow-blur/.test(blur.input!.slice(Math.max(0, blur.index! - 6), blur.index! + blur[0].length))) problems.push(`${at}: ${blur[0]} is outside Meridian's blur scale and renders nothing (use backdrop-blur-sm, -md or -xl)`);
    // Motion is tokens: a literal duration or delay drifts from the system and ignores the reduced-motion collapse.
    const dur = line.match(/\b(?:duration|delay)-(?:\[\d[^\]]*\]|\d+)\b/);
    if (dur) problems.push(`${at}: ${dur[0]} is a literal duration (use duration-(--dur-hover), --dur-enter, --dur-exit…)`);
    // A pressed control eases down only if its transition includes transform; a colour-only list makes the press snap.
    if (/(?:^|[\s'"`])press(?=[\s'"`])/.test(line) && /\btransition(?:-colors|-shadow|-opacity|-\[[^\]]*\])/.test(line) && !/\btransition-\[[^\]]*transform/.test(line))
      problems.push(`${at}: a press control's transition leaves out transform, so the press snaps (add transform to the list)`);
    const pal = line.match(PALETTE);
    if (pal) problems.push(`${at}: Tailwind palette class ${pal[0]} (use a role)`);
  });
  for (const m of new Set([...src.matchAll(/var\(--([a-z0-9-]+)/g), ...src.matchAll(/\(--([a-z0-9-]+)\)/g)].map((x) => x[1]))) {
    if (m.endsWith('-')) continue; // a name built at run time: var(--series-${slot})
    if (!defined.has(m) && !LOCAL.test(m)) problems.push(`${f}: uses --${m}, which is not defined`);
  }
}

// ── No dormant code: an export nothing a product keeps imports ───────────────────────────────────────
// What the console ships is everything under src, app and scripts except card previews; tests do not count as a use.
const SWEPT = /^src\/(lib|data)\//;
const kept = ['src', 'app', 'scripts'].flatMap((d) => walk(d, /\.tsx?$/)).filter((f) => !/(^|\/)preview\.tsx$/.test(f));
const resolveSpec = (from: string, spec: string) => {
  const base = spec.startsWith('@/') ? path.join('src', spec.slice(2)) : spec.startsWith('.') ? path.join(path.dirname(from), spec) : null;
  if (!base) return null;
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((c) => /\.tsx?$/.test(c) && fs.existsSync(path.join(ROOT, c)) && fs.statSync(path.join(ROOT, c)).isFile()) ?? null;
};
/** For every module: the names a kept importer uses, or '*' when one takes them all. */
const used = new Map<string, Set<string>>();
const record = (f: string | null, name: string) => { if (f) used.set(f, (used.get(f) ?? new Set()).add(name)); };
const recordNames = (f: string | null, clause: string) => {
  for (const part of clause.split(',').map((s) => s.trim()).filter(Boolean)) record(f, part.replace(/^type\s+/, '').split(/\s+as\s+/)[0]);
};
for (const f of kept) {
  const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const m of src.matchAll(/\b(?:import|export)\s+(?:type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    const to = resolveSpec(f, m[2]);
    if (to === f) continue;
    const clause = m[1].trim();
    if (/^\*/.test(clause) || clause === '') record(to, '*');
    else {
      const def = clause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
      if (def) record(to, 'default');
      const named = clause.match(/\{([^}]*)\}/);
      if (named) recordNames(to, named[1]);
      if (/,\s*\*\s+as\b/.test(clause)) record(to, '*');
    }
  }
  for (const m of src.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) record(resolveSpec(f, m[1]), '*');
  for (const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) record(resolveSpec(f, m[1]), '*');
}
const EXPORT_DECL = /^export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|abstract\s+class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
for (const f of walk('src', /\.tsx?$/).filter((x) => SWEPT.test(x) && !/(^|\/)preview\.tsx$/.test(x))) {
  const src = read(f);
  const names = new Set([...src.matchAll(EXPORT_DECL)].map((m) => m[1]));
  if (/^export\s+default\b/m.test(src)) names.add('default');
  for (const m of src.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) for (const part of m[1].split(',').map((s) => s.trim()).filter(Boolean)) names.add(part.replace(/^type\s+/, '').split(/\s+as\s+/).pop()!);
  const u = used.get(f);
  if (u?.has('*')) continue;
  for (const n of names) if (!u?.has(n)) problems.push(`${f}: exports ${n}, which nothing a product keeps imports`);
}


// ── The console's own rules ──────────────────────────────────────────────────────────────────────────
// Product code only: Meridian's own layers are checked by the rules above.
const PRODUCT = LAYERS.filter((f) => /^(app|src\/console|src\/lib|src\/nav)/.test(f));
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
for (const f of PRODUCT) {
  const src = read(f);
  const c = code(src);
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
// Markdown a team member pasted in is safe for one reason: react-markdown with no rehype-raw, so raw HTML stays text.
// The whole defence is the absence of one plugin, so its arrival fails here.
{
  const pkg = JSON.parse(read('package.json'));
  for (const d of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (/^rehype-raw$|^rehype-dangerous|^remark-html$/.test(d)) problems.push(`package.json depends on ${d}: raw HTML would stop being inert`);
  }
  let renderers = 0;
  for (const f of LAYERS) {
    const c = code(read(f));
    if (/\brehype-raw\b|\brehypeRaw\b/.test(c)) problems.push(`${f} reaches for rehype-raw`);
    // A second way in: __html from anything but a literal or the pre-paint script, which is a constant string.
    for (const m of c.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g)) {
      const expr = m[1].trim();
      if (!/^[`'"]/.test(expr) && expr !== 'PREPAINT') problems.push(`${f} sets __html from ${expr.slice(0, 40)}`);
    }
    if (/from 'react-markdown'/.test(c)) renderers++;
  }
  if (!renderers) problems.push('nothing renders markdown: the raw-HTML rule is reading nothing');
}

// ── Size: the console's ceiling ──────────────────────────────────────────────────────────────────────
const CEILING = 700;
for (const f of [...LAYERS, ...walk('scripts', /\.tsx?$/), ...walk('tests', /\.tsx?$/)]) {
  const n = read(f).split('\n').length;
  if (n > CEILING) problems.push(`${f}: ${n} lines, over the ${CEILING}-line ceiling (split it)`);
}

console.log(problems.join('\n') || 'check: ok');
console.log(`${problems.length} problems · ${cards().length} cards · ${PAGE_SPECS.length} page specs · ${LAYERS.length} source files`);
process.exit(problems.length ? 1 : 0);
