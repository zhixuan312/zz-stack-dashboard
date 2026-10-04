/* eslint-disable @typescript-eslint/no-explicit-any -- DTCG token JSON files have no types; this file runs in Node, never in a page. */
/**
 * Generate the CSS of Layer 0 from the DTCG 2025.10 token files in tokens/.
 *
 *   node scripts/tokens.ts           write src/styles/tokens.css and src/styles/theme.css
 *   node scripts/tokens.ts --check   exit 1 if either file is out of date
 *
 * tokens.css holds the custom properties: core and the default theme (dark) on :root, the other theme under its
 * prefers-color-scheme query and under its [data-theme], each accent preset under [data-accent], and the
 * compact density under [data-density="compact"]. theme.css maps them into Tailwind v4 (`@theme inline`), after
 * resetting Tailwind's own scales, so a utility can only ever name a Meridian value.
 * Values DTCG cannot type (clamp(), oklch() built from variables, em tracking) keep their nearest typed value in
 * $value and the exact CSS in $extensions["dev.zz.meridian"].css.
 */
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
const T = path.join(ROOT, 'tokens');
export const NS = 'dev.zz.meridian';

type Json = Record<string, any>;
export type Token = { name: string; group: string; type: string; value: any; description: string; css?: string; raw: Json };

export function load(file: string): Json {
  return JSON.parse(fs.readFileSync(path.join(T, file), 'utf8'));
}

/** The resolver: the always-on sets, and each modifier's default and contexts. */
export function resolver() {
  const r = load('zz-meridian.resolver.json');
  const sets: string[] = Object.values(r.sets as Json).map((s: any) => s.sources[0].$ref);
  const mods: Record<string, { default: string; contexts: Record<string, string | null> }> = {};
  for (const [name, m] of Object.entries(r.modifiers as Json)) {
    mods[name] = { default: m.default, contexts: Object.fromEntries(Object.entries(m.contexts as Json).map(([k, v]: [string, any]) => [k, v[0]?.$ref ?? null])) };
  }
  return { sets, mods };
}

/** Tokens of a file, in file order, one level of groups deep (group -> token). */
export function tokensOf(file: Json): Token[] {
  const out: Token[] = [];
  for (const [group, g] of Object.entries(file)) {
    if (group.startsWith('$') || typeof g !== 'object') continue;
    for (const [name, t] of Object.entries(g as Json)) {
      if (name.startsWith('$')) continue;
      out.push({ name, group, type: t.$type, value: t.$value, description: t.$description ?? '', css: t.$extensions?.[NS]?.css, raw: t });
    }
  }
  return out;
}

function lookup(alias: string): any {
  const pal = load('palette.tokens.json');
  let node: any = pal;
  for (const part of alias.slice(1, -1).split('.')) node = node[part];
  return node.$value;
}

const num = (x: number) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 10000) / 10000));
const dim = (d: { value: number; unit: string }) => (d.value === 0 ? '0' : num(d.value) + d.unit);

function color(v: any): string {
  if (typeof v === 'string') v = lookup(v);
  if (v.alpha !== undefined && v.alpha < 1) {
    const h = v.hex;
    return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${num(v.alpha)})`;
  }
  return v.hex;
}

export function cssValue(t: Token): string {
  if (t.css) return t.css;
  const v = t.value;
  switch (t.type) {
    case 'color': return color(v);
    case 'dimension': return dim(v);
    case 'duration': return num(v.value) + v.unit;
    case 'cubicBezier': return `cubic-bezier(${v.map(num).join(',')})`;
    case 'fontFamily': return v.map((f: string) => (/\s/.test(f) ? `"${f}"` : f)).join(',');
    case 'fontWeight': case 'number': return num(v);
    case 'shadow': return (Array.isArray(v) ? v : [v]).map((s: any) =>
      [s.inset ? 'inset' : '', dim(s.offsetX), dim(s.offsetY), dim(s.blur), s.spread?.value ? dim(s.spread) : '', color(s.color)].filter(Boolean).join(' ')).join(',');
  }
  throw new Error(`cannot write a ${t.type} token (${t.name})`);
}

const decls = (ts: Token[], indent: string) => {
  const out: string[] = [];
  let group = '';
  for (const t of ts) {
    if (t.group !== group) { group = t.group; out.push(`${indent}/* ${group} */`); }
    out.push(`${indent}--${t.name}:${cssValue(t)};`);
  }
  return out;
};
const block = (sel: string, body: string[], scheme?: string) => [`${sel}{`, ...(scheme ? [`  color-scheme:${scheme};`] : []), ...body, '}'];
/**
 * The embed bridge: on the MCP Apps surface, Meridian's neutral roles take the host's standard style variables, with
 * Meridian's own value for the theme as the fallback. Accent, status and chart colours never bridge: they carry meaning.
 */
export const BRIDGE: Record<string, string> = {
  surface: '--color-background-primary',
  'surface-sunk': '--color-background-secondary',
  'surface-raised': '--color-background-primary',
  ink: '--color-text-primary',
  'ink-2': '--color-text-secondary',
  'ink-3': '--color-text-tertiary',
  line: '--color-border-primary',
  'line-strong': '--color-border-secondary',
  'radius-lg': '--border-radius-lg',
  'radius-md': '--border-radius-md',
};

const isRole = (t: Token) => /var\(--accent-[hc]\)/.test(t.css ?? '');

const HEADER = `/* ZZ Meridian · Layer 0 · Tokens
 *
 * GENERATED by scripts/tokens.ts from tokens/*.tokens.json (W3C DTCG 2025.10). Edit the token files, not this one.
 *
 * Five layers, each using only the layers beneath it:
 *   0 Tokens      this file: values only, no selectors but the theme, accent and density scopes
 *   1 Base        src/styles/base.css and src/components/base: the ground, text roles, the shell and the grid
 *   2 Components  src/components/ui: single-purpose parts that never know which page they are on
 *   3 Patterns    src/components/patterns and charts: components composed for one dashboard job
 *   4 Pages       app/(dashboard): routes, each an arrangement of patterns, with no styling of their own
 *
 * Three independent modifiers, each settable on the root or on any subtree:
 *   data-theme="dark|light"         dark on :root; unset, the operating system may ask for light
 *   data-accent="indigo|cobalt|jade|graphite"   indigo by default
 *   data-density="comfortable|compact"        comfortable by default
 */
`;

export function buildCss(): string {
  const { sets, mods } = resolver();
  const core = sets.flatMap((f) => (f.startsWith('palette') ? [] : tokensOf(load(f))));
  const theme = (n: string) => tokensOf(load(mods.theme.contexts[n]!));
  const first = mods.theme.default;
  const second = Object.keys(mods.theme.contexts).find((n) => n !== first)!;
  const main = theme(first), other = theme(second);
  const roles = main.filter(isRole);
  const accents = Object.entries(mods.accent.contexts).map(([n, f]) => ({ n, file: load(f!) }));
  const def = accents.find((a) => a.n === mods.accent.default)!;
  const L: string[] = [HEADER];

  L.push(...block(':root', [...decls(core, '  '), ...decls(main, '  '), '  /* accent preset */', ...decls(tokensOf(def.file), '  ')], first), '');
  L.push(`/* The ${second} theme, when the operating system asks for it and the page has not chosen. */`);
  L.push(`@media (prefers-color-scheme:${second}){`, ...block(`:root:not([data-theme="${first}"])`, decls(other, '    '), second).map((l) => '  ' + l), '}');
  L.push('/* A theme chosen explicitly, on the root or on any subtree. */');
  L.push(...block(`[data-theme="${second}"]`, decls(other, '  '), second));
  L.push(...block(`[data-theme="${first}"]`, decls(main, '  '), first), '');

  L.push('/* Accent presets. A preset sets two numbers; the roles are declared again on every scope that changes them,');
  L.push('   because a custom property resolves its var() where it is declared, not where it is used. */');
  for (const a of accents) {
    L.push(...block(`[data-accent="${a.n}"]`, decls(tokensOf(a.file), '  ')));
    const ov = a.file.$extensions?.[NS]?.overrides;
    if (ov) {
      const o = (m: Json) => Object.entries(m).map(([k, v]) => `  --${k}:${v};`);
      const s = `[data-accent="${a.n}"]`;
      L.push(...block(`${s},${s} [data-theme="${first}"]`, o(ov[first] ?? {})));
      L.push(`@media (prefers-color-scheme:${second}){`, ...block(`:root:not([data-theme="${first}"])${s},:root:not([data-theme="${first}"]) ${s}`, o(ov[second] ?? {})).map((l) => '  ' + l), '}');
      L.push(...block(`[data-theme="${second}"]${s},[data-theme="${second}"] ${s},${s} [data-theme="${second}"]`, o(ov[second] ?? {})));
    }
  }
  L.push(...block('[data-theme],[data-accent]', decls(roles, '  ')), '');

  L.push('/* The embed surface (MCP Apps): transparent planes, and the host\'s neutrals with Meridian\'s as the fallback. */');
  const bridge = (ts: Token[]) => ['  --frame:transparent;', '  --ground:transparent;', ...Object.entries(BRIDGE).map(([k, v]) => {
    const t = ts.find((x) => x.name === k) ?? core.find((x) => x.name === k)!;
    return `  --${k}:var(${v}, ${cssValue(t)});`;
  })];
  L.push(...block('[data-surface="embed"]', bridge(main)));
  L.push(...block(`[data-surface="embed"][data-theme="${second}"]`, bridge(other)), '');

  L.push('/* Density. */');
  for (const [n, f] of Object.entries(mods.density.contexts)) if (f) L.push(...block(`[data-density="${n}"]`, decls(tokensOf(load(f)), '  ')));
  return L.join('\n') + '\n';
}

/** Tailwind v4 bridge: reset Tailwind's scales, then expose only Meridian's names as utilities. */
export function buildTheme(): string {
  const { sets, mods } = resolver();
  const core = sets.flatMap((f) => (f.startsWith('palette') ? [] : tokensOf(load(f))));
  const light = tokensOf(load(mods.theme.contexts.light!));
  const colors = light.filter((t) => t.type === 'color').map((t) => t.name);
  const by = (g: string) => core.filter((t) => t.group === g);
  const L = [
    '/* ZZ Meridian · the Tailwind v4 bridge. GENERATED by scripts/tokens.ts. Edit tokens/, not this file.',
    ' *',
    ' * Tailwind\'s own palette, type scale, radii, shadows and curves are reset, so a utility can only name a',
    ' * Meridian value: `bg-surface`, `text-ink-2`, `border-line`, `rounded-lg`, `text-sm`, `shadow-overlay`.',
    ' * Spacing is Tailwind\'s 4px multiplier (`p-6` is 24px), which is the Meridian scale. */',
    '@theme {',
    '  --color-*: initial;', '  --font-*: initial;', '  --text-*: initial;', '  --radius-*: initial;', '  --shadow-*: initial;',
    '  --inset-shadow-*: initial;', '  --drop-shadow-*: initial;', '  --ease-*: initial;', '  --tracking-*: initial;', '  --leading-*: initial;',
    '  --font-weight-*: initial;', '  --blur-*: initial;', '  --animate-*: initial;',
    '  --spacing: 4px;',
    '  --breakpoint-sm: 640px;', '  --breakpoint-md: 768px;', '  --breakpoint-lg: 1024px;', '  --breakpoint-xl: 1280px;', '  --breakpoint-2xl: 1600px;',
    '}',
    '@theme inline {',
    '  --color-transparent: transparent;', '  --color-current: currentColor;',
    ...colors.map((c) => `  --color-${c}: var(--${c});`),
    '  --font-sans: var(--font-sans);', '  --font-mono: var(--font-mono);',
    ...by('type').filter((t) => t.name.startsWith('text-')).map((t) => `  --${t.name}: var(--${t.name});`),
    ...by('type').filter((t) => t.name.startsWith('weight-')).map((t) => `  --font-weight-${t.name.slice(7)}: var(--${t.name});`),
    ...by('type').filter((t) => t.name.startsWith('leading-')).map((t) => `  --${t.name}: var(--${t.name});`),
    ...by('type').filter((t) => t.name.startsWith('tracking-')).map((t) => `  --${t.name}: var(--${t.name});`),
    ...by('radius').map((t) => `  --${t.name}: var(--${t.name});`),
    ...by('blur').map((t) => `  --${t.name}: var(--${t.name});`),
    ...light.filter((t) => t.type === 'shadow').map((t) => `  --${t.name}: var(--${t.name});`),
    ...by('motion').filter((t) => t.type === 'cubicBezier').map((t) => `  --${t.name}: var(--${t.name});`),
    '}',
  ];
  return L.join('\n') + '\n';
}

function main() {
  const out = { 'src/styles/tokens.css': buildCss(), 'src/styles/theme.css': buildTheme() };
  let stale = 0;
  for (const [file, css] of Object.entries(out)) {
    const p = path.join(ROOT, file);
    if (process.argv.includes('--check')) {
      if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== css) { console.log(`${file} is out of date: run node scripts/tokens.ts`); stale++; }
    } else {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, css);
      console.log(`${file}: ${css.length} bytes`);
    }
  }
  if (process.argv.includes('--check')) { console.log(stale ? '' : 'tokens: up to date'); process.exit(stale ? 1 : 0); }
}

if (import.meta.main) main();
