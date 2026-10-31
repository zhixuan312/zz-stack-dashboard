/**
 * Consistency gate: the system holds itself to its own contract.
 *
 *   node scripts/check.ts
 *
 * - Every card folder has its README.md and preview.tsx, and every README follows the card anatomy.
 * - Every page specification exists and follows the page anatomy, and a page with a view tool says what the agent does
 *   there: its protagonist and at least three questions its prepared query answers.
 * - Every token a specification names in backticks, and every var(--x) or (--x) a component uses, exists.
 * - No literal colour (hex of 3, 4, 6 or 8 digits; rgb, hsl, oklch, oklab, lab, lch, color) and no Tailwind default
 *   palette in the layers: colours come from roles.
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
 *   SVG under public/. A managed file whose bytes are not the release's and that keep.json does not keep is named on a
 *   `drift:` line, a warning the gate carries: nothing else says so between releases.
 * - Every nav item's `needs` has the shape the rail can read: 'public', a grant `object:read|create|update|remove`, or an
 *   `{ allOf: [...] }` of them.
 * - Every nav item's `under` names an item of its own group that is not itself under another, in the same workspace, and
 *   no item has more than seven sub pages: the rail draws three levels and nothing it cannot draw.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { importTarget, projectAliases } from './lib/aliases.ts';
import { checkBrief, scanReferences } from './lib/context-check.ts';
import { navTrailProblems, navUnderProblems } from './lib/nav-under.ts';
import { blankedText, noDirectQuery, presentationDoesNotRead, resolveSpec as resolveProjectSpec, valueImports, walk as walkIn } from './lib/layer-rules.ts';
import { APP_DIR, agentPageSpec, agentSection, specRoute, viewToolPages } from './lib/routes.ts';
import { keepProblems, unresolved, parseJournal, parseKeep, parseResolutions, verifiedRetirements, type Hash, type Retirement } from './lib/update-session.ts';
import { cards } from './registry.ts';
import { app, nav } from '../src/app.config.ts';
import { logoSource } from '../src/lib/logo.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
/** The project's import aliases, from its tsconfig: `@/` is `src/` in the template and the team's root in an adopted project. */
const ALIASES = projectAliases(ROOT);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
/** Comments blanked, not removed, so a scan reads code and a line number is still the file's. */
const blanked = (p: string) => blankedText(read(p));
/** The project file a specifier names, with the extension resolved; the helper is shared with `scripts/lib/layer-rules.ts`. */
const resolveSpec = (from: string, spec: string) => resolveProjectSpec(from, spec, ALIASES, ROOT);
const lineOf = (src: string, at: number) => src.slice(0, at).split('\n').length;
const problems: string[] = [];
/** A deviation a line states with `allow-<rule>: <reason>`, printed beside the problems rather than passed in silence. */
const escapes: string[] = [];
/**
 * How many things each rule over a set the project's files make judged. A rule whose set came out empty passes having
 * judged nothing, which reads exactly like a rule that judged everything and found it right: the agent sections passed a
 * project whose view tools were in modules the reader did not follow (#43), and the agent-reads rule passed a route
 * group not named `(dashboard)` (#23). So a rule that judged nothing says so, in the line `judged nothing: <rules>`,
 * which the gate and the coverage line of `pnpm verify` carry. It is not a failure: a product without cards has none.
 */
const judged: [rule: string, count: number][] = [];

// ── The four-layer switch: the project's own file turns the rules on ─────────────────────────────────
// `scripts/check.ts` reads one declaration from `scripts/check.local.ts` and nothing else. It is read as TEXT, never
// imported: a static import throws in every project that has no such file, a dynamic one runs the team's own checks
// inside this one (the gate runs them as its own step), and this is the one path under `scripts/` an update never
// overwrites. The text is comment-blanked first, so a comment cannot turn a rule on. Only an exported declaration
// assigning a boolean turns the rules on; a file that merely names `fourLayers` prints one note and leaves them off.
const LOCAL_CHECK = 'scripts/check.local.ts';
let fourLayers = false;
let fourLayersNote: string | null = null;
if (fs.existsSync(path.join(ROOT, LOCAL_CHECK))) {
  const declaration = blankedText(fs.readFileSync(path.join(ROOT, LOCAL_CHECK), 'utf8'));
  const assigned = declaration.match(/\bexport\s+const\s+fourLayers\s*=\s*(true|false)\b/);
  if (assigned) fourLayers = assigned[1] === 'true';
  else if (/\bfourlayers\b/i.test(declaration)) fourLayersNote = `note  ${LOCAL_CHECK}: fourLayers is declared but not as true or false — the four-layer rules are off`;
}

const sha256 = (p: string): Hash | null => (fs.existsSync(path.join(ROOT, p)) ? `sha256-${createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex')}` : null);

const walk = (dir: string, ext: RegExp) => walkIn(ROOT, dir, ext);

// ── Tokens that exist ────────────────────────────────────────────────────────────────────────────────
const css = read('src/styles/tokens.css') + read('src/styles/base.css') + read('src/styles/motion.css');
const defined = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
/** Local custom properties a component sets for itself, and the host's bridged variables. */
const LOCAL = /^(i|w|m-len|bar-(h|at)|cols(-(xl|lg|md|sm))?|readout-(cursor|width)|safe-(top|right|bottom|left)|font-face-(sans|mono)|color-[a-z-]+|border-radius-[a-z]+|tw-.*|radix-.*)$/;

// ── Cards ────────────────────────────────────────────────────────────────────────────────────────────
const CARD_SECTIONS = ['## Surfaces', '## Agents', '## Accessibility'];
for (const c of cards()) {
  if (!c.hasPreview) problems.push(`${c.dir}: no preview.tsx`);
  const md = read(`${c.dir}/README.md`);
  if (!/^# .+\n\n[^#\n].+/.test(md)) problems.push(`${c.dir}/README.md: must open with "# Name" and a one-sentence summary`);
  if (!/^Status: (draft|beta|stable)$/m.test(md)) problems.push(`${c.dir}/README.md: no "Status: draft|beta|stable" line`);
  for (const s of CARD_SECTIONS) if (!md.includes(s)) problems.push(`${c.dir}/README.md: missing ${s}`);
}

judged.push(['the card contract', cards().length]);

// ── Pages ────────────────────────────────────────────────────────────────────────────────────────────
const PAGE_SPECS = walk(APP_DIR, /^README\.md$/);
judged.push(['the page specifications', PAGE_SPECS.length], ['what the agent reads', PAGE_SPECS.filter((p) => agentPageSpec(p)).length]);
for (const p of PAGE_SPECS) {
  const md = read(p);
  if (!/^# .+\n\n[^#\n].+/.test(md)) problems.push(`${p}: must open with "# Name" and a one-sentence summary`);
  for (const s of ['## Structure', '## States']) if (!md.includes(s)) problems.push(`${p}: missing ${s}`);
  // Every console page and embed view shares a context with both agents (decision 0011), and its spec says what it says.
  if (agentPageSpec(p) && !/^## Agents$(?:\n(?!## ).*)*\n### What the agent reads$/m.test(md)) problems.push(`${p}: no "### What the agent reads" under ## Agents`);
}

// ── What the agent does on a page with a view tool ────────────────────────────────────────────────────
// A page an agent can view has a prepared query, and its specification names the card worth asking about and the
// questions a person asks there that the context does not answer alone: the line `Protagonist: <name>.` and at
// least three items `- "<question>" — <what the prepared query is asked>`. The page marks that card with
// `data-protagonist="<name>"`, and `scripts/ask.ts` asks the questions. Settings, the Atlas, Docs and the embed views are
// no view tool's page, so they are asked nothing; a project without `src/logic/tools.ts` has no view tools to read.
{
  const pages = new Set((viewToolPages() ?? []).map((v) => v.page));
  const viewed = PAGE_SPECS.filter((f) => agentPageSpec(f) && pages.has(specRoute(f)));
  judged.push(['what the agent does here', viewed.length]);
  for (const p of viewed) {
    const md = read(p);
    const section = agentSection(md);
    if (!section || !/^## Agents$(?:\n(?!## ).*)*\n### What the agent does here$/m.test(md)) {
      problems.push(`${p}: no "### What the agent does here" under ## Agents`);
      continue;
    }
    if (!section.protagonist) problems.push(`${p}: "### What the agent does here" has no "Protagonist: <the card's name>." line`);
    if (section.questions.length < 3) {
      const stray = section.stray.length ? `; not in that form: ${section.stray.map((s) => s.slice(0, 60)).join(' | ')}` : '';
      problems.push(`${p}: "### What the agent does here" has ${section.questions.length} of the three questions it needs, each - "<question>" — <what the prepared query is asked>${stray}`);
    }
  }
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
//   - the surfaces inventory's own column (`docs/surfaces.md`, Layer 4), which names the view: `` `home` ``. It
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
    // Literal colour, in every form a browser takes: hex of 3, 4, 6 or 8 digits, and the colour functions. A function
    // is matched by its own name and its parenthesis, and not after a dot — so `color-mix(in oklch, var(--ink) 40%,
    // transparent)`, which is how the layers compose a tint out of tokens, is not a literal and is not reported.
    const lit = line.match(/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])|\brgba?\(\s*\d|\bhsla?\(|(?<![\w.$])(?:oklch|oklab|lab|lch|color)\(/);
    // A comment line is words: "the focus left with no blur" names no class.
    const comment = /^\s*(\*|\/\/|\/\*)/.test(line);
    if (lit && !comment) problems.push(`${at}: literal colour ${lit[0]} (use a role)`);
    // Meridian resets Tailwind's scales; a utility outside them emits no CSS and fails silently.
    const dead = line.match(/\b(?:font-(?:normal|light|bold|extrabold|black|thin)|rounded-(?:2xl|3xl)|shadow-(?:sm|md|lg|xl|2xl)|text-(?:3xl|4xl|5xl))\b/);
    if (dead && !comment) problems.push(`${at}: ${dead[0]} is outside Meridian's scale and renders nothing (use font-regular, rounded-xl, shadow-card…)`);
    // Blur names its token (blur-md, blur-xl) or an arbitrary value; a bare or other name emits no filter.
    const blur = line.match(/\b(?:backdrop-)?blur(?:-(?!md\b|xl\b|\[|\()[a-z0-9]+)?(?![-\w[(])/);
    if (blur && !comment && !/glow-blur/.test(blur.input!.slice(Math.max(0, blur.index! - 6), blur.index! + blur[0].length))) problems.push(`${at}: ${blur[0]} is outside Meridian's blur scale and renders nothing (use backdrop-blur-md or -xl)`);
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
let collectionRows = 0;
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
  collectionRows = covered.size;
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
  for (const f of LAYERS) if (/\brehype-?raw\b/i.test(blankedText(read(f)))) problems.push(`${f}: reaches for rehype-raw; render markdown with Prose, where raw HTML stays text`);
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

// ── A nav item asks its own need, and that need has a shape ───────────────────────────────────────────
// The rail asks each destination's need of the person, and the code that answers it reads two shapes only: the string
// 'public', a grant `object:operation`, or an object whose one key is a non-empty `allOf` of grants. A nav item that
// forgets `needs`, misspells an operation (`keys:manage`, which no collection carries) or nests another `allOf` reaches
// the rail as a need nothing can satisfy, and the page behind it is then reachable by nobody — silently. This is the
// shape of a need, which every project declares in its own grants: the role table is not read, so whatever a project
// grants passes. `src/app.config.ts` is every project's file, so this rule holds in a product too.
const GRANT = /^[a-z][a-z0-9-]*:(read|create|update|remove)$/;

/** Why a nav item's `needs` has no shape the rail can read, as the clause after the item's href, or null when it has one. */
const needProblem = (need: unknown): string | null => {
  if (need === undefined || need === null) return "has no needs; name 'public', a grant such as 'keys:read', or { allOf: [...] }";
  if (need === 'public') return null;
  if (typeof need === 'string') return GRANT.test(need) ? null : `names ${JSON.stringify(need)}, which is not a grant (object:read|create|update|remove)`;
  if (typeof need === 'object' && !Array.isArray(need)) {
    const allOf = (need as { allOf?: unknown }).allOf;
    if (Object.keys(need).length === 1 && Array.isArray(allOf)) {
      if (!allOf.length) return 'has an empty allOf; a need names at least one grant';
      const bad = (allOf as unknown[]).find((g) => typeof g !== 'string' || !GRANT.test(g));
      return bad === undefined ? null : `names ${JSON.stringify(bad)} in its allOf, which is not a grant`;
    }
  }
  return "must be 'public', a grant such as 'keys:read', or { allOf: [...] }";
};

for (const item of nav.flatMap((g) => g.items)) {
  const why = needProblem(item.needs);
  if (why) problems.push(`src/app.config.ts: nav item ${item.href} ${why}`);
}

// ── A sub page names a parent the rail can draw ───────────────────────────────────────────────────────
// A nav item may name its parent with `under`, and the rail draws it as one list nested under that parent. An `under`
// that names nothing of its group, the item itself, an item that is already a sub page (a fourth level), or an item of
// another workspace has no place in that list, so the page would vanish from the rail or hang in the wrong one. A parent
// with more than seven sub pages is a group of its own. The rule is pure and lives in scripts/lib/nav-under.ts.
problems.push(...navUnderProblems(nav));
// A masthead trail names the page's own href, or a detail page's nearest item, which nothing else keeps true when the
// route moves (#102).
problems.push(...navTrailProblems(walk(APP_DIR, /^(page|loading)\.tsx$/).map((f) => ({ file: f, route: specRoute(f), src: blanked(f) })), nav.flatMap((g) => g.items.map((it) => it.href))));

// ── The update session, the keep register and the logo ────────────────────────────────────────────────
// A session under .meridian/update/ must be resolved before the gate passes. With one ready, its candidate manifest
// stands in for the original: the files it will own are what keep, retirements and the dormant-code sweep read.
const manifestFile = path.join(ROOT, '.meridian/manifest.json');
let effective: { route?: string; files: Record<string, string> } | null = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
const retirements: Retirement[] = [];
/** The managed files that are not the release's bytes and that no keep entry explains (`drift:`, printed last). */
let drift: string[] = [];
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
  // Between releases nothing else compares the managed files with their recorded hashes, so an edit nobody recorded a
  // reason for met the team at the next update. An open session accounts for its own differences.
  if (effective && sessions.length === 0) {
    let kept = new Set<string>();
    try { kept = new Set(parseKeep(read('.meridian/keep.json')).map((k) => k.path)); } catch { /* no register, or one reported above */ }
    drift = Object.entries(effective.files).filter(([p, h]) => !kept.has(p) && sha256(p) !== h).map(([p]) => (sha256(p) === null ? `${p} (missing)` : p)).sort();
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
  const sources = [APP_DIR, 'src'].flatMap((d) => walk(d, /\.tsx?$/)).map((f) => f.split(path.sep).join('/'));
  for (const f of sources) {
    if (BOUNDARIES.includes(f)) continue;
    blanked(f).split('\n').forEach((line, i) => {
      if (/\bconnection\s*\(/.test(line)) problems.push(`${f}:${i + 1}: connection() outside the template's three request boundaries`);
    });
  }
  // A page, a view and a logic module read the sample through src/data, so the day it becomes an API is one file's
  // change. Every import specifier counts, a type-only one too; the Atlas, a preview and src/data itself are the
  // sample's own. The shared request cells live under src/system but draw the product's Requests, Home and embed.
  const FIXTURES = 'src/system/fixtures';
  for (const f of sources.filter((x) => (x.startsWith(`${APP_DIR}/`) || x.startsWith('src/views/') || x.startsWith('src/logic/') || x === 'src/system/sample-cells.tsx') && !x.startsWith(`${APP_DIR}/system/`) && !/(^|\/)preview\.tsx$/.test(x))) {
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

// ── The four layers: imports run one way, and a view renders ─────────────────────────────────────────
// src/data reads records and imports neither the logic that derives from them nor the views that draw them; src/logic
// derives from those records and imports no view; src/views draws what it is handed. The direction is decided from
// import specifiers and a view from what it exports. A project turns the rules on in its own scripts/check.local.ts
// (`export const fourLayers = true`). No rule reads a comment to decide anything — the scan is over comment-blanked
// source — except a line's `allow-<rule>: <reason>` escape, which is a declaration and is printed, never silent.
const IMPORTS = /(?:\bfrom|\bimport\s*\(?)\s*['"]([^'"]+)['"]/g;
/** Whether a line states an escape for a rule; when it does, the deviation joins `escapes` and the rule stays quiet. */
const escaped = (rule: string, f: string, line: number, raw: string) => {
  const reason = raw.split('\n')[line - 1]?.match(new RegExp(`allow-${rule}:\\s*(\\S.*?)\\s*$`))?.[1];
  if (!reason) return false;
  escapes.push(`escape  ${f}:${line}: ${rule} — ${reason}`);
  return true;
};
if (fourLayers) {
  for (const [rule, dir, forbidden, why] of [
    ['data-imports-neither', 'src/data', /^src\/(?:logic|views)\//, 'the data layer imports neither src/logic nor src/views'],
    ['logic-does-not-import-views', 'src/logic', /^src\/views\//, 'the logic layer imports no view'],
  ] as const) {
    for (const f of walk(dir, /\.tsx?$/)) {
      const src = blanked(f);
      const raw = read(f);
      for (const m of src.matchAll(IMPORTS)) {
        const spec = m[1];
        const target = importTarget(f, spec, ALIASES) ?? '';
        if (!forbidden.test(target)) continue;
        const line = lineOf(src, m.index + m[0].lastIndexOf(spec));
        if (escaped(rule, f, line, raw)) continue;
        problems.push(`${f}:${line}: imports ${spec} from ${target}; ${why}`);
      }
    }
  }
  // A view renders. A `.tsx` that exports no component, and any non-`.tsx` file but workspaces.ts, is a module in the
  // wrong layer: it produces a value or a sentence where the tree expects a screen. The violation is the file, so its
  // escape sits on the file's first line and the printed escape names that line.
  const CAPITALISED = /^export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class)\s+[A-Z][\w$]*/m;
  const renderer = (f: string, src: string) => {
    if (!f.endsWith('.tsx')) return false;
    if (/^export\s+default\b/m.test(src) || CAPITALISED.test(src)) return true;
    return [...src.matchAll(/^export\s+(type\s+)?\{([^}]*)\}/gm)].some((m) => !m[1] && m[2].split(',').some((part) => {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop() ?? '';
      return /^[A-Z]/.test(name);
    }));
  };
  for (const f of walk('src/views', /\.tsx?$/)) {
    if (f === 'src/views/workspaces.ts') continue;
    const src = blanked(f);
    if (renderer(f, src) || escaped('views-produce-nothing', f, 1, read(f))) continue;
    problems.push(`${f}: is not a renderer; a view is a .tsx that exports a component (a default export or a capitalised named export), or workspaces.ts`);
  }
}

// ── A client module imports no logic module that reads ────────────────────────────────────────────────
// A module with 'use client' runs in a browser. A logic module it imports by value may derive from the records, but the
// chain must not reach a module that READS them: access resolution and a fetch belong on the server. A reading module is
// decided by what it does, not by where it sits — a module under src/data whose own source, comments blanked, calls one
// of `read(`, `readAll(`, `aggregate(`, `collectionFor(`, `resolveAccess(` or `can(`. A pure helper over values a page
// was given (`src/data/verification.ts`) is not one, so `src/logic/tests-context.ts` stays legal. The walk stops at a
// 'use server' module: its module is a reference in the browser and not its body. A project turns this on with the same
// switch as the other four-layer rules; the escape is `allow-client-does-not-import-a-reading-module: <reason>`.
if (fourLayers) {
  const READS = /\b(?:read|readAll|aggregate|collectionFor|resolveAccess|can)\s*\(/;
  /** Comment-blanked source, read once per module: the walk visits the same modules from many clients. */
  const codeOf = new Map<string, string>();
  const code = (f: string) => {
    if (!codeOf.has(f)) codeOf.set(f, blanked(f));
    return codeOf.get(f)!;
  };
  /** The directive a module opens with, past any comment above it. */
  const directive = (f: string) => /^\s*['"]use (client|server)['"]/.exec(code(f))?.[1] ?? null;
  /** A module that reads the company's records. */
  const reading = (f: string) => /^src\/data\//.test(f) && READS.test(code(f));
  /** The chain of value imports from `start` to the first module that reads, or null when it never reaches one. */
  const reachesReading = (start: string): string[] | null => {
    const seen = new Set<string>([start]);
    const queue: string[][] = [[start]];
    while (queue.length) {
      const trail = queue.shift()!;
      for (const { spec } of valueImports(code(trail.at(-1)!))) {
        const next = resolveSpec(trail.at(-1)!, spec);
        if (!next || seen.has(next) || directive(next) === 'server') continue;
        if (reading(next)) return [...trail, next];
        seen.add(next);
        queue.push([...trail, next]);
      }
    }
    return null;
  };
  for (const f of [APP_DIR, 'src'].flatMap((d) => walk(d, /\.tsx?$/))) {
    if (directive(f) !== 'client') continue;
    const src = code(f);
    for (const { spec, at } of valueImports(src)) {
      const target = resolveSpec(f, spec);
      if (!target || !/^src\/logic\//.test(target)) continue;
      // A 'use server' logic module is a reference in the browser, so what it does on the server is not the client's.
      if (directive(target) === 'server') continue;
      const trail = reachesReading(target);
      if (!trail) continue;
      const line = lineOf(src, at);
      if (escaped('client-does-not-import-a-reading-module', f, line, read(f))) continue;
      // Paths as an import writes them: the extension a resolution added is not what the reader is looking for.
      const bare = (m: string) => m.replace(/\.tsx?$/, '');
      problems.push(`${f}:${line}: imports ${spec} from ${bare(target)}, whose imports reach ${bare(trail.at(-1)!)}, a module that reads (${trail.map(bare).join(' -> ')}); a client module imports no logic module that reads`);
    }
  }
}

// ── What is drawn imports no read, and a read is written in one place ────────────────────────────────
// `presentation does not read` refuses a value import from `@/data` in `src/views/**` or `src/components/**` naming any
// module but the five vocabulary modules; `no direct query` refuses a `.query(` call in `app/**`, `src/logic/**`,
// `src/views/**` or `src/lib/**` on a line that states no `allow-no-direct-query:` escape, as the five sites that must query directly do. Both scans live in
// `scripts/lib/layer-rules.ts`, beside the helpers they share with this file, so this managed file stays under the line
// ceiling a project may enforce. Like the rules above, a line may state its escape and the check prints it.
if (fourLayers) {
  for (const [rule, scan] of [
    ['presentation-does-not-read', presentationDoesNotRead],
    ['no-direct-query', noDirectQuery],
  ] as const) {
    for (const p of scan({ root: ROOT, aliases: ALIASES })) {
      if (escaped(rule, p.file, p.line, read(p.file))) continue;
      problems.push(`${p.file}:${p.line}: ${p.message}`);
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
const TOOLKIT = /^src\/lib\/(format|color|collection|explore|live)\.ts$/;
// In a project built on Meridian (adopted or created), Meridian's own modules are a library it uses in part: a newer
// release may add an export the team's code does not use yet. Only the project's own src/lib and src/data are swept.
// The template, with no manifest, is swept whole.
const meridians = new Set(Object.keys(effective?.files ?? {}));
// A root proxy.ts is the product's own code too: Next runs it before every request.
const kept = [...['src', 'app', 'scripts'].flatMap((d) => walk(d, /\.tsx?$/)), ...(fs.existsSync(path.join(ROOT, 'proxy.ts')) ? ['proxy.ts'] : [])].filter((f) => !/(^|\/)preview\.tsx$/.test(f) && !f.startsWith('app/system/') && !atlasOnly.includes(f));
/** For every module: the names a kept importer uses, or '*' when one takes them all. */
const used = new Map<string, Set<string>>();
const record = (f: string | null, name: string) => { if (f) used.set(f, (used.get(f) ?? new Set()).add(name)); };
const recordNames = (f: string | null, clause: string) => {
  for (const part of clause.split(',').map((s) => s.trim()).filter(Boolean)) record(f, part.replace(/^type\s+/, '').split(/\s+as\s+/)[0]);
};
for (const f of kept) {
  const src = blankedText(read(f));
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

judged.push(['a collection\'s rows read through it', collectionRows]);

console.log(problems.join('\n') || 'check: ok');
const none = judged.filter(([, n]) => n === 0).map(([rule]) => rule);
if (none.length) console.log(`judged nothing: ${none.join(', ')}`);
if (escapes.length) console.log(escapes.join('\n'));
if (fourLayersNote) console.log(fourLayersNote);
if (drift.length) console.log(`drift: ${drift.length} managed ${drift.length === 1 ? 'file differs from the release and is' : 'files differ from the release and are'} not in .meridian/keep.json: ${drift.slice(0, 8).join(', ')}${drift.length > 8 ? `, and ${drift.length - 8} more` : ''}. The next update asks about each, and tells a file whose imports are only spelled differently from one you changed; restore a file to the release, or name it in .meridian/keep.json with the reason it differs.`);
console.log(`${problems.length} problems · ${cards().length} cards · ${PAGE_SPECS.length} page specs · ${LAYERS.length} source files`);
process.exit(problems.length ? 1 : 0);
