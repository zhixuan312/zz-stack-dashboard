/**
 * Consistency gate: the system holds itself to its own contract.
 *
 *   node scripts/check.ts
 *
 * - Every card folder has its README.md and preview.tsx, and every README follows the card anatomy.
 * - Every page specification exists and follows the page anatomy.
 * - Every token a specification names in backticks, and every var(--x) or (--x) a component uses, exists.
 * - No literal colour (hex, rgb, hsl) and no Tailwind default palette in the layers: colours come from roles.
 * - One implementation: the fixtures a collection serves are read through src/data/collections.ts, not imported again.
 * - No dormant code: every export of src/lib and src/data is imported by a file a product keeps.
 * - Markdown stays inert: no raw-HTML plugin in the dependencies or the source.
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
    // Blur names its token (blur-md, blur-xl) or an arbitrary value; a bare or other name emits no filter.
    const blur = line.match(/\b(?:backdrop-)?blur(?:-(?!md\b|xl\b|\[|\()[a-z0-9]+)?(?![-\w[(])/);
    if (blur && !/glow-blur/.test(blur.input!.slice(Math.max(0, blur.index! - 6), blur.index! + blur[0].length))) problems.push(`${at}: ${blur[0]} is outside Meridian's blur scale and renders nothing (use backdrop-blur-md or -xl)`);
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

// ── One implementation: a collection's rows are read through the collection ──────────────────────────
// The covered fixtures are the names src/data/collections.ts passes as `rows:` (read from the file, so a product's own
// collection is covered without editing this rule). Other fixture exports it imports, such as DEMO_NOW or ROLES, are not records.
// A project without the collections seam (an existing app that brought Meridian in) has nothing for this rule to read.
const COLLECTIONS = 'src/data/collections.ts';
if (fs.existsSync(path.join(ROOT, COLLECTIONS))) {
  const FIXTURE_IMPORT = /(?:import|export)\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]*fixtures\/[^'"]*)['"]/g;
  /** A whole fixture module taken at once: `import * as`, `export * from`, or a dynamic `import()`. */
  const FIXTURE_WHOLE = /(?:import\s+\*\s+as\s+\w+\s+from|export\s+\*(?:\s+as\s+\w+)?\s+from|import\()\s*['"]([^'"]*fixtures\/[^'"]*)['"]/g;
  const valueNames = (clause: string) => clause.split(',').map((s) => s.trim()).filter((s) => s && !/^type\s/.test(s)).map((s) => s.split(/\s+as\s+/)[0]);
  const fixtureModule = (spec: string) => spec.slice(spec.indexOf('fixtures/')).replace(/\.tsx?$/, '');
  const collectionsSrc = read(COLLECTIONS);
  const served = new Set([...collectionsSrc.matchAll(/\brows:\s*([A-Za-z_]\w*)/g)].map((m) => m[1]));
  /** Each covered name, and the fixture module it comes from. */
  const covered = new Map([...collectionsSrc.matchAll(FIXTURE_IMPORT)].filter((m) => !m[1]).flatMap((m) => valueNames(m[2]).filter((n) => served.has(n)).map((n) => [n, fixtureModule(m[3])] as const)));
  const coveredModules = new Set(covered.values());
  for (const f of LAYERS) {
    if (f === COLLECTIONS || /^src\/system\/fixtures\//.test(f) || /(^|\/)preview\.tsx$/.test(f)) continue;
    const src = read(f);
    for (const m of src.matchAll(FIXTURE_IMPORT)) {
      if (m[1]) continue;
      for (const n of valueNames(m[2])) if (covered.has(n)) problems.push(`${f}: imports ${n} from the fixtures; read it through ${COLLECTIONS}`);
    }
    for (const m of src.matchAll(FIXTURE_WHOLE)) {
      const mod = fixtureModule(m[1]);
      if (coveredModules.has(mod)) problems.push(`${f}: imports all of ${mod}, which holds ${[...covered].filter(([, x]) => x === mod).map(([n]) => n).join(', ')}; read it through ${COLLECTIONS}`);
    }
  }
}

// ── Markdown stays inert ───────────────────────────────────────────────────────────────────────────────
// Prose renders what people and models wrote, and is safe for one reason: react-markdown with no raw-HTML plugin, so
// HTML in the text stays text. The whole defence is the absence of a package, so its arrival fails here.
{
  const pkg = JSON.parse(read('package.json'));
  for (const d of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (/^(rehype-raw|rehype-dangerous-html|remark-html)$/.test(d)) problems.push(`package.json depends on ${d}: raw HTML in rendered markdown would stop being inert`);
  }
  // Code only: a comment that names the plugin to explain why it is absent is not a use.
  const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  for (const f of LAYERS) if (/\brehype-?raw\b/i.test(code(read(f)))) problems.push(`${f}: reaches for rehype-raw; render markdown with Prose, where raw HTML stays text`);
}

// ── No dormant code: an export nothing a product keeps imports ───────────────────────────────────────
// A product keeps everything except tests, previews, the Atlas pages and the Atlas-only modules scripts/brand.ts removes
// (read from its list, so the two never disagree). A type the docs tell a product to use stays exported by the sample using it.
// A project without the Atlas (src/system) has no Atlas-only modules, and may not carry brand.ts at all.
const hasAtlas = fs.existsSync(path.join(ROOT, 'src/system')) && fs.existsSync(path.join(ROOT, 'scripts/brand.ts'));
const atlasOnly = hasAtlas ? [...read('scripts/brand.ts').matchAll(/const atlasOnly = \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => `src/system/${x[1]}`)) : [];
if (hasAtlas && !atlasOnly.length) problems.push('scripts/brand.ts: no atlasOnly list found, so the dormant-code rule cannot tell what a product keeps');
const SWEPT = /^src\/(lib|data)\//;
// In a project that adopted Meridian (zz-meridian adopt), Meridian's own modules are a library it uses in part; only
// the project's own src/lib and src/data are swept. A created dashboard is swept whole, as the template is.
const manifestPath = path.join(ROOT, '.meridian/manifest.json');
const adopted = fs.existsSync(manifestPath) && JSON.parse(fs.readFileSync(manifestPath, 'utf8')).route === 'adopt' ? new Set(Object.keys(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files)) : new Set<string>();
const kept = ['src', 'app', 'scripts'].flatMap((d) => walk(d, /\.tsx?$/)).filter((f) => !/(^|\/)preview\.tsx$/.test(f) && !f.startsWith('app/system/') && !atlasOnly.includes(f));
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
for (const f of walk('src', /\.tsx?$/).filter((x) => SWEPT.test(x) && !/(^|\/)preview\.tsx$/.test(x) && !adopted.has(x))) {
  const src = read(f);
  const names = new Set([...src.matchAll(EXPORT_DECL)].map((m) => m[1]));
  if (/^export\s+default\b/m.test(src)) names.add('default');
  for (const m of src.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) for (const part of m[1].split(',').map((s) => s.trim()).filter(Boolean)) names.add(part.replace(/^type\s+/, '').split(/\s+as\s+/).pop()!);
  const u = used.get(f);
  if (u?.has('*')) continue;
  for (const n of names) if (!u?.has(n)) problems.push(`${f}: exports ${n}, which nothing a product keeps imports`);
}

console.log(problems.join('\n') || 'check: ok');
console.log(`${problems.length} problems · ${cards().length} cards · ${PAGE_SPECS.length} page specs · ${LAYERS.length} source files`);
process.exit(problems.length ? 1 : 0);
