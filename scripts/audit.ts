/**
 * The browser audit: every page and embed view, at every width, in both themes, measured.
 *
 *   node scripts/audit.ts [--base http://localhost:3100] [--routes /,/requests] [--embeds-only] [--atlas] [--list]
 *
 * Routes are discovered from app/ (every static page; embeds under /embed), with the detail pages in
 * scripts/verify.config.ts beside them; --routes replaces the pages for one run.
 *
 * --atlas audits the Design Atlas instead: every card's page and its bare preview, and every other entry the Atlas
 * serves — the token views, the page specs and the guides — at 1440 and 390px in both themes.
 * A card's preview is the one place it is drawn alone, so a defect in its own box shows there and nowhere else. It is
 * not part of `pnpm verify` (the default stays fast); run it when the question is the component surface. It takes
 * about twenty minutes, and a project without the Atlas has nothing for it to read. `--list` prints the routes a run would
 * visit, and for `--atlas` what they are by kind, and exits without opening a browser: what a run covers, before it runs.
 *
 * The walk enters open shadow roots and follows slots (scripts/lib/deep.ts, injected into every page), so a custom element's
 * own content is measured like any other. A defined custom element that shows a box but exposes no open root and no
 * light-DOM content, and one that is still undefined after the settle wait, are reported as `unmeasured:` instead of passed.
 *
 * Fails (exit 1) on: a route that served another page or dropped a parameter it was asked for, a page whose content
 * region rendered nothing or that threw or logged a failure while it rendered, sideways scroll, text clipped without an
 * ellipsis, text cut with an ellipsis that keeps the whole of it nowhere, two pieces of text in the same place or a line
 * drawn through one, a control with no accessible name or one under 44px on touch, a heading two levels below the one
 * before it, more than one page scroller, and rendered text under its WCAG minimum, an SVG's text included, read by its
 * `fill` against whatever the SVG paints behind it. Prints the design metrics per page: distinct type sizes, weights and
 * radii, and the hierarchy ratio (largest text over the median), which should be 3 or more on an analytical page.
 * Every rule above has a page in `scripts/fixtures/deep/` that makes it fire.
 */
import fs from 'node:fs';
import path from 'node:path';
import { atlasCoverage, atlasEntries } from './lib/atlas.ts';
import { launch } from './lib/chrome.ts';
import { DEEP_SOURCE } from './lib/deep.ts';
import { discover } from './lib/routes.ts';
import { settle } from './lib/settle.ts';
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

/**
 * Every Atlas page: each card's page and its bare preview (from the keys scripts/registry.ts generates), plus every
 * other entry the Atlas serves — the token views, the page specs and the guides. Those live under `[section]/[id]`, so
 * `discover()` skips them as dynamic segments. They are read through the module the Atlas itself renders from, so a new
 * entry is audited without being listed; an Atlas whose entries cannot be read fails the run, and the coverage line says
 * what was reached. Only the template has an Atlas.
 */
let atlasLine = '';
async function atlasRoutes(): Promise<string[]> {
  // Resolved from this file, like every other path a check reads: run by hand from another folder, a bare relative path
  // told a repository with an Atlas that it had none.
  const file = path.resolve(import.meta.dirname, '../app/system/preview/[section]/[card]/keys.ts');
  if (!fs.existsSync(file)) { console.error('audit --atlas: this project has no Design Atlas to audit'); process.exit(1); }
  const keys = [...fs.readFileSync(file, 'utf8').matchAll(/'([a-z]+\/[a-z0-9-]+)'/g)].map((m) => m[1]);
  const cards = keys.flatMap((k) => [`/system/${k}`, `/system/preview/${k}`]);
  const entries = await atlasEntries().catch((e: Error) => { console.error(`audit --atlas: ${e.message}`); process.exit(1); });
  atlasLine = `atlas: ${atlasCoverage(entries)}, and ${keys.length} bare previews`;
  return [...new Set([...cards, ...entries.map((e) => e.href)])];
}

const found = discover();
// verify.config.ts is the team's, so read the one field this needs through its own type.
const detailRoutes = (config as { detailRoutes?: string[] }).detailRoutes ?? [];
const ROUTES = EMBEDS_ONLY ? [] : ATLAS ? await atlasRoutes() : (opt('--routes', '') ? opt('--routes', '').split(',') : [...found.filter((r) => !r.startsWith('/embed')), ...detailRoutes]);
const EMBEDS = ATLAS ? [] : found.filter((r) => r.startsWith('/embed/'));
const WIDTHS = ATLAS ? [1440, 390] : [2560, 1440, 1024, 768, 390];
const THEMES = ['dark', 'light'];
if (args.includes('--list')) {
  console.log([...ROUTES, ...EMBEDS].join('\n'));
  if (atlasLine) console.log(atlasLine);
  process.exit(0);
}
if (atlasLine) console.log(atlasLine);

type Report = {
  path: string; href: string; text: number;
  sideways: string[]; clipped: string[]; truncated: string[]; overlap: string[]; focusless: string[]; unnamed: string[]; unmeasured: string[]; scrollers: string[]; contrast: string[]; targets: string[]; headings: string[];
  sizes: number[]; weights: number[]; radii: number[]; ratio: number;
};

/** Runs inside the page. Plain JavaScript: it is serialised into the browser. */
const MEASURE = `(() => {
  const W = innerWidth, out = { path: location.pathname, href: location.href, text: 0, sideways: [], clipped: [], truncated: [], overlap: [], unnamed: [], unmeasured: [], scrollers: [], contrast: [], targets: [], headings: [], sizes: [], weights: [], radii: [], ratio: 0 };
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
  // An SVG's text is painted by fill, not color, and what it sits on is whatever the SVG painted before it: the page
  // behind the SVG, then every filled shape under the text's centre, in document order (which is paint order). The
  // shapes are asked directly (isPointInFill) rather than hit-tested, so one drawn with pointer-events off still counts.
  // A gradient, behind the text or as its fill, has no single colour to compare and is left unmeasured.
  const svgInk = (c) => { const f = c.fill; if (!f || f === 'none' || /^url\\(|context-/.test(f)) return null; const p = rgba(f); p[3] *= parseFloat(c.fillOpacity || '1'); return p[3] > 0.02 ? p : null; };
  const svgBack = (el) => {
    const root = el.ownerSVGElement; let b = backOf(root || el); if (!b || !root) return b;
    const box = el.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
    for (const g of root.querySelectorAll('rect,path,circle,ellipse,polygon')) {
      if (!(g.compareDocumentPosition(el) & 4) || g.closest('defs,clipPath,mask,pattern,marker,symbol')) continue;
      const gc = getComputedStyle(g); if (gc.display === 'none' || gc.visibility === 'hidden' || gc.fill === 'none') continue;
      const m = g.getScreenCTM(); if (!m) continue;
      let inside = false; try { inside = g.isPointInFill(new DOMPoint(x, y).matrixTransform(m.inverse())); } catch { continue; }
      if (!inside) continue;
      if (/^url\\(/.test(gc.fill)) return null;
      const f = rgba(gc.fill); f[3] *= parseFloat(gc.fillOpacity || '1') * parseFloat(gc.opacity || '1');
      if (f[3] > 0) b = over(f, b);
    }
    return b;
  };
  // Text cut with an ellipsis has to keep the whole of itself where a pointer can reach it: a title attribute on the element or
  // on what holds it (a cell, a row, a link), or on the one thing inside it that the pointer is over. The title has to
  // *hold* the text, compared as a whole — a title on any ancestor or descendant used to count whatever it said, so a
  // cell titled "Orders" over a cut account id passed as keeping it.
  const whole = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const keeps = (el, title) => { const t = whole(title), own = whole(el.textContent); return t.length > 0 && own.length > 0 && t.includes(own); };
  // The walk reaches through a table cell's wrapper: a name span in a flex row in a link in the wrapper's cut span in the
  // wrapper is six levels, so the cell's title is still found.
  const titled = (el) => { for (let n = el, i = 0; n && i < 6; n = deepParent(n), i++) if (keeps(el, n.getAttribute('title'))) return true; return [...el.querySelectorAll('[title]')].some((n) => keeps(el, n.getAttribute('title'))); };
  const inked = [];
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
      if (el.scrollWidth > el.clientWidth + 1 && c.textOverflow === 'ellipsis' && /hidden|clip/.test(c.overflowX) && el.clientWidth > 0 && !titled(el)) out.truncated.push(label(el) + ' "' + el.textContent.trim().slice(0, 30) + '"');
      inked.push(el);
      // Gradient text paints its glyphs with a clipped background (color is transparent); both ends sit at accent-ink's
      // lightness, which the contrast gate already holds, so it is not measured here.
      if (!/text/.test(c.backgroundClip + ' ' + c.webkitBackgroundClip) && !deepClosest(el, '[data-contrast-exempt]') && !deepClosest(el, ':disabled,[aria-disabled="true"],[data-disabled]')) {
        const svg = el instanceof SVGElement;
        const ink = svg ? svgInk(c) : rgba(c.color);
        const back = ink && (svg ? svgBack(el) : backOf(el));
        if (back) {
          const fg = over(ink, back);
          const a = lum(fg), b = lum(back), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          // An SVG scales its text with its viewBox, so the size that matters is the one drawn.
          const m = svg && el.getScreenCTM ? el.getScreenCTM() : null, size = fs * (m ? Math.hypot(m.a, m.b) : 1);
          const large = size >= 24 || (size >= 18.6 && +c.fontWeight >= 600);
          if (r < (large ? 3 : 4.5) - 0.05) out.contrast.push(r.toFixed(2) + ':1 ' + label(el) + ' "' + el.textContent.trim().slice(0, 24) + '"');
        }
      }
    }
    const rad = parseFloat(c.borderTopLeftRadius);
    if (rad > 0 && rad < 999) out.radii.push(Math.round(rad));
    // A card drawn as a specimen in the Atlas keeps its own scroll regions; only the page's count against the one scroller.
    if (/(auto|scroll)/.test(c.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 120 && !deepClosest(el, '[data-specimen]')) out.scrollers.push(label(el));
    if (el.matches('button,a[href],[role="button"],[role="tab"],[role="switch"],[role="checkbox"],[role="radio"],input:not([type=hidden]),select,textarea')) {
      // A name is what the control is announced as. aria-labelledby names elements that hold it, and is worth
      // nothing until they are looked up — the same lookup a label-for gets two terms later — so an id that names
      // nothing leaves the control unnamed rather than passing on the attribute's own text.
      const byIds = (attr) => (el.getAttribute(attr) || '').split(/\\s+/).filter(Boolean).map((id) => { const t = el.getRootNode().querySelector('#' + CSS.escape(id)); return t ? whole(t.textContent) : ''; }).join(' ').trim();
      const name = el.getAttribute('aria-label') || byIds('aria-labelledby') || el.getAttribute('title') || deepText(el).trim() || el.querySelector('img[alt]')?.getAttribute('alt') || (el.id && el.getRootNode().querySelector('label[for="' + el.id + '"]')?.textContent.trim()) || el.closest('label')?.textContent.trim() || el.getAttribute('placeholder') || '';
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
  // Two things in the same place. Every other measurement here is against the frame (does it fit, is it cut, can it be
  // read against its ground); none asked whether a neighbour is drawn where the text is, so a sparkline through its own
  // caption passed at five widths in both themes. Two cases, each unambiguous: two pieces of text whose glyph boxes
  // share a third of a line or more, and a stroked line (a shape with no fill) that runs through a text's box. A filled
  // shape under text is a ground, and the contrast pass reads it as one. What a layer is meant to cover is left out:
  // anything fixed or sticky, anything faded out by an ancestor, and whatever has a box and is not on the page: text
  // or a line an overflow has clipped away, and the content of a closed disclosure.
  // checkVisibility answers for what has a box and is not drawn: the text of a closed disclosure, a subtree with content-visibility hidden.
  const off = (el) => { if (el.checkVisibility && !el.checkVisibility()) return true; for (let n = el; n && n !== document.documentElement; n = deepParent(n)) { const c = getComputedStyle(n); if (c.position === 'fixed' || c.position === 'sticky' || parseFloat(c.opacity) < 0.05) return true; } return false; };
  // What of a box is on the page at all: the part no clipping ancestor cuts away. From the element itself, since a
  // clamp or a truncation hides its own later lines and their boxes are still where the text would have been; and for
  // a shape as much as for text, since an icon scrolled out of a list is still, by its geometry, wherever the list ends.
  const seen = (el, r) => {
    let x1 = Math.max(r.left, 0), y1 = r.top, x2 = Math.min(r.right, W), y2 = r.bottom;
    for (let n = el; n && n !== document.documentElement; n = deepParent(n)) {
      const c = getComputedStyle(n);
      if (/hidden|clip|auto|scroll/.test(c.overflowX + ' ' + c.overflowY)) { const b = n.getBoundingClientRect(); x1 = Math.max(x1, b.left); y1 = Math.max(y1, b.top); x2 = Math.min(x2, b.right); y2 = Math.min(y2, b.bottom); }
    }
    return x2 - x1 > 2 && y2 - y1 > 2 ? { left: x1, top: y1, right: x2, bottom: y2 } : null;
  };
  const quote = (el) => label(el) + ' "' + el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 24) + '"';
  const boxes = [];
  for (const el of inked) {
    if (off(el)) continue;
    const rs = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      let rects = [...range.getClientRects()]; if (!rects.length && el instanceof SVGElement) rects = [el.getBoundingClientRect()];
      for (const r of rects) { const v = seen(el, r); if (v) rs.push(v); }
    }
    if (rs.length) boxes.push({ el, rs });
  }
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const hit = a.rs.some((p) => b.rs.some((q) => Math.min(p.right, q.right) - Math.max(p.left, q.left) > 3 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > Math.max(3, 0.34 * Math.min(p.bottom - p.top, q.bottom - q.top))));
    if (hit && !a.el.contains(b.el) && !b.el.contains(a.el)) out.overlap.push(quote(a.el) + ' and ' + quote(b.el) + ' are drawn in the same place');
  }
  for (const g of all) {
    if (!(g instanceof SVGGeometryElement) || g.closest('defs,clipPath,mask,pattern,marker,symbol')) continue;
    const c = getComputedStyle(g);
    if (c.display === 'none' || c.visibility === 'hidden' || c.stroke === 'none' || !(parseFloat(c.strokeWidth) > 0) || parseFloat(c.strokeOpacity || '1') * parseFloat(c.opacity || '1') < 0.2) continue;
    if (c.fill !== 'none' && parseFloat(c.fillOpacity || '1') > 0 && rgba(c.fill)[3] > 0) continue;
    const whole = g.getBoundingClientRect(); if (!whole.width && !whole.height) continue;
    // A level line has a box of no height: widened by its own stroke and a little more, so a rule is not mistaken for nothing.
    const gb = seen(g, { left: whole.left - 3, top: whole.top - 3, right: whole.right + 3, bottom: whole.bottom + 3 }); if (!gb) continue;
    // Only the middle of a line of text counts: a rule that runs under its baseline or over its cap height is beside it.
    const near = boxes.filter((t) => !g.contains(t.el)).map((t) => ({ el: t.el, rs: t.rs.map((r) => { const h = r.bottom - r.top; return { left: r.left + 1, right: r.right - 1, top: r.top + 0.22 * h, bottom: r.bottom - 0.22 * h }; }).filter((r) => r.right > gb.left && r.left < gb.right && r.bottom > gb.top && r.top < gb.bottom) })).filter((t) => t.rs.length);
    if (!near.length || off(g)) continue;
    const m = g.getScreenCTM(); if (!m) continue;
    let length = 0; try { length = g.getTotalLength(); } catch { continue; }
    const step = 2 / (Math.hypot(m.a, m.b) || 1), n = Math.min(Math.ceil(length / step), 4000);
    const inside = new Map();
    for (let i = 0; i <= n; i++) {
      const p = new DOMPoint(g.getPointAtLength(i * step).x, g.getPointAtLength(i * step).y).matrixTransform(m);
      if (p.x < gb.left || p.x > gb.right || p.y < gb.top || p.y > gb.bottom) continue;
      for (const t of near) if (t.rs.some((r) => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom)) inside.set(t.el, (inside.get(t.el) || 0) + 1);
    }
    // Sampled every two pixels: four samples is eight pixels of line inside the text.
    for (const [el, k] of inside) if (k >= 4) out.overlap.push('a line (' + label(g) + ') is drawn through ' + quote(el));
  }
  out.overlap = [...new Set(out.overlap)].slice(0, 8); out.truncated = [...new Set(out.truncated)].slice(0, 8);
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
  // A page that rendered nothing fails every check above without being told to: nothing sideways, nothing clipped, no
  // unnamed control, no heading to skip, no colour, no target. So what was measured is recorded here — the path the
  // browser is on, and how many characters the page's own content region holds — and the caller fails a route the
  // audit never really reached. A loading skeleton holds none: its boxes have no text, its aria-label is an attribute.
  const content = deepAll(document.body).find((n) => n.matches('[data-scroll-region]')) || document.body;
  out.text = (content.textContent || '').replace(/\\s+/g, ' ').trim().length;
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
  // The page's late chrome first (scripts/lib/settle.ts): what arrives after the measurement is taken is never measured.
  await settle(page);
  // A subtree with content-visibility: auto that is off screen is not laid out: the browser skips it, and checkVisibility()
  // does not count it as off (it is not hidden, only not laid out yet), so the walk measured boxes that were never laid
  // out. Render every such subtree first and let two frames draw it. (The probe found 180 issues across 9 routes as
  // shipped and 0 with every auto element rendered first.) content-visibility: hidden is left alone: it is not drawn,
  // and checkVisibility() already answers for it.
  await page.eval(`(() => { for (const n of deepAll(document.body)) if (n instanceof HTMLElement && getComputedStyle(n).contentVisibility === 'auto') n.style.contentVisibility = 'visible'; return true; })()`);
  await page.eval(`new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(true))))`);
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
    // First, because it is the one that fails in the direction of looking clean: a route that never rendered passes
    // everything below, and the run would end with the standard's line over a page nobody measured.
    //
    // `location.pathname` never carries a query, so comparing it to the route *as asked* fails every route that has one —
    // parent-ba measured ten combinations of five widths and two themes failing that way, deterministically, on a page
    // that renders correctly. Comparing the path alone would go too far the other way: a route that dropped its query and
    // served the default view would pass, audited as something it is not. So the path is compared, and every parameter
    // that was asked for has to still be in the address. (Both halves from parent-ba, 2026-10-12.)
    ...((): string[] => {
      const asked = new URL(route, 'http://x'), here = new URL(r.href);
      if (here.pathname.replace(/\/$/, '') !== asked.pathname.replace(/\/$/, '')) return [`the audit measured ${here.pathname} while asking for ${route} — the route served another page`];
      const dropped = [...asked.searchParams.keys()].filter((k) => !here.searchParams.has(k));
      return dropped.length ? [`the address dropped ${dropped.join(', ')} — the audit measured a different view than it asked for`] : [];
    })(),
    ...(r.text < 24 ? [`the page holds ${r.text} characters of text — it rendered nothing, or only its loading state`] : []),
    ...r.sideways.map((x) => 'sideways: ' + x),
    ...r.clipped.map((x) => 'clipped: ' + x),
    ...r.truncated.map((x) => 'truncated: ' + x + ' is cut with an ellipsis and no title holds the whole of it'),
    ...r.overlap.map((x) => 'overlap: ' + x),
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
