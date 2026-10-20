/**
 * Live data: the tab's stream opens, a change reaches it, and a change it does not follow is left alone.
 *
 *   node scripts/live-check.ts --base http://127.0.0.1:3100
 *
 * Meridian's own live check drives the sample Members page, which this product does not have, so the standard puts the
 * product's own live pages here (`standard.md`'s floor, "a product's own live pages add a `browserChecks` script").
 *
 * What it proves, and what it does not. It proves the console's half of the contract in `references/live.md`: a page
 * loaded directly opens its first stream with the revisions its server read was answered at and reads nothing again
 * for it, so does the stream a press in the rail opens for a page that follows another collection, a page opens one
 * stream and follows its own collection, a hint for that collection is read again and what
 * arrived is on
 * screen (on Teams and on a team's page, whose first reads are the console's server's), a hint for a collection the page does not show changes nothing, People reads its
 * collection again on a hint for it, and the bell's own read follows a hint for the collection it watches. It does NOT prove the multi-tab and offline behaviour Meridian's own check does — one
 * `launch()` here owns one page, and a second tab is not something this harness can open. The stream is shared per
 * origin, so a hint reaching this tab is the same frame a second tab would get; the reader should know that is an
 * argument, not a measurement.
 *
 * ONE CAVEAT under `verify --full`, where it matters: the read counts are the gateway's, per collection, and the
 * presses suite shares that gateway. A page the presses visit may read `initiatives` in the same window this check is
 * watching, which would let the bell case pass without this tab having read anything. The cases that assert on the page
 * itself are unaffected, and the negative control was run outside that concurrency: the case fails when the thing it
 * names is broken, and passes here — which is what a check should do, but is weaker evidence under a shared gateway
 * than when run alone.
 *
 * The change is driven through the fake gateway's own hooks, which live under the path the app proxies
 * (`/api/console/__hint`) so this check never has to know the gateway's address. Against a real gateway there are no
 * such routes and this file is not run. It signs in as a session of its own, `superadmin+live`, which the fake answers
 * as the superadmin in the normal state and keeps the check's renames for: every other suite, signed in or not, reads
 * the fixture's names throughout.
 */
import { launch } from './lib/chrome.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');

/** The fixture team this check renames: no row is added, so nothing else in `verify` sees a link it cannot follow. See
 * the hook's own comment in `scripts/fake-gateway/server.ts`. */
const RENAMED_SLUG = 'dune';
/** This check's own session value (scripts/fake-gateway/server.ts): the renames it asks for are seen by it alone. */
const SESSION = { name: 'zz_console', value: 'superadmin+live' };
/** How long a tab is given to show what it read again, well inside the 30 s safety poll: a pass here is a hint's doing. */
const SHOW_MS = 8000;
/** How long the "nothing should happen" case watches for, for the same reason. */
const QUIET_MS = 5000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const page = await launch();
const failures: string[] = [];

/**
 * Every stream the page opens, as the browser opened it: its address, and its greeting with the moment it arrived.
 * Recorded inside the page before any of its scripts run, so the first stream of each load is in it however soon it
 * opens; a check outside the page sees only the gateway, which other suites share under `verify --full`.
 */
await page.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    const Native = window.EventSource;
    window.__liveStreams = [];
    window.__liveChanges = [];
    window.EventSource = class extends Native {
      constructor(url, init) {
        super(url, init);
        const opened = { url: String(url), greeting: null, at: null, closed: false };
        window.__liveStreams.push(opened);
        // A stream the page closes before its greeting was replaced by the next one the navigation opened: recorded, so
        // it is not read as a stream the gateway never greeted.
        this.close = () => { opened.closed = true; Native.prototype.close.call(this); };
        const greet = (event) => (e) => { if (opened.greeting === null) { opened.greeting = { event, data: e.data }; opened.at = performance.now(); } };
        this.addEventListener('synced', greet('synced'));
        this.addEventListener('resync', greet('resync'));
        // Every hint the stream carried, with when: under verify --full the other suites' writes are hinted too.
        this.addEventListener('change', (e) => {
          try { window.__liveChanges.push({ collection: JSON.parse(e.data).collection, at: performance.now() }); } catch {}
        });
      }
    };
  })();`,
});

/** What the page shows, as one string of text. */
const text = () => page.eval<string>('document.body.innerText.replace(/\\s+/g, " ")');

/** Fire the fake gateway's hint, through the app's own origin. */
const hint = (query: string) => page.eval<{ reached: number; renamed: string | null }>(`fetch('/api/console/__hint?${query}', { credentials: 'same-origin' }).then((r) => r.json())`);

const streams = () => page.eval<{ streams: number }>(`fetch('/api/console/__streams', { credentials: 'same-origin' }).then((r) => r.json())`);

/** How many times the gateway has been asked for each collection since it started. */
const counts = () => page.eval<Record<string, number>>(`fetch('/api/console/__streams', { credentials: 'same-origin' }).then((r) => r.json()).then((s) => s.reads ?? {})`);

/** Wait for `seen` to hold of the page's text, up to `ms`. */
async function until(seen: (t: string) => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (seen(await text())) return true;
    await sleep(250);
  }
  return false;
}

/**
 * One page that follows `teams`, at `address`: its stream is open, a change to teams is read again in the browser and
 * shows, though the page's first read was the console's server's, and a change to a collection it does not show is
 * left alone. Each address renames the team to names of its own, so what one case shows another cannot have made.
 */
async function follows(address: string, renamedTo: string, unsolicitedTo: string): Promise<void> {
  await page.open(base + address, { width: 1440, theme: 'dark', cookie: SESSION });
  if (page.errors.length) failures.push(`${address}: ${page.errors[0]}`);

  // The stream is open, and it is following something: a page that registered nothing subscribes to nothing. The
  // provider opens it once `/me` answers, which is a round trip after the page itself.
  let open = 0;
  for (let i = 0; i < 24; i++) {
    open = await streams().then((s) => s.streams).catch(() => -1);
    if (open >= 1) break;
    await sleep(250);
  }
  if (open < 0) failures.push(`${address}: the app did not proxy the fake gateway's \`__streams\` hook, so nothing here could be checked`);
  else if (open < 1) failures.push(`${address}: no stream is open, though the page shows teams (following ${open})`);

  if ((await text()).includes(renamedTo)) failures.push(`${address}: ${renamedTo} is on the page before this check made it`);

  // A change to a collection the page follows is read again and what arrived is on screen.
  const reached = await hint(`collection=teams&rename=${RENAMED_SLUG}:${encodeURIComponent(renamedTo)}`);
  if (reached.reached < 1) failures.push(`${address}: the hint reached no tab — the page is not following teams`);
  if (!reached.renamed) failures.push(`${address}: the fixture has no team ${RENAMED_SLUG} to rename`);
  if (!(await until((t) => t.includes(renamedTo), SHOW_MS))) failures.push(`${address}: a change to teams never showed, so the tab did not read the collection again`);

  // A change to a collection the page does not show is left alone. The second rename really is made and `runs` is what
  // gets hinted, so a tab that read teams again for any reason would show it — which is what gives this case its meaning.
  await hint(`collection=runs&rename=${RENAMED_SLUG}:${encodeURIComponent(unsolicitedTo)}`);
  if (await until((t) => t.includes(unsolicitedTo), QUIET_MS)) failures.push(`${address}: a change to runs reached the page, so the tab reads collections it does not show`);

  if (page.errors.length) failures.push(`${address}: ${page.errors[0]}`);
}

/**
 * A page loaded directly asks its first stream whether anything moved since its server read (ZZ Meridian 0.18.0's
 * `since`): the stream's address names a revision for every collection it follows, the greeting is `synced`, and the
 * tab reads none of those collections again for it. The pages are every kind that hands a server read to its stream:
 * one followed in the browser (`useServed`), one asked of the server again (`useServerReadLive`), a detail route, and
 * the bell's own read, which every page shows and which the stream waits for.
 */
const DIRECT = ['/platform/teams', `/platform/teams/${RENAMED_SLUG}`, '/platform/people', '/knowledge', '/knowledge/log', '/approvals', '/initiatives', '/access', '/activity', '/runs', '/plugins'];
/** How long after its greeting a tab is watched for a read of what it follows. */
const AFTER_GREETING_MS = 1500;
/** The collection a console read is kept under, as `src/views/console-live.tsx` maps a path. */
const collectionOf = (path: string) => {
  const head = path.split('?')[0]!.split('/').filter(Boolean)[0] ?? '';
  return ({ approvals: 'initiatives', access: 'settings' } as Record<string, string>)[head] ?? head;
};
type Opened = { url: string; greeting: { event: string; data: string } | null; at: number | null; closed: boolean };

/**
 * The tab's reads of a followed collection begun after `greetedAt` that no hint explains: a read that starts after a
 * `change` for its own collection is that hint's doing, which under `verify --full` the presses' writes raise (an
 * approval hints `initiatives`, a revoked token `settings`), so only a read with no hint before it is one the greeting
 * caused. Harbormaster #3751 failed /platform/people and /access on reads the presses' hints made.
 */
async function readsTheGreetingCaused(greetedAt: number, followed: string[]): Promise<string[]> {
  const reads = await page.eval<{ name: string; start: number }[]>(
    "performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname.startsWith('/api/console/')).map((e) => ({ name: e.name, start: e.startTime }))",
  );
  const hinted = await page.eval<{ collection: string; at: number }[]>('window.__liveChanges ?? []');
  return reads
    .map((r) => ({ path: new URL(r.name).pathname, start: r.start }))
    .filter((r) => r.start > greetedAt)
    .filter((r) => followed.includes(collectionOf(r.path.replace('/api/console', ''))))
    .filter((r) => !hinted.some((h) => h.collection === collectionOf(r.path.replace('/api/console', '')) && h.at > greetedAt && h.at <= r.start))
    .map((r) => r.path);
}

/**
 * The first stream a page kept: one closed before its greeting was replaced as the page's collections grew while it
 * mounted (`setNames` in src/lib/live.ts), which a loaded machine spreads over several commits (Harbormaster #3860
 * replaced /activity's and /platform/teams's first stream, following only `initiatives`, before it was greeted).
 */
const kept = (streams: Opened[]) => streams.find((s) => s.greeting || !s.closed);

/**
 * The pages whose first greeting was a resync on the first load and synced on the second. Under `verify --full` another
 * suite's write (a press revoking a token hints `settings`) can move a collection between the page's server read and its
 * stream's greeting, and a resync is then the right answer (Harbormaster #4530 failed /access so, and passed alone twice,
 * #4536). So a resync is judged once more on a fresh load; a console that resyncs every time fails both.
 */
const resyncedOnce: string[] = [];

async function asksSince(address: string, retry = true): Promise<void> {
  await page.open(base + address, { width: 1440, theme: 'dark', wait: 600, cookie: SESSION });
  if (page.errors.length) failures.push(`${address}: ${page.errors[0]}`);
  let first: Opened | undefined;
  for (let i = 0; i < 32 && !first?.greeting; i++) {
    first = kept(await page.eval<Opened[]>('window.__liveStreams ?? []'));
    if (!first?.greeting) await sleep(250);
  }
  if (!first) { failures.push(`${address}: no stream opened`); return; }
  if (!first.greeting) { failures.push(`${address}: the first stream was never greeted (${first.url})`); return; }
  const asked = new URL(first.url, base).searchParams;
  const followed = (asked.get('collections') ?? '').split(',').filter(Boolean);
  const since = new Map((asked.get('since') ?? '').split(',').filter(Boolean).map((p) => [p.slice(0, p.indexOf(':')), p.slice(p.indexOf(':') + 1)]));
  const without = followed.filter((n) => !since.get(n));
  if (without.length) failures.push(`${address}: the first stream follows ${followed.join(', ')} and asked with no revision for ${without.join(', ')}`);
  if (first.greeting.event !== 'synced') {
    if (retry) { resyncedOnce.push(address); return asksSince(address, false); }
    failures.push(`${address}: the first stream was greeted ${first.greeting.event} ${first.greeting.data}, not synced, on two loads`);
  }
  await sleep(AFTER_GREETING_MS);
  const again = await readsTheGreetingCaused(first.at!, followed);
  if (again.length) failures.push(`${address}: read ${again.join(', ')} again after its stream's greeting`);
}

for (const address of DIRECT) await asksSince(address);
if (resyncedOnce.length) console.log(`note: ${resyncedOnce.join(', ')} greeted resync on the first load and was judged on a second`);

/** A page's live streams so far, in the order they opened. */
const opened = () => page.eval<Opened[]>('window.__liveStreams ?? []');

/**
 * A press in the rail to a page that follows another collection (ZZ Meridian 0.18.1, its issue #54): the stream the new
 * names open asks with the revisions the new page's server read was answered at, is greeted `synced`, and the tab reads
 * none of what it follows again for it. A client navigation keeps the page's script, so `window.__liveStreams` holds the
 * first page's streams and then every one the press opened.
 */
async function pressed(from: string, to: string, collection: string): Promise<void> {
  const where = `a press in the rail from ${from} to ${to}`;
  await page.open(base + from, { width: 1440, theme: 'dark', wait: 600, cookie: SESSION });
  if (page.errors.length) failures.push(`${from}: ${page.errors[0]}`);
  let before: Opened[] = [];
  for (let i = 0; i < 32 && !kept(before)?.greeting; i++) {
    before = await opened();
    if (!kept(before)?.greeting) await sleep(250);
  }
  if (!kept(before)?.greeting) { failures.push(`${where}: ${from}'s own stream was never greeted, so there was nothing to navigate from`); return; }
  const link = `nav[aria-label="Main"] a[href="${to}"]`;
  if (!(await page.eval<boolean>(`(() => { const a = document.querySelector(${JSON.stringify(link)}); if (!a) return false; a.click(); return true; })()`))) {
    failures.push(`${where}: the rail has no link to ${to}`);
    return;
  }
  let after: Opened[] = [];
  let at = '';
  for (let i = 0; i < 40; i++) {
    at = await page.eval<string>('location.pathname');
    after = (await opened()).slice(before.length);
    if (at === to && after.some((s) => new URL(s.url, base).searchParams.get('collections')?.split(',').includes(collection)) && after.every((s) => s.greeting || s.closed)) break;
    await sleep(250);
  }
  if (at !== to) { failures.push(`${where}: the page is at ${at}, so the press did not navigate`); return; }
  const target = after.findLast((s) => new URL(s.url, base).searchParams.get('collections')?.split(',').includes(collection));
  if (!target) { failures.push(`${where}: no stream following ${collection} opened after the press (${after.length} opened)`); return; }
  if (!target.greeting) { failures.push(`${where}: the stream following ${collection} was never greeted (${target.url})`); return; }
  for (const s of after) {
    // Closed before its greeting: replaced while the navigation settled (Harbormaster #3842 under a full verify's load).
    if (!s.greeting && s.closed) continue;
    if (!s.greeting) { failures.push(`${where}: a stream it opened was never greeted (${s.url})`); continue; }
    const asked = new URL(s.url, base).searchParams;
    const followed = (asked.get('collections') ?? '').split(',').filter(Boolean);
    const since = new Set((asked.get('since') ?? '').split(',').filter(Boolean).map((p) => p.slice(0, p.indexOf(':'))));
    const without = followed.filter((n) => !since.has(n));
    if (without.length) failures.push(`${where}: its stream follows ${followed.join(', ')} and asked with no revision for ${without.join(', ')}`);
    if (s.greeting.event !== 'synced') failures.push(`${where}: its stream was greeted ${s.greeting.event} ${s.greeting.data}, not synced`);
  }
  if (!target.greeting) return;
  await sleep(AFTER_GREETING_MS);
  const followed = (new URL(target.url, base).searchParams.get('collections') ?? '').split(',').filter(Boolean);
  const again = await readsTheGreetingCaused(target.at!, followed);
  if (again.length) failures.push(`${where}: read ${again.join(', ')} again after its stream's greeting`);
  if (page.errors.length) failures.push(`${to}: ${page.errors[0]}`);
}

await pressed('/platform/teams', '/platform/people', 'people');

await follows('/platform/teams', 'Dune Renamed By The Live Check', 'Dune Renamed Unsolicited');
await follows(`/platform/teams/${RENAMED_SLUG}`, 'Dune Renamed On Its Own Page', 'Dune Renamed Unsolicited On Its Page');

/**
 * People, at its address under Platform: its first read is the console's server's, so a read of `people` the gateway
 * counts after a hint is the tab's own. Nothing in the fixture can rename a person, so this asserts on the gateway's
 * read count, as the bell case below does, and carries the same caveat under `verify --full`. A hint for a collection
 * People does not show is not asserted here: on a shared gateway another suite's read of `people` would fail it.
 */
await page.open(base + '/platform/people', { width: 1440, theme: 'dark', cookie: SESSION });
if (page.errors.length) failures.push(`/platform/people: ${page.errors[0]}`);
if (!(await until((t) => t.includes('Sign-ins last week'), SHOW_MS))) failures.push('/platform/people: the page never drew its tiles');
const peopleBefore = (await counts()).people ?? 0;
await hint('collection=people');
let peopleRead = false;
for (let i = 0; i < 24 && !peopleRead; i++) {
  await sleep(250);
  peopleRead = ((await counts()).people ?? 0) > peopleBefore;
}
if (!peopleRead) failures.push('/platform/people: a hint for people was never read again, so the tab does not follow people');

/**
 * The chrome's own read, on a page that does not show it.
 *
 * `/platform/people` reads `people` and nothing else, so any read of `approvals` there is the BELL's — the one place the console
 * says "this needs you" without being asked. It registers `initiatives` itself (`src/console/frame.tsx`), and without
 * that registration a gate approved in another tab leaves its count stale on every page whose own read is not also
 * `initiatives`, which is all of them but two.
 *
 * Asserted on the gateway's read count, not on the bell's markup: the waiting list is a fixed fixture, so a refetch
 * returns the same rows and the bell looks identical either way. The count says the request arrived, which is what "the
 * tab read it again" means.
 */
const bellBefore = (await counts()).approvals ?? 0;
await hint('collection=initiatives');
let bellRead = false;
for (let i = 0; i < 24 && !bellRead; i++) {
  await sleep(250);
  bellRead = ((await counts()).approvals ?? 0) > bellBefore;
}
if (!bellRead) failures.push('/platform/people: a hint for initiatives never read the bell\'s Approvals again, though the bell beside that page shows it');

if (page.errors.length) failures.push(`/platform/people: ${page.errors[0]}`);

page.close();
for (const f of failures) console.log('FAIL ' + f);
console.log(`\nlive: ${DIRECT.length} pages loaded directly each asked their first stream with the revisions they were served and were greeted synced with no second read, a press in the rail to a page following another collection opened its stream with that page's revisions and was greeted synced with no second read, teams followed at two addresses, each change read again and each unsolicited one ignored, and people read again on a hint; ${failures.length} issues`);
process.exit(failures.length ? 1 : 0);
