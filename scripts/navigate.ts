/**
 * Navigation readiness against the built app: for each route, how long until the shell is there, until the data is, and
 * until a control works, on a desktop and through the real phone drawer.
 *
 *   node scripts/navigate.ts --base http://127.0.0.1:3000 [--routes /,/requests,/settings] [--mode default|full] [--samples 1]
 *
 * Each journey starts from the rail route before the destination (the one after it for the first), waits for what a visitor
 * would wait for (the destination's router prefetch and every chunk it brought in, once its link is shown; the drawer on a
 * phone), presses the destination in the rail and times three things from that press:
 * the shell (the path and the heading), the data (the mapping's `readySelector` and `readyText`, never a skeleton's rows) and the interaction (its
 * `probe` on `controlSelector`, observed on `resultSelector`). Times are the page's own clock, from the press event to the first
 * frame that shows the condition, never round trips over the debugging protocol. The phone is 390 wide, 4x CPU throttled, 150 ms and 1.6 Mbps,
 * and the drawer-open-to-navigation time is reported apart.
 *
 * A timing over its budget is retaken twice and gated on the median of three (scripts/lib/timing.ts). A wrong result, a
 * page that never gets ready and a control that does nothing are failures and are never retaken. A route with no mapping
 * is measured for its shell only; its data and interaction are `not-configured`, never passed. A mapping's selectors resolve inside
 * open shadow roots (scripts/lib/deep.ts); when the control's selector matches several elements the first visible one is pressed and
 * `note: <selector> matches <n> elements; the first visible one was used` is printed once, never a failure. Nothing here writes:
 * probes only open, sort, filter, toggle or follow.
 *
 * One line per route and device, one per device for the prefetch bytes, and a JSON summary on the last line:
 *
 *   ok|FAIL|warn|not run <route> <device> shell <ms> · data <ms|not-configured> · interactive <ms|not-configured>[ · noisy][ · <reasons>]
 *   navigate: {...}
 *
 * scripts/perf.ts drives the same journey 20 times per route, device and condition (warm, cold and after a live refresh).
 *
 * The exit code is non-zero on a FAIL and on a configuration error. Missing Chrome makes every line `not run`: exit 0 in
 * the default mode, non-zero in `full`. The mappings and budgets come from scripts/verify.config.ts, which `--config` can
 * replace and `--rail` can name the rail routes for (the readiness fixtures, which have no src/app.config.ts).
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEEP_SOURCE } from './lib/deep.ts';
import { budgetsOf, type BudgetsConfig, type NavigationCheck } from './lib/budgets.ts';
import { launch, type Page } from './lib/chrome.ts';
import { resolveCoverage, selectSmokeRoutes } from './lib/coverage.ts';
import { railRoutes } from './lib/routes.ts';
import { isPrefetch, prefetchProblems } from './lib/sizes.ts';
import { judge } from './lib/timing.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const base = (opt('--base') ?? process.env.BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const mode = (opt('--mode') ?? 'default') as 'default' | 'full';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type Device = 'desktop' | 'phone';
export type Metric = 'shell' | 'data' | 'interactive';
/** What the visitor's tab has done before the press: `warm` waited for prefetch, `cold` had none for the destination, `afterLive` just refreshed. */
export type Condition = 'warm' | 'cold' | 'afterLive';
export const DEVICES: Device[] = ['desktop', 'phone'];
export const METRICS: Metric[] = ['shell', 'data', 'interactive'];
export const BUDGET_KEY = { shell: 'shellMs', data: 'dataMs', interactive: 'interactiveMs' } as const;
/** The phone is slow by design: its waits are longer, never its budgets. */
const PATIENCE: Record<Device, number> = { desktop: 10_000, phone: 30_000 };
/** How long a press may take to show its result before the control is called dead: past every cold interactive budget. */
const RESULT_WAIT: Record<Device, number> = { desktop: 5000, phone: 12_000 };
const KIB = 1024;

/** The fields of the team's config that navigate reads, each optional: an older product's config has none of them. */
export type NavConfig = BudgetsConfig & { navigationChecks?: NavigationCheck[]; smokeRoutes?: string[] };

// ---- what a journey can end in ----

type Kind = 'never-ready' | 'wrong-result' | 'control-dead' | 'prefetched';
/** A failure that is the answer, not a measurement to repeat. */
export class Fail extends Error {
  kind: Kind;
  constructor(kind: Kind, message: string) { super(message); this.kind = kind; }
}
export type Measured = { ms: number } | { fail: Fail };
export type Sample = { shell: Measured; data: Measured | null; interactive: Measured | null; drawerMs?: number; prefetchCapped: boolean; refused?: number };

// ---- in the page ----

/**
 * Every element of the page that matches a project-given selector, inside open shadow roots too (deepAll, scripts/lib/deep.ts).
 * A combinator does not cross a shadow boundary: `x-host .inner` finds nothing inside `x-host`'s root. Page code, defined after
 * the deep-DOM helper in every document this tab opens.
 */
const DEEP_MATCHES = `function deepMatches(selector) { return deepAll(document).filter((el) => el.matches(selector)); }`;

/** What a probe's result looks like: the address, how many elements, their text and their state attributes. Runs in the page. */
const SNAP = `(selector) => location.href + '|' + deepMatches(selector).slice(0, 40)
  .map((el) => (el.textContent ?? '').trim().slice(0, 80) + ['aria-sort', 'aria-expanded', 'aria-pressed', 'aria-checked', 'aria-selected', 'data-state', 'open'].map((a) => el.getAttribute(a)).join(','))
  .join(';')`;
/**
 * Before the app runs: remembers every router prefetch, so the bytes can be summed and awaited, and keeps the clock for the
 * journey. The times are the page's own: the press is the `pointerdown` event's time and a condition holds at the first frame
 * that finds it true, so no round trip over the debugging protocol is in any of them. The press and the spec are kept in
 * sessionStorage, so a page that loads anew (not a client navigation) is timed from the same press.
 */
const INSTRUMENT = `${DEEP_SOURCE}\n${DEEP_MATCHES}\n(() => {
  const nav = window.__nav = { prefetches: [], spec: null, t0: undefined, res: {}, expect: null, snap: ${SNAP} };
  const KEY = '__nav_journey';
  try { const kept = JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); if (kept) { nav.spec = kept.spec; nav.t0 = kept.t0; } } catch { /* a fresh journey */ }
  nav.arm = (spec) => { nav.before = document.querySelector('h1')?.textContent.trim(); nav.spec = spec; nav.t0 = undefined; nav.res = {}; nav.expect = null; try { sessionStorage.setItem(KEY, JSON.stringify({ spec, t0: null })); } catch { /* kept in memory */ } };
  document.addEventListener('pointerdown', (e) => {
    if (!nav.spec || nav.t0 != null) return;
    nav.t0 = performance.timeOrigin + e.timeStamp;
    try { sessionStorage.setItem(KEY, JSON.stringify({ spec: nav.spec, t0: nav.t0 })); } catch { /* kept in memory */ }
  }, true);
  const frame = (ts) => {
    const s = nav.spec;
    if (s && nav.t0 != null) {
      const at = Math.max(0, Math.round(performance.timeOrigin + ts - nav.t0));
      const r = nav.res;
      if (r.shell === undefined && location.pathname === s.route) {
        const h = document.querySelector('h1');
        const text = h ? h.textContent.trim() : '';
        // Without a title, a heading that differs from the one on screen at the press is the target's.
        if (text !== '' && (s.title ? text.includes(s.title) : text !== nav.before)) r.shell = at;
      }
      // Until the heading is the target's, the page on screen is the old one, whose table would answer for the new one.
      if (r.shell !== undefined) {
        // Only what is on screen and real counts as the data. The router keeps routes it has shown mounted and hidden
        // (Cache Components: display none), so the previous page's rows are still in the document; and a loading.tsx
        // draws rows shaped like the real ones, which would hide the time React holds a shown fallback (300 ms or more).
        if (s.ready && r.data === undefined && location.pathname === s.route && deepMatches(s.ready).some((el) => el.getClientRects().length > 0 && el.textContent.toLowerCase().includes(s.text) && !el.querySelector('.shimmer') && !el.closest('.shimmer, [aria-busy="true"]'))) r.data = at;
        // A link probe leaves the route: its result is the address changing.
        if (nav.expect && r.interactive === undefined && nav.snap(nav.expect.selector) !== nav.expect.before) r.interactive = at;
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  try { performance.setResourceTimingBufferSize(2000); } catch { /* keep the default */ }
  // The chunks a prefetch brings in are scripts and styles the page adds to itself. Each is on the link until the browser has
  // a timing entry for it, which it writes when the response has ended. A script for browsers without modules is never fetched.
  nav.wanted = new Set();
  nav.loading = () => [...nav.wanted].filter((u) => performance.getEntriesByName(u).length === 0).length;
  const want = (el) => {
    const url = el instanceof HTMLScriptElement ? (el.noModule ? '' : el.src) : el instanceof HTMLLinkElement && /preload|modulepreload|stylesheet/.test(el.rel) ? el.href : '';
    if (url) nav.wanted.add(url);
  };
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) { want(n); if (n instanceof Element) n.querySelectorAll('script[src],link').forEach(want); }
  }).observe(document, { childList: true, subtree: true });
  const headerOf = (input, init, name) => {
    const h = (init && init.headers) || (input instanceof Request ? input.headers : null);
    if (!h) return null;
    if (h instanceof Headers) return h.get(name);
    if (Array.isArray(h)) { const hit = h.find(([k]) => String(k).toLowerCase() === name); return hit ? hit[1] : null; }
    const key = Object.keys(h).find((k) => k.toLowerCase() === name);
    return key ? h[key] : null;
  };
  // What perf needs of a live refresh: the Server Actions that answered { ok: true }, and the router's own (not prefetch) RSC reads.
  const act = nav.act = { started: 0, inFlight: 0, results: [], arrivedAt: [] };
  const rsc = nav.rsc = { reads: [] };
  // A cold sample refuses the destination's prefetches: they are counted here and never reach the network.
  nav.blocked = [];
  nav.track = false;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const prefetch = headerOf(input, init, 'next-router-prefetch');
    const action = headerOf(input, init, 'next-action') !== null;
    // The router's own reads are watched only while a refresh is awaited, so a timed navigation's response is never tapped.
    const read = nav.track && !action && prefetch === null && headerOf(input, init, 'rsc') !== null;
    if (prefetch === null && !action && !read) return nativeFetch(input, init);
    if (action) {
      const at = act.started++;
      act.inFlight++;
      act.results[at] = null;
      return nativeFetch(input, init).then((r) => {
        // The router refresh begins once the page has this answer, so the answer's arrival is what its read is placed after.
        act.arrivedAt[at] = performance.now();
        const finish = (ok) => { act.results[at] = ok; act.inFlight--; };
        r.clone().text().then((t) => finish(r.ok && /"ok":true/.test(t)), () => finish(false));
        return r;
      }, (e) => { act.results[at] = false; act.inFlight--; throw e; });
    }
    if (read) {
      const mine = { start: performance.now(), done: false };
      rsc.reads.push(mine);
      const settle = () => { mine.done = true; };
      return nativeFetch(input, init).then((r) => { r.clone().arrayBuffer().then(settle, settle); return r; }, (e) => { settle(); throw e; });
    }
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    if (window.__navBlock && url.pathname === window.__navBlock) { nav.blocked.push(url.href); return Promise.reject(new TypeError('prefetch refused by the cold sample')); }
    const seen = { url: url.href, path: url.pathname, done: false, headers: { 'next-router-prefetch': String(prefetch), 'next-router-segment-prefetch': String(headerOf(input, init, 'next-router-segment-prefetch')) } };
    nav.prefetches.push(seen);
    // Done is the whole body read, not the headers: a response still streaming is still on the link.
    return nativeFetch(input, init).then((r) => { r.clone().arrayBuffer().then(() => { seen.done = true; }, () => { seen.done = true; }); return r; }, (e) => { seen.done = true; throw e; });
  };
})()`;

/**
 * The first element of `selector` a person could press now: shown, and once the page is a Next one, hydrated, because a
 * press before hydration does nothing. Null when there is none.
 */
const pickable = (selector: string) => `(() => {
  // React marks what it rendered once it hydrates; it never renders into a shadow root, so a control inside one is ready
  // when the host React rendered is.
  const rendered = (el) => { let n = el; while (n.getRootNode() instanceof ShadowRoot) n = n.getRootNode().host; return n; };
  const hydrated = typeof self.__next_f === 'undefined' ? () => true : (el) => Object.keys(rendered(el)).some((k) => k.startsWith('__reactProps$'));
  return deepMatches(${JSON.stringify(selector)}).find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && hydrated(el);
  }) ?? null;
})()`;

/** Where the centre of the first pressable element of `selector` is, or null while none is or something covers it. */
async function point(page: Page, selector: string): Promise<{ x: number; y: number } | null> {
  return page.eval<{ x: number; y: number } | null>(`(() => {
    const el = ${pickable(selector)};
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    // The topmost element at the point, through open roots: document.elementFromPoint stops at the outermost host.
    let hit = document.elementFromPoint(x, y);
    for (let inner = hit && hit.shadowRoot && hit.shadowRoot.elementFromPoint(x, y); inner && inner !== hit; inner = hit.shadowRoot && hit.shadowRoot.elementFromPoint(x, y)) hit = inner;
    for (let n = hit; n; n = deepParent(n)) if (n === el) return { x, y };
    return null;
  })()`);
}

/** Presses with the mouse; resolves with the time of the press. */
async function press(page: Page, at: { x: number; y: number }): Promise<number> {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at, button: 'left', clickCount: 1 });
  const t = Date.now();
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at, button: 'left', clickCount: 1 });
  return t;
}

/** Polls `read` until it returns something, or `until` (a clock time) passes. */
async function poll<T>(read: () => Promise<T | null | false>, until: number): Promise<T | null> {
  for (;;) {
    const v = await read();
    if (v) return v;
    if (Date.now() > until) return null;
    await sleep(15);
  }
}

// ---- the journey ----

/** Instruments every page this tab opens from now on; `refuse` is a path whose router prefetches the page must never send. */
export async function prepare(page: Page, refuse?: string): Promise<void> {
  await page.send('Network.enable');
  if (refuse !== undefined) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__navBlock = ${JSON.stringify(refuse)};` });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT });
}

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

async function throttle(page: Page, device: Device) {
  await page.send('Network.enable');
  await page.send('Network.clearBrowserCache');
  // 1.6 Mbps down is 200 000 bytes a second.
  await page.send('Network.emulateNetworkConditions', device === 'phone'
    ? { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 200_000 }
    : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.send('Emulation.setCPUThrottlingRate', { rate: device === 'phone' ? 4 : 1 });
}

async function openStart(page: Page, device: Device, start: string, origin: string) {
  await throttle(page, device);
  await page.open(origin + start, { ...(device === 'phone' ? PHONE : DESKTOP), theme: 'dark', wait: 200 });
  const ready = await poll(() => page.eval<boolean>(`document.readyState === 'complete' && !!document.querySelector('h1')`), Date.now() + PATIENCE[device]);
  if (!ready) throw new Fail('never-ready', `the starting page ${start} did not load in ${PATIENCE[device]} ms`);
}

/** How long a warm press waits for the prefetches and the chunks they bring in, from the link being shown. */
const PREFETCH_WAIT = 6000;
/** How long the router has, once a link is shown, to start prefetching its destination before the page is taken as one that does not. */
const PREFETCH_START_WAIT = 2500;
/** How long the prefetches and the chunks must stay done for the page to be called idle. */
const PREFETCH_SETTLE = 120;

/**
 * Waits until the router has prefetched `route` and everything it brought in is there: every prefetch has its whole body and
 * every script and style a prefetch added has loaded, twice in a row. A prefetch begins a moment after its link is shown, its
 * content (not only the route tree that comes first) after that, and its chunks when its body has arrived, so "not yet" holds
 * until the destination's content has been asked for or `PREFETCH_START_WAIT` has passed: a page that never prefetches its
 * destination is then idle. False when the cap passed first.
 */
async function awaitPrefetch(page: Page, route: string): Promise<boolean> {
  const from = Date.now();
  let quiet = 0;
  const idle = await poll(async () => {
    const state = await page.eval<{ started: boolean; done: boolean }>(`({ started: window.__nav.blocked.length > 0 || window.__nav.prefetches.some((p) => p.path === ${JSON.stringify(route)} && p.headers['next-router-segment-prefetch'] !== '/_tree'), done: window.__nav.prefetches.every((p) => p.done) && window.__nav.loading() === 0 })`);
    if (!state.done || (!state.started && Date.now() - from < PREFETCH_START_WAIT)) { quiet = 0; return false; }
    quiet = quiet || Date.now();
    return Date.now() - quiet >= PREFETCH_SETTLE;
  }, from + PREFETCH_WAIT);
  return idle !== null;
}

/** How long a verified refresh may take: the Server Action, then the router's read of the page. */
const REFRESH_WAIT = 15_000;
/** How long the router's read may take to start once the action has answered. */
const REFRESH_START_WAIT = 3000;

/**
 * Resyncs the tab's live provider without writing anything: the provider listens for `online`, reads the collections again
 * through `refreshCollections` and then refreshes the router. Resolves only when an action started after the event answered
 * `{ ok: true }` and the router read that followed it has its whole body, and throws never-ready otherwise.
 */
export async function liveRefresh(page: Page, wait = REFRESH_WAIT): Promise<void> {
  const state = `(() => { const n = window.__nav; return { started: n.act.started, results: n.act.results, arrivedAt: n.act.arrivedAt, inFlight: n.act.inFlight, reads: n.rsc.reads }; })()`;
  type State = { started: number; results: (boolean | null)[]; arrivedAt: number[]; inFlight: number; reads: { start: number; done: boolean }[] };
  // The provider's own opening resync may still be running; the refresh that counts starts after it.
  const quiet = await poll(() => page.eval<State>(state).then((v) => v.inFlight === 0), Date.now() + REFRESH_WAIT);
  if (quiet === null) throw new Fail('never-ready', `a live refresh was still running ${REFRESH_WAIT} ms after the page loaded`);
  await page.eval(`window.__nav.track = true`);
  const from = (await page.eval<State>(state)).started;
  await page.eval(`window.dispatchEvent(new Event('online'))`);
  const verified = await poll(async () => {
    const v = await page.eval<State>(state);
    const at = v.results.findIndex((r, i) => i >= from && r === true);
    return at >= 0 && v.inFlight === 0 ? { arrivedAt: v.arrivedAt[at] } : false;
  }, Date.now() + wait);
  if (!verified) {
    await page.eval(`window.__nav.track = false`);
    throw new Fail('never-ready', `no refresh action answered { ok: true } within ${wait} ms of the page's online event (is the starting page live?)`);
  }
  // The router's read is the first one to begin after the answer; it is finished when its whole body is in.
  const refreshed = await poll(async () => {
    const v = await page.eval<State>(state);
    return v.reads.find((r) => r.start >= verified.arrivedAt)?.done === true;
  }, Date.now() + REFRESH_START_WAIT + REFRESH_WAIT);
  await page.eval(`window.__nav.track = false`);
  if (!refreshed) throw new Fail('never-ready', 'the router refresh after the verified live refresh did not finish');
  // Committed to the screen, not only received.
  await page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`);
}

/**
 * Where a journey to `route` starts: the rail route before it in rail order, so the sequence a person browses in is the one
 * measured, or the one after it for the first. `pool` is the routes that may start one; undefined when it has none but `route`.
 */
export function startFor(order: string[], route: string, pool: string[] = order): string | undefined {
  const at = order.indexOf(route);
  return [...order.slice(0, Math.max(at, 0)).reverse(), ...order.slice(at + 1)].find((r) => pool.includes(r) && r !== route);
}

/**
 * The rail routes whose phone page has the console's drawer: a journey can only start from one. A route with a frame of its own
 * (the Atlas) is a destination, never a start, so the start is the nearest console route before it.
 */
export async function drawerRoutes(page: Page, origin: string, routes: string[]): Promise<string[]> {
  const have: string[] = [];
  for (const route of routes) {
    await page.open(origin + route, { ...PHONE, theme: 'dark', wait: 200 });
    const shown = await poll(() => page.eval<boolean>(`document.readyState === 'complete' && !!document.querySelector('h1')`), Date.now() + PATIENCE.phone);
    if (shown && (await page.eval<boolean>(`!!document.querySelector('button[aria-label="Open navigation"]')`))) have.push(route);
  }
  return have;
}

export async function journey(page: Page, device: Device, start: string, route: string, check: NavigationCheck | undefined, run: { origin: string; condition: Condition }): Promise<Sample> {
  await openStart(page, device, start, run.origin);
  const link = `nav a[href=${JSON.stringify(route)}]`;
  const cap = PATIENCE[device];
  let drawerMs: number | undefined;
  let idle = true;
  if (device === 'phone') {
    const opened = await poll(() => point(page, 'button[aria-label="Open navigation"]'), Date.now() + cap);
    if (!opened) throw new Fail('never-ready', 'the Open navigation button is not pressable on the phone');
    const t = await press(page, opened);
    if (!(await poll(() => point(page, link), t + cap))) throw new Fail('never-ready', `the drawer did not show a link to ${route}`);
    drawerMs = Date.now() - t;
    idle = await awaitPrefetch(page, route);
  } else {
    if (!(await poll(() => point(page, link), Date.now() + cap))) throw new Fail('never-ready', `the rail has no pressable link to ${route}`);
    idle = await awaitPrefetch(page, route);
  }
  const prefetchCapped = !idle;
  // After-live presses at once after the refresh, which dropped the router's cache: nothing warms the destination again first.
  if (run.condition === 'afterLive') await liveRefresh(page);
  const at = await poll(() => point(page, link), Date.now() + cap);
  if (!at) throw new Fail('never-ready', `the link to ${route} is covered or gone`);
  // A cold sample is cold only if no prefetch of the destination got through: the page refused them, and the browser's own
  // record of requests has none for the destination either.
  const refused = await page.eval<number>(`window.__nav.blocked.length`);
  if (run.condition === 'cold') {
    const reached = await page.eval<string[]>(`performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname === ${JSON.stringify(route)}).map((e) => e.name)`);
    if (reached.length) throw new Fail('prefetched', `${reached.length} request(s) for ${route} had already been made before the press (${reached[0]})`);
  }
  const spec = { route, title: check?.title ?? '', ready: check?.readySelector ?? '', text: (check?.readyText ?? '').toLowerCase() };
  await page.eval(`window.__nav.arm(${JSON.stringify(spec)})`);
  const t0 = await press(page, at);

  // The shell: the path and the target heading.
  const shellMs = await result(page, 'shell', t0 + cap);
  if (shellMs === null) {
    const now = await page.eval<{ p: string; h: string }>(`({ p: location.pathname, h: document.querySelector('h1')?.textContent.trim() ?? '' })`);
    const wrong = now.p === route;
    return {
      shell: { fail: new Fail(wrong ? 'wrong-result' : 'never-ready', wrong ? `${route} shows the heading "${now.h}", not "${check?.title}"` : `still on ${now.p} ${cap} ms after pressing ${route}`) },
      data: check ? { fail: new Fail('never-ready', 'the shell was never reached') } : null,
      interactive: check ? { fail: new Fail('never-ready', 'the shell was never reached') } : null,
      drawerMs,
      prefetchCapped,
      refused,
    };
  }
  const shell = { ms: shellMs };
  if (!check) return { shell, data: null, interactive: null, drawerMs, prefetchCapped, refused };

  // Data and interaction run side by side: a control that is there at once does not wait for a body that is not.
  const [data, interactive] = await Promise.all([measureData(page, route, check, t0, cap), measureInteraction(page, route, check, t0, cap, RESULT_WAIT[device])]);
  if (check.probe === 'dialog') await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  return { shell, data, interactive, drawerMs, prefetchCapped, refused };
}

/** The page's own time for `name`, in ms since the press, once it has one; null when `until` (a clock time) passes first. */
const result = (page: Page, name: 'shell' | 'data' | 'interactive', until: number) =>
  poll(() => page.eval<number | undefined>(`window.__nav.res.${name}`).then((v) => (typeof v === 'number' ? v : null), () => null), until);

async function measureData(page: Page, route: string, check: NavigationCheck, t0: number, cap: number): Promise<Measured> {
  const ms = await result(page, 'data', t0 + cap);
  if (ms !== null) return { ms };
  const there = await page.eval<boolean>(`!!deepQuery(${JSON.stringify(check.readySelector)})`);
  return { fail: new Fail(there ? 'wrong-result' : 'never-ready', there ? `${check.readySelector} is there but never shows "${check.readyText}"` : `${check.readySelector} did not appear in ${cap} ms`) };
}

/** Selectors already reported, so a note appears once per run, not once per sample. */
const noted = new Set<string>();

/** A lookup that chooses one element says so when several match; it never fails the check. */
async function noteIfSeveral(page: Page, selector: string): Promise<void> {
  if (noted.has(selector)) return;
  const n = await page.eval<number>(`deepMatches(${JSON.stringify(selector)}).length`);
  if (n > 1) { noted.add(selector); console.log(`note: ${selector} matches ${n} elements; the first visible one was used`); }
}

async function measureInteraction(page: Page, route: string, check: NavigationCheck, t0: number, cap: number, wait: number): Promise<Measured> {
  const where = await poll(async () => (await page.eval<boolean>(`location.pathname === ${JSON.stringify(route)}`)) && point(page, check.controlSelector), t0 + cap);
  if (!where) return { fail: new Fail('never-ready', `the control ${check.controlSelector} was not pressable in ${cap} ms`) };
  await noteIfSeveral(page, check.controlSelector);
  const isInput = await page.eval<boolean>(`(() => { const el = ${pickable(check.controlSelector)}; return !!el && el.tagName === 'INPUT' && ['text', 'search'].includes(el.type); })()`);
  // The page compares this result with what it shows from now on, and times the first frame that differs.
  await page.eval(`(() => { const n = window.__nav; n.expect = { selector: ${JSON.stringify(check.resultSelector)}, before: n.snap(${JSON.stringify(check.resultSelector)}) }; })()`);
  await press(page, where);
  if (isInput) await page.send('Input.insertText', { text: 'a' });
  const ms = await result(page, 'interactive', Date.now() + wait);
  if (ms === null) return { fail: new Fail('control-dead', `pressing ${check.controlSelector} (${check.probe}) changed nothing on ${check.resultSelector} in ${wait} ms`) };
  return { ms };
}

// ---- the retake rule, per route and device ----

type Verdict = 'pass' | 'fail' | 'not-configured' | 'not-run';
type Reported = { ms: number | null; limit?: number; verdict: Verdict; reason?: string };
type Line = {
  route: string;
  device: Device;
  status: 'ok' | 'warn' | 'FAIL' | 'not run';
  shell: Reported;
  data: Reported;
  interactive: Reported;
  drawerMs?: number;
  prefetchCapped: boolean;
  noisy: boolean;
  problems: string[];
};

const value = (m: Measured | null): number | null => (m && 'ms' in m ? m.ms : null);

async function measure(page: Page, device: Device, start: string, route: string, check: NavigationCheck | undefined, limits: Record<Metric, number>): Promise<Line> {
  const line: Line = { route, device, status: 'ok', shell: { ms: null, verdict: 'pass' }, data: { ms: null, verdict: 'not-configured' }, interactive: { ms: null, verdict: 'not-configured' }, noisy: false, prefetchCapped: false, problems: [] };
  const fill = (name: Metric, m: Measured | null) => {
    if (m === null) return;
    if ('fail' in m) {
      line[name] = { ms: null, limit: limits[name], verdict: 'fail', reason: `${m.fail.kind}: ${m.fail.message}` };
      line.problems.push(`${name} ${m.fail.kind}: ${m.fail.message}`);
    } else line[name] = { ms: m.ms, limit: limits[name], verdict: 'pass' };
  };
  const first = await journey(page, device, start, route, check, { origin: base, condition: 'warm' });
  line.drawerMs = first.drawerMs;
  line.prefetchCapped = first.prefetchCapped;
  for (const name of METRICS) fill(name, first[name]);
  // A wrong result, a never-ready page or a dead control is the answer: no retake can replace it.
  if (line.problems.length) return finish(line);
  const over = METRICS.filter((name) => { const v = value(first[name]); return v !== null && judge([v], limits[name]).verdict === 'retake'; });
  if (over.length) {
    const run = { origin: base, condition: 'warm' as const };
    const retakes = [await journey(page, device, start, route, check, run), await journey(page, device, start, route, check, run)];
    const all = [first, ...retakes];
    for (const retake of retakes) for (const name of METRICS) {
      const m = retake[name];
      if (m && 'fail' in m) line.problems.push(`${name} ${m.fail.kind} on a retake: ${m.fail.message}`);
    }
    if (line.problems.length) { for (const name of METRICS) fill(name, retakes.map((r) => r[name]).find((m) => m && 'fail' in m) ?? first[name]); return finish(line); }
    for (const name of METRICS) {
      const samples = all.map((s) => value(s[name])).filter((v): v is number => v !== null);
      if (samples.length !== 3) continue;
      const j = judge(samples, limits[name]);
      line[name] = { ms: j.median, limit: limits[name], verdict: j.verdict === 'pass' ? 'pass' : 'fail', reason: j.verdict === 'pass' ? undefined : `median of ${samples.join(', ')} ms over ${limits[name]} ms` };
      if (j.verdict !== 'pass') line.problems.push(`${name} ${j.median} ms over its ${limits[name]} ms budget (samples ${samples.join(', ')})`);
      line.noisy ||= j.noisy;
    }
  }
  return finish(line);
}

function finish(line: Line): Line {
  line.status = line.problems.length ? 'FAIL' : line.noisy || line.data.verdict === 'not-configured' || line.interactive.verdict === 'not-configured' ? 'warn' : 'ok';
  return line;
}

const cell = (r: Reported): string => (r.verdict === 'not-configured' ? 'not-configured' : r.verdict === 'not-run' ? 'not run' : r.ms === null ? 'failed' : `${Math.round(r.ms)} ms`);
const text = (l: Line): string =>
  `${l.status.padEnd(7)} ${l.route} ${l.device} shell ${cell(l.shell)} · data ${cell(l.data)} · interactive ${cell(l.interactive)}`
  + (l.noisy ? ' · noisy' : '')
  + (l.prefetchCapped ? ` · prefetch not idle after ${PREFETCH_WAIT / 1000} s` : '')
  + (l.drawerMs !== undefined ? ` · drawer ${l.drawerMs} ms` : '')
  + (l.problems.length ? ` · ${l.problems.join('; ')}` : '');

// ---- prefetch ----

/** The compressed bytes of every router prefetch the landing route makes by the time it is idle. */
async function prefetchKiB(page: Page, device: Device, landing: string): Promise<number> {
  await openStart(page, device, landing, base);
  // Idle: two looks, 700 ms apart, that find the same prefetches and all of them answered.
  for (let i = 0, last = -1; i < 10; i++) {
    const now = await page.eval<{ n: number; done: boolean }>(`({ n: window.__nav.prefetches.length, done: window.__nav.prefetches.every((p) => p.done) })`);
    if (now.n === last && now.done) break;
    last = now.n;
    await sleep(700);
  }
  const seen = await page.eval<{ headers: Record<string, string>; url: string }[]>(`window.__nav.prefetches`);
  const urls = JSON.stringify(seen.filter((p) => isPrefetch({ headers: p.headers })).map((p) => p.url));
  return page.eval<number>(`(() => { const urls = new Set(${urls}); return performance.getEntriesByType('resource').filter((e) => urls.has(e.name)).reduce((n, e) => n + e.transferSize, 0); })()`);
}

// ---- main ----

const summary = (o: Record<string, unknown>) => console.log(`navigate: ${JSON.stringify(o)}`);

async function main(): Promise<number> {
  if (mode !== 'default' && mode !== 'full') { console.error(`--mode must be default or full, got ${mode}`); return 1; }
  if ((opt('--samples') ?? '1') !== '1') { console.error('--samples: one sample and two retakes is the only protocol here; scripts/perf.ts takes the 20-sample one'); return 1; }

  const config = ((await import(pathToFileURL(path.resolve(ROOT, opt('--config') ?? 'scripts/verify.config.ts')).href)) as { default?: NavConfig }).default ?? {};
  const budgets = budgetsOf(config);
  const checks = Array.isArray(config.navigationChecks) ? config.navigationChecks : [];

  let rail: { routes: string[]; landing: string };
  try {
    const named = opt('--rail')?.split(',').filter(Boolean);
    rail = named ? { routes: named, landing: named.includes('/') ? '/' : named[0] } : await railRoutes();
  } catch (e) {
    const reason = (e as Error).message;
    // The default smoke cannot choose its routes without a rail; the deeper modes treat that as an error.
    console.log(`${mode === 'full' ? 'FAIL   ' : 'not run'} navigate: ${reason}`);
    summary({ mode, status: mode === 'full' ? 'FAIL' : 'not-run', reason });
    return mode === 'full' ? 1 : 0;
  }

  const requested = opt('--routes')?.split(',').filter(Boolean);
  let routes: string[];
  try {
    routes = requested ?? (mode === 'full' ? rail.routes : selectSmokeRoutes({ smokeRoutes: config.smokeRoutes, nav: rail.routes, landing: rail.landing }));
  } catch (e) {
    console.log(`FAIL    navigate: ${(e as Error).message}`);
    summary({ mode, status: 'FAIL', errors: [(e as Error).message] });
    return 1;
  }

  // Everything that can be wrong with the routes and mappings is wrong before Chrome starts.
  const outside = routes.filter((r) => !rail.routes.includes(r));
  if (outside.length) {
    const errors = outside.map((r) => `${r}: not one of the rail routes (${rail.routes.join(', ')})`);
    errors.forEach((e) => console.log(`FAIL    ${e}`));
    summary({ mode, status: 'FAIL', routes, errors });
    return 1;
  }
  const coverage = resolveCoverage(mode, routes, checks, rail.routes);
  for (const w of coverage.warnings) console.log(`warn    ${w}`);
  if (coverage.errors.length) {
    for (const e of coverage.errors) console.log(`FAIL    ${e}`);
    summary({ mode, status: 'FAIL', routes, errors: coverage.errors });
    return 1;
  }

  let page: Page;
  try {
    // A missing Chrome binary is an error event on the child process, which nothing here can listen to: take it as the answer.
    let missing: (e: Error) => void = () => {};
    const gone = new Promise<never>((_, reject) => { missing = reject; });
    const onError = (e: Error) => missing(e);
    process.once('uncaughtException', onError);
    try { page = await Promise.race([launch(), gone]); } finally { process.off('uncaughtException', onError); }
  } catch (e) {
    const reason = `Chrome could not start (${(e as Error).message.split('\n')[0]})`;
    const lines = routes.flatMap((route) => DEVICES.map((device) => `not run ${route} ${device} shell not run · data not run · interactive not run · ${reason}`));
    lines.forEach((l) => console.log(l));
    for (const device of DEVICES) console.log(`not run prefetch ${device} · ${reason}`);
    summary({ mode, status: 'not-run', routes, reason });
    return mode === 'full' ? 1 : 0;
  }

  const lines: Line[] = [];
  let prefetch: { desktopKiB: number; phoneClosedKiB: number } | undefined;
  let problems: string[] = [];
  try {
    await prepare(page);
    const starts = await drawerRoutes(page, base, rail.routes);
    for (const route of routes) {
      const check = checks.find((c) => c.path === route);
      // Each journey comes from the rail route before the destination, so it is a navigation and not the page already shown.
      const start = startFor(rail.routes, route, starts);
      for (const device of DEVICES) {
        const limits = Object.fromEntries(METRICS.map((m) => {
          // A route's own figure, where the config gives one, stands in for the shared one on that metric and device.
          const shared = budgets.navigation.warm[BUDGET_KEY[m]][device];
          return [m, check?.budget?.[BUDGET_KEY[m]]?.[device] ?? shared];
        })) as Record<Metric, number>;
        let line: Line;
        try {
          // A route with no other route to start from has no navigation to time: it is a problem, never a 0 ms pass.
          if (start === undefined) throw new Fail('never-ready', 'the rail has no other route to start from');
          line = await measure(page, device, start, route, check, limits);
        } catch (e) {
          // The starting page never loading is a failure of this route and device, not of the run.
          const reason = e instanceof Fail ? `${e.kind}: ${e.message}` : (e as Error).message;
          line = finish({ route, device, status: 'FAIL', shell: { ms: null, verdict: 'fail', reason }, data: { ms: null, verdict: 'not-run' }, interactive: { ms: null, verdict: 'not-run' }, noisy: false, prefetchCapped: false, problems: [reason] });
        }
        if (!check) {
          line.data = { ms: null, verdict: 'not-configured' };
          line.interactive = { ms: null, verdict: 'not-configured' };
          finish(line);
        }
        lines.push(line);
        console.log(text(line));
      }
    }
    const bytes = { desktop: await prefetchKiB(page, 'desktop', rail.landing), phoneClosed: await prefetchKiB(page, 'phone', rail.landing) };
    prefetch = { desktopKiB: bytes.desktop / KIB, phoneClosedKiB: bytes.phoneClosed / KIB };
    problems = prefetchProblems({ desktopBytes: bytes.desktop, phoneClosedBytes: bytes.phoneClosed }, budgets.prefetchKb);
    const lineFor = (device: string, kib: number, cap: number) => `${kib > cap ? 'FAIL   ' : 'ok     '} prefetch ${device} ${kib.toFixed(1)} KiB compressed · cap ${cap} KiB`;
    console.log(lineFor('desktop', prefetch.desktopKiB, budgets.prefetchKb.desktop));
    console.log(lineFor('phone-closed', prefetch.phoneClosedKiB, budgets.prefetchKb.phoneClosed));
    for (const p of problems) console.log(`FAIL    ${p}`);
  } finally {
    page.close();
  }

  const failed = lines.some((l) => l.status === 'FAIL') || problems.length > 0;
  const status = failed ? 'FAIL' : lines.some((l) => l.status === 'warn') ? 'warn' : 'ok';
  summary({
    mode,
    status,
    routes,
    warnings: coverage.warnings,
    lines: lines.map(({ route, device, status: s, shell, data, interactive, drawerMs, prefetchCapped, noisy, problems: p }) => ({ route, device, status: s, shell, data, interactive, drawerMs, prefetchCapped, noisy, problems: p })),
    prefetch: prefetch && { ...prefetch, problems },
  });
  return failed ? 1 : 0;
}

// perf.ts imports the journey and must not run this main.
if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main());
