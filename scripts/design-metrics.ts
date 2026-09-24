/**
 * Design metrics — measures the visual system of every page.
 *
 * The layout audit (layout-audit.ts) asks "is it broken?". This asks "is it
 * disciplined?" — a page can pass every structural invariant and still use 19
 * font sizes, 6 shadow recipes and 4 radii.
 *
 * What it counts:
 *
 *   TYPE SCALE      distinct font-size values in use. A system has ~7.
 *   WEIGHTS         distinct font-weight values. Four is the ceiling.
 *   RADII           distinct border-radius values.
 *   SHADOWS         distinct box-shadow recipes.
 *   OFF-SCALE SPACE padding/gap values that are not on the spacing scale.
 *   INK LADDER      distinct text colours. A ladder has 3-4 rungs.
 *   ACCENTS         distinct saturated (non-neutral) colours actually painted.
 *                   One accent plus a reserved status trio is the discipline.
 *   CONTRAST        text failing WCAG AA (4.5:1 body, 3:1 large).
 *   HIERARCHY       largest text on the page vs the median.
 *
 * Run: AUDIT_BASE=https://<console host> AUDIT_TOKEN=zzp_… node scripts/design-metrics.ts
 *      (a deployment: every page reads /api/console, which a dev server does not serve)
 */

const BASE = process.env.AUDIT_BASE ?? 'http://127.0.0.1:3000';

// Routes come from src/nav.ts, the way layout-audit.ts does it: a hardcoded list goes stale
// silently and the audit keeps reporting on pages that are not there. As in layout-audit, this
// refuses to run when it finds no route — an audit that visits nothing would pass by visiting
// nothing.
import { readFileSync } from 'node:fs';

const PERIODS = new Set(['/', '/activity']);
const navSource = readFileSync(new URL('../src/nav.ts', import.meta.url), 'utf8');
const PAGES = [...navSource.matchAll(/href:\s*'([^']+)'/g)]
  .map((m) => m[1])
  .map((href) => [
    href === '/' ? 'overview' : href.replace(/^\//, ''),
    PERIODS.has(href) ? `${href}${href.includes('?') ? '&' : '?'}period=90d` : href,
  ]);
if (!PAGES.length) {
  console.error('no routes found in src/nav.ts — the audit would pass by visiting nothing');
  process.exit(2);
}

const VIEWPORT = { width: 1440, height: 900 };

/** The spacing scale a value must land on to count as "in the system". */
const SCALE = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96];

/** A colour read back off the page, always with an alpha. */
interface Rgba { r: number; g: number; b: number; a: number }
/** How often one value appears, and a scrap of the first element wearing it. */
interface Tally { n: number; sample: string }

function measureInPage(scale: number[]) {
  const px = (v: string): number => Math.round(parseFloat(v) || 0);

  const fontSizes = new Map<number, Tally>();
  const weights = new Map<string, Tally>();
  const radii = new Map<number, Tally>();
  const shadows = new Map<string, Tally>();
  const inks = new Map<string, Tally>();
  const paints = new Map<string, Tally>();
  const offScale = new Map<string, Tally>();
  const contrastFails: string[] = [];

  // ---- colour helpers -------------------------------------------------
  const parse = (c: string): Rgba | null => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const p = m[1].split(',').map((n: string) => parseFloat(n));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }: Rgba): number => {
    const f = (v: number): number => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a: Rgba, b: Rgba): number => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const over = (fg: Rgba, bg: Rgba): Rgba =>
    fg.a >= 1
      ? fg
      : {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1,
        };
  /** Saturated = the max-min channel spread is large enough to read as a hue. */
  const saturated = (c: Rgba): boolean => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 26;

  const effectiveBg = (el: Element): Rgba => {
    let n: Element | null = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.85) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const bump = <K,>(map: Map<K, Tally>, key: K, el: Element): void => {
    const rec = map.get(key) ?? { n: 0, sample: '' };
    rec.n += 1;
    if (!rec.sample) {
      const t = (el.textContent || '').trim().slice(0, 24);
      rec.sample = t || el.tagName.toLowerCase();
    }
    map.set(key, rec);
  };

  const all = [...document.querySelectorAll('*')];
  const textSizes: number[] = [];

  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.closest('.sr-only') || el.closest('svg')) continue;

    // Only count type on elements that actually own visible text.
    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => (n.textContent ?? '').trim())
      .join('');
    if (ownText) {
      const fs = px(cs.fontSize);
      bump(fontSizes, fs, el);
      bump(weights, cs.fontWeight, el);
      bump(inks, cs.color, el);
      textSizes.push(fs);

      const fg = parse(cs.color);
      const bg = effectiveBg(el);
      if (fg) {
        const c = ratio(over(fg, bg), bg);
        const large = fs >= 24 || (fs >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
        const need = large ? 3 : 4.5;
        if (c < need) {
          contrastFails.push(
            `${c.toFixed(2)}:1 (needs ${need}) — ${fs}px "${ownText.slice(0, 32)}"`,
          );
        }
      }
      if (fg && saturated(fg)) bump(paints, cs.color, el);
    }

    // Radius, shadow — only where a surface is actually drawn.
    const hasSurface =
      (parse(cs.backgroundColor)?.a ?? 0) > 0.02 || cs.borderTopWidth !== '0px';
    if (hasSurface) {
      const rad = px(cs.borderTopLeftRadius);
      if (rad > 0) bump(radii, rad, el);
      const bgc = parse(cs.backgroundColor);
      if (bgc && bgc.a > 0.2 && saturated(bgc)) bump(paints, cs.backgroundColor, el);
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') bump(shadows, cs.boxShadow, el);

    // Off-scale spacing. `.prose` is exempt: the typography plugin sets its internal rhythm in
    // `em`, so a list indent computes to 4.5px at 12px type and 6px at 16px — correct
    // typography, deliberately not on a pixel scale.
    if (el.closest('.prose')) continue;
    const SPACING = ['paddingTop', 'paddingLeft', 'gap', 'rowGap', 'columnGap'] as const;
    for (const prop of SPACING) {
      const raw = cs[prop];
      if (!raw || raw === 'normal') continue;
      const v = px(raw);
      if (v > 0 && !scale.includes(v)) {
        bump(offScale, `${v}px (${prop})`, el);
      }
    }
  }

  textSizes.sort((a, b) => a - b);
  const median = textSizes[Math.floor(textSizes.length / 2)] ?? 0;
  const max = textSizes[textSizes.length - 1] ?? 0;

  const top = <K,>(map: Map<K, Tally>, n = 99): string[] =>
    [...map.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, n)
      .map(([k, v]) => `${k} ×${v.n}`);

  return {
    fontSizes: top(fontSizes),
    weights: top(weights),
    radii: top(radii),
    shadows: top(shadows, 8),
    inks: top(inks),
    paints: top(paints, 12),
    offScale: top(offScale, 12),
    contrastFails: [...new Set(contrastFails)].slice(0, 12),
    hierarchy: { median, max, ratio: median ? +(max / median).toFixed(2) : 0 },
  };
}

let puppeteer;
try {
  ({ default: puppeteer } = await import('puppeteer'));
} catch {
  console.error('puppeteer is not installed — run `pnpm install`.');
  process.exit(2);
}

// `true` is the new headless. 'new' was puppeteer 20's spelling and has not been a
// documented value since 22; it still worked only because every branch tests === 'shell'.
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport(VIEWPORT);
// A superadmin platform token authenticates every request the page makes, as in layout-audit.ts.
if (process.env.AUDIT_TOKEN) {
  await page.setExtraHTTPHeaders({ authorization: `Bearer ${process.env.AUDIT_TOKEN}` });
}

/**
 * One theme, so there is one measurement. There is no dark mode to audit.
 *
 * Contrast is `scripts/verify-contrast.ts`'s job: it checks enumerated pairs against the tokens
 * and exits non-zero. This measures discipline and its exit code stays advisory.
 */

const union = {
  fontSizes: new Set<string>(),
  weights: new Set<string>(),
  radii: new Set<string>(),
  shadows: new Set<string>(),
  inks: new Set<string>(),
  paints: new Set<string>(),
  offScale: new Set<string>(),
};
let totalContrastFails = 0;

let vacuous = 0;
for (const [name, path] of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 120_000 });
  // Guard against a vacuous pass: a run without AUDIT_TOKEN lands on /login and every number
  // describes the sign-in screen. Numbers about the wrong page look like an answer, so it fails
  // instead.
  if (new URL(page.url()).pathname.startsWith('/login')) {
    console.error(`  FAIL ${name}: landed on /login — this audit is not authenticated`);
    vacuous += 1;
    continue;
  }
  await new Promise((r) => setTimeout(r, 400));
  const m = await page.evaluate(measureInPage, SCALE);

  const bare = (arr: string[]): string[] => arr.map((s) => s.replace(/ ×\d+$/, ''));
  bare(m.fontSizes).forEach((v) => union.fontSizes.add(v));
  bare(m.weights).forEach((v) => union.weights.add(v));
  bare(m.radii).forEach((v) => union.radii.add(v));
  bare(m.shadows).forEach((v) => union.shadows.add(v));
  bare(m.inks).forEach((v) => union.inks.add(v));
  bare(m.paints).forEach((v) => union.paints.add(v));
  bare(m.offScale).forEach((v) => union.offScale.add(v));
  totalContrastFails += m.contrastFails.length;

  console.log(`\n━━ ${name} ${'━'.repeat(Math.max(0, 60 - name.length))}`);
  console.log(`  type sizes  (${m.fontSizes.length})  ${m.fontSizes.join('  ')}`);
  console.log(`  weights     (${m.weights.length})  ${m.weights.join('  ')}`);
  console.log(`  radii       (${m.radii.length})  ${m.radii.join('  ')}`);
  console.log(`  shadows     (${m.shadows.length})`);
  for (const s of m.shadows) console.log(`      ${s.slice(0, 96)}`);
  console.log(`  ink ladder  (${m.inks.length})  ${m.inks.join('  ')}`);
  console.log(`  paints      (${m.paints.length})  ${m.paints.join('  ')}`);
  console.log(`  off-scale   (${m.offScale.length})  ${m.offScale.join('  ')}`);
  console.log(
    `  hierarchy   max ${m.hierarchy.max}px / median ${m.hierarchy.median}px = ${m.hierarchy.ratio}×`,
  );
  if (m.contrastFails.length) {
    console.log(`  CONTRAST FAILS (${m.contrastFails.length})`);
    for (const f of m.contrastFails) console.log(`      ${f}`);
  }
}

await browser.close();

console.log(`\n${'═'.repeat(64)}\nWHOLE-APP TOTALS`);
console.log(`  distinct type sizes   ${union.fontSizes.size}   ${[...union.fontSizes].sort((a, b) => Number(a) - Number(b)).join(' ')}`);
console.log(`  distinct weights      ${union.weights.size}   ${[...union.weights].sort().join(' ')}`);
console.log(`  distinct radii        ${union.radii.size}   ${[...union.radii].sort((a, b) => Number(a) - Number(b)).join(' ')}`);
console.log(`  distinct shadows      ${union.shadows.size}`);
console.log(`  distinct text inks    ${union.inks.size}`);
console.log(`  distinct paints       ${union.paints.size}`);
console.log(`  off-scale spacings    ${union.offScale.size}   ${[...union.offScale].join(' ')}`);
console.log(`  contrast failures     ${totalContrastFails}`);
if (vacuous) {
  console.error(`\n  ${vacuous} of ${PAGES.length} page(s) redirected to /login — every metric above is ` +
                `about the sign-in screen. Set AUDIT_TOKEN to a superadmin platform token.`);
  process.exit(1);
}
