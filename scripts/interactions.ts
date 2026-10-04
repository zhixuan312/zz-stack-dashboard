/**
 * Press every control on every page and fail on the ones that do nothing, and on links that lead nowhere.
 *
 *   node scripts/interactions.ts [--base http://localhost:3100] [--routes /,/requests] [--extra /requests/req_1] [--quick]
 *
 * A control works when pressing it changes something: the address, the page (a dialog, a menu, a sort, a toast, a
 * file download), or opens a tab. Desktop presses with a mouse at 1440px; phones tap at 390px, where there is no hover,
 * so a tooltip-only control counts only on touch, or when it is an info button ("About …").
 *
 * Skipped: controls already in their chosen state (a selected tab, the current segment) and the Atlas's component
 * pages, whose buttons are specimens of states, not actions.
 */
import { launch, type Page } from './lib/chrome.ts';
import { discover } from './lib/routes.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
const extra = opt('--extra', '').split(',').filter(Boolean);
const ROUTES = opt('--routes', '') ? opt('--routes', '').split(',') : [...discover().filter((r) => !r.startsWith('/system/components')), ...extra];
const WIDTHS = args.includes('--quick') ? [1440] : [1440, 390];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tag every visible, enabled, not-yet-chosen control with its index; return their names and the page's links. */
const LIST = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('[aria-hidden="true"],[inert],.sr-only'); };
  const chosen = (el) => ['aria-pressed', 'aria-checked', 'aria-selected'].some((a) => el.getAttribute(a) === 'true') || el.getAttribute('aria-current') === 'page' || ['on', 'active', 'checked'].includes(el.getAttribute('data-state'));
  const all = [...document.querySelectorAll('button, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"]')]
    .filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true' && vis(b) && !chosen(b));
  return {
    controls: all.map((b, i) => (b.setAttribute('data-press', i), (b.getAttribute('aria-label') || b.textContent || b.title || '').trim().replace(/\\s+/g, ' ').slice(0, 60))),
    links: [...document.querySelectorAll('a[href]')].filter(vis).map((a) => a.getAttribute('href')),
  };
})()`;

/** Scroll the control into view, check nothing covers it, and start counting what changes. */
const ARM = (i: number) => `(() => {
  const el = document.querySelector('[data-press="${i}"]'); if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  if (!hit || !(hit === el || el.contains(hit))) return { covered: hit ? hit.tagName.toLowerCase() + '.' + String(hit.className).slice(0, 40) : 'nothing' };
  window.__changes = 0; window.__href = location.href;
  window.open = () => { window.__changes++; return null; };
  const tipOnly = (n) => { const e = n.nodeType === 1 ? n : n.parentElement; return !!e && !!(e.closest('[role="tooltip"]') || e.closest('[data-radix-popper-content-wrapper]')?.querySelector('[role="tooltip"]')); };
  window.__mo?.disconnect();
  window.__mo = new MutationObserver((ms) => { for (const m of ms) {
    if (tipOnly(m.target)) continue;
    if (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].every(tipOnly)) continue;
    if (m.type === 'attributes' && m.target === el && ['data-state', 'class', 'style', 'data-press', 'aria-describedby'].includes(m.attributeName)) continue;
    window.__changes++;
  } });
  setTimeout(() => window.__mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }), 40);
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
const failures: string[] = [];
const checkedLinks = new Map<string, number>();
let pressed = 0;

for (const width of WIDTHS) {
  const touch = width < 600;
  for (const route of ROUTES) {
    const fresh = async () => { await page.open(base + route, { width, theme: 'dark' }); return page.eval<{ controls: string[]; links: string[] }>(LIST); };
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
      if (!armed) continue;
      if (armed.covered) { failures.push(`${route} @${width}: "${controls[i]}" is covered by ${armed.covered}`); continue; }
      await sleep(100);
      await press(page, armed.x, armed.y, touch);
      await sleep(600);
      pressed++;
      const tip = touch || /^About /.test(controls[i]);
      const r = await page.eval<{ changes: number; moved: boolean }>(`({ changes: window.__changes + (${tip} ? document.querySelectorAll('[role=tooltip]').length : 0), moved: location.href !== window.__href })`);
      if (!r.changes && !r.moved) failures.push(`${route} @${width}: "${controls[i]}" does nothing when ${touch ? 'tapped' : 'pressed'}`);
      if (r.moved) await fresh();
      else {
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await sleep(200);
        if (await page.eval<boolean>(`!!document.querySelector('[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]')`)) await fresh();
      }
    }
    if (page.errors.length) failures.push(`${route} @${width}: ${page.errors[0]}`);
  }
}
page.close();
for (const f of failures) console.log('FAIL ' + f);
console.log(`\ninteractions: ${pressed} controls pressed and ${checkedLinks.size} links followed across ${ROUTES.length} routes at ${WIDTHS.join(' and ')}px; ${failures.length} issues`);
process.exit(failures.length ? 1 : 0);
