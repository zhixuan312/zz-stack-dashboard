/**
 * Live data in the browser, checked end to end against the built app: two tabs on /members, a write in one and the other
 * showing it, and every way the stream can go quiet (hints suppressed, a server restart, a hidden tab, a tab offline) or
 * loud (a burst). Explicit verification work that `pnpm verify` runs; it is not part of any default smoke.
 *
 *   node scripts/live.ts --base http://127.0.0.1:3000 [--drop-base <url>] [--poll-ms 3000]
 *
 * `--drop-base` is the same build started with LIVE_DROP_HINTS=1, which keeps the stream open and silent: verify starts
 * it. The restart case starts, stops and restarts a `next start` of this folder on its own port. The short safety poll
 * comes from `?livePollMs=` in the page address, never from a production default.
 *
 * Every write goes through the template's own invitation sheet and row menu, with real mouse and key input, and the
 * check removes the members it invited. One line per case, `ok`, `FAIL` or `not run` with the reason and measured
 * milliseconds. The exit code is 1 on any FAIL, 2 when nothing failed but a case did not run, and 0 only when every case
 * ran and passed: a case that did not run is never reported as passed.
 *
 * Controls are found and hit-tested through open shadow roots (scripts/lib/deep.ts), so a design system whose buttons,
 * menus and sheets are web components is driven the same way.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { bin } from './lib/bin.ts';
import { NOT_RUN_EXIT } from './lib/coverage.ts';
import { launch, type Page } from './lib/chrome.ts';
import { DEEP_SOURCE } from './lib/deep.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const base = (opt('--base') ?? process.env.BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const dropBase = opt('--drop-base')?.replace(/\/$/, '');
const pollMs = Number(opt('--poll-ms') ?? 3000);
/** Runs only the cases whose name contains this text; for working on one case. */
const only = opt('--only');
/** How long a tab may take to show a change a hint carries, refresh round trip included. */
const HINT_BOUND_MS = 2000;
/** How long it may take when only the safety refresh can repair it. */
const POLL_BOUND_MS = pollMs + 2000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const run = Math.random().toString(36).slice(2, 7);

type Outcome = { status: 'ok' | 'FAIL' | 'not run'; text: string };
const outcomes: Outcome[] = [];
const report = (status: Outcome['status'], name: string, text: string) => {
  outcomes.push({ status, text });
  console.log(`${status.padEnd(7)} ${name}: ${text}`);
};

// ---- processes this script starts, and only those ----

const started: ChildProcess[] = [];
const stopGroup = (c: ChildProcess) => { try { process.kill(-c.pid!, 'SIGTERM'); } catch { /* already gone */ } };
process.on('exit', () => started.forEach(stopGroup));
// An interrupted run does not emit 'exit' by itself, and the detached servers would outlive it.
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => process.exit(sig === 'SIGINT' ? 130 : 143));
const freePort = () => new Promise<number>((res) => { const s = net.createServer(); s.listen(0, () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)); }); });

/** The status the server on `port` answers with, or null when nothing does; a fresh connection each time, so a server that was just stopped is never reached through a stale one. */
const status = (port: number) => new Promise<number | null>((resolve) => {
  const req = http.get({ host: '127.0.0.1', port, path: '/', agent: false, timeout: 3000 }, (res) => { res.resume(); resolve(res.statusCode ?? null); });
  req.on('error', () => resolve(null));
  req.on('timeout', () => { req.destroy(); resolve(null); });
});

async function serve(port: number): Promise<ChildProcess> {
  const server = spawn(bin('next'), ['start', '-p', String(port)], { cwd: ROOT, env: process.env, stdio: 'ignore', detached: true });
  started.push(server);
  for (let i = 0; i < 120; i++) {
    const code = await status(port);
    if (code !== null && code < 500) return server;
    await sleep(250);
  }
  throw new Error(`the server on port ${port} did not start`);
}

async function stopServer(server: ChildProcess, port: number) {
  stopGroup(server);
  // The port answers until the process is really gone; only then can the next one take it.
  for (let i = 0; i < 80; i++) {
    if ((await status(port)) === null) return;
    await sleep(100);
  }
  throw new Error(`the server on port ${port} did not stop`);
}

// ---- what the page records, from its first script on ----

/** Wraps EventSource and fetch before the app runs, so a tab can say which hints it heard and how many refreshes it made. */
const INSTRUMENT = `(() => {
  const w = window;
  const live = w.__live = { born: Date.now(), opens: 0, errors: 0, events: [], actions: [], inFlight: 0, maxInFlight: 0, reads: { count: 0, inFlight: 0, max: 0 }, prefetches: { count: 0, inFlight: 0, max: 0 } };
  const Native = w.EventSource;
  if (Native) w.EventSource = class extends Native {
    constructor(url, init) {
      super(url, init);
      this.addEventListener('open', () => { live.opens++; });
      this.addEventListener('error', () => { live.errors++; });
      for (const type of ['resync', 'change']) this.addEventListener(type, () => live.events.push(type));
    }
  };
  const headerOf = (input, init, name) => {
    const h = (init && init.headers) || (input instanceof Request ? input.headers : null);
    if (!h) return null;
    if (h instanceof Headers) return h.get(name);
    if (Array.isArray(h)) { const hit = h.find(([k]) => String(k).toLowerCase() === name); return hit ? hit[1] : null; }
    const key = Object.keys(h).find((k) => k.toLowerCase() === name);
    return key ? h[key] : null;
  };
  const nativeFetch = w.fetch.bind(w);
  w.fetch = (input, init) => {
    // Three kinds of request, told apart by their headers: a refresh action, a prefetch and the router's own read of a page.
    const action = headerOf(input, init, 'next-action') !== null;
    const prefetch = !action && headerOf(input, init, 'next-router-prefetch') === '1';
    const read = !action && !prefetch && headerOf(input, init, 'rsc') !== null;
    if (!action && !prefetch && !read) return nativeFetch(input, init);
    // The invitation action's own call, kept so the burst can send it again with other names.
    if (action && init && typeof init.body === 'string' && init.body.includes('@live-check.example')) {
      const h = init.headers;
      live.invite = { headers: h instanceof Headers ? [...h.entries()] : Array.isArray(h) ? h : Object.entries(h || {}), body: init.body };
    }
    if (action) { live.actions.push(Date.now()); live.inFlight++; live.maxInFlight = Math.max(live.maxInFlight, live.inFlight); }
    const kind = prefetch ? live.prefetches : live.reads;
    if (!action) { kind.count++; kind.inFlight++; kind.max = Math.max(kind.max, kind.inFlight); }
    const done = () => { if (action) live.inFlight--; else kind.inFlight--; };
    return nativeFetch(input, init).finally(done);
  };
  live.reset = () => { live.events.length = 0; live.actions.length = 0; for (const k of [live.reads, live.prefetches]) { k.count = 0; k.max = k.inFlight; } live.maxInFlight = live.inFlight; };
})()`;

type Seen = { born: number; opens: number; errors: number; events: string[]; actions: number[]; inFlight: number; maxInFlight: number; reads: Requests; prefetches: Requests };
/** One kind of request a tab made: how many, and the most at once. */
type Requests = { count: number; inFlight: number; max: number };
const seen = (page: Page) => page.eval<Seen>('window.__live');
/** What a tab's stream and refreshes had done, for a failure to say. */
const tally = async (page: Page) => { const s = await seen(page); return `age ${Date.now() - s.born} ms, opens ${s.opens}, errors ${s.errors}, hints heard [${s.events.join(',')}], refreshes ${s.actions.length}, ${s.inFlight} in flight`; };

async function tab(): Promise<Page> {
  const page = await launch();
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: DEEP_SOURCE });
  await page.send('Network.enable');
  return page;
}

const url = (origin: string) => `${origin}/members?livePollMs=${pollMs}`;

/** Opens /members and waits until the tab's stream is open and its first resynchronization has finished. */
async function openMembers(page: Page, origin: string) {
  await page.open(url(origin), { width: 1440, theme: 'dark' });
  // A new member sorts last, which on a table of twenty per page is a page the tab is not showing: show up to a hundred.
  if (await page.eval<boolean>(`!!(${find('button', '20 per page')})`)) {
    await click(page, find('button', '20 per page'));
    await click(page, find('[role="menuitem"]', '100 per page'), true);
  }
  await waitFor(page, 'the table showing every member', `/^1–(\\d+) of \\1 members/m.test(document.body.innerText) || !/of \\d+ members/.test(document.body.innerText)`);
  const t = Date.now();
  for (;;) {
    const s = await seen(page);
    if (s.opens >= 1 && s.actions.length >= 1 && s.inFlight === 0) return;
    if (Date.now() - t > 10_000) throw new Error(`${origin}/members: the live stream did not open and resynchronize in 10 s (opens ${s.opens}, refreshes ${s.actions.length})`);
    await sleep(100);
  }
}

// ---- input, through the template's own controls ----

/** A page expression for the first element matching `selector` under `scope` (another page expression), named `text` if given. */
const find = (selector: string, text?: string, scope = 'document') => text === undefined
  ? `deepQuery(${JSON.stringify(selector)}, ${scope})`
  : `deepQueryAll(${JSON.stringify(selector)}, ${scope}).find((el) => deepText(el).trim() === ${JSON.stringify(text)} && !el.disabled)`;
/** The dialog on screen. A closed one may stay in the page, drawn nowhere. */
const DIALOG = `deepQueryAll('[role="dialog"]').find((d) => d.getBoundingClientRect().width > 0)`;
/** What the dialog on screen holds: from its host when it is drawn inside a root, since its fields are slotted into that host. */
const IN_DIALOG = `(() => { const d = ${DIALOG}; const r = d?.getRootNode(); return r instanceof ShadowRoot ? r.host : d ?? null; })()`;

/** Where to press `element`: its centre, once nothing covers it. The topmost element is found through open roots, and a host
 *  whose own slotted text is at the point (the element's host or one around it) does not cover what is inside it. */
async function point(page: Page, element: string, { stable = false, within = 5000 } = {}): Promise<{ x: number; y: number }> {
  const t = Date.now();
  const where = () => page.eval<{ x: number; y: number } | null>(`(() => { const el = ${element}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return null; const x = r.left + r.width / 2, y = r.top + r.height / 2; let hit = document.elementFromPoint(x, y); for (let inner = hit && hit.shadowRoot && hit.shadowRoot.elementFromPoint(x, y); inner && inner !== hit; inner = hit.shadowRoot && hit.shadowRoot.elementFromPoint(x, y)) hit = inner; for (let n = hit; n; n = deepParent(n)) if (n === el) return { x, y }; for (let n = el; n; n = deepParent(n)) if (n === hit && n.shadowRoot) return { x, y }; return null; })()`);
  for (;;) {
    const at = await where();
    // A menu or dialog still animating in moves under the pointer; stable means the same place twice, 60 ms apart.
    if (at && stable) {
      await sleep(60);
      const again = await where();
      if (again && again.x === at.x && again.y === at.y) return at;
    } else if (at) return at;
    if (Date.now() - t > within) {
      const buttons = await page.eval<string>(`deepQueryAll('button').map((b) => deepText(b).trim() + (b.disabled ? ' (disabled)' : '')).filter(Boolean).slice(-6).join(' | ')`);
      throw new Error(`no such control: ${element.slice(0, 120)}; the page's last buttons: ${buttons}`);
    }
    await sleep(15);
  }
}

/** Presses an element with the mouse; resolves with the time of the press. */
async function click(page: Page, element: string, stable = false): Promise<number> {
  const { x, y } = await point(page, element, { stable });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  const at = Date.now();
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  return at;
}

/** Activates a button from the keyboard: a toast can sit over a button in the corner, and a press on it would close the sheet. */
async function press(page: Page, element: string): Promise<number> {
  await waitFor(page, `the control ${element.slice(0, 80)}`, element);
  await page.eval(`(${element}).focus()`);
  const at = Date.now();
  for (const type of ['rawKeyDown', 'char', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, ...(type === 'char' ? { text: '\r' } : {}) });
  }
  return at;
}

async function waitFor(page: Page, what: string, expression: string, within = 5000) {
  const t = Date.now();
  while (!(await page.eval<boolean>(`!!(${expression})`))) {
    if (Date.now() - t > within) throw new Error(`${what}: not within ${within} ms`);
    await sleep(15);
  }
}

/** Invites one member through the sheet; resolves with the time of the Send press. */
async function invite(page: Page, name: string, confirm = true): Promise<number> {
  await waitFor(page, 'the previous sheet closing', `!${DIALOG}`);
  // The sheet slides in from the right; a press aimed at it mid-slide lands outside it and closes it. A press on the
  // button that a closing menu or toast swallowed is pressed again.
  for (let attempt = 1; ; attempt++) {
    await click(page, find('button', 'Invite member'));
    try {
      await waitFor(page, 'the sheet settling', `(() => { const d = ${DIALOG}; const r = d?.getBoundingClientRect(); return r && r.width > 0 && r.right <= innerWidth + 1; })()`, 1500);
      break;
    } catch (e) {
      if (attempt === 3) throw e;
    }
  }
  await click(page, find('input[placeholder="Ana Costa"]', undefined, IN_DIALOG));
  await page.send('Input.insertText', { text: name });
  await click(page, find('input[type="email"]', undefined, IN_DIALOG));
  const email = `${name.replace(/\s+/g, '.')}@live-check.example`;
  await page.send('Input.insertText', { text: email });
  const pressed = await press(page, find('button', 'Send invitation'));
  // The table's own answer: a toast says the server took the invitation, or why it did not.
  if (confirm) await refused(page, 4000, `Invitation sent to ${email}`);
  return pressed;
}

/** Waits for the toast that confirms an invitation; a refused one throws with the reason its toast gives. */
async function refused(page: Page, within: number, confirmation: string) {
  const t = Date.now();
  for (;;) {
    const text = await page.eval<string>(`document.body.innerText`);
    const no = /Change not made\n([^\n]*)/.exec(text);
    if (no) throw new Error(`the server refused an invitation: ${no[1]}`);
    if (text.includes(confirmation)) return;
    if (Date.now() - t > within) throw new Error(`A's invitation was not confirmed by its toast in ${within} ms; saving rows ${await page.eval<number>(`(document.body.innerText.match(/Saving…/g) ?? []).length`)}, toasts [${await page.eval<string>(`deepQueryAll('[role=status],[role=alert],[data-toast],ol li').map((e) => e.innerText.replace(/\\s+/g, ' ').slice(0, 80)).slice(0, 5).join(' / ')`)}], errors [${page.errors.join(' / ')}]; the sheet now: ${await page.eval<string>(`(${IN_DIALOG}?.innerText ?? 'closed').replace(/\\s+/g, ' ')`)}`);
    await sleep(25);
  }
}

/**
 * The invitation Server Action again, from the page, one every `everyMs`: the sheet takes one invitation at a time
 * (its button is busy until the last one lands), so a burst calls the template's own `inviteMember` the way the sheet
 * does, with the request the sheet's own invitation made. Resolves with the page's clock at each send and how many
 * the server accepted.
 */
const replayInvites = (page: Page, names: string[], everyMs: number) => page.eval<{ sent: number[]; accepted: number }>(`(async () => {
  const call = window.__live.invite;
  if (!call) throw new Error('no invitation was made through the sheet first, so there is no request to repeat');
  const [args] = JSON.parse(call.body);
  const sent = [];
  const results = [];
  for (const name of ${JSON.stringify(names)}) {
    await new Promise((r) => setTimeout(r, ${everyMs}));
    const body = JSON.stringify([{ ...args, name, email: name.replace(/\\s+/g, '.') + '@live-check.example' }]);
    sent.push(Date.now());
    results.push(fetch(location.href, { method: 'POST', headers: call.headers, body }).then((r) => r.text()).then((t) => t.includes('"ok":true')));
  }
  return { sent, accepted: (await Promise.all(results)).filter(Boolean).length };
})()`);

/**
 * Removes a member through the row's menu; a name that is not on the page is already gone. Remove takes the row away at
 * once and holds the removal for its Undo; the page sends a held removal the moment it is hidden, so the check hides it
 * (as switching tabs does) rather than waiting out the Undo, then reads the page from the server until the name is gone.
 */
async function remove(page: Page, name: string) {
  const row = `button[aria-label="Actions for ${name}"]`;
  if (!(await page.eval<boolean>(`!!${find(row)}`))) return;
  await waitFor(page, 'no dialog open', `!${DIALOG}`);
  await click(page, find(row));
  await click(page, find('[role="menuitem"]', 'Remove'), true);
  await waitFor(page, `${name} leaving the table`, `!document.querySelector('main table, main [role="table"]')?.textContent.includes(${JSON.stringify(name)})`, 8000);
  await page.eval(`(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  })()`);
  const t = Date.now();
  while (await page.eval<boolean>(`fetch(location.pathname, { cache: 'no-store' }).then((r) => r.text()).then((h) => h.includes(${JSON.stringify(name)}))`)) {
    if (Date.now() - t > 8000) throw new Error(`${name} was still on the server 8000 ms after the page sent the removal`);
    await sleep(200);
  }
}

/**
 * Resolves with the page's clock the moment the names are all shown (or all gone), or null at the deadline. A mutation
 * of the page is the prompt to look, and so is every 50 ms: a row a web component draws shows its text only once the
 * component has rendered inside its root, which no observer of the page's own tree hears.
 */
const showing = (page: Page, names: string[], present: boolean, within: number) => page.eval<number | null>(`new Promise((resolve) => {
  const names = ${JSON.stringify(names)};
  const ok = () => names.every((n) => document.body.innerText.includes(n) === ${present});
  if (ok()) return resolve(Date.now());
  const done = (at) => { clearTimeout(timer); clearInterval(tick); observer.disconnect(); resolve(at); };
  const look = () => { if (ok()) done(Date.now()); };
  const timer = setTimeout(() => done(null), ${within});
  const tick = setInterval(look, 50);
  const observer = new MutationObserver(look);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
})`);

const name = (label: string, i = 0) => `${run} ${label} ${i} ok`;

// ---- the cases ----

type Tabs = { a: Page; b: Page };
/** Names this run invited on an origin, so the cleanup can take them out again. */
const invited = new Set<string>();
const track = (n: string) => { invited.add(n); return n; };

/** A tab-to-tab change: A invites, B must show it within `bound` of the press. */
async function converges(t: Tabs, label: string, bound: number): Promise<{ ms: number; heard: number }> {
  const n = track(name(label));
  await t.b.eval<void>('window.__live.reset()');
  const waiting = showing(t.b, [n], true, bound + 500);
  const pressed = await invite(t.a, n);
  const at = await waiting;
  const ms = at === null ? Infinity : at - pressed;
  const s = await seen(t.b);
  if (ms > bound) throw new Error(`B did not show the invitation within ${bound} ms (${at === null ? 'never in ' + (bound + 500) + ' ms' : ms + ' ms'})`);
  return { ms, heard: s.events.filter((e) => e === 'change').length };
}

async function cleanup(t: Tabs) {
  for (const n of invited) await remove(t.a, n);
  invited.clear();
}

async function twoTabs(t: Tabs) {
  const { ms, heard } = await converges(t, 'two-tabs', HINT_BOUND_MS);
  report('ok', 'two tabs', `an invitation made in A showed in B in ${ms} ms (bound ${HINT_BOUND_MS} ms), ${heard} change hint(s) heard by B`);
}

async function visibility(t: Tabs) {
  const show = () => t.b.eval(`(() => { delete document.visibilityState; delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); })()`);
  await t.b.eval(`(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); })()`);
  try {
    const n = track(name('visibility'));
    const pressed = await invite(t.a, n);
    // While hidden the tab holds no stream and runs no poll: the change must not arrive on its own.
    await sleep(Math.max(0, pressed + pollMs + 1000 - Date.now()));
    if (await t.b.eval<boolean>(`document.body.innerText.includes(${JSON.stringify(n)})`)) throw new Error('B showed the change while hidden; it should hold no stream and no poll');
    const shown = showing(t.b, [n], true, POLL_BOUND_MS + 500);
    const visibleAt = Date.now();
    await show();
    const at = await shown;
    const ms = at === null ? Infinity : at - visibleAt;
    if (ms > POLL_BOUND_MS) throw new Error(`B did not show the change within ${POLL_BOUND_MS} ms of becoming visible (${await tally(t.b)}; A ${await tally(t.a)}; A shows it: ${await t.a.eval(`document.body.innerText.includes(${JSON.stringify(n)})`)}; A's table rows ${await t.a.eval(`deepQueryAll('tr').length`)}, B's ${await t.b.eval(`deepQueryAll('tr').length`)}; A's messages: ${await t.a.eval(`document.body.innerText.split('\\n').filter((l) => /Invitation|Change not made|Sign in|permission|Enter their|Name the/.test(l)).join(' / ')`)}; this run's rows: A [${await t.a.eval(`deepQueryAll('tr').map((tr) => deepText(tr).replace(/\\s+/g, ' ').slice(0, 60)).filter((x) => x.includes(${JSON.stringify(run)})).join(' / ')`)}] B [${await t.b.eval(`deepQueryAll('tr').map((tr) => deepText(tr).replace(/\\s+/g, ' ').slice(0, 60)).filter((x) => x.includes(${JSON.stringify(run)})).join(' / ')`)}])`);
    report('ok', 'visibility', `B, hidden while A invited (still not showing it ${pollMs + 1000} ms after A's invitation), showed it ${ms} ms after becoming visible (bound ${POLL_BOUND_MS} ms; visibility emulated by overriding document.visibilityState)`);
  } finally {
    // Whatever happened above, B must not stay hidden for the cases that follow.
    await show().catch(() => {});
  }
}

async function offline(t: Tabs) {
  const conditions = (offline: boolean) => t.b.send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await conditions(true);
  try {
    const n = track(name('offline'));
    const pressed = await invite(t.a, n);
    await sleep(Math.max(0, pressed + 1500 - Date.now()));
    if (await t.b.eval<boolean>(`document.body.innerText.includes(${JSON.stringify(n)})`)) throw new Error('B showed the change while its network was offline');
    const shown = showing(t.b, [n], true, POLL_BOUND_MS + 500);
    const onlineAt = Date.now();
    await conditions(false);
    const at = await shown;
    const ms = at === null ? Infinity : at - onlineAt;
    if (ms > POLL_BOUND_MS) throw new Error(`B did not show the change within ${POLL_BOUND_MS} ms of coming back online`);
    report('ok', 'a disconnected write', `A wrote while B was offline (B showed nothing for 1500 ms); B showed it ${ms} ms after coming back online (bound ${POLL_BOUND_MS} ms)`);
  } finally {
    await conditions(false);
  }
}

/**
 * B's requests by kind, each with its count and the most in flight at once, and which kind made the route fetches: refresh
 * actions (`next-action`), the router's own reads that follow them (`rsc` without the prefetch header) and prefetches
 * (`next-router-prefetch: 1`).
 */
function kinds(s: Seen): string {
  const { reads, prefetches } = s;
  const route = reads.count && prefetches.count ? `both router refreshes (${reads.count}) and prefetches (${prefetches.count})` : prefetches.count ? 'prefetches' : reads.count ? 'router refreshes' : 'none';
  return `refresh actions ${s.actions.length} (at most ${s.maxInFlight} in flight), router refreshes ${reads.count} (at most ${reads.max} in flight), prefetches ${prefetches.count} (at most ${prefetches.max} in flight); the route fetches came from ${route}`;
}

async function burst(t: Tabs) {
  const COUNT = 20;
  const names = Array.from({ length: COUNT }, (_, i) => track(name('burst', i)));
  await t.b.eval<void>('window.__live.reset()');
  const started = Date.now();
  const waiting = showing(t.b, names, true, 2000 + 10_000);
  // The first one through the sheet, which also gives the request the rest repeat; 19 more follow, one every 90 ms.
  const first = await invite(t.a, names[0]!);
  const { sent, accepted } = await replayInvites(t.a, names.slice(1), 90);
  const last = sent[sent.length - 1]!;
  const sendMs = last - first;
  if (accepted !== COUNT - 1) throw new Error(`the server accepted ${accepted} of ${COUNT - 1} repeated invitations`);
  const at = await waiting;
  const s = await seen(t.b);
  const settled = at === null ? Infinity : at - last;
  const span = (at ?? Date.now()) - started;
  const per = (s.actions.length / (span / 1000)).toFixed(1);
  const peak = Math.max(0, ...s.actions.map((ts) => s.actions.filter((x) => x >= ts && x < ts + 1000).length));
  const detail = `${COUNT} invitations sent in ${sendMs} ms (the first through the sheet, ${COUNT - 1} through its Server Action, ${accepted} accepted); B showed all ${at === null ? 0 : COUNT} ${at === null ? 'never' : `${settled} ms after the last`}; B made ${s.actions.length} refreshes in ${span} ms = ${per}/s (peak ${peak} in one second), at most ${s.maxInFlight} in flight; B's requests by kind: ${kinds(s)}`;
  if (sendMs > 2000) throw new Error(`${detail}; the burst took longer than 2000 ms to send`);
  if (at === null || settled > HINT_BOUND_MS) throw new Error(`${detail}; B did not show all ${COUNT} within ${HINT_BOUND_MS} ms of the last`);
  if (s.maxInFlight > 1) throw new Error(`${detail}; more than one refresh was in flight`);
  report('ok', 'a sustained burst', detail);
}

async function suppressed(t: Tabs, origin: string) {
  await openMembers(t.a, origin);
  await openMembers(t.b, origin);
  // Write just after B's safety refresh has run, so the next one is about a full interval away and a quick answer cannot be luck.
  const refreshes = (await seen(t.b)).actions.length;
  await waitFor(t.b, 'the next safety refresh', `window.__live.actions.length > ${refreshes}`, POLL_BOUND_MS + 1000);
  const n = track(name('suppressed'));
  await t.b.eval<void>('window.__live.reset()');
  const waiting = showing(t.b, [n], true, POLL_BOUND_MS + 500);
  const pressed = await invite(t.a, n);
  const at = await waiting;
  const ms = at === null ? Infinity : at - pressed;
  const s = await seen(t.b);
  if (ms > POLL_BOUND_MS) throw new Error(`B did not show the change within ${POLL_BOUND_MS} ms`);
  if (s.events.includes('change')) throw new Error('B heard a change hint, so hints were not suppressed on this server');
  if (s.errors > 0 || s.opens < 1) throw new Error(`the stream did not stay open (opens ${s.opens}, errors ${s.errors})`);
  report('ok', 'suppressed hints', `LIVE_DROP_HINTS=1: the stream stayed open (${s.opens} open, ${s.errors} errors) and silent (no change hint); B still showed A's invitation ${ms} ms after A pressed Send, a moment after B's last safety refresh (poll ${pollMs} ms, bound ${POLL_BOUND_MS} ms)`);
}

async function restart(t: Tabs) {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  let server = await serve(port);
  try {
    await openMembers(t.a, origin);
    await openMembers(t.b, origin);
    const before = track(name('restart-before'));
    const pressed = await invite(t.a, before);
    const first = await showing(t.b, [before], true, HINT_BOUND_MS + 500);
    if (first === null) throw new Error('B never showed the invitation made before the restart');
    // The data is in memory: a restarted server starts over from the sample, so "current data" no longer has that member.
    await stopServer(server, port);
    server = await serve(port);
    const upAt = Date.now();
    const gone = await showing(t.b, [before], false, POLL_BOUND_MS + 500);
    const goneMs = gone === null ? Infinity : gone - upAt;
    if (goneMs > POLL_BOUND_MS) throw new Error(`B still showed the pre-restart member ${POLL_BOUND_MS} ms after the server was back`);
    const after = name('restart-after');
    const sent = await invite(t.a, after);
    const arrived = await showing(t.b, [after], true, POLL_BOUND_MS + 500);
    const afterMs = arrived === null ? Infinity : arrived - sent;
    if (afterMs > POLL_BOUND_MS) throw new Error(`B did not show a write made after the restart within ${POLL_BOUND_MS} ms`);
    report('ok', 'a server restart', `B showed the invitation in ${first - pressed} ms, then ${goneMs} ms after the restarted server answered it showed the current data (the member gone); a write made after the restart reached B in ${afterMs} ms (bound ${POLL_BOUND_MS} ms; this server and its data are discarded)`);
  } finally {
    await stopServer(server, port).catch(() => undefined);
    invited.clear();
  }
}

// ---- go ----

async function absent(): Promise<string | null> {
  try {
    const page = await fetch(`${base}/members`);
    if (!page.ok) return `${base}/members answers ${page.status}`;
    if (!(await page.text()).includes('Invite member')) return 'the members page has no invitation to make';
    const abort = new AbortController();
    const stream = await fetch(`${base}/api/live?collections=members`, { signal: abort.signal });
    abort.abort();
    if (!stream.ok || !stream.headers.get('content-type')?.startsWith('text/event-stream')) return `/api/live answers ${stream.status} and not an event stream`;
    return null;
  } catch (e) {
    return `${base} is not reachable: ${(e as Error).message}`;
  }
}

const CASES = ['two tabs', 'visibility', 'a disconnected write', 'a sustained burst', 'suppressed hints', 'a server restart'];
const skipAll = (why: string) => { for (const c of CASES) report('not run', c, why); };

const why = await absent();
if (why) {
  skipAll(`this app has no live /members to drive (${why})`);
} else if (!fs.existsSync(path.join(ROOT, '.next/BUILD_ID'))) {
  skipAll('there is no production build in this folder, which the restart case starts');
} else {
  let a: Page | undefined;
  let b: Page | undefined;
  try {
    [a, b] = [await tab(), await tab()];
  } catch (e) {
    skipAll(`Chrome did not start (${(e as Error).message})`);
  }
  if (a && b) {
    const t: Tabs = { a, b };
    const step = async (label: string, fn: () => Promise<void>) => {
      if (only && !only.split(',').includes(label)) return;
      try { await fn(); } catch (e) { report('FAIL', label, (e as Error).message); }
    };
    // Case order matters only in that each leaves the tabs usable; every case invites its own uniquely named members.
    await openMembers(a, base);
    await openMembers(b, base);
    await step('two tabs', () => twoTabs(t));
    await step('visibility', () => visibility(t));
    await step('a disconnected write', () => offline(t));
    await step('a sustained burst', () => burst(t));
    try { await cleanup(t); } catch (e) { report('FAIL', 'cleanup', `a member this check invited was not removed: ${(e as Error).message}`); }
    if (dropBase) {
      await step('suppressed hints', async () => { await suppressed(t, dropBase); });
      try { await cleanup(t); } catch (e) { report('FAIL', 'cleanup', `a member this check invited on ${dropBase} was not removed: ${(e as Error).message}`); }
    } else {
      report('not run', 'suppressed hints', 'no --drop-base: the server started with LIVE_DROP_HINTS=1 was not given');
    }
    await step('a server restart', () => restart(t));
  }
  a?.close();
  b?.close();
}

const failed = outcomes.filter((o) => o.status === 'FAIL').length;
const skipped = outcomes.filter((o) => o.status === 'not run').length;
console.log(`\nlive: ${outcomes.filter((o) => o.status === 'ok').length} ok, ${failed} FAIL, ${skipped} not run (poll ${pollMs} ms)`);
process.exit(failed ? 1 : skipped ? NOT_RUN_EXIT : 0);
