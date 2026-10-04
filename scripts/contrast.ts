/**
 * Contrast gate: every foreground the specifications put on a background, computed in every theme x accent
 * (WCAG 2.2 AA), and the categorical chart palette held to the dataviz checks in both themes.
 *
 *   node scripts/contrast.ts [--all]   prints failures (every pair with --all); exit 1 on any failure
 *
 * Text needs 4.5:1; focus rings, control outlines and chart marks need 3:1 (WCAG 1.4.11). Translucent colours
 * are composited over the background they sit on, which is itself composited over the ground.
 */
import { load, resolver, tokensOf, cssValue, NS } from './tokens.ts';
import { parse, over, ratio, simulate, deltaE, oklchOf, hex } from '../src/lib/color.ts';

const TEXT = 4.5, UI = 3;
type Pair = [fg: string, bg: string | string[], min: number, what: string];

export const PAIRS: Pair[] = [
  ['ink', 'ground', TEXT, 'body text on the page'],
  ['ink', 'surface', TEXT, 'body text in a card'],
  ['ink', 'surface-raised', TEXT, 'text in a menu or dialog'],
  ['ink-2', 'ground', TEXT, 'secondary copy on the page'],
  ['ink-2', 'surface', TEXT, 'secondary copy and inactive navigation'],
  ['ink-2', 'surface-sunk', TEXT, 'a segmented option at rest'],
  ['ink-2', ['frame'], TEXT, 'inactive navigation in the rail'],
  ['ink-3', ['frame'], TEXT, 'a group label in the rail'],
  ['accent-ink', ['frame', 'accent-tint'], TEXT, 'the active navigation label in the rail'],
  ['ink-3', 'ground', TEXT, 'captions on the page'],
  ['ink-3', 'surface', TEXT, 'axis ticks, captions and placeholders in a card'],
  ['ink-3', 'surface-sunk', TEXT, 'a table head'],
  ['ink-3', 'surface-raised', TEXT, 'a shortcut hint in a menu'],
  ['ink', ['surface', 'fill-hover'], TEXT, 'a row under the pointer'],
  ['ink-inverse', 'surface-inverse', TEXT, 'tooltip text'],
  ['on-accent', 'accent', TEXT, 'primary button label'],
  ['on-accent', 'accent-hover', TEXT, 'primary button label on hover'],
  ['accent-ink', 'surface', TEXT, 'an inline link in a card'],
  ['accent-ink', 'ground', TEXT, 'an inline link on the page'],
  ['accent-ink', ['surface', 'accent-tint'], TEXT, 'the active navigation label'],
  ['ink', ['surface', 'accent-tint'], TEXT, 'a selected row'],
  ['ink-2', ['surface', 'accent-tint'], TEXT, 'muted text in a selected row or on an accent wash (ink-3 is not enough there)'],
  ['ink-2', ['surface', 'fill-track'], TEXT, 'a count on an inactive tab'],
  ['positive-ink', 'surface', TEXT, 'an improving delta'],
  ['positive-ink', ['surface', 'positive-tint'], TEXT, 'a positive badge'],
  ['warning-ink', 'surface', TEXT, 'a warning message'],
  ['warning-ink', ['surface', 'warning-tint'], TEXT, 'a warning badge'],
  ['critical-ink', 'surface', TEXT, 'an error message'],
  ['critical-ink', 'ground', TEXT, 'an error under a field on the page'],
  ['critical-ink', ['surface', 'critical-tint'], TEXT, 'a critical badge'],
  ['on-critical', 'critical-fill', TEXT, 'the destructive button label'],
  ['accent', 'surface', UI, 'focus ring, active marker and the highlighted mark in a card'],
  ['accent', 'ground', UI, 'focus ring on the page'],
  ['line-control', 'surface', UI, 'a checkbox or radio at rest'],
  ['positive', 'surface', UI, 'a positive status dot'],
  ['warning', 'surface', UI, 'a warning status dot'],
  ['critical', 'surface', UI, 'a critical status dot'],
  ['chart-neutral-strong', 'surface', UI, 'a neutral comparison line'],
  ['series-1', 'surface', UI, 'chart slot 1'],
  ['series-2', 'surface', UI, 'chart slot 2'],
  ['series-3', 'surface', UI, 'chart slot 3'],
  ['series-4', 'surface', UI, 'chart slot 4'],
  ['series-6', 'surface', UI, 'chart slot 6'],
];

/** Every custom property of one context, as raw CSS strings. */
export function context(theme: string, accent: string): Record<string, string> {
  const { sets, mods } = resolver();
  const env: Record<string, string> = {};
  for (const f of sets) if (!f.startsWith('palette')) for (const t of tokensOf(load(f))) env[t.name] = cssValue(t);
  for (const t of tokensOf(load(mods.theme.contexts[theme]!))) env[t.name] = cssValue(t);
  const a = load(mods.accent.contexts[accent]!);
  for (const t of tokensOf(a)) env[t.name] = cssValue(t);
  Object.assign(env, Object.fromEntries(Object.entries(a.$extensions?.[NS]?.overrides?.[theme] ?? {}).map(([k, v]) => [k, String(v)])));
  return env;
}

export function resolve(env: Record<string, string>, name: string, depth = 0): string {
  if (depth > 8) throw new Error(`cycle at --${name}`);
  let v = env[name];
  if (v === undefined) throw new Error(`--${name} is not defined`);
  v = v.replace(/var\(--([a-z0-9-]+)\)/g, (_, n) => resolve(env, n, depth + 1));
  return v.replace(/calc\(([\d.]+)\s*\*\s*([\d.]+)\)/g, (_, x, y) => String(Number(x) * Number(y)));
}

export const colorOf = (env: Record<string, string>, name: string) => parse(resolve(env, name));

function measure(env: Record<string, string>, fg: string, bg: string | string[]) {
  let back = colorOf(env, 'ground');
  for (const layer of Array.isArray(bg) ? bg : [bg]) back = over(colorOf(env, layer), back);
  return ratio(over(colorOf(env, fg), back), back);
}

/** The dataviz checks on the categorical slots: lightness band, chroma floor, adjacent CVD and normal-vision separation. */
function palette(theme: string) {
  const env = context(theme, resolver().mods.accent.default);
  const slots = [1, 2, 3, 4, 5, 6].map((i) => colorOf(env, `series-${i}`));
  const band = theme === 'light' ? [0.43, 0.77] : [0.48, 0.67];
  const fails: string[] = [];
  slots.forEach((c, i) => {
    const { L, C } = oklchOf(c);
    if (L < band[0] - 0.005 || L > band[1] + 0.005) fails.push(`series-${i + 1} ${hex(c)} lightness ${L.toFixed(3)} outside ${band.join('-')}`);
    if (C < 0.1) fails.push(`series-${i + 1} ${hex(c)} chroma ${C.toFixed(3)} under 0.10`);
  });
  let worstCvd = Infinity, worstNormal = Infinity;
  for (let i = 0; i < slots.length - 1; i++) {
    const [a, b] = [slots[i], slots[i + 1]];
    worstNormal = Math.min(worstNormal, deltaE(a, b));
    for (const k of ['protan', 'deutan'] as const) worstCvd = Math.min(worstCvd, deltaE(simulate(a, k), simulate(b, k)));
  }
  if (worstCvd < 8) fails.push(`adjacent CVD separation ${worstCvd.toFixed(1)} under 8`);
  if (worstNormal < 15) fails.push(`adjacent normal-vision separation ${worstNormal.toFixed(1)} under 15`);
  return { fails, worstCvd, worstNormal };
}

function main() {
  const all = process.argv.includes('--all');
  const { mods } = resolver();
  let fails = 0, count = 0;
  for (const theme of Object.keys(mods.theme.contexts)) {
    for (const accent of Object.keys(mods.accent.contexts)) {
      const env = context(theme, accent);
      for (const [fg, bg, min, what] of PAIRS) {
        const r = measure(env, fg, bg);
        count++;
        const ok = r >= min;
        if (!ok) fails++;
        if (all || !ok) console.log(`${ok ? 'ok  ' : 'FAIL'} ${theme.padEnd(5)} ${accent.padEnd(8)} ${r.toFixed(2).padStart(5)}:1 (needs ${min})  ${fg} on ${[bg].flat().join('+')}: ${what}`);
      }
    }
    const p = palette(theme);
    fails += p.fails.length;
    for (const f of p.fails) console.log(`FAIL ${theme} chart palette: ${f}`);
    if (all) console.log(`ok   ${theme} chart palette: worst adjacent CVD ${p.worstCvd.toFixed(1)}, normal ${p.worstNormal.toFixed(1)}`);
  }
  console.log(`contrast: ${count} pairs across every theme and accent, ${fails} failures`);
  process.exit(fails ? 1 : 0);
}

if (import.meta.main) main();
