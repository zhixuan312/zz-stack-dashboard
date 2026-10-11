/**
 * The browser audit: every page and embed view, at every width, in both themes, measured.
 *
 *   node scripts/audit.ts [--base http://localhost:3100] [--routes /,/requests] [--embeds-only] [--atlas]
 *
 * Routes are discovered from app/ (every static page; embeds under /embed), with the detail pages in
 * scripts/verify.config.ts beside them; --routes replaces the pages for one run.
 *
 * --atlas audits the Design Atlas instead: every card's page and its bare preview, at 1440 and 390px in both themes.
 * A card's preview is the one place it is drawn alone, so a defect in its own box shows there and nowhere else. It is
 * not part of `pnpm verify` (the default stays fast); run it when the question is the component surface. It takes
 * about ten minutes, and a project without the Atlas has nothing for it to read.
 *
 * The walk enters open shadow roots and follows slots (scripts/lib/deep.ts, injected into every page), so a custom element's
 * own content is measured like any other. A defined custom element that shows a box but exposes no open root and no
 * light-DOM content, and one that is still undefined after the settle wait, are reported as `unmeasured:` instead of passed.
 *
 * Fails (exit 1) on: sideways scroll, text clipped without an ellipsis, a control with no accessible name, more than
 * one page scroller, and rendered text under its WCAG minimum. Prints the design metrics per page: distinct type
 * sizes, weights and radii, and the hierarchy ratio (largest text over the median), which should be 3 or more on
 * an analytical page.
 */
import fs from 'node:fs';
import { launch } from './lib/chrome.ts';
import { DEEP_SOURCE } from './lib/deep.ts';
import { discover } from './lib/routes.ts';
import config from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
// `--as` signs every open in as one persona (scripts/verify.config.ts), through the cookie scripts/lib/chrome.ts sets
// before the first request. Without it nothing changes: no cookie is passed and the suite runs exactly as before.
const personas = (config as { personas?: Record<string, { cookie: { name: string; value: string } }> }).personas ?? {};
const as = opt('--as', '');
const cookie = as ? personas[as]?.cookie : undefined;
if (as && !cookie) { console.error(`audit: --as ${as} is not a declared persona. Declared personas: ${Object.keys(personas).join(', ')}.`); process.exit(1); }
const EMBEDS_ONLY = args.includes('--embeds-only');
const ATLAS = args.includes('--atlas');

/** Every card's Atlas page and bare preview, from the keys scripts/registry.ts generates; only the template has them. */
function atlasRoutes(): string[] {
  const file = 'app/system/preview/[section]/[card]/keys.ts';
  if (!fs.existsSync(file)) { console.error('audit --atlas: this project has no Design Atlas to audit'); process.exit(1); }
  const keys = [...fs.readFileSync(file, 'utf8').matchAll(/'([a-z]+\/[a-z0-9-]+)'/g)].map((m) => m[1]);
  return keys.flatMap((k) => [`/system/${k}`, `/system/preview/${k}`]);
}

const found = discover();
// verify.config.ts is the team's, so read the one field this needs through its own type.
const detailRoutes = (config as { detailRoutes?: string[] }).detailRoutes ?? [];
const ROUTES = EMBEDS_ONLY ? [] : ATLAS ? atlasRoutes() : (opt('--routes', '') ? opt('--routes', '').split(',') : [...found.filter((r) => !r.startsWith('/embed')), ...detailRoutes]);
const EMBEDS = ATLAS ? [] : found.filter((r) => r.startsWith('/embed/'));
const WIDTHS = ATLAS ? [1440, 390] : [2560, 1440, 1024, 768, 390];
const THEMES = ['dark', 'light'];

type Report = {
  sideways: string[]; clipped: string[]; focusless: string[]; unnamed: string[]; unmeasured: string[]; scrollers: string[]; contrast: string[]; targets: string[]; headings: string[];
  sizes: number[]; weights: number[]; radii: number[]; ratio: number;
};

/** Runs inside the page. Plain JavaScript: it is serialised into the browser. */
const MEASURE = `(() => {
  const W = innerWidth, out = { sideways: [], clipped: [], unnamed: [], unmeasured: [], scrollers: [], contrast: [], targets: [], headings: [], sizes: [], weights: [], radii: [], ratio: 0 };
  const label = (el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '')).slice(0, 90);
  /* closest() across open roots and slots: deepParent (injected from scripts/lib/deep.ts) steps through both */
  const deepClosest = (el, sel) => { for (let n = el; n; n = deepParent(n)) if (n.matches(sel)) return n; return null; };
  const visible = (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); /* visually hidden (sr-only, also under a variant) is for screen readers, not the eye */ return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && parseFloat(c.opacity) > 0.05 && !deepClosest(el, '.sr-only,[aria-hidden="true"]') && !(c.position === 'absolute' && r.width <= 1 && r.height <= 1); };
  const sr = document.scrollingElement;
  if (sr.scrollWidth > W + 1) out.sideways.push('document ' + sr.scrollWidth + 'px wide at ' + W);
  const all = deepAll(document.body).filter((n) => n !== document.body);
  all.filter((n) => n.matches('[data-scroll-region]')).forEach((s) => { if (s.scrollWidth > s.clientWidth + 1) out.sideways.push('scroll region ' + s.scrollWidth + ' > ' + s.clientWidth); });
  // A dashboard fills its canvas at every size: a data page narrower than the scroll region (less the gutters) is a
  // centred strip on a wide screen.
  all.filter((n) => n.matches('[data-page-width="data"]')).forEach((p) => { const region = deepClosest(p, '[data-scroll-region]'); if (region && p.getBoundingClientRect().width < region.clientWidth - 2) out.sideways.push('data page ' + Math.round(p.getBoundingClientRect().width) + 'px wide in a ' + region.clientWidth + 'px canvas (it should fill it)'); });
  // A table wider than its frame is clipped, not scrolled: its last columns (often the actions) are out of reach.
  all.filter((n) => n.localName === 'table').forEach((t) => { const f = deepParent(t); if (!deepClosest(t, '.sr-only') && f && t.offsetWidth > 0 && !/auto|scroll/.test(getComputedStyle(f).overflowX) && t.scrollWidth > f.clientWidth + 1) out.sideways.push('table ' + (t.querySelector('caption')?.textContent || label(t)) + ' ' + t.scrollWidth + ' > its frame ' + f.clientWidth + ' (hideBelow a column)'); });
  // Pixel colours, whatever the colour space.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255]; };
  const lin = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const over = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
  const groundColour = rgba(window.__hostGround || getComputedStyle(document.documentElement).backgroundColor);
  const backOf = (el) => {
    const stack = [];
    for (let n = el; n && n !== document.documentElement; n = deepParent(n)) {
      const c = getComputedStyle(n);
      if (c.backgroundImage !== 'none' && !/url\\(/.test(c.backgroundImage) && n !== el) return null;
      const bg = rgba(c.backgroundColor);
      if (bg[3] > 0) { stack.push(bg); if (bg[3] >= 0.99) break; }
    }
    let b = groundColour[3] > 0 ? groundColour : [0, 0, 0, 1];
    for (let i = stack.length - 1; i >= 0; i--) b = over(stack[i], b);
    return b;
  };
  const ringSig = (c) => [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderTopStyle, c.borderTopWidth, c.borderTopColor, c.borderBottomColor, c.borderLeftColor, c.borderRightColor].join('|');
  const texts = [];
  for (const el of all) {
    const c = getComputedStyle(el);
    // A custom element the walk cannot see into is reported, not passed over: an undefined one with no open root has no content yet
    // (one with an open root, as Next's route announcer has, is walked like any other), and a
    // defined one with a closed root (or none) and nothing in the light DOM draws a box the audit cannot measure.
    if (el.localName.includes('-')) {
      if (!customElements.get(el.localName)) { if (!el.shadowRoot) out.unmeasured.push(el.localName + ' (not defined)'); }
      else if (!el.shadowRoot && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0 && ![...el.childNodes].some((n) => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()))) out.unmeasured.push(el.localName + ' (no open shadow root)');
    }
    if (!visible(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      const fs = parseFloat(c.fontSize);
      texts.push(fs); out.sizes.push(Math.round(fs)); out.weights.push(+c.fontWeight);
      if (el.scrollWidth > el.clientWidth + 1 && c.textOverflow !== 'ellipsis' && /hidden|clip/.test(c.overflow) && el.clientWidth > 0) out.clipped.push(label(el) + ' "' + el.textContent.trim().slice(0, 30) + '"');
      // Gradient text paints its glyphs with a clipped background (color is transparent); both ends sit at accent-ink's
      // lightness, which the contrast gate already holds, so it is not measured here.
      if (!deepClosest(el, 'svg') && !/text/.test(c.backgroundClip + ' ' + c.webkitBackgroundClip) && !deepClosest(el, '[data-contrast-exempt]') && !deepClosest(el, ':disabled,[aria-disabled="true"],[data-disabled]')) {
        const back = backOf(el);
        if (back) {
          const fg = over(rgba(c.color), back);
          const a = lum(fg), b = lum(back), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          const large = fs >= 24 || (fs >= 18.6 && +c.fontWeight >= 600);
          if (r < (large ? 3 : 4.5) - 0.05) out.contrast.push(r.toFixed(2) + ':1 ' + label(el) + ' "' + el.textContent.trim().slice(0, 24) + '"');
        }
      }
    }
    const rad = parseFloat(c.borderTopLeftRadius);
    if (rad > 0 && rad < 999) out.radii.push(Math.round(rad));
    // A card drawn as a specimen in the Atlas keeps its own scroll regions; only the page's count against the one scroller.
    if (/(auto|scroll)/.test(c.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 120 && !deepClosest(el, '[data-specimen]')) out.scrollers.push(label(el));
    if (el.matches('button,a[href],[role="button"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],input:not([type=hidden]),select,textarea')) {
      const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || deepText(el).trim() || el.querySelector('img[alt]')?.getAttribute('alt') || (el.id && el.getRootNode().querySelector('label[for="' + el.id + '"]')?.textContent.trim()) || el.closest('label')?.textContent.trim() || el.getAttribute('placeholder') || '';
      if (!name) out.unnamed.push(label(el));
      // On touch (a phone is emulated as one) every control answers at least 44px: its own box, its field's frame, or
      // the .hit square around it. A link inside running text is exempt, as WCAG exempts it.
      if (matchMedia('(pointer: coarse)').matches && !el.disabled && !(el.matches('a') && getComputedStyle(el).display === 'inline')) {
        // A labelled control answers its label too (a press on the label toggles it), so the target is both together.
        const lab = (el.id && el.getRootNode().querySelector('label[for="' + el.id + '"]')) || el.closest('label');
        const own = (el.closest('.control-frame') || el).getBoundingClientRect();
        const lr = lab && !lab.contains(el.closest('.control-frame') || el) ? lab.getBoundingClientRect() : null;
        const box = lr ? { width: Math.max(own.right, lr.right) - Math.min(own.left, lr.left), height: Math.max(own.bottom, lr.bottom) - Math.min(own.top, lr.top) } : own;
        const b = getComputedStyle(el, '::before');
        const w = b.content !== 'none' && b.position === 'absolute' ? Math.max(box.width, parseFloat(b.width) || 0) : box.width;
        const h = b.content !== 'none' && b.position === 'absolute' ? Math.max(box.height, parseFloat(b.height) || 0) : box.height;
        if (Math.min(w, h) < 44) out.targets.push((name || label(el)).trim().replace(/\\s+/g, ' ').slice(0, 40) + ' ' + Math.round(w) + '×' + Math.round(h));
      }
    }
  }
  // Headings descend one level at a time, so a screen reader's outline has no holes.
  // A specimen's headings are the card's own, at the level the card uses where it is placed, not the documentation page's.
  const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => !h.closest('[aria-hidden="true"]') && !h.closest('[data-specimen]')).map((h) => +h.tagName[1]);
  levels.forEach((l, i) => { if (i && l > levels[i - 1] + 1) out.headings.push('h' + levels[i - 1] + ' then h' + l); });
  out.focusless = [];
  // What each element looks like unfocused, so the focus check can tell a ring from a decoration that is always there.
  window.__ringBefore = new WeakMap(); for (const n of all) window.__ringBefore.set(n, ringSig(getComputedStyle(n)));
  const sorted = texts.sort((a, b) => a - b);
  out.ratio = sorted.length ? +(sorted[sorted.length - 1] / sorted[Math.floor(sorted.length / 2)]).toFixed(1) : 0;
  out.sizes = [...new Set(out.sizes)].sort((a, b) => a - b); out.weights = [...new Set(out.weights)].sort(); out.radii = [...new Set(out.radii)].sort((a, b) => a - b);
  out.contrast = [...new Set(out.contrast)].slice(0, 8); out.clipped = [...new Set(out.clipped)].slice(0, 8); out.unnamed = [...new Set(out.unnamed)].slice(0, 8); out.unmeasured = [...new Set(out.unmeasured)].slice(0, 8);
  return out;
})()`;

/** Pages that legitimately have a second scroller: the rail's own list, an open sidebar, a code block. */
const ALLOWED_SCROLLERS = /data-scroll-region|^nav|^aside|^pre|^textarea|overflow-x-auto|max-h-|^div\.min-h-0\.flex-1\.overflow-y-auto/;

const page = await launch();
let failures = 0;
const metrics: string[] = [];
const run = async (route: string, width: number, theme: string, embed: boolean) => {
  await page.open(base + route, { width, height: width < 600 ? 844 : 900, theme: theme as 'dark' | 'light', wait: 1500, cookie });
  // An embed is a guest with a transparent ground: paint the host's ground behind it, as a host does.
  if (embed) await page.eval(`(() => { const d = document.documentElement; d.setAttribute('data-theme','${theme}'); window.__hostGround = '${theme}' === 'dark' ? '#1C1C20' : '#FFFFFF'; return true; })()`);
  // One implementation of the walk: the helper is injected, never copied. A page it cannot be injected into fails the audit.
  try {
    if (!(await page.eval<boolean>(`${DEEP_SOURCE}\n;typeof deepAll === 'function' && typeof deepActive === 'function' && typeof deepParent === 'function' && typeof deepText === 'function'`))) throw new Error('the helper is not defined after injection');
  } catch (e) {
    console.error(`audit: cannot inject the deep-DOM helper into ${route}: ${(e as Error).message}`);
    page.close();
    process.exit(1);
  }
  const r = await page.eval<Report>(MEASURE);
  // Focus: press Tab through the page as a person would; every stop must show a ring (outline or box-shadow ring) on the
  // focused element or the frame around it.
  for (let i = 0; i < 18; i++) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    const miss = await page.eval<string | null>(`(() => {
      const el = deepActive(); if (!el || el === document.body) return null;
      // A ring is a change on focus: an outline, a coloured shadow or a border that was not there unfocused. The element
      // itself, its frame and the frame's frame count; inside a shadow root every composed ancestor up to the outermost
      // host does, since the host is where :host(:focus-within) draws.
      const sig = (c) => [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderTopStyle, c.borderTopWidth, c.borderTopColor, c.borderBottomColor, c.borderLeftColor, c.borderRightColor].join('|');
      const ringed = (n) => {
        const c = getComputedStyle(n), before = window.__ringBefore && window.__ringBefore.get(n);
        const outline = c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0, shadow = /rgb|oklch|oklab|color/.test(c.boxShadow) && c.boxShadow !== 'none';
        if (!before) return outline || shadow;
        const b = before.split('|'), now = sig(c).split('|');
        const outlineMoved = now.slice(0, 3).join('|') !== b.slice(0, 3).join('|'), shadowMoved = now[3] !== b[3], borderMoved = now.slice(4).join('|') !== b.slice(4).join('|') && c.borderTopStyle !== 'none';
        return (outline && outlineMoved) || (shadow && shadowMoved) || borderMoved;
      };
      const chain = [el];
      if (el.getRootNode() instanceof ShadowRoot) { for (let n = deepParent(el); n; n = deepParent(n)) { chain.push(n); if (!(n.getRootNode() instanceof ShadowRoot)) break; } }
      else { const p = deepParent(el); if (p) chain.push(p); const g = p && deepParent(p); if (g) chain.push(g); }
      if (chain.some(ringed)) return null;
      return el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 3).join('.');
    })()`);
    if (miss) r.focusless.push(miss);
  }
  r.focusless = [...new Set(r.focusless)].slice(0, 6);
  const scrollers = r.scrollers.filter((s) => !ALLOWED_SCROLLERS.test(s));
  const issues = [
    ...r.sideways.map((x) => 'sideways: ' + x),
    ...r.clipped.map((x) => 'clipped: ' + x),
    ...r.unnamed.map((x) => 'unnamed: ' + x),
    ...r.unmeasured.map((x) => 'unmeasured: ' + x),
    ...[...new Set(r.headings)].map((x) => 'heading skips a level: ' + x),
    ...[...new Set(r.targets)].slice(0, 8).map((x) => 'touch target under 44px: ' + x),
    ...(scrollers.length > 1 ? ['scrollers: ' + scrollers.join(', ')] : []),
    ...r.contrast.map((x) => 'contrast: ' + x),
    ...r.focusless.map((x) => 'no focus ring: ' + x),
    ...[...new Set(page.errors)].slice(0, 4).map((x) => x),
  ];
  const tag = `${route} @${width} ${theme}`;
  if (issues.length) { failures += issues.length; console.log(`FAIL ${tag}\n  ${issues.join('\n  ')}`); }
  if (width === 1440 && theme === THEMES[0]) metrics.push(`${route.padEnd(34)} sizes ${String(r.sizes.length).padStart(2)} [${r.sizes.join(' ')}] · weights ${r.weights.join('/')} · radii ${r.radii.length} [${r.radii.join(' ')}] · hierarchy ${r.ratio}×`);
};
for (const route of ROUTES) for (const w of WIDTHS) for (const t of THEMES) await run(route, w, t, false);
for (const route of EMBEDS) for (const w of [720, 420]) for (const t of THEMES) await run(route, w, t, true);
page.close();
console.log('\nDesign metrics at 1440:\n' + metrics.join('\n'));
console.log(`\naudit: ${failures} issues across ${ROUTES.length + EMBEDS.length} routes, at ${WIDTHS.join(', ')}px in ${THEMES.join(' and ')}`);
process.exit(failures ? 1 : 0);
