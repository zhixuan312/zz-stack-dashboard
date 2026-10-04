/**
 * The browser audit: every page and embed view, at every width, in both themes, measured.
 *
 *   node scripts/audit.ts [--base http://localhost:3100] [--routes /,/requests] [--extra /requests/req_1] [--quick] [--embeds-only]
 *
 * Routes are discovered from app/ (every static page; embeds under /embed); --extra adds dynamic ones.
 *
 * Fails (exit 1) on: sideways scroll, text clipped without an ellipsis, a control with no accessible name, more than
 * one page scroller, and rendered text under its WCAG minimum. Prints the design metrics per page: distinct type
 * sizes, weights and radii, and the hierarchy ratio (largest text over the median), which should be 3 or more on
 * an analytical page.
 */
import { launch } from './lib/chrome.ts';
import { discover } from './lib/routes.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
const quick = args.includes('--quick');
const EMBEDS_ONLY = args.includes('--embeds-only');

const found = discover();
const extra = opt('--extra', '').split(',').filter(Boolean);
const ROUTES = EMBEDS_ONLY ? [] : (opt('--routes', '') ? opt('--routes', '').split(',') : [...found.filter((r) => !r.startsWith('/embed')), ...extra]);
const EMBEDS = found.filter((r) => r.startsWith('/embed/'));
const WIDTHS = quick ? [1440, 390] : [2560, 1440, 1024, 768, 390];
const THEMES = quick ? ['dark'] : ['dark', 'light'];

type Report = {
  sideways: string[]; clipped: string[]; focusless: string[]; unnamed: string[]; scrollers: string[]; contrast: string[]; targets: string[]; headings: string[];
  sizes: number[]; weights: number[]; radii: number[]; ratio: number;
};

/** Runs inside the page. Plain JavaScript: it is serialised into the browser. */
const MEASURE = `(() => {
  const W = innerWidth, out = { sideways: [], clipped: [], unnamed: [], scrollers: [], contrast: [], targets: [], headings: [], sizes: [], weights: [], radii: [], ratio: 0 };
  const label = (el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '')).slice(0, 90);
  const visible = (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); /* visually hidden (sr-only, also under a variant) is for screen readers, not the eye */ return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && parseFloat(c.opacity) > 0.05 && !el.closest('.sr-only,[aria-hidden="true"]') && !(c.position === 'absolute' && r.width <= 1 && r.height <= 1); };
  const sr = document.scrollingElement;
  if (sr.scrollWidth > W + 1) out.sideways.push('document ' + sr.scrollWidth + 'px wide at ' + W);
  document.querySelectorAll('[data-scroll-region]').forEach((s) => { if (s.scrollWidth > s.clientWidth + 1) out.sideways.push('scroll region ' + s.scrollWidth + ' > ' + s.clientWidth); });
  // A dashboard fills its canvas at every size: a data page narrower than the scroll region (less the gutters) is a
  // centred strip on a wide screen.
  document.querySelectorAll('[data-page-width="data"]').forEach((p) => { const region = p.closest('[data-scroll-region]'); if (region && p.getBoundingClientRect().width < region.clientWidth - 2) out.sideways.push('data page ' + Math.round(p.getBoundingClientRect().width) + 'px wide in a ' + region.clientWidth + 'px canvas (it should fill it)'); });
  // A table wider than its frame is clipped, not scrolled: its last columns (often the actions) are out of reach.
  document.querySelectorAll('table').forEach((t) => { const f = t.parentElement; if (!t.closest('.sr-only') && f && t.offsetWidth > 0 && !/auto|scroll/.test(getComputedStyle(f).overflowX) && t.scrollWidth > f.clientWidth + 1) out.sideways.push('table ' + (t.querySelector('caption')?.textContent || label(t)) + ' ' + t.scrollWidth + ' > its frame ' + f.clientWidth + ' (hideBelow a column)'); });
  const all = [...document.body.querySelectorAll('*')];
  // Pixel colours, whatever the colour space.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255]; };
  const lin = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const over = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
  const groundColour = rgba(window.__hostGround || getComputedStyle(document.documentElement).backgroundColor);
  const backOf = (el) => {
    const stack = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.backgroundImage !== 'none' && !/url\\(/.test(c.backgroundImage) && n !== el) return null;
      const bg = rgba(c.backgroundColor);
      if (bg[3] > 0) { stack.push(bg); if (bg[3] >= 0.99) break; }
    }
    let b = groundColour[3] > 0 ? groundColour : [0, 0, 0, 1];
    for (let i = stack.length - 1; i >= 0; i--) b = over(stack[i], b);
    return b;
  };
  const texts = [];
  for (const el of all) {
    const c = getComputedStyle(el);
    if (!visible(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      const fs = parseFloat(c.fontSize);
      texts.push(fs); out.sizes.push(Math.round(fs)); out.weights.push(+c.fontWeight);
      if (el.scrollWidth > el.clientWidth + 1 && c.textOverflow !== 'ellipsis' && /hidden|clip/.test(c.overflow) && el.clientWidth > 0) out.clipped.push(label(el) + ' "' + el.textContent.trim().slice(0, 30) + '"');
      // Gradient text paints its glyphs with a clipped background (color is transparent); both ends sit at accent-ink's
      // lightness, which the contrast gate already holds, so it is not measured here.
      if (!el.closest('svg') && !/text/.test(c.backgroundClip + ' ' + c.webkitBackgroundClip) && !el.closest('[data-contrast-exempt]') && !el.closest(':disabled,[aria-disabled="true"],[data-disabled]')) {
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
    if (/(auto|scroll)/.test(c.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 120) out.scrollers.push(label(el));
    if (el.matches('button,a[href],[role="button"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],input:not([type=hidden]),select,textarea')) {
      const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.textContent.trim() || el.querySelector('img[alt]')?.getAttribute('alt') || (el.id && document.querySelector('label[for="' + el.id + '"]')?.textContent.trim()) || el.closest('label')?.textContent.trim() || el.getAttribute('placeholder') || '';
      if (!name) out.unnamed.push(label(el));
      // On touch (a phone is emulated as one) every control answers at least 44px: its own box, its field's frame, or
      // the .hit square around it. A link inside running text is exempt, as WCAG exempts it.
      if (matchMedia('(pointer: coarse)').matches && !el.disabled && !(el.matches('a') && getComputedStyle(el).display === 'inline')) {
        // A labelled control answers its label too (a press on the label toggles it), so the target is both together.
        const lab = (el.id && document.querySelector('label[for="' + el.id + '"]')) || el.closest('label');
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
  const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => !h.closest('[aria-hidden="true"]')).map((h) => +h.tagName[1]);
  levels.forEach((l, i) => { if (i && l > levels[i - 1] + 1) out.headings.push('h' + levels[i - 1] + ' then h' + l); });
  out.focusless = [];
  const sorted = texts.sort((a, b) => a - b);
  out.ratio = sorted.length ? +(sorted[sorted.length - 1] / sorted[Math.floor(sorted.length / 2)]).toFixed(1) : 0;
  out.sizes = [...new Set(out.sizes)].sort((a, b) => a - b); out.weights = [...new Set(out.weights)].sort(); out.radii = [...new Set(out.radii)].sort((a, b) => a - b);
  out.contrast = [...new Set(out.contrast)].slice(0, 8); out.clipped = [...new Set(out.clipped)].slice(0, 8); out.unnamed = [...new Set(out.unnamed)].slice(0, 8);
  return out;
})()`;

/** Pages that legitimately have a second scroller: the rail's own list, an open sidebar, a code block. */
const ALLOWED_SCROLLERS = /data-scroll-region|^nav|^aside|^pre|^textarea|overflow-x-auto|max-h-|^div\.min-h-0\.flex-1\.overflow-y-auto/;

const page = await launch();
let failures = 0;
const metrics: string[] = [];
const run = async (route: string, width: number, theme: string, embed: boolean) => {
  await page.open(base + route, { width, height: width < 600 ? 844 : 900, theme: theme as 'dark' | 'light', wait: 1500 });
  // An embed is a guest with a transparent ground: paint the host's ground behind it, as a host does.
  if (embed) await page.eval(`(() => { const d = document.documentElement; d.setAttribute('data-theme','${theme}'); window.__hostGround = '${theme}' === 'dark' ? '#1C1C20' : '#FFFFFF'; return true; })()`);
  const r = await page.eval<Report>(MEASURE);
  // Focus: press Tab through the page as a person would; every stop must show a ring (outline or box-shadow ring) on the
  // focused element or the frame around it.
  for (let i = 0; i < 18; i++) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    const miss = await page.eval<string | null>(`(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const ringed = (n) => { if (!n) return false; const c = getComputedStyle(n); return (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || /rgb|oklch|oklab|color/.test(c.boxShadow) && c.boxShadow !== 'none'; };
      if (ringed(el) || ringed(el.parentElement) || ringed(el.parentElement && el.parentElement.parentElement)) return null;
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
for (const route of EMBEDS) for (const w of quick ? [720] : [720, 420]) for (const t of THEMES) await run(route, w, t, true);
page.close();
console.log('\nDesign metrics at 1440:\n' + metrics.join('\n'));
console.log(`\naudit: ${failures} issues across ${ROUTES.length + EMBEDS.length} routes, at ${WIDTHS.join(', ')}px in ${THEMES.join(' and ')}`);
process.exit(failures ? 1 : 0);
