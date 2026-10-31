/**
 * Press every control on every page and fail on the ones that do nothing, and on links that lead nowhere.
 *
 *   node scripts/interactions.ts [--base http://localhost:3100] [--routes /,/requests] [--width 1440,390] [--as <persona>]
 *                                [--missing /a,/b]
 *
 * A control works when pressing it changes something: the address, the page (a dialog, a menu, a sort, a toast, a
 * file download), or opens a tab. Desktop presses with a mouse at 1440px; phones tap at 390px, where there is no hover,
 * so a tooltip-only control counts only on touch, or when it is an info button ("About …").
 *
 * The walk enters open shadow roots and follows slots (scripts/lib/deep.ts, injected into every page), so a control inside a
 * custom element is listed, hit-tested and observed like any other, and named with its host: `Save (in x-card)`.
 *
 * "Does nothing" means nothing answered within the hang bound (HANG_BOUND_MS): no counted change, no new address, no file
 * chooser. The walk looks once after 600 ms, then every 100 ms until the bound; a control that answers sooner is decided at
 * that first look. How fast a control answers is the navigation's interactive time, judged in the timed tier, not here.
 *
 * Skipped: controls already in their chosen state (a selected tab, the current segment) and the Atlas's component
 * pages, whose buttons are specimens of states, not actions.
 */
import { answerProblem, DRAWS_NOT_FOUND, missingRoutes } from './lib/answered.ts';
import { launch, type Page } from './lib/chrome.ts';
import { DEEP_SOURCE } from './lib/deep.ts';
import { linkPath } from './lib/links.ts';
import { discover } from './lib/routes.ts';
import { settle } from './lib/settle.ts';
import { detailRoutes, personaCookie } from './lib/team-config.ts';
import { holdArgs } from './lib/args.ts';

const args = process.argv.slice(2);
holdArgs('interactions', args, ['--as', '--base', '--missing', '--routes', '--width']);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
const MISSING = missingRoutes(args);
const ROUTES = opt('--routes', '') ? opt('--routes', '').split(',') : [...new Set([...discover().filter((r) => !r.startsWith('/system/components')), ...detailRoutes, ...MISSING])];
// `--as` signs every open in as one persona (scripts/verify.config.ts), through the cookie scripts/lib/chrome.ts sets
// before the first request; without it nothing changes. `--width` narrows the walk to the widths given (default: both).
const cookie = personaCookie('interactions', opt('--as', ''));
const WIDTHS = opt('--width', '1440,390').split(',').map(Number);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// A hang bound, not a budget: how long a press may go unanswered before the walk calls the control dead. How fast a control
// answers is the navigation's interactive time, judged in the timed tier; this only keeps a slow answer from reading as none.
const HANG_BOUND_MS = 5000;

/**
 * The page's controls and how each is named: its accessible name and the roots it sits in. A control is found again by
 * that name (and which of the controls with it), never by its place in the walk: a later load can draw the controls in
 * another order or fewer of them for a while, a table still loading or rows a concurrent write changed (#65). A name that
 * carries a live part after a comma ("Alerts, 3 new") is found again by the part before it once the exact name is gone (#66).
 */
const CONTROLS = `
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !deepClosest(el, '[aria-hidden="true"],[inert],.sr-only'); };
  const hosts = (el) => { const out = []; for (let r = el.getRootNode(); r instanceof ShadowRoot; r = r.host.getRootNode()) out.unshift(r.host.localName); return out; };
  const label = (b) => (b.getAttribute('aria-label') || deepText(b) || b.title || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
  const within = (b) => { const h = hosts(b); return h.length ? ' (in ' + h.join(' > ') + ')' : ''; };
  const nameOf = (b) => label(b) + within(b);
  // What the control is without what it says about now: the name before its first comma, so "Alerts, 3 new" is still the
  // "Alerts" listed before the read answered (#66).
  const keyOf = (b) => label(b).split(',')[0].trim() + within(b);
  // A control already chosen is not pressed: choosing it again changes nothing, which is not a dead control.
  const chosen = (el) => ['aria-pressed', 'aria-checked', 'aria-selected'].some((a) => el.getAttribute(a) === 'true') || el.getAttribute('aria-current') === 'page' || ['on', 'active', 'checked'].includes(el.getAttribute('data-state'));
  const pressable = (every) => every.filter((b) => b.matches('button, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"]'))
    .filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true' && vis(b) && !chosen(b));
`;
const LIST = `(() => {${CONTROLS}
  const every = deepAll(document.body);
  return {
    controls: pressable(every).map(nameOf),
    keys: pressable(every).map(keyOf),
    links: every.filter((a) => a.matches('a[href]') && vis(a)).map((a) => a.getAttribute('href')),
  };
})()`;

/** Scroll the control into view, check nothing covers it, and start counting what changes. */
const ARM = (name: string, nth: number, key: string, keyNth: number) => `(() => {${CONTROLS}
  const all = pressable(deepAll(document.body));
  const el = all.filter((b) => nameOf(b) === ${JSON.stringify(name)})[${nth}] ?? all.filter((b) => keyOf(b) === ${JSON.stringify(key)})[${keyNth}]; if (!el) return null;
  // A control inside a closed disclosure is laid out but not drawn: open the ones it sits in, as a reader does before
  // pressing it. The one whose own summary holds the control stays shut, since pressing that summary is the control (#82).
  for (let n = deepParent(el); n; n = deepParent(n)) {
    if (n.localName !== 'details' || n.open) continue;
    const own = [...n.children].find((c) => c.localName === 'summary');
    if (own && own.contains(el)) continue;
    n.open = true;
  }
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
    if (m.type === 'attributes' && m.target === el && ['data-state', 'class', 'style', 'aria-describedby'].includes(m.attributeName)) continue;
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

/**
 * One route at one width: every control pressed and every link followed. A page that stops answering — a protocol
 * command times out after 30 s (`scripts/lib/chrome.ts`) — is that route's own failure, named and counted, and the walk
 * goes on to the next one, as `scripts/audit.ts` measures each route in a guard of its own. Without it one hanging page
 * took the evidence for every route after it, and the count read as if it had walked them all.
 */
const walk = async (route: string, width: number) => {
  const touch = width < 600;
  // The page's late chrome first (scripts/lib/settle.ts): a control that arrives after the list is taken is never pressed, and the count reads as if it had been.
  // Each load starts the page's errors again, so what a load threw is kept before the next: an error a press threw is the
  // route's, though the walk opened the route again after it.
  const thrown: string[] = [];
  let loads = 0;
  const fresh = async () => { if (loads++) thrown.push(...page.errors); await page.open(base + route, { width, theme: 'dark', cookie }); await inject(route); await settle(page); return page.eval<{ controls: string[]; keys: string[]; links: string[] }>(LIST); };
  const { controls, keys, links } = await fresh();
  // An error page's controls are not the route's: a route that answered other than declared is that, and nothing pressed.
  const answer = answerProblem(route, page.status(), await page.eval<boolean>(DRAWS_NOT_FOUND), MISSING);
  if (answer) { failures.push(`${route} @${width}: ${answer}`); return; }
  // A link is followed as a browser follows it: its href as the page writes it, resolved against the page. Skipping every
  // href that did not start with "/" let a relative link that answered 404 pass (/system/system/contributing).
  for (const href of new Set(links)) {
    let path: string | null;
    try { path = linkPath(href, base + route); } catch { failures.push(`${route}: link ${href} is not a URL`); continue; }
    if (path === null || checkedLinks.has(path)) continue;
    // As the persona the page was opened as: a link that person may follow answers them, not a request with no one signed in.
    const status = (await fetch(base + path, { redirect: 'manual', headers: cookie ? { cookie: `${cookie.name}=${cookie.value}` } : {} })).status;
    checkedLinks.set(path, status);
    if (status >= 400) failures.push(`${route}: link ${href}${path === href ? '' : ` (${path})`} answers ${status}`);
  }
  for (let i = 0; i < controls.length; i++) {
    // Which of the controls named alike this is, in the order the first load listed them; and, for a name that has
    // changed since (a count that arrived), which of the controls that are the same thing.
    const nth = controls.slice(0, i).filter((c) => c === controls[i]).length;
    const keyNth = keys.slice(0, i).filter((k) => k === keys[i]).length;
    type Armed = { x: number; y: number; covered?: string } | null;
    // A document replaced since the last read has no helper: that is a page to open again, never a crash (#64).
    const arm = () => page.eval<Armed>(ARM(controls[i], nth, keys[i], keyNth)).catch((): Armed => null);
    let armed = await arm();
    // Something left open or a toast in the way: start the page again and try once more. A control not drawn yet on the
    // new load (a list still loading) is waited for up to the hang bound before it is called gone.
    if (!armed || armed.covered) {
      await fresh();
      armed = await arm();
      for (let waited = 0; !armed && waited < HANG_BOUND_MS; waited += 200) { await sleep(200); armed = await arm(); }
    }
    // Tagged by this suite a moment ago and gone after a fresh load: say so, never skip it.
    if (!armed) { failures.push(`${route} @${width}: "${controls[i]}" was listed but could not be found again`); continue; }
    if (armed.covered) { failures.push(`${route} @${width}: "${controls[i]}" is covered by ${armed.covered}`); continue; }
    await sleep(100);
    const choosers = page.fileChoosers();
    await press(page, armed.x, armed.y, touch);
    await sleep(600);
    pressed++;
    const tip = touch || /^About /.test(controls[i]);
    // A press that loads a new document leaves the helper and the counters behind: that page has moved, which is its answer.
    const look = () => page.eval<{ changes: number; moved: boolean }>(`({ changes: window.__changes + (${tip} && typeof deepAll === 'function' ? deepAll(document.body).filter((n) => n.matches('[role=tooltip]')).length : 0), moved: location.href !== window.__href })`);
    // A file picker answers by opening the system's file chooser, which changes nothing on the page (issue #16).
    let chosen = page.fileChoosers() > choosers;
    let r = chosen ? { changes: 1, moved: false } : await look();
    // Nothing yet: look again, never press again, until something answers or the hang bound passes. A look that lands
    // while a new document replaces the page cannot evaluate: that page has moved too.
    for (let waited = 600; !chosen && !r.changes && !r.moved && waited < HANG_BOUND_MS; waited += 100) {
      await sleep(100);
      chosen = page.fileChoosers() > choosers;
      if (!chosen) r = await look().catch(() => ({ changes: 0, moved: true }));
    }
    if (chosen) continue;
    if (r.moved) { await fresh(); continue; }
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(200);
    // A document replaced after the look closed (a team switch that reloads once its request is accepted) has lost the
    // helper and the counters: the press moved the page, late, and the route is opened again (#64).
    const after = await page.eval<{ replaced: boolean; open: boolean }>(`typeof deepQuery !== 'function' ? { replaced: true, open: false } : { replaced: location.href !== window.__href, open: !!deepQuery('[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]', document.body) }`).catch(() => ({ replaced: true, open: false }));
    if (!r.changes && !after.replaced) failures.push(`${route} @${width}: "${controls[i]}" does nothing when ${touch ? 'tapped' : 'pressed'}`);
    if (after.replaced || after.open) await fresh();
  }
  thrown.push(...page.errors);
  if (thrown.length) failures.push(`${route} @${width}: ${thrown[0]}`);
};

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    try {
      await walk(route, width);
    } catch (e) {
      failures.push(`${route} @${width}: could not be walked: ${(e as Error).message.replace(/\s+/g, ' ').trim()}`);
      await page.open('about:blank', { width, height: 900, theme: 'dark', cookie }).catch(() => {});
    }
  }
}
page.close();
for (const f of failures) console.log('FAIL ' + f);
console.log(`\ninteractions: ${pressed} controls pressed and ${checkedLinks.size} links followed across ${ROUTES.length} routes at ${WIDTHS.join(' and ')}px; ${failures.length} issues`);
// No control pressed and no link followed passes on nothing, which reads like a pass on everything.
if (!pressed && !checkedLinks.size) console.log('judged nothing: presses (no control and no link on any route)');
process.exit(failures.length ? 1 : 0);
