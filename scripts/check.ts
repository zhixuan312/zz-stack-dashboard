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
 * - In the template, `connection()` is called only where the request is meant to be read: the console layout and the
 *   not-found page; pages and views reach the sample through src/data, never src/system/fixtures; and a writer path
 *   never revalidates with 'max'. A product's own pages are its own, so these rules are silent once
 *   `.meridian/manifest.json` exists.
 * - No dormant code: every export of src/lib and src/data is imported by a file a product keeps.
 * - Markdown stays inert: no raw-HTML plugin in the dependencies or the source.
 * - The agent context holds: docs/brief.md has its five sections, and every path and package script the managed block in
 *   AGENTS.md, the skill and the brief name exists.
 * - An update session is resolved, `.meridian/keep.json` names files that are managed and present, and `app.logo` is an
 *   SVG under public/.
 * - Every nav item's `needs` has the shape the rail can read: 'public', a grant `object:read|create|update|remove`, or an
 *   `{ allOf: [...] }` of them.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { importTarget, projectAliases } from './lib/aliases.ts';
import { checkBrief, scanReferences } from './lib/context-check.ts';
import { APP_DIR } from './lib/routes.ts';
import { keepProblems, unresolved, parseJournal, parseKeep, parseResolutions, verifiedRetirements, type Hash, type Retirement } from './lib/update-session.ts';
import { cards } from './registry.ts';
import { app, nav } from '../src/app.config.ts';
import { logoSource } from '../src/lib/logo.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
/** The project's import aliases, from its tsconfig: `@/` is `src/` in the template and the team's root in an adopted project. */
const ALIASES = projectAliases(ROOT);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const problems: string[] = [];

const sha256 = (p: string): Hash | null => (fs.existsSync(path.join(ROOT, p)) ? `sha256-${createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex')}` : null);

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
const LOCAL = /^(i|w|m-len|readout-(cursor|width)|safe-(top|right|bottom|left)|font-face-(sans|mono)|color-[a-z-]+|border-radius-[a-z]+|tw-.*|radix-.*)$/;

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
  // Every console page and embed view shares a context with both agents (decision 0011), and its spec says what it says.
  if (/^app\/(\(dashboard\)|embed)\//.test(p) && !/^## Agents\n[\s\S]*?^### What the agent reads$/m.test(md)) problems.push(`${p}: no "### What the agent reads" under ## Agents`);
}

// ── Token names in specifications ────────────────────────────────────────────────────────────────────
const TOKEN_LIKE = /`((?:ground|frame|surface|line|fill|ink|accent|on-accent|on-critical|positive|warning|critical|series|chart|shadow|highlight|glow|edge|text|weight|leading|tracking|space|radius|control|row-height|card-pad|stack-gap|rail|assistant-width|data-width|stage-width|reading-width|form-width|field-width|gutter|layer|dur|stagger|ease|stretch)(?:-[a-z0-9-]+)?)`/g;
const NOT_TOKENS = new Set(['leading', 'trailing', 'fill', 'text-wrap', 'text-pretty', 'text-balance', 'line-clamp', 'ease-out', 'ease-in-out', 'ease-spring', 'layer-1', 'text-left', 'text-right', 'text-center', 'surface-sunk/60', 'fill-hover', 'glow', 'edge', 'chart', 'series', 'shadow', 'surface', 'line', 'ink', 'accent', 'frame', 'ground']);
const SPECS = [...cards().map((c) => `${c.dir}/README.md`), ...PAGE_SPECS, ...walk('docs', /\.md$/), 'README.md', 'CONTRIBUTING.md'].filter((f) => fs.existsSync(path.join(ROOT, f)));
for (const f of SPECS) {
  const md = read(f).replace(/```[\s\S]*?```/g, '');
  for (const m of new Set([...md.matchAll(TOKEN_LIKE)].map((x) => x[1]))) {
    if (!defined.has(m) && !NOT_TOKENS.has(m)) problems.push(`${f}: names \`${m}\`, which is not a token`);
  }
}

// ── A specification that annotates a token with its value gets the value right ───────────────────────
// The specs write sizes as `` `radius-lg` 16px `` and `` `control-md` 38px ``, which is a claim about the token. When
// the radius scale was retuned (4/6/8/12/16 to 5/8/10/16/24) and the control heights with it (30/36/44 to 32/38/46),
// nineteen of those annotations were left behind — so a product sizing a control, a corner or a row from the specs was
// a few pixels out, and nothing said so. A token whose FIRST definition is not a plain px (a clamp, a var, a calc) has
// no single number to compare and is skipped; where a later definition is a plain px it joins the accepted set, so a
// density variant may be written as either.
const LITERAL = new Map<string, Set<number>>();
{
  const first = new Map<string, string>();
  for (const m of read('src/styles/tokens.css').matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+)/g)) {
    if (!first.has(m[1])) first.set(m[1], m[2].trim());
    if (/^[0-9.]+px$/.test(m[2].trim())) {
      if (!LITERAL.has(m[1])) LITERAL.set(m[1], new Set());
      LITERAL.get(m[1])!.add(Number(m[2].trim().replace('px', '')));
    }
  }
  for (const [name, def] of first) if (!/^[0-9.]+px$/.test(def)) LITERAL.delete(name);
}
for (const f of SPECS) {
  for (const m of read(f).matchAll(/`([a-z][a-z0-9-]*)`[  ]*\(?[  ]*([0-9.]+)px/g)) {
    const values = LITERAL.get(m[1]);
    if (values && !values.has(Number(m[2]))) problems.push(`${f}: \`${m[1]}\` is written as ${m[2]}px; the token is ${[...values].join(' or ')}px`);
  }
}

// ── An embed view a document names exists ────────────────────────────────────────────────────────────
// Two shapes name an embed view, and both have drifted from the routes:
//
//   - the literal route, in prose: `/embed/orders`. A name followed by a dot is a FILE in that folder
//     (`app/embed/layout.tsx`), not a route, so it is left alone.
//   - the surfaces inventory's own column (`docs/surfaces.md`, Layer 4), which names the view: `` `overview` ``. It
//     offered a `request` and a `customer` view that had never been built and left out the `proposal` one that had, and
//     nothing noticed: a reader following the guide went looking for a view that is not there.
const isEmbed = (name: string) => fs.existsSync(path.join(ROOT, APP_DIR, 'embed', name, 'page.tsx'));
for (const f of [...SPECS, ...walk('skills', /\.md$/)]) {
  for (const m of new Set([...read(f).matchAll(/\/embed\/([a-z0-9-]+)(?![\w.-])/g)].map((x) => x[1]))) {
    if (!isEmbed(m)) problems.push(`${f}: names the embed /embed/${m}, which is not a route`);
  }
}
{
  // A product built by `brand.ts --product` has no `docs/` at all, so the file is read only when it is there.
  const file = 'docs/surfaces.md';
  if (fs.existsSync(path.join(ROOT, file))) {
    const lines = read(file).split('\n');
    const after = lines.slice(lines.findIndex((l) => l.startsWith('### Layer 4')) + 1);
    const rows: string[] = [];
    for (const l of after) {
      if (l.startsWith('|')) rows.push(l);
      else if (rows.length) break;
    }
    for (const row of rows.slice(2)) {
      const cell = row.split('|').slice(-2)[0]?.trim() ?? '';
      if (!cell || /Not offered|Fullscreen only/.test(cell)) continue;
      for (const m of new Set([...cell.matchAll(/`([a-z0-9-]+)`/g)].map((x) => x[1]))) {
        if (!isEmbed(m)) problems.push(`${file}: the inventory offers a \`${m}\` embed view, which is not a route`);
      }
    }
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

// ── A control a keyboard can use ─────────────────────────────────────────────────────────────────────
// A native button, link or field answers Enter and Space by itself, and Radix's primitives carry their own keys. An
// element that only claims a control's role does not: it needs its own key handler, or a keyboard user can reach it,
// see its ring and still not use it, past every browser check (issue #11). An option is left out: its listbox's owner,
// the combobox that holds focus, moves through the options and picks one (aria-activedescendant).
{
  const ROLES = /\brole=["'](button|link|menuitem|menuitemcheckbox|menuitemradio|tab|checkbox|switch|radio)["']/;
  const NATIVE = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary']);
  for (const f of [APP_DIR, 'src'].flatMap((d) => walk(d, /\.tsx$/))) {
    const src = read(f);
    for (const m of src.matchAll(/<([a-z][a-z0-9]*)\b((?:=>|[^>])*)>/g)) {
      const [, tag, attrs] = m;
      const role = ROLES.exec(attrs)?.[1];
      if (role && !NATIVE.has(tag) && !/\bonKeyDown\s*=/.test(attrs)) problems.push(`${f}: <${tag} role="${role}"> has no onKeyDown; use a <button>, or handle Enter and Space`);
    }
  }
}

// ── One protagonist ───────────────────────────────────────────────────────────────────────────────────
// A page has one figure the eye lands on first. Two featured metrics on one page split it, and both read at the same
// size, so a person judging the render may not name it as the defect it is (a planted one went unscored in a skill
// evaluation, docs/skill-evals.md): settled rules are checked here, not left to the eye. Previews show every variant.
for (const f of [APP_DIR, 'src', 'components'].flatMap((d) => walk(d, /\.tsx$/)).filter((x) => !/(^|\/)preview\.tsx$/.test(x) && !x.startsWith(`${APP_DIR}/system/`))) {
  const src = read(f);
  const at = [...src.matchAll(/<FeaturedMetric\b/g)].map((m) => src.slice(0, m.index).split('\n').length);
  if (at.length > 1) problems.push(`${f}:${at[1]}: a second FeaturedMetric (the first is at line ${at[0]}); a page has one protagonist, so make the others Metric tiles or Cards`);
}

// ── The navigation ────────────────────────────────────────────────────────────────────────────────────
// `nav` in `src/app.config.ts` is what the rail draws (narrowed by `src/nav.ts`) and what `scripts/lib/routes.ts`
// walks for verify's navigation smoke, so a bad href is a broken check as much as a broken link. Meridian's own rule
// asks every item to declare `needs`, the grant that decides whether the person sees it; this console gates by the
// scope in view instead — a `platformOnly` fleet surface — and the gateway enforces what a member may read. What is
// worth holding here is the shape of the route itself, and that each one appears once: the rail lights up the longest
// match, so two entries with the same href are two links to the same page.
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

// ── The update session, the keep register and the logo ────────────────────────────────────────────────
// A session under .meridian/update/ must be resolved before the gate passes. With one ready, its candidate manifest
// stands in for the original: the files it will own are what keep, retirements and the dormant-code sweep read.
const manifestFile = path.join(ROOT, '.meridian/manifest.json');
let effective: { route?: string; files: Record<string, string> } | null = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
const retirements: Retirement[] = [];
{
  const dirsOf = (d: string) => (fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);
  for (const v of dirsOf('.meridian/history')) {
    for (const id of dirsOf(`.meridian/history/${v}`)) {
      const file = `.meridian/history/${v}/${id}/state.json`;
      if (!fs.existsSync(path.join(ROOT, file))) continue;
      try {
        const j = parseJournal(read(file));
        if (j.phase === 'complete') retirements.push(...verifiedRetirements(j));
      } catch (e) {
        problems.push(`${file}: ${(e as Error).message}`);
      }
    }
  }
  const sessions = dirsOf('.meridian/update').filter((n) => fs.existsSync(path.join(ROOT, '.meridian/update', n, 'state.json')));
  if (sessions.length > 1) problems.push(`.meridian/update: ${sessions.length} update sessions (${sessions.join(', ')}); finish or abort all but one`);
  else if (sessions.length === 1) {
    const dir = `.meridian/update/${sessions[0]}`;
    const HINT = `resolve them as MERGE.md says, then run npx zz-meridian@${sessions[0]} update --finalize`;
    try {
      const j = parseJournal(read(`${dir}/state.json`));
      const resFile = `${dir}/resolutions.json`;
      const open = unresolved(j, fs.existsSync(path.join(ROOT, resFile)) ? parseResolutions(read(resFile)) : [], sha256);
      if (open.length) problems.push(...open.map((o) => `${dir}: ${o}`), `${dir}: ${HINT}`);
      else {
        effective = j.targetManifest;
        retirements.push(...verifiedRetirements(j));
      }
    } catch (e) {
      problems.push(`${dir}/state.json: ${(e as Error).message}`, `${dir}: ${HINT}`);
    }
  }
  if (fs.existsSync(path.join(ROOT, '.meridian/keep.json'))) {
    try {
      problems.push(...keepProblems(parseKeep(read('.meridian/keep.json')), { managed: new Set(Object.keys(effective?.files ?? {})), retired: retirements, exists: (p) => fs.existsSync(path.join(ROOT, p)) }).map((m) => `.meridian/keep.json: ${m}`));
    } catch (e) {
      problems.push(`.meridian/keep.json: ${(e as Error).message}`);
    }
  }
  const logo = (app as { logo?: unknown }).logo;
  if (logo !== undefined) {
    const source = logoSource(logo);
    if (!source) problems.push(`src/app.config.ts: app.logo ${JSON.stringify(logo)} is not a root-relative SVG path such as "/logo.svg"`);
    else if (!fs.existsSync(path.join(ROOT, 'public', source))) problems.push(`src/app.config.ts: app.logo is ${source}, but public${source} does not exist`);
  }
}

// ── The template's request boundaries ────────────────────────────────────────────────────────────────
// Three places read the request: the console layout, which hands the shell a promise, the not-found page, which streams
// the address in, and the sign-in page's panel, which streams in as the demo's password or the product's sign-in, set by
// DEMO_PASSWORD at run time. A `connection()` anywhere else makes the page behind it wait for the request, and a template whose
// pages all prerender has none. In a product those pages are the team's, so the rule is the template's alone.
if (!fs.existsSync(manifestFile)) {
  const BOUNDARIES = [`${APP_DIR}/(dashboard)/layout.tsx`, `${APP_DIR}/not-found.tsx`, `${APP_DIR}/sign-in/gated-panel.tsx`];
  /** Comments blanked, not removed, so a line number is the file's. */
  const blanked = (f: string) => read(f).replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const lineOf = (src: string, at: number) => src.slice(0, at).split('\n').length;
  const sources = [APP_DIR, 'src'].flatMap((d) => walk(d, /\.tsx?$/)).map((f) => f.split(path.sep).join('/'));
  for (const f of sources) {
    if (BOUNDARIES.includes(f)) continue;
    blanked(f).split('\n').forEach((line, i) => {
      if (/\bconnection\s*\(/.test(line)) problems.push(`${f}:${i + 1}: connection() outside the template's three request boundaries`);
    });
  }
  // A page and a view read the sample through src/data, so the day it becomes an API is one file's change. Every
  // import specifier counts, a type-only one too; the Atlas, a preview and src/data itself are the sample's own.
  const FIXTURES = 'src/system/fixtures';
  for (const f of sources.filter((x) => (x.startsWith(`${APP_DIR}/`) || x.startsWith('src/views/')) && !x.startsWith(`${APP_DIR}/system/`) && !/(^|\/)preview\.tsx$/.test(x))) {
    const src = blanked(f);
    for (const m of src.matchAll(/(?:\bfrom|\bimport\s*\(?)\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      const target = importTarget(f, spec, ALIASES) ?? '';
      if (target === FIXTURES || target.startsWith(`${FIXTURES}/`)) problems.push(`${f}:${lineOf(src, m.index + m[0].lastIndexOf(spec))}: reads src/system/fixtures directly; go through src/data`);
    }
  }
  // The code that writes revalidates at once. 'max' keeps serving stale content, so the caller's own next read would
  // still show what it just changed.
  const WRITER = new RegExp(`^(?:${APP_DIR}/.*/actions\\.ts|${APP_DIR}/api/.*|src/lib/assistant/.*|src/data/live-actions\\.ts)$`);
  for (const f of sources.filter((x) => WRITER.test(x))) {
    const src = blanked(f);
    for (const m of src.matchAll(/\b(?:revalidateTag|cacheLife)\s*\(((?:[^()]|\([^()]*\))*)\)/g)) {
      if (/['"]max['"]/.test(m[1])) problems.push(`${f}:${lineOf(src, m.index)}: revalidates with 'max' on a writer path; use updateTag or { expire: 0 }`);
    }
  }
}

// ── No dormant code: an export nothing a product keeps imports ───────────────────────────────────────
// A product keeps everything except tests, previews, the Atlas pages and the Atlas-only modules scripts/brand.ts removes
// (read from its list, so the two never disagree). A type the docs tell a product to use stays exported by the sample using it.
// A project without the Atlas (src/system) has no Atlas-only modules, and may not carry brand.ts at all.
const hasAtlas = fs.existsSync(path.join(ROOT, 'src/system')) && fs.existsSync(path.join(ROOT, 'scripts/brand.ts'));
const atlasOnly = hasAtlas ? [...read('scripts/brand.ts').matchAll(/const atlasOnly = \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => `src/system/${x[1]}`)) : [];
if (hasAtlas && !atlasOnly.length) problems.push('scripts/brand.ts: no atlasOnly list found, so the dormant-code rule cannot tell what a product keeps');
const SWEPT = /^src\/(lib|data)\//;
/**
 * The modules Meridian ships as a TOOLKIT, whose exports are a product's to use or not.
 *
 * A product re-syncs `src/lib` verbatim and removes the samples, or never had them, so a formatter or a colour helper
 * whose only callers were sample views reads as a dormant export and fails this very check — in the product, on a file
 * Meridian gave it. Naming them here is the fix: "this module is a library a product may use in part" is a decision
 * about the module, so it is declared rather than inferred, and the list is short on purpose.
 */
const TOOLKIT = /^src\/lib\/(format|color|collection|live)\.ts$/;
// In a project built on Meridian (adopted or created), Meridian's own modules are a library it uses in part: a newer
// release may add an export the team's code does not use yet. Only the project's own src/lib and src/data are swept.
// The template, with no manifest, is swept whole.
const meridians = new Set(Object.keys(effective?.files ?? {}));
// A root proxy.ts is the product's own code too: Next runs it before every request.
const kept = [...['src', 'app', 'scripts'].flatMap((d) => walk(d, /\.tsx?$/)), ...(fs.existsSync(path.join(ROOT, 'proxy.ts')) ? ['proxy.ts'] : [])].filter((f) => !/(^|\/)preview\.tsx$/.test(f) && !f.startsWith('app/system/') && !atlasOnly.includes(f));
const resolveSpec = (from: string, spec: string) => {
  const base = importTarget(from, spec, ALIASES);
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
for (const f of walk('src', /\.tsx?$/).filter((x) => SWEPT.test(x) && !TOOLKIT.test(x) && !/(^|\/)preview\.tsx$/.test(x) && !meridians.has(x))) {
  const src = read(f);
  const names = new Set([...src.matchAll(EXPORT_DECL)].map((m) => m[1]));
  if (/^export\s+default\b/m.test(src)) names.add('default');
  for (const m of src.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) for (const part of m[1].split(',').map((s) => s.trim()).filter(Boolean)) names.add(part.replace(/^type\s+/, '').split(/\s+as\s+/).pop()!);
  const u = used.get(f);
  if (u?.has('*')) continue;
  for (const n of names) if (!u?.has(n)) problems.push(`${f}: exports ${n}, which nothing a product keeps imports`);
}

// ── The agent context: the brief, and what the instruction documents point at ──────────────────────────
// The managed block markers are the ones `zz-meridian adopt` writes (cli/src/context.ts); the CLI is not in a project.
{
  const BEGIN = '<!-- BEGIN:zz-meridian-agent-rules -->';
  const END = '<!-- END:zz-meridian-agent-rules -->';
  const has = (p: string) => fs.existsSync(path.join(ROOT, p));
  if (has('docs/brief.md')) {
    const { errors, warnings } = checkBrief(read('docs/brief.md'));
    for (const w of warnings) console.log(`docs/brief.md: warning: ${w}`);
    for (const e of errors) problems.push(`docs/brief.md: ${e}`);
  } else if (has('.meridian/manifest.json')) {
    console.log("docs/brief.md is missing: write it with the skill's brief template from the person's own answers");
  }

  const docs: { file: string; text: string; firstLine?: number }[] = [];
  if (has('AGENTS.md')) {
    const text = read('AGENTS.md');
    const begin = text.indexOf(BEGIN);
    const end = text.indexOf(END);
    if (begin !== -1 && end > begin) docs.push({ file: 'AGENTS.md', text: text.slice(begin, end + END.length), firstLine: text.slice(0, begin).split('\n').length });
  }
  for (const dir of ['skills/zz-meridian', '.agents/skills/zz-meridian', '.claude/skills/zz-meridian']) {
    for (const file of walk(dir, /\.md$/)) docs.push({ file: file.split(path.sep).join('/'), text: read(file) });
  }
  if (has('docs/brief.md')) docs.push({ file: 'docs/brief.md', text: read('docs/brief.md') });
  const scripts = new Set(Object.keys(JSON.parse(read('package.json')).scripts ?? {}));
  problems.push(...scanReferences(docs, has, scripts));
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

console.log(problems.join('\n') || 'check: ok');
console.log(`${problems.length} problems · ${cards().length} cards · ${PAGE_SPECS.length} page specs · ${LAYERS.length} source files`);
process.exit(problems.length ? 1 : 0);
