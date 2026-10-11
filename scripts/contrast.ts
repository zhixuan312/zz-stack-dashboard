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
import { PAIRS } from './lib/contrast-pairs.ts';

/** Every custom property of one context, as raw CSS strings. */
function context(theme: string, accent: string): Record<string, string> {
  const { sets, mods } = resolver();
  const env: Record<string, string> = {};
  for (const f of sets) if (!f.startsWith('palette')) for (const t of tokensOf(load(f))) env[t.name] = cssValue(t);
  for (const t of tokensOf(load(mods.theme.contexts[theme]!))) env[t.name] = cssValue(t);
  const a = load(mods.accent.contexts[accent]!);
  for (const t of tokensOf(a)) env[t.name] = cssValue(t);
  Object.assign(env, Object.fromEntries(Object.entries(a.$extensions?.[NS]?.overrides?.[theme] ?? {}).map(([k, v]) => [k, String(v)])));
  return env;
}

function resolve(env: Record<string, string>, name: string, depth = 0): string {
  if (depth > 8) throw new Error(`cycle at --${name}`);
  let v = env[name];
  if (v === undefined) throw new Error(`--${name} is not defined`);
  v = v.replace(/var\(--([a-z0-9-]+)\)/g, (_, n) => resolve(env, n, depth + 1));
  return v.replace(/calc\(([\d.]+)\s*\*\s*([\d.]+)\)/g, (_, x, y) => String(Number(x) * Number(y)));
}

const colorOf = (env: Record<string, string>, name: string) => parse(resolve(env, name));

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
