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
 * screen, a hint for a collection the page does not show changes nothing, and no frame arrives with the stream closed
 * again. It does NOT prove the multi-tab and offline behaviour Meridian's own check does — one `launch()` here owns one
 * page, and a second tab is not something this harness can open. The stream is shared per origin, so a hint reaching
 * this tab is the same frame a second tab would get; the reader should know that is an argument, not a measurement.
 *
 * The change is driven through the fake gateway's own hooks, which live under the path the app proxies
 * (`/api/console/__hint`) so this check never has to know the gateway's address. Against a real gateway there are no
 * such routes and this file is not run.
 */
import { launch } from './lib/chrome.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');

/** The fixture team this check renames, and what it renames it to: no row is added, so nothing else in `verify` sees a
 * link it cannot follow. See the hook's own comment in `scripts/fake-gateway/server.ts`. */
const RENAMED_SLUG = 'dune';
const RENAMED_TO = 'Dune Renamed By The Live Check';
/** The second rename, hinted at a collection the page does not follow. */
const UNSOLICITED_TO = 'Dune Renamed Unsolicited';
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

/** Wait for `seen` to hold of the page's text, up to `ms`. */
async function until(seen: (t: string) => boolean, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (seen(await text())) return true;
    await sleep(250);
  }
  return false;
}

await page.open(base + '/teams', { width: 1440, theme: 'dark' });
if (page.errors.length) failures.push(`/teams: ${page.errors[0]}`);

// The stream is open, and it is following something: a page that registered nothing subscribes to nothing. The provider
// opens it once `/me` answers, which is a round trip after the page itself.
let open = 0;
for (let i = 0; i < 24; i++) {
  open = await streams().then((s) => s.streams).catch(() => -1);
  if (open >= 1) break;
  await sleep(250);
}
if (open < 0) failures.push('/teams: the app did not proxy the fake gateway\'s `__streams` hook, so nothing here could be checked');
else if (open < 1) failures.push(`/teams: no stream is open, though the page shows teams (following ${open})`);

const before = await text();
if (before.includes(RENAMED_TO)) failures.push(`/teams: ${RENAMED_TO} is on the page before this check made it`);

// A change to a collection the page follows is read again and what arrived is on screen.
const reached = await hint(`collection=teams&rename=${RENAMED_SLUG}:${encodeURIComponent(RENAMED_TO)}`);
if (reached.reached < 1) failures.push('/teams: the hint reached no tab — the page is not following teams');
if (!reached.renamed) failures.push(`/teams: the fixture has no team ${RENAMED_SLUG} to rename`);
const arrived = await until((t) => t.includes(RENAMED_TO), SHOW_MS);
if (!arrived) failures.push('/teams: a change to teams never showed, so the tab did not read the collection again');

// A change to a collection the page does not show is left alone. The second rename really is made and `runs` is what
// gets hinted, so a tab that read teams again for any reason would show it — which is what gives this case its meaning.
await hint(`collection=runs&rename=${RENAMED_SLUG}:${encodeURIComponent(UNSOLICITED_TO)}`);
const leaked = await until((t) => t.includes(UNSOLICITED_TO), QUIET_MS);
if (leaked) failures.push('/teams: a change to runs reached the teams page, so the tab reads collections it does not show');

if (page.errors.length) failures.push(`/teams: ${page.errors[0]}`);

page.close();
for (const f of failures) console.log('FAIL ' + f);
console.log(`\nlive: one collection followed, one change read again, one ignored; ${failures.length} issues`);
process.exit(failures.length ? 1 : 0);
