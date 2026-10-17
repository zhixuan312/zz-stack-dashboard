/**
 * Live data: the tab's stream opens, a change reaches it, and a change it does not follow is left alone.
 *
 *   node scripts/live-check.ts --base http://127.0.0.1:3100
 *
 * Meridian's own live check drives the sample Members page, which this product does not have, so the standard puts the
 * product's own live pages here (`standard.md`'s floor, "a product's own live pages add a `browserChecks` script").
 *
 * What it proves, and what it does not. It proves the console's half of the contract in `references/live.md`: a page
 * opens one stream and follows its own collection, a hint for that collection is read again and what arrived is on
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
 * such routes and this file is not run.
 */
import { launch } from './lib/chrome.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');

/** The fixture team this check renames: no row is added, so nothing else in `verify` sees a link it cannot follow. See
 * the hook's own comment in `scripts/fake-gateway/server.ts`. */
const RENAMED_SLUG = 'dune';
/** How long a tab is given to show what it read again, well inside the 30 s safety poll: a pass here is a hint's doing. */
const SHOW_MS = 8000;
/** How long the "nothing should happen" case watches for, for the same reason. */
const QUIET_MS = 5000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const page = await launch();
const failures: string[] = [];

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
  await page.open(base + address, { width: 1440, theme: 'dark' });
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

await follows('/platform/teams', 'Dune Renamed By The Live Check', 'Dune Renamed Unsolicited');
await follows(`/platform/teams/${RENAMED_SLUG}`, 'Dune Renamed On Its Own Page', 'Dune Renamed Unsolicited On Its Page');

/**
 * People, at its address under Platform: its first read is the console's server's, so a read of `people` the gateway
 * counts after a hint is the tab's own. Nothing in the fixture can rename a person, so this asserts on the gateway's
 * read count, as the bell case below does, and carries the same caveat under `verify --full`. A hint for a collection
 * People does not show is not asserted here: on a shared gateway another suite's read of `people` would fail it.
 */
await page.open(base + '/platform/people', { width: 1440, theme: 'dark' });
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
console.log(`\nlive: teams followed at two addresses, each change read again and each unsolicited one ignored, and people read again on a hint; ${failures.length} issues`);
process.exit(failures.length ? 1 : 0);
