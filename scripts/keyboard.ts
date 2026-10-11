/**
 * The whole keyboard path of every page: Tab from the top until focus comes back round, and check each stop.
 *
 *   node scripts/keyboard.ts [--base http://localhost:3100] [--routes /,/teams]
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
import { launch } from './lib/chrome.ts';
import { DEEP_SOURCE } from './lib/deep.ts';
import { discover } from './lib/routes.ts';
import config from './verify.config.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
// verify.config.ts is the team's, so read the one field this needs through its own type.
const detailRoutes = (config as { detailRoutes?: string[] }).detailRoutes ?? [];
const ROUTES = opt('--routes', '') ? opt('--routes', '').split(',') : [...discover().filter((r) => r !== '/this-page-does-not-exist'), ...detailRoutes];
// `--as` signs every open in as one persona (scripts/verify.config.ts), through the cookie scripts/lib/chrome.ts sets
// before the first request. Without it nothing changes: no cookie is passed and the walk runs exactly as before.
const personas = (config as { personas?: Record<string, { cookie: { name: string; value: string } }> }).personas ?? {};
const as = opt('--as', '');
const cookie = as ? personas[as]?.cookie : undefined;
if (as && !cookie) { console.error(`keyboard: --as ${as} is not a declared persona. Declared personas: ${Object.keys(personas).join(', ')}.`); process.exit(1); }

/** Tag every visible control the keyboard should reach; return how many. Also records how everything looks unfocused. */
const TAG = `(() => {
  const deepClosest = (el, sel) => { for (let n = el; n; n = deepParent(n)) if (n.matches(sel)) return n; return null; };
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !deepClosest(el, '[aria-hidden="true"],[inert],.sr-only'); };
  // :disabled, not [disabled]: the attribute is only the control's own, and a fieldset with disabled disables every
  // control inside it without touching their attributes. A FormSection in its read-only or saving state is exactly
  // that, so the attribute form expected a correctly-disabled input to be reachable, and failed on a page that was right.
  const every = deepAll(document.body).filter((n) => n !== document.body);
  const all = every.filter((el) => el.matches('a[href], button:not(:disabled), input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'))
    .filter((el) => vis(el) && el.tabIndex >= 0);
  const hosts = (el) => { const out = []; for (let r = el.getRootNode(); r instanceof ShadowRoot; r = r.host.getRootNode()) out.unshift(r.host.localName); return out; };
  window.__kbName = (el) => { const h = hosts(el); return (el.getAttribute('aria-label') || deepText(el).trim() || el.getAttribute('placeholder') || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) + (h.length ? ' (in ' + h.join(' > ') + ')' : ''); };
  // A stop's identity: its tag, or, for a control the tagging did not list (a roving group hands the tab stop to a member that was
  // not tabbable when the page was tagged), a mark of its own, so a stop is the same stop forward and back.
  window.__kbN = 0; window.__kbId = (el) => el.getAttribute('data-kb') ?? (el.__kbU ??= 'u' + (++window.__kbN));
  window.__kbNames = all.map((el) => window.__kbName(el));
  all.forEach((el, i) => el.setAttribute('data-kb', i));
  // What each element looks like unfocused, so a ring is told from a decoration that is always there (as in scripts/audit.ts).
  const sig = (c) => [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderTopStyle, c.borderTopWidth, c.borderTopColor, c.borderBottomColor, c.borderLeftColor, c.borderRightColor].join('|');
  window.__kbBefore = new WeakMap(); for (const n of every) window.__kbBefore.set(n, sig(getComputedStyle(n)));
  return all.length;
})()`;

/** The focused element: its tag, whether focus gave it a ring, and whether it is on top where it sits. */
const STOP = `(() => {
  const el = deepActive(); if (!el || el === document.body) return null;
  el.setAttribute('data-kb-hit', '');
  const sig = (c) => [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderTopStyle, c.borderTopWidth, c.borderTopColor, c.borderBottomColor, c.borderLeftColor, c.borderRightColor].join('|');
  // A ring is a change on focus: an outline, a coloured shadow or a border that was not there unfocused. The element itself,
  // its frame and the frame's frame count; inside a shadow root every composed ancestor up to the outermost host does.
  const ringed = (n) => {
    const c = getComputedStyle(n), before = window.__kbBefore && window.__kbBefore.get(n);
    const outline = c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0, shadow = /rgb|oklch|oklab|color/.test(c.boxShadow) && c.boxShadow !== 'none';
    if (!before) return outline || shadow;
    const b = before.split('|'), now = sig(c).split('|');
    const outlineMoved = now.slice(0, 3).join('|') !== b.slice(0, 3).join('|'), shadowMoved = now[3] !== b[3], borderMoved = now.slice(4).join('|') !== b.slice(4).join('|') && c.borderTopStyle !== 'none';
    return (outline && outlineMoved) || (shadow && shadowMoved) || borderMoved;
  };
  const chain = [el];
  if (el.getRootNode() instanceof ShadowRoot) { for (let n = deepParent(el); n; n = deepParent(n)) { chain.push(n); if (!(n.getRootNode() instanceof ShadowRoot)) break; } }
  else { const p = deepParent(el); if (p) chain.push(p); const g = p && deepParent(p); if (g) chain.push(g); }
  const ring = chain.some(ringed);
  // The first line box, not the whole rectangle: a link that wraps has its centre over the text beside it.
  const r = el.getClientRects()[0] ?? el.getBoundingClientRect();
  const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
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
  // The stop is judged once its geometry has SETTLED, not at a fixed two frames. The focus styles
  // (the skip link sliding in) paint after the key event rather than with it, so some wait is
  // owed — but on a loaded runner the paint lands later than two frames, and an element read
  // before its style arrives is at its unfocused position: the skip link is 64px above the
  // viewport until `focus-visible` moves it down, and `elementFromPoint` clamped to y=0 there
  // returns the rail's brand row. That is a reachable, on-top skip link reported as
  // `hidden under div.flex.h-16`. Measured: this walk is 0 issues on a laptop and reported that
  // one issue on CI at the same commit, twice passing and once failing on the runner.
  //
  // Waiting for the rect to hold across three frames cannot hide a real failure: a stop that is
  // genuinely covered stays covered no matter how long the wait.
  await page.eval(`(() => new Promise((resolve) => {
    let last = '', same = 0, frames = 0;
    const step = () => {
      const el = document.activeElement;
      const r = el && el !== document.body ? (el.getClientRects()[0] ?? el.getBoundingClientRect()) : null;
      const now = r ? [r.left, r.top, r.width, r.height].join() : '';
      same = now === last ? same + 1 : 0;
      last = now;
      if (same >= 2 || ++frames > 12) resolve(true); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }))()`);
};

const page = await launch();
let failures = 0;
for (const route of ROUTES) {
  await page.open(base + route, { width: 1440, height: 900, theme: 'dark', wait: 2500, cookie });
  // One implementation of the walk: the helper is injected, never copied. A page it cannot be injected into fails the suite.
  try {
    if (!(await page.eval<boolean>(`${DEEP_SOURCE}\n;typeof deepAll === 'function' && typeof deepActive === 'function' && typeof deepParent === 'function' && typeof deepText === 'function'`))) throw new Error('the helper is not defined after injection');
  } catch (e) {
    console.error(`keyboard: cannot inject the deep-DOM helper into ${route}: ${(e as Error).message}`);
    page.close();
    process.exit(1);
  }
  const total = await page.eval<number>(TAG);
  const reached = new Set<string>();
  const order: string[] = [];
  const names = new Map<string, string>();
  const problems: string[] = [];
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
  else console.log(`ok   ${route} (${reached.size} stops, every one ringed and on top, and the same in reverse)`);
}
page.close();
console.log(`\nkeyboard: ${failures} issues across ${ROUTES.length} routes`);
process.exit(failures ? 1 : 0);
