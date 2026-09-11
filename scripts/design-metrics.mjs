/**
 * Design metrics — measures the VISUAL system of every page, so "this looks
 * unprofessional" becomes a number you can argue with.
 *
 * The layout audit (layout-audit.mjs) asks "is it broken?". This asks "is it
 * disciplined?" — a page can pass every structural invariant and still look
 * amateur because it uses 19 font sizes, 6 shadow recipes and 4 radii.
 *
 * What it counts, and why each one is a proxy for craft:
 *
 *   TYPE SCALE      distinct font-size values in use. A system has ~7. A page
 *                   with 15 was authored by eyeballing, and it reads that way.
 *   WEIGHTS         distinct font-weight values. Four is the ceiling.
 *   RADII           distinct border-radius values. Mixed radii are the single
 *                   most common tell of an unsystematised UI.
 *   SHADOWS         distinct box-shadow recipes. Blurred shadows at multiple
 *                   depths read as consumer-soft; one or two hard offsets read
 *                   as instrument-grade.
 *   OFF-SCALE SPACE padding/gap values that are not on the spacing scale.
 *                   "If it is not on the scale, it is not in the system."
 *   INK LADDER      distinct text colours. A ladder has 3-4 rungs; 9 means
 *                   nobody decided.
 *   ACCENTS         distinct saturated (non-neutral) colours actually painted.
 *                   One accent plus a reserved status trio is the discipline.
 *   CONTRAST        text failing WCAG AA (4.5:1 body, 3:1 large).
 *   HIERARCHY       largest text on the page vs the median. A page whose
 *                   biggest element is only slightly bigger than its body has
 *                   no dominant object, and the eye has nowhere to land.
 *
 * Run: node scripts/design-metrics.mjs   (dev server must be running)
 */

const BASE = process.env.AUDIT_BASE ?? 'http://127.0.0.1:3000';

// FROM src/nav.ts, the way layout-audit.mjs already does it, and for the reason it says: a
// hardcoded list goes stale silently and the audit keeps reporting on pages that are not there.
// This one had — /records, /health and /components stopped existing, so three of its six pages
// were 404s, and the "contrast failures" it reported were measured on the error page.
//
// layout-audit refuses to run when it finds no route ("the audit would pass by visiting
// nothing"). Same guard here: an audit that visits nothing is worse than one that fails.
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

function measureInPage(scale) {
  const px = (v) => Math.round(parseFloat(v) || 0);

  const fontSizes = new Map();
  const weights = new Map();
  const radii = new Map();
  const shadows = new Map();
  const inks = new Map();
  const paints = new Map();
  const offScale = new Map();
  const contrastFails = [];

  // ---- colour helpers -------------------------------------------------
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const p = m[1].split(',').map((n) => parseFloat(n));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const over = (fg, bg) =>
    fg.a >= 1
      ? fg
      : {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1,
        };
  /** Saturated = the max-min channel spread is large enough to read as a hue. */
  const saturated = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 26;

  const effectiveBg = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.85) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const bump = (map, key, el) => {
    const rec = map.get(key) ?? { n: 0, sample: '' };
    rec.n += 1;
    if (!rec.sample) {
      const t = (el.textContent || '').trim().slice(0, 24);
      rec.sample = t || el.tagName.toLowerCase();
    }
    map.set(key, rec);
  };

  const all = [...document.querySelectorAll('*')];
  const textSizes = [];

  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.closest('.sr-only') || el.closest('svg')) continue;

    // Only count type on elements that actually own visible text.
    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
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

    // Off-scale spacing.
    //
    // `.prose` is exempt. The typography plugin sets its internal rhythm in `em`,
    // so a list indent computes to 4.5px at 12px type and 6px at 16px — correct
    // typography, and deliberately NOT on a pixel scale. Holding rendered
    // markdown to the app's px grid would mean overriding a plugin that is doing
    // the right thing, to satisfy a check that is asking the wrong question.
    if (el.closest('.prose')) continue;
    for (const prop of ['paddingTop', 'paddingLeft', 'gap', 'rowGap', 'columnGap']) {
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

  const top = (map, n = 99) =>
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
  console.error('puppeteer is not installed — run `pnpm add -D puppeteer`.');
  process.exit(2);
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport(VIEWPORT);

/**
 * Measure BOTH themes.
 *
 * Almost every palette mistake is invisible in the theme it was designed in —
 * a faint rung that clears 4.5:1 on white can sit at 3:1 on a dark panel, and
 * nobody notices because nobody switched. A one-theme audit is how a dark mode
 * ships broken.
 */
const THEME = process.env.AUDIT_THEME ?? 'light';
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: THEME }]);
console.log(`theme: ${THEME}`);

const union = {
  fontSizes: new Set(),
  weights: new Set(),
  radii: new Set(),
  shadows: new Set(),
  inks: new Set(),
  paints: new Set(),
  offScale: new Set(),
};
let totalContrastFails = 0;

let vacuous = 0;
for (const [name, path] of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 120_000 });
  // GUARD AGAINST A VACUOUS PASS, the same one layout-audit.mjs carries and this did not.
  //
  // This script has no authentication step at all, so every page redirected to /login and
  // every number it printed described the sign-in screen: three type sizes, no radii, no
  // paints, and the same contrast failure once per page — measured on the same button each
  // time. Numbers about the wrong page are worse than no numbers, because they look like an
  // answer. It fails now instead.
  if (new URL(page.url()).pathname.startsWith('/login')) {
    console.error(`  FAIL ${name}: landed on /login — this audit is not authenticated`);
    vacuous += 1;
    continue;
  }
  await new Promise((r) => setTimeout(r, 400));
  const m = await page.evaluate(measureInPage, SCALE);

  const bare = (arr) => arr.map((s) => s.replace(/ ×\d+$/, ''));
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
console.log(`  distinct type sizes   ${union.fontSizes.size}   ${[...union.fontSizes].sort((a, b) => a - b).join(' ')}`);
console.log(`  distinct weights      ${union.weights.size}   ${[...union.weights].sort().join(' ')}`);
console.log(`  distinct radii        ${union.radii.size}   ${[...union.radii].sort((a, b) => a - b).join(' ')}`);
console.log(`  distinct shadows      ${union.shadows.size}`);
console.log(`  distinct text inks    ${union.inks.size}`);
console.log(`  distinct paints       ${union.paints.size}`);
console.log(`  off-scale spacings    ${union.offScale.size}   ${[...union.offScale].join(' ')}`);
console.log(`  contrast failures     ${totalContrastFails}`);
if (vacuous) {
  console.error(`\n  ${vacuous} of ${PAGES.length} page(s) redirected to /login — every metric above is ` +
                `about the sign-in screen. Set AUDIT_EMAIL and AUDIT_PASSWORD, as layout-audit.mjs does.`);
  process.exit(1);
}
