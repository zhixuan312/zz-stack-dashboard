/**
 * The whole keyboard path of every page: Tab from the top until focus comes back round, and check each stop.
 *
 *   node scripts/keyboard.ts [--base http://localhost:3100] [--routes /,/teams] [--as <persona>] [--missing /a,/b]
 *
 * Fails (exit 1) when the first stop inside the shell is not "Skip to content", when a stop shows no focus ring (an outline, a
 * ring drawn as a box shadow, or a border, that focus CHANGED, on the control or the frame around it; inside a shadow root, on
 * any composed ancestor up to the outermost host), when a focused control is hidden under something else such as the sticky
 * top bar (WCAG 2.4.11), when a visible control is never reached at all, or when pressing Shift+Tab back through the stops
 * does not visit them in the reverse order.
 *
 * The walk enters open shadow roots and follows slots (scripts/lib/deep.ts, injected into every page): the focused element
 * is `deepActive()`, and a control inside a custom element is named with its host, as `Run (in x-ring)`.
 * The audit (scripts/audit.ts) checks the first eighteen stops of every page at every width; this walks all of them.
 *
 * This proves every control is REACHABLE and ringed; it never ACTIVATES one with the keyboard. The activation is held
 * where it can be held without guessing: a native button, link or field answers Enter and Space by itself, Radix's
 * primitives carry their own keys, and scripts/check.ts fails any element that only claims a control's role
 * (role="button", "tab", "switch" and the rest) with no onKeyDown (issue #11). A pass that presses keys here is left
 * out on purpose, so it cannot cry wolf: what a key should do
 * depends on the role — Enter activates a button and a menu item, Space toggles a checkbox and a switch, and an arrow
 * key moves within a radio group — so a blanket "something must change on Enter" fails honest controls and teaches
 * people to ignore the check. Two things a future check needs: send the key as
 * `Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })`
 * — a CDP keyDown WITHOUT `text` does not activate a button at all, which reads as a dead control — and press by role,
 * not one key for everything.
 */
import { answerProblem, DRAWS_NOT_FOUND, missingRoutes, NOT_FOUND_PROBE } from './lib/answered.ts';
import { launch } from './lib/chrome.ts';
import { DEEP_SOURCE } from './lib/deep.ts';
import { discover } from './lib/routes.ts';
import { settle } from './lib/settle.ts';
import { detailRoutes, personaCookie } from './lib/team-config.ts';
import { holdArgs } from './lib/args.ts';

const args = process.argv.slice(2);
holdArgs('keyboard', args, ['--as', '--base', '--missing', '--routes']);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
const MISSING = missingRoutes(args);
const ROUTES = opt('--routes', '') ? opt('--routes', '').split(',') : [...new Set([...discover(), ...detailRoutes, ...MISSING])].filter((r) => r !== NOT_FOUND_PROBE);
// `--as` signs every open in as one persona (scripts/verify.config.ts), through the cookie scripts/lib/chrome.ts sets
// before the first request. Without it nothing changes: no cookie is passed and the walk runs exactly as before.
const cookie = personaCookie('keyboard', opt('--as', ''));

/** Tag every visible control the keyboard should reach; return how many. Also records how everything looks unfocused. */
const TAG = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !deepClosest(el, '[aria-hidden="true"],[inert],.sr-only'); };
  // :disabled, not [disabled]: the attribute is only the control's own, and a fieldset with disabled disables every
  // control inside it without touching their attributes. A FormSection in its read-only or saving state is exactly
  // that, so the attribute form expected a correctly-disabled input to be reachable, and failed on a page that was right.
  // A tabindex does not make a disabled control a stop either: a save bar's Discard keeps tabindex="0" while it saves.
  // A reader opens a disclosure to reach what is in it. A closed <details> lays its content out without drawing it, so
  // the content has a real box while Tab skips it: tagged, it was reported as never reached (#82).
  for (const n of deepAll(document.body)) if (n.localName === 'details' && !n.open) n.open = true;
  const every = deepAll(document.body).filter((n) => n !== document.body);
  const all = every.filter((el) => el.matches('a[href], button:not(:disabled), input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]):not(:disabled)'))
    .filter((el) => vis(el) && el.tabIndex >= 0);
  const hosts = (el) => { const out = []; for (let r = el.getRootNode(); r instanceof ShadowRoot; r = r.host.getRootNode()) out.unshift(r.host.localName); return out; };
  window.__kbName = (el) => { const h = hosts(el); return (el.getAttribute('aria-label') || deepText(el).trim() || el.getAttribute('placeholder') || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) + (h.length ? ' (in ' + h.join(' > ') + ')' : ''); };
  // A stop's identity: its tag, or, for a control the tagging did not list (a roving group hands the tab stop to a member that was
  // not tabbable when the page was tagged), a mark of its own, so a stop is the same stop forward and back.
  window.__kbN = 0; window.__kbId = (el) => el.getAttribute('data-kb') ?? (el.__kbU ??= 'u' + (++window.__kbN));
  window.__kbNames = all.map((el) => window.__kbName(el));
  all.forEach((el, i) => el.setAttribute('data-kb', i));
  // What each element looks like unfocused, so a ring is told from a decoration that is always there (scripts/lib/deep.ts).
  window.__kbBefore = new WeakMap(); for (const n of every) window.__kbBefore.set(n, ringSignature(getComputedStyle(n)));
  return all.length;
})()`;

/** The focused element: its tag, whether focus gave it a ring, and whether it is on top where it sits. */
const STOP = `(() => {
  const el = deepActive(); if (!el || el === document.body) return null;
  el.setAttribute('data-kb-hit', '');
  // A ring is a change on focus, wherever on the element's frames it may be drawn (scripts/lib/deep.ts).
  const ring = ringChain(el).some((n) => ringed(n, window.__kbBefore && window.__kbBefore.get(n)));
  // The first line box, not the whole rectangle: a link that wraps has its centre over the text beside it.
  const r = el.getClientRects()[0] ?? el.getBoundingClientRect();
  const x = Math.min(document.documentElement.clientWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
  const hit = document.elementFromPoint(x, y);
  // A control inside an open root is hit as its outermost host: on top is the control, or any shadow host that contains it.
  let onTop = !!hit && (hit === el || el.contains(hit) || hit.contains(el) || !!hit.closest('[data-radix-popper-content-wrapper]'));
  for (let n = el; n && !onTop; n = deepParent(n)) onTop = hit === n && !!n.shadowRoot;
  return { id: window.__kbId(el), name: window.__kbName(el), ring, onTop, covered: onTop ? '' : (hit ? hit.tagName.toLowerCase() + '.' + String(hit.className).split(' ').slice(0, 2).join('.') : 'nothing') };
})()`;

/** Who has focus now, without marking it as reached. */
const WHO = `(() => { const el = deepActive(); if (!el || el === document.body) return null; return { id: window.__kbId(el), name: window.__kbName(el) }; })()`;

/** Controls tagged and not focused by the forward walk, and the tagged ones that can no longer be found. */
const MISSED = `(() => {
  const found = new Set(), missed = [];
  for (const el of deepAll(document.body)) {
    const k = el.getAttribute('data-kb'); if (k === null) continue;
    found.add(k);
    if (!el.matches('[data-kb-hit]') && !deepAll(el).some((n) => n !== el && n.matches('[data-kb-hit]'))) missed.push({ kb: k, name: window.__kbName(el) });
  }
  return { missed, gone: window.__kbNames.map((name, i) => [String(i), name]).filter(([k]) => !found.has(k)).map(([, name]) => name) };
})()`;

const SHIFT_TAB = 8;
const press = async (modifiers: number) => {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers });
  // The focus styles (the skip link sliding in) paint after the key event, and on a loaded machine later than any fixed
  // number of frames: a stop is judged once its box has held still for three frames, or after twelve. A stop that is
  // really covered stays covered however long the wait.
  await page.eval(`new Promise((resolve) => {
    let last = '', held = 0, frames = 0;
    const tick = () => {
      const r = document.activeElement ? document.activeElement.getBoundingClientRect() : null;
      const now = r ? [r.x, r.y, r.width, r.height].join(',') : '';
      held = now === last ? held + 1 : 0;
      last = now;
      if (held >= 3 || ++frames >= 12) resolve(true);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })`);
};

const page = await launch();

let failures = 0;

/** Every stop the walks tagged, across the routes: none at all is a walk that judged nothing. */
let stops = 0;
/**
 * One route's walk. A page that stops answering — a protocol command times out after 30 s (`scripts/lib/chrome.ts`) — is
 * that route's own failure, named and counted, and the walk goes on to the next one, as `scripts/audit.ts` measures each
 * route in a guard of its own. Without it one hanging page ended the suite and its evidence for every route after it.
 */
const walk = async (route: string) => {
  await page.open(base + route, { width: 1440, height: 900, theme: 'dark', wait: 2500, cookie });
  // One implementation of the walk: the helper is injected, never copied. A page it cannot be injected into fails the suite.
  try {
    if (!(await page.eval<boolean>(`${DEEP_SOURCE}\n;typeof deepAll === 'function' && typeof deepActive === 'function' && typeof deepParent === 'function' && typeof deepText === 'function'`))) throw new Error('the helper is not defined after injection');
  } catch (e) {
    // The route is named and counted by the guard around this walk; the suite goes on to the next one.
    console.error(`keyboard: cannot inject the deep-DOM helper into ${route}: ${(e as Error).message}`);
    throw new Error('the deep-DOM helper could not be injected');
  }
  // The shell's late chrome first: a walk that starts before it has arrived counts a different page on the way back.
  await settle(page);
  const total = await page.eval<number>(TAG);
  stops += total;
  const reached = new Set<string>();
  const order: string[] = [];
  const names = new Map<string, string>();
  const problems: string[] = [];
  const answer = answerProblem(route, page.status(), await page.eval<boolean>(DRAWS_NOT_FOUND), MISSING);
  if (answer) problems.push(answer);
  let first = '';
  let wrapped = false;
  for (let i = 0; i < 400; i++) {
    await press(0);
    const measure = () => page.eval<{ id: string; name: string; ring: boolean; onTop: boolean; covered: string } | null>(STOP);
    let s = await measure();
    if (!s) continue;
    // Ask again before calling a control covered. A control that has just taken focus may not yet be painted where it
    // will sit — the skip link is drawn off the top edge until `:focus-visible` moves it in — and a measurement taken
    // in between finds the sticky bar over it. On a loaded runner that cost the release its gates job: `/keys` failed
    // with "hidden under div.flex.h-16: Skip to content" while the same page passed here and in the dry run. A control
    // that is genuinely under something stays under it, so the second look costs a page nothing and a false failure.
    if (!s.onTop) {
      await page.eval('new Promise((r) => setTimeout(r, 150))');
      s = (await measure()) ?? s;
    }
    if (i === 0 || (!first && s)) first = first || s.name;
    if (reached.has(s.id)) { wrapped = true; break; }
    reached.add(s.id); order.push(s.id); names.set(s.id, s.name);
    if (!s.ring) problems.push(`no focus ring: ${s.name}`);
    if (!s.onTop) problems.push(`hidden under ${s.covered}: ${s.name}`);
  }
  // A control counts as reached when it, or a control inside it, took focus: a radio group is entered at its checked
  // radio and moved through with the arrow keys, as ARIA's radio pattern asks.
  const { missed, gone } = await page.eval<{ missed: { kb: string; name: string }[]; gone: string[] }>(MISSED);
  // The way back: Shift+Tab from the first stop must visit the stops in the reverse order, and nothing else. A control the
  // forward walk skipped but this one reaches is still reported as never reached, with that said.
  const back: string[] = [];
  if (wrapped && order.length) {
    const seen = new Set([order[0]]);
    for (let i = 0; i < 400; i++) {
      await press(SHIFT_TAB);
      const w = await page.eval<{ id: string; name: string } | null>(WHO);
      if (!w) continue;
      if (seen.has(w.id)) break;
      seen.add(w.id); back.push(w.id); names.set(w.id, w.name);
    }
    const want = order.slice(1).reverse();
    if (back.join() !== want.join()) {
      const list = (ids: string[]) => ids.map((k) => names.get(k) ?? `#${k}`).join(' < ');
      problems.push(`reverse order differs: Shift+Tab visits ${list(back) || 'nothing'}, Tab visited ${list(want) || 'nothing'} (reversed)`);
    }
  }
  // Bypass blocks (WCAG 2.4.1) is owed where blocks repeat: inside the shell, with its rail. A standalone screen has none.
  const shell = await page.eval<boolean>(`!!deepQuery('a[href="#content"]', document.body)`);
  if (shell && !/skip to content/i.test(first)) problems.push(`first stop is "${first}", not Skip to content`);
  for (const m of missed) problems.push(`never reached: ${m.name}${back.includes(m.kb) ? ' (Tab skips it; only Shift+Tab reaches it)' : ''}`);
  // Tagged a moment ago and not in the page now: say so, never skip it.
  for (const g of gone) problems.push(`could not be found again: ${g}`);
  const unique = [...new Set(problems)];
  if (unique.length) { failures += unique.length; console.log(`FAIL ${route} (${reached.size} of ${total} stops)\n  ${unique.slice(0, 12).join('\n  ')}`); }
  else console.log(`ok   ${route} (${reached.size} stops, every one ringed and on top, ${wrapped && order.length ? 'and the same in reverse' : 'the reverse walk not run: Tab did not come back round'})`);
};

for (const route of ROUTES) {
  try {
    await walk(route);
  } catch (e) {
    failures += 1;
    console.log(`FAIL ${route}\n  could not be walked: ${(e as Error).message.replace(/\s+/g, ' ').trim()}`);
    await page.open('about:blank', { width: 1440, height: 900, theme: 'dark', wait: 0, cookie }).catch(() => {});
  }
}
page.close();
console.log(`\nkeyboard: ${failures} issues across ${ROUTES.length} routes`);
if (!stops) console.log('judged nothing: keyboard (no stop to tab to on any route)');
process.exit(failures ? 1 : 0);
