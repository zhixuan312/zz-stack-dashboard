/**
 * Live data in the browser, checked end to end against the built app: two tabs on /members, a write in one and the other
 * showing it, and every way the stream can go quiet (hints suppressed, a server restart, a hidden tab, a tab offline) or
 * loud (a burst). scripts/browser.ts --depth timed runs it, alone on a quiet machine, under `pnpm test:release`.
 *
 *   node scripts/live.ts --base http://127.0.0.1:3000 [--drop-base <url>] [--poll-ms 3000] [--only <case>,<case>]
 *
 * `--drop-base` is the same build started with LIVE_DROP_HINTS=1, which keeps the stream open and silent: verify starts
 * it. The restart case starts, stops and restarts a `next start` of this folder on its own port. The short safety poll
 * comes from `?livePollMs=` in the page address, never from a production default.
 *
 * Every write goes through the template's own invitation sheet and row menu, with real mouse and key input, and the
 * check removes the members it invited. One line per case, `ok`, `warn`, `FAIL` or `not run` with the reason and measured
 * milliseconds. A change arriving is the requirement, however long it took: the milliseconds are a Tier 2 value, recorded
 * in `out/tier2` and reported against the case's latency line (`HINT_BOUND_MS`, `POLL_BOUND_MS`), and a case that shows
 * it late is `warn`. Only a change that never arrives within `PATIENCE_MS` fails the run, because that is the product not
 * working. The exit code is 1 on any FAIL, 2 when nothing failed but a case did not run, and 0 otherwise: a case that did
 * not run is never reported as passed.
 *
 * Controls are found and hit-tested through open shadow roots (scripts/lib/deep.ts), so a design system whose buttons,
 * menus and sheets are web components is driven the same way.
 */
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { answers, freePort, spawnNext, status } from './lib/bin.ts';
import { launch, type Page } from './lib/chrome.ts';
import { DEEP_SOURCE } from './lib/deep.ts';
import { holdArgs } from './lib/args.ts';
import { liveSummary, verdictOf, type LiveOutcome } from './lib/live-arrival.ts';
import { recordPart, type Value } from './lib/tier2.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
holdArgs('live', args, ['--base', '--drop-base', '--only', '--poll-ms']);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const base = (opt('--base') ?? process.env.BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const dropBase = opt('--drop-base')?.replace(/\/$/, '');
const pollMs = Number(opt('--poll-ms') ?? 3000);
/** Runs only the cases named, comma-separated, for working on one case; every other case is reported not run. */
const only = opt('--only');
/** How long a tab may take to show a change a hint carries, refresh round trip included: the case's latency line. */
const HINT_BOUND_MS = 2000;
/** How long it may take when only the safety refresh can repair it: the case's latency line. */
const POLL_BOUND_MS = pollMs + 2000;
/**
 * How long a change may take to arrive at all before the product is at fault. A functional bound, not a budget: fixed,
 * far beyond any answer a slowed machine gives, and never derived from a timing. Past it the case is a FAIL; between its
 * latency line and it the case is a warn with its number.
 */
const PATIENCE_MS = 30_000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const run = Math.random().toString(36).slice(2, 7);

const outcomes: LiveOutcome[] = [];
const report = (status: LiveOutcome['status'], name: string, text: string) => {
  outcomes.push({ status, text });
  console.log(`${status.padEnd(7)} ${name}: ${text}`);
};

/** What each case measured, recorded for the run's Tier 2 table and compared with the releases, never judged here. */
const values: Value[] = [];
const record = (check: string, ms: number) => {
  if (Number.isFinite(ms)) values.push({ check, page: '/members', unit: 'ms', value: Math.round(ms) });
};

// ---- processes this script starts, and only those ----

const started: ChildProcess[] = [];
const stopGroup = (c: ChildProcess, signal: NodeJS.Signals = 'SIGTERM') => { try { process.kill(-c.pid!, signal); } catch { /* already gone */ } };
// At exit nothing is waited for, so the group is killed outright: a graceful stop can outlive this process, and the
// servers here are disposable.
process.on('exit', () => started.forEach((c) => stopGroup(c, 'SIGKILL')));
// An interrupted run does not emit 'exit' by itself, and the detached servers would outlive it.
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => process.exit(sig === 'SIGINT' ? 130 : 143));
async function serve(port: number): Promise<ChildProcess> {
  const server = spawnNext(port, process.env);
  started.push(server);
  if (await answers(port)) return server;
  throw new Error(`the server on port ${port} did not start`);
}

/** Whether any process of this server's group is still running. */
const groupAlive = (pid: number | undefined) => {
  if (!pid) return false;
  try { process.kill(-pid, 0); return true; } catch { return false; }
};
async function stopServer(server: ChildProcess, port: number) {
  stopGroup(server);
  // The port answers until the process is really gone; only then can the next one take it.
  for (let i = 0; i < 80; i++) {
    if ((await status(port)) === null) break;
    await sleep(100);
  }
  if ((await status(port)) !== null) throw new Error(`the server on port ${port} did not stop`);
  // A graceful stop closes the port and THEN waits for its open connections, and a tab's keep-alive sockets are open
  // connections: the old process outlived its port for as long as a tab kept polling over them (measured 5 s and
  // longer). The new process served the port while the old one went on answering that tab from its own store — one tab
  // read a server the other tab never wrote to. A restart ends the process, and its connections end with it.
  if (groupAlive(server.pid)) stopGroup(server, 'SIGKILL');
  for (let i = 0; i < 50 && groupAlive(server.pid); i++) await sleep(100);
  if (groupAlive(server.pid)) throw new Error(`the server on port ${port} is still running after it was killed`);
}

// ---- what the page records, from its first script on ----

/** Wraps EventSource and fetch before the app runs, so a tab can say which hints it heard and how many refreshes it made. */
const INSTRUMENT = `(() => {
  const w = window;
  const live = w.__live = { born: Date.now(), opens: 0, errors: 0, events: [], actions: [], inFlight: 0, maxInFlight: 0, reads: { count: 0, inFlight: 0, max: 0 }, prefetches: { count: 0, inFlight: 0, max: 0 }, watch: '', exchanges: [] };
  const Native = w.EventSource;
  if (Native) w.EventSource = class extends Native {
    constructor(url, init) {
      super(url, init);
      this.addEventListener('open', () => { live.opens++; });
      this.addEventListener('error', () => { live.errors++; });
      for (const type of ['resync', 'synced', 'change']) this.addEventListener(type, () => live.events.push(type));
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
    const prefetch = !action && /^[1-9]\\d*$/.test(headerOf(input, init, 'next-router-prefetch') ?? '');
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
    const sent = nativeFetch(input, init);
    // What the server answered a refresh with, kept for a failure to read: a status, and whether the body holds the name
    // the case is waiting for. A read that has the row and a page that does not is the client's fault; a read without it
    // is the server's.
    const at = Date.now();
    const keep = (entry) => { live.exchanges.push(entry); if (live.exchanges.length > 12) live.exchanges.shift(); };
    if (action || read) sent.then(
      (res) => {
        // The entry itself is kept, not a copy: the body arrives after it is pushed and fills in bytes and has.
        const entry = { kind: action ? 'action' : 'read', at, status: res.status, bytes: 0, has: false };
        keep(entry);
        res.clone().text().then((t) => { entry.bytes = t.length; entry.has = !!live.watch && t.includes(live.watch); }).catch(() => {});
      },
      () => keep({ kind: action ? 'action' : 'read', at, failed: true }),
    );
    return sent.finally(done);
  };
  live.reset = () => { live.events.length = 0; live.actions.length = 0; for (const k of [live.reads, live.prefetches]) { k.count = 0; k.max = k.inFlight; } live.maxInFlight = live.inFlight; };
})()`;

type Seen = { born: number; opens: number; errors: number; events: string[]; actions: number[]; inFlight: number; maxInFlight: number; reads: Requests; prefetches: Requests; watch: string; exchanges: Exchange[] };
/** One kind of request a tab made: how many, and the most at once. */
type Requests = { count: number; inFlight: number; max: number };
/** One refresh action or route read: what the server answered, and whether the body held the name being watched for. */
type Exchange = { kind: 'action' | 'read'; at: number; status?: number; bytes?: number; has?: boolean; failed?: boolean };
const seen = (page: Page) => page.eval<Seen>('window.__live');
/** What a tab's stream and refreshes had done, for a failure to say. */
const tally = async (page: Page) => {
  const s = await seen(page);
  return `age ${Date.now() - s.born} ms, opens ${s.opens}, errors ${s.errors}, hints heard [${s.events.join(',')}], refresh actions ${s.actions.length} and route reads ${s.reads.count}, ${s.inFlight + s.reads.inFlight} in flight`;
};
/** What the server answered each refresh with, newest last: the status, and whether the body held the name waited for. */
const exchange = async (page: Page, since: number) => {
  const s = await seen(page);
  const kept = s.exchanges.filter((x) => x.at >= since);
  return kept.length
    ? kept.map((x) => `${x.kind} ${x.failed ? 'failed' : `HTTP ${x.status}, ${x.has ? 'has the row' : 'no row'} (${x.bytes ?? '?'} bytes)`} at +${x.at - since} ms`).join('; ')
    : `no refresh action or route read since +${since}`;
};

async function tab(): Promise<Page> {
  const page = await launch();
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: DEEP_SOURCE });
  await page.send('Network.enable');
  return page;
}

const url = (origin: string) => `${origin}/members?livePollMs=${pollMs}`;

/** Opens /members and waits until the tab's stream is open and has answered: a refresh has finished, or the greeting said nothing moved since the server's read. */
async function openMembers(page: Page, origin: string) {
  await page.open(url(origin), { width: 1440, theme: 'dark' });
  // A new member sorts last, which on a table of twenty per page is a page the tab is not showing: show up to a hundred.
  if (await page.eval<boolean>(`!!(${find('button', '20 per page')})`)) {
    await click(page, find('button', '20 per page'));
    await click(page, find('[role="menuitem"]', '100 per page'), true);
  }
  await waitFor(page, 'the table showing every member', `/^1–(\\d+) of \\1 members/m.test(document.body?.innerText ?? '') || !/of \\d+ members/.test(document.body?.innerText ?? '')`);
  const t = Date.now();
  for (;;) {
    const s = await seen(page);
    if (s.opens >= 1 && (s.actions.length >= 1 || s.events.includes('synced')) && s.inFlight === 0) return;
    if (Date.now() - t > PATIENCE_MS) throw new Error(`${origin}/members: the live stream did not open and answer in ${PATIENCE_MS} ms (opens ${s.opens}, refreshes ${s.actions.length}, greetings [${s.events.join(',')}])`);
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
async function point(page: Page, element: string, { stable = false, within = PATIENCE_MS } = {}): Promise<{ x: number; y: number }> {
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

async function waitFor(page: Page, what: string, expression: string, within = PATIENCE_MS) {
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
  // button that a closing menu or toast swallowed is pressed again. The three quick looks are retry pacing, not a
  // verdict: the wait after them is the functional bound, so a sheet that is slow to draw is waited for, not called broken.
  const settled = `(() => { const d = ${DIALOG}; const r = d?.getBoundingClientRect(); return r && r.width > 0 && r.right <= document.documentElement.clientWidth + 1; })()`;
  let shown = false;
  for (let attempt = 1; attempt <= 3 && !shown; attempt++) {
    await click(page, find('button', 'Invite member'));
    try { await waitFor(page, 'the sheet settling', settled, 1500); shown = true; } catch { /* a press that missed; press again */ }
  }
  if (!shown) await waitFor(page, 'the sheet settling', settled, PATIENCE_MS);
  await click(page, find('input[placeholder="Ana Costa"]', undefined, IN_DIALOG));
  await page.send('Input.insertText', { text: name });
  await click(page, find('input[type="email"]', undefined, IN_DIALOG));
  const email = `${name.replace(/\s+/g, '.')}@live-check.example`;
  await page.send('Input.insertText', { text: email });
  const pressed = await press(page, find('button', 'Invite'));
  // The table's own answer: a toast says the server took the invitation, or why it did not.
  if (confirm) await refused(page, PATIENCE_MS, `Invited ${email}`);
  return pressed;
}

/** Waits for the toast that confirms an invitation; a refused one throws with the reason its toast gives. */
async function refused(page: Page, within: number, confirmation: string) {
  const t = Date.now();
  for (;;) {
    const text = await page.eval<string>(`document.body?.innerText ?? ''`);
    const no = /Change not made\n([^\n]*)/.exec(text);
    if (no) throw new Error(`the server refused an invitation: ${no[1]}`);
    if (text.includes(confirmation)) return;
    if (Date.now() - t > within) throw new Error(`A's invitation was not confirmed by its toast in ${within} ms; saving rows ${await page.eval<number>(`((document.body?.innerText ?? '').match(/Saving…/g) ?? []).length`)}, toasts [${await page.eval<string>(`deepQueryAll('[role=status],[role=alert],[data-toast],ol li').map((e) => e.innerText.replace(/\\s+/g, ' ').slice(0, 80)).slice(0, 5).join(' / ')`)}], errors [${page.errors.join(' / ')}]; the sheet now: ${await page.eval<string>(`(${IN_DIALOG}?.innerText ?? 'closed').replace(/\\s+/g, ' ')`)}`);
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
  await waitFor(page, `${name} leaving the table`, `!document.querySelector('main table, main [role="table"]')?.textContent.includes(${JSON.stringify(name)})`, PATIENCE_MS);
  await page.eval(`(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  })()`);
  const t = Date.now();
  while (await page.eval<boolean>(`fetch(location.pathname, { cache: 'no-store' }).then((r) => r.text()).then((h) => h.includes(${JSON.stringify(name)}))`)) {
    if (Date.now() - t > PATIENCE_MS) throw new Error(`${name} was still on the server ${PATIENCE_MS} ms after the page sent the removal`);
    await sleep(200);
  }
}

/**
 * Resolves with the page's clock the moment the names are all shown (or all gone), or null at the deadline. A mutation
 * of the page is the prompt to look, and so is every 50 ms: a row a web component draws shows its text only once the
 * component has rendered inside its root, which no observer of the page's own tree hears.
 *
 * The wait runs inside one command, so the transport guard is asked for the deadline plus a margin: at the default 30 s
 * the guard would race the deadline the page was given and report a timeout instead of letting the page answer null.
 */
const showing = (page: Page, names: string[], present: boolean, within: number) => page.eval<number | null>(`new Promise((resolve) => {
  const names = ${JSON.stringify(names)};
  const ok = () => names.every((n) => (document.body?.innerText ?? '').includes(n) === ${present});
  if (ok()) return resolve(Date.now());
  const done = (at) => { clearTimeout(timer); clearInterval(tick); observer.disconnect(); resolve(at); };
  const look = () => { if (ok()) done(Date.now()); };
  const timer = setTimeout(() => done(null), ${within});
  const tick = setInterval(look, 50);
  const observer = new MutationObserver(look);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
})`, within + 5000);

const name = (label: string, i = 0) => `${run} ${label} ${i} ok`;

// ---- the cases ----

type Tabs = { a: Page; b: Page };
/** Names this run invited on an origin, so the cleanup can take them out again. */
const invited = new Set<string>();
const track = (n: string) => { invited.add(n); return n; };

/** A tab-to-tab change: A invites, and B's moment of showing it is returned, or null when it did not within PATIENCE_MS. */
async function converges(t: Tabs, label: string): Promise<{ at: number | null; pressed: number; heard: number }> {
  const n = track(name(label));
  await t.b.eval<void>('window.__live.reset()');
  const waiting = showing(t.b, [n], true, PATIENCE_MS);
  const pressed = await invite(t.a, n);
  const at = await waiting;
  const s = await seen(t.b);
  return { at, pressed, heard: s.events.filter((e) => e === 'change').length };
}

async function cleanup(t: Tabs) {
  for (const n of invited) await remove(t.a, n);
  invited.clear();
}

async function twoTabs(t: Tabs) {
  const { at, pressed, heard } = await converges(t, 'two-tabs');
  const { status, ms } = verdictOf(at, pressed, HINT_BOUND_MS);
  if (status === 'FAIL') throw new Error(`B did not show the invitation within ${PATIENCE_MS} ms`);
  record('live.two-tabs', ms);
  report(status, 'two tabs', `an invitation made in A showed in B in ${ms} ms (hint line ${HINT_BOUND_MS} ms${status === 'warn' ? '; past it, reported, never a failure' : ''}), ${heard} change hint(s) heard by B`);
}

async function visibility(t: Tabs) {
  const show = () => t.b.eval(`(() => { delete document.visibilityState; delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); })()`);
  await t.b.eval(`(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); })()`);
  try {
    const n = track(name('visibility'));
    const pressed = await invite(t.a, n);
    // While hidden the tab holds no stream and runs no poll: the change must not arrive on its own.
    await sleep(Math.max(0, pressed + pollMs + 1000 - Date.now()));
    if (await t.b.eval<boolean>(`(document.body?.innerText ?? '').includes(${JSON.stringify(n)})`)) throw new Error('B showed the change while hidden; it should hold no stream and no poll');
    const shown = showing(t.b, [n], true, PATIENCE_MS);
    const visibleAt = Date.now();
    await show();
    const at = await shown;
    const { status, ms } = verdictOf(at, visibleAt, POLL_BOUND_MS);
    if (status === 'FAIL') throw new Error(`B did not show the change within ${PATIENCE_MS} ms of becoming visible (${await tally(t.b)}; A ${await tally(t.a)}; A shows it: ${await t.a.eval(`(document.body?.innerText ?? '').includes(${JSON.stringify(n)})`)}; A's table rows ${await t.a.eval(`deepQueryAll('tr').length`)}, B's ${await t.b.eval(`deepQueryAll('tr').length`)}; A's messages: ${await t.a.eval(`(document.body?.innerText ?? '').split('\\n').filter((l) => /Invitation|Change not made|Sign in|permission|Enter their|Name the/.test(l)).join(' / ')`)}; this run's rows: A [${await t.a.eval(`deepQueryAll('tr').map((tr) => deepText(tr).replace(/\\s+/g, ' ').slice(0, 60)).filter((x) => x.includes(${JSON.stringify(run)})).join(' / ')`)}] B [${await t.b.eval(`deepQueryAll('tr').map((tr) => deepText(tr).replace(/\\s+/g, ' ').slice(0, 60)).filter((x) => x.includes(${JSON.stringify(run)})).join(' / ')`)}])`);
    record('live.visibility', ms);
    report(status, 'visibility', `B, hidden while A invited (still not showing it ${pollMs + 1000} ms after A's invitation), showed it ${ms} ms after becoming visible (line ${POLL_BOUND_MS} ms${status === 'warn' ? '; past it, reported, never a failure' : ''}; visibility emulated by overriding document.visibilityState)`);
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
    if (await t.b.eval<boolean>(`(document.body?.innerText ?? '').includes(${JSON.stringify(n)})`)) throw new Error('B showed the change while its network was offline');
    const shown = showing(t.b, [n], true, PATIENCE_MS);
    const onlineAt = Date.now();
    await conditions(false);
    const at = await shown;
    const { status, ms } = verdictOf(at, onlineAt, POLL_BOUND_MS);
    if (status === 'FAIL') throw new Error(`B did not show the change within ${PATIENCE_MS} ms of coming back online`);
    record('live.offline', ms);
    report(status, 'a disconnected write', `A wrote while B was offline (B showed nothing for 1500 ms); B showed it ${ms} ms after coming back online (line ${POLL_BOUND_MS} ms${status === 'warn' ? '; past it, reported, never a failure' : ''})`);
  } finally {
    await conditions(false);
  }
}

/**
 * B's requests by kind, each with its count and the most in flight at once, and which kind made the route fetches: refresh
 * actions (`next-action`), the router's own reads that follow them (`rsc` without the prefetch header) and prefetches
 * (`next-router-prefetch`, a positive integer).
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
  const waiting = showing(t.b, names, true, PATIENCE_MS);
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
  if (at === null) throw new Error(`${detail}; B did not show all ${COUNT} within ${PATIENCE_MS} ms of the last`);
  if (s.maxInFlight > 1) throw new Error(`${detail}; more than one refresh was in flight`);
  record('live.burst', settled);
  record('live.burst-send', sendMs);
  const late = settled > HINT_BOUND_MS;
  const slowSend = sendMs > 2000;
  report(late || slowSend ? 'warn' : 'ok', 'a sustained burst', `${detail}${late ? `; showing them took ${settled} ms, past the ${HINT_BOUND_MS} ms hint line (reported, never a failure)` : ''}${slowSend ? `; sending took ${sendMs} ms, past 2000 ms (reported, never a failure)` : ''}`);
}

async function suppressed(t: Tabs, origin: string) {
  await openMembers(t.a, origin);
  await openMembers(t.b, origin);
  // Write just after B's safety refresh has run, so the next one is about a full interval away and a quick answer cannot be luck.
  const refreshes = (await seen(t.b)).actions.length;
  await waitFor(t.b, 'the next safety refresh', `window.__live.actions.length > ${refreshes}`, PATIENCE_MS);
  const n = track(name('suppressed'));
  await t.b.eval<void>('window.__live.reset()');
  const waiting = showing(t.b, [n], true, PATIENCE_MS);
  const pressed = await invite(t.a, n);
  const at = await waiting;
  const { status, ms } = verdictOf(at, pressed, POLL_BOUND_MS);
  const s = await seen(t.b);
  if (status === 'FAIL') throw new Error(`B did not show the change within ${PATIENCE_MS} ms`);
  if (s.events.includes('change')) throw new Error('B heard a change hint, so hints were not suppressed on this server');
  if (s.errors > 0 || s.opens < 1) throw new Error(`the stream did not stay open (opens ${s.opens}, errors ${s.errors})`);
  record('live.suppressed', ms);
  report(status, 'suppressed hints', `LIVE_DROP_HINTS=1: the stream stayed open (${s.opens} open, ${s.errors} errors) and silent (no change hint); B still showed A's invitation ${ms} ms after A pressed Send, a moment after B's last safety refresh (poll ${pollMs} ms, line ${POLL_BOUND_MS} ms${status === 'warn' ? '; past it, reported, never a failure' : ''})`);
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
    const first = await showing(t.b, [before], true, PATIENCE_MS);
    if (first === null) throw new Error(`B never showed the invitation made before the restart, within ${PATIENCE_MS} ms`);
    const firstMs = first - pressed;
    // The data is in memory: a restarted server starts over from the sample, so "current data" no longer has that member.
    await stopServer(server, port);
    server = await serve(port);
    const upAt = Date.now();
    const gone = await showing(t.b, [before], false, PATIENCE_MS);
    if (gone === null) throw new Error(`B still showed the pre-restart member ${PATIENCE_MS} ms after the server was back`);
    const goneMs = gone - upAt;
    const after = name('restart-after');
    // The instrument reports, for every refresh after this, whether the server's answer held this name.
    await Promise.all([t.a, t.b].map((page) => page.eval(`if (window.__live) window.__live.watch = ${JSON.stringify(after)}`)));
    const sent = await invite(t.a, after);
    const arrived = await showing(t.b, [after], true, PATIENCE_MS);
    if (arrived === null) {
      const rows = (page: Page) => page.eval<string>(`deepQueryAll('tr').map((tr) => deepText(tr).replace(/\\s+/g, ' ').slice(0, 60)).filter((x) => x.includes(${JSON.stringify(run)})).join(' / ')`);
      const messages = (page: Page) => page.eval<string>(`(document.body?.innerText ?? '').split('\\n').filter((l) => /Invitation|Change not made|Sign in|permission|Enter their|Name the/.test(l)).join(' / ')`);
      throw new Error(`B did not show a write made after the restart within ${PATIENCE_MS} ms; A shows it: ${await t.a.eval<boolean>(`(document.body?.innerText ?? '').includes(${JSON.stringify(after)})`)}, A's rows ${await t.a.eval<number>(`deepQueryAll('tr').length`)}, B's ${await t.b.eval<number>(`deepQueryAll('tr').length`)}; this run's rows: A [${await rows(t.a)}] B [${await rows(t.b)}]; A's messages: ${await messages(t.a)}; B's messages: ${await messages(t.b)}; B's exchanges: ${await exchange(t.b, sent)}; A's exchanges: ${await exchange(t.a, sent)}; ${await tally(t.b)}; A ${await tally(t.a)}`);
    }
    const afterMs = arrived - sent;
    record('live.restart-before', firstMs);
    record('live.restart-gone', goneMs);
    record('live.restart-after', afterMs);
    const late = [firstMs > HINT_BOUND_MS ? `the write before the restart took ${firstMs} ms (hint line ${HINT_BOUND_MS} ms)` : '', goneMs > POLL_BOUND_MS ? `the pre-restart member took ${goneMs} ms to go (line ${POLL_BOUND_MS} ms)` : '', afterMs > POLL_BOUND_MS ? `the write after the restart took ${afterMs} ms (line ${POLL_BOUND_MS} ms)` : ''].filter(Boolean);
    report(late.length ? 'warn' : 'ok', 'a server restart', `B showed the invitation in ${firstMs} ms, then ${goneMs} ms after the restarted server answered it showed the current data (the member gone); a write made after the restart reached B in ${afterMs} ms${late.length ? `; past its line, reported, never a failure: ${late.join('; ')}` : ''}; this server and its data are discarded`);
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
const asked = (label: string) => !only || only.split(',').includes(label);
const unknown = only?.split(',').filter((c) => !CASES.includes(c)) ?? [];
if (unknown.length) {
  console.error(`live: --only names ${unknown.map((c) => `"${c}"`).join(', ')}, which no case is called; the cases are ${CASES.map((c) => `"${c}"`).join(', ')}.`);
  process.exit(1);
}

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
      if (!asked(label)) return report('not run', label, 'not asked for (--only)');
      try { await fn(); } catch (e) { report('FAIL', label, (e as Error).message); }
    };
    // Case order matters only in that each leaves the tabs usable; every case invites its own uniquely named members.
    // Opening the page is where a slow machine or a cold build shows first, so it is guarded like the cases: its failure
    // is a line of its own, and every case says it did not run and why, instead of the tier ending in a stack trace.
    let opened = false;
    try {
      await openMembers(a, base);
      await openMembers(b, base);
      opened = true;
    } catch (e) {
      report('FAIL', 'open the members page', (e as Error).message);
      skipAll('the members page did not open in both tabs');
    }
    if (opened) {
      await step('two tabs', () => twoTabs(t));
      await step('visibility', () => visibility(t));
      await step('a disconnected write', () => offline(t));
      await step('a sustained burst', () => burst(t));
      try { await cleanup(t); } catch (e) { report('FAIL', 'cleanup', `a member this check invited was not removed: ${(e as Error).message}`); }
      if (dropBase) {
        await step('suppressed hints', async () => { await suppressed(t, dropBase); });
        try { await cleanup(t); } catch (e) { report('FAIL', 'cleanup', `a member this check invited on ${dropBase} was not removed: ${(e as Error).message}`); }
      } else {
        report('not run', 'suppressed hints', asked('suppressed hints') ? 'no --drop-base: the server started with LIVE_DROP_HINTS=1 was not given' : 'not asked for (--only)');
      }
      await step('a server restart', () => restart(t));
    }
  }
  a?.close();
  b?.close();
}

recordPart(ROOT, 'live', values);
const { line, exit } = liveSummary(outcomes, pollMs);
console.log(`\n${line}`);
process.exit(exit);
