/**
 * Press every control on every page and fail on the ones that do nothing, and on links that lead nowhere.
 *
 *   node scripts/interactions.ts [--base http://localhost:3100] [--routes /,/requests]
 *
 * A control works when pressing it changes something: the address, the page (a dialog, a menu, a sort, a toast, a
 * file download), or opens a tab. Desktop presses with a mouse at 1440px; phones tap at 390px, where there is no hover,
 * so a tooltip-only control counts only on touch, or when it is an info button ("About …").
 *
 * The walk enters open shadow roots and follows slots (scripts/lib/deep.ts, injected into every page), so a control inside a
 * custom element is listed, hit-tested and observed like any other, and named with its host: `Save (in x-card)`.
 *
 * Skipped: controls already in their chosen state (a selected tab, the current segment) and the Atlas's component
 * pages, whose buttons are specimens of states, not actions.
 */
import { launch, type Page } from './lib/chrome.ts';
import { DEEP_SOURCE } from './lib/deep.ts';
import { discover } from './lib/routes.ts';
import config from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
// verify.config.ts is the team's, so read the one field this needs through its own type.
const detailRoutes = (config as { detailRoutes?: string[] }).detailRoutes ?? [];
const ROUTES = opt('--routes', '') ? opt('--routes', '').split(',') : [...discover().filter((r) => !r.startsWith('/system/components')), ...detailRoutes];
// `--as` signs every open in as one persona (scripts/verify.config.ts), through the cookie scripts/lib/chrome.ts sets
// before the first request; without it nothing changes. `--width` narrows the walk to the widths given (default: both).
const personas = (config as { personas?: Record<string, { cookie: { name: string; value: string } }> }).personas ?? {};
const as = opt('--as', '');
const cookie = as ? personas[as]?.cookie : undefined;
if (as && !cookie) { console.error(`interactions: --as ${as} is not a declared persona. Declared personas: ${Object.keys(personas).join(', ')}.`); process.exit(1); }
const WIDTHS = opt('--width', '1440,390').split(',').map(Number);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tag every visible, enabled, not-yet-chosen control with its index; return their names (with the hosts they sit in) and the page's links. */
const LIST = `(() => {
  const deepClosest = (el, sel) => { for (let n = el; n; n = deepParent(n)) if (n.matches(sel)) return n; return null; };
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !deepClosest(el, '[aria-hidden="true"],[inert],.sr-only'); };
  const chosen = (el) => ['aria-pressed', 'aria-checked', 'aria-selected'].some((a) => el.getAttribute(a) === 'true') || el.getAttribute('aria-current') === 'page' || ['on', 'active', 'checked'].includes(el.getAttribute('data-state'));
  const hosts = (el) => { const out = []; for (let r = el.getRootNode(); r instanceof ShadowRoot; r = r.host.getRootNode()) out.unshift(r.host.localName); return out; };
  const every = deepAll(document.body);
  every.forEach((n) => n.removeAttribute('data-press'));
  const all = every.filter((b) => b.matches('button, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"]'))
    .filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true' && vis(b) && !chosen(b));
  return {
    controls: all.map((b, i) => { b.setAttribute('data-press', i); const h = hosts(b); return (b.getAttribute('aria-label') || deepText(b) || b.title || '').trim().replace(/\\s+/g, ' ').slice(0, 60) + (h.length ? ' (in ' + h.join(' > ') + ')' : ''); }),
    links: every.filter((a) => a.matches('a[href]') && vis(a)).map((a) => a.getAttribute('href')),
  };
})()`;

/** Scroll the control into view, check nothing covers it, and start counting what changes. */
const ARM = (i: number) => `(() => {
  const el = deepAll(document.body).find((n) => n.getAttribute('data-press') === '${i}'); if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  // A control inside an open root is hit as its outermost host: the control, or any shadow host that contains it, is on top.
  let top = !!hit && el.contains(hit);
  for (let n = el; n && !top; n = deepParent(n)) top = hit === n && (n === el || !!n.shadowRoot);
  if (!top) return { covered: hit ? hit.tagName.toLowerCase() + '.' + String(hit.className).slice(0, 40) : 'nothing' };
  window.__changes = 0; window.__href = location.href;
  window.open = () => { window.__changes++; return null; };
  const tipOnly = (n) => { const e = n.nodeType === 1 ? n : n.parentElement; return !!e && !!(e.closest('[role="tooltip"]') || e.closest('[data-radix-popper-content-wrapper]')?.querySelector('[role="tooltip"]')); };
  const roots = () => [document.body, ...deepAll(document.body).filter((n) => n.shadowRoot).map((n) => n.shadowRoot)];
  window.__mo?.disconnect();
  window.__mo = new MutationObserver((ms) => { for (const m of ms) {
    if (tipOnly(m.target)) continue;
    if (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].every(tipOnly)) continue;
    if (m.type === 'attributes' && m.target === el && ['data-state', 'class', 'style', 'data-press', 'aria-describedby'].includes(m.attributeName)) continue;
    window.__changes++;
  } });
  setTimeout(() => roots().forEach((r) => window.__mo.observe(r, { subtree: true, childList: true, attributes: true, characterData: true })), 40);
  return { x, y };
})()`;

async function press(page: Page, x: number, y: number, touch: boolean) {
  if (touch) {
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'] as const) await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  }
}

const page = await launch();

/** One implementation of the walk: the helper is injected, never copied. A page it cannot be injected into fails the suite. */
async function inject(route: string) {
  try {
    if (!(await page.eval<boolean>(`${DEEP_SOURCE}\n;typeof deepAll === 'function' && typeof deepParent === 'function' && typeof deepQuery === 'function' && typeof deepText === 'function'`))) throw new Error('the helper is not defined after injection');
  } catch (e) {
    console.error(`interactions: cannot inject the deep-DOM helper into ${route}: ${(e as Error).message}`);
    page.close();
    process.exit(1);
  }
}
const failures: string[] = [];
const checkedLinks = new Map<string, number>();
let pressed = 0;

for (const width of WIDTHS) {
  const touch = width < 600;
  for (const route of ROUTES) {
    const fresh = async () => { await page.open(base + route, { width, theme: 'dark', cookie }); await inject(route); return page.eval<{ controls: string[]; links: string[] }>(LIST); };
    const { controls, links } = await fresh();
    for (const href of new Set(links)) {
      if (!href.startsWith('/') || checkedLinks.has(href)) continue;
      const status = (await fetch(base + href.split('#')[0], { redirect: 'manual' })).status;
      checkedLinks.set(href, status);
      if (status >= 400) failures.push(`${route}: link ${href} answers ${status}`);
    }
    for (let i = 0; i < controls.length; i++) {
      let armed = await page.eval<{ x: number; y: number; covered?: string } | null>(ARM(i));
      // Something left open or a toast in the way: start the page again and try once more.
      if (!armed || armed.covered) { await fresh(); armed = await page.eval(ARM(i)); }
      // Tagged by this suite a moment ago and gone after a fresh load: say so, never skip it.
      if (!armed) { failures.push(`${route} @${width}: "${controls[i]}" was listed but could not be found again`); continue; }
      if (armed.covered) { failures.push(`${route} @${width}: "${controls[i]}" is covered by ${armed.covered}`); continue; }
      await sleep(100);
      const choosers = page.fileChoosers();
      await press(page, armed.x, armed.y, touch);
      await sleep(600);
      pressed++;
      // A file picker answers by opening the system's file chooser, which changes nothing on the page (issue #16).
      if (page.fileChoosers() > choosers) continue;
      const tip = touch || /^About /.test(controls[i]);
      // A press that loads a new document leaves the helper and the counters behind: that page has moved, which is its answer.
      const r = await page.eval<{ changes: number; moved: boolean }>(`({ changes: window.__changes + (${tip} && typeof deepAll === 'function' ? deepAll(document.body).filter((n) => n.matches('[role=tooltip]')).length : 0), moved: location.href !== window.__href })`);
      if (!r.changes && !r.moved) failures.push(`${route} @${width}: "${controls[i]}" does nothing when ${touch ? 'tapped' : 'pressed'}`);
      if (r.moved) await fresh();
      else {
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await sleep(200);
        if (await page.eval<boolean>(`!!deepQuery('[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]', document.body)`)) await fresh();
      }
    }
    if (page.errors.length) failures.push(`${route} @${width}: ${page.errors[0]}`);
  }
}
page.close();
for (const f of failures) console.log('FAIL ' + f);
console.log(`\ninteractions: ${pressed} controls pressed and ${checkedLinks.size} links followed across ${ROUTES.length} routes at ${WIDTHS.join(' and ')}px; ${failures.length} issues`);
process.exit(failures.length ? 1 : 0);
