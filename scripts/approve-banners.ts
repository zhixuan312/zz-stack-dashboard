/**
 * The document page's two Approve banners that a page load alone does not reach, drawn in the built app against the
 * fake gateway (scripts/fake-gateway/work.ts): one of verify's `browserChecks`.
 *
 *   node scripts/approve-banners.ts [--base http://localhost:3100]
 *
 * - "This document changed while you were reading it": a refetch brings a newer snapshot than the one the page
 *   recorded. The fake's `drifting` document is revised every fifteen seconds, so the page records the snapshot it
 *   loaded; once the console's thirty-second staleTime has passed, the focus a returning reader brings refetches it,
 *   and the snapshot that arrives is a later one.
 * - "Approve is unavailable": zz-core refuses the record outright (the fake's `unrecordable` document). The audit draws
 *   that one from its detail route; this checks the banner is what the route shows.
 *
 * Fails (exit 1) when a banner is not drawn, when Approve stays pressable under it, or on an uncaught page error.
 */
import { launch } from './lib/chrome.ts';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const base = opt('--base', process.env.BASE ?? 'http://localhost:3100');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The page's text, and whether an enabled Approve button is on it. */
const STATE = `(() => ({
  text: document.body.innerText,
  approve: [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Approve' && !b.disabled && b.getAttribute('aria-disabled') !== 'true'),
}))()`;

type State = { text: string; approve: boolean };

const page = await launch();
const failures: string[] = [];
const read = () => page.eval<State>(STATE);

/** Approve once the record lands: polled, since the record is a request of its own after the render. */
async function offered(): Promise<State> {
  let state = await read();
  for (let i = 0; i < 16 && !state.approve; i++) { await sleep(500); state = await read(); }
  return state;
}

// Changed: recorded first (Approve pressable), then a focus refetch past the staleTime lands on a newer snapshot.
const drifting = '/initiatives/atlas/2026-10-03-ranking-weights/spec.md';
await page.open(base + drifting, { width: 1440, theme: 'dark' });
let first = await offered();
// A read and its record that straddle one of the document's revisions land on "out of date" — a true state, not this
// one — so the page is opened once more.
if (!first.approve && first.text.includes('This page is out of date')) {
  await page.open(base + drifting, { width: 1440, theme: 'dark' });
  first = await offered();
}
if (!first.approve) failures.push(`${drifting}: Approve is not offered once the page has recorded what it shows`);
await sleep(31_000);
await page.eval(`window.dispatchEvent(new Event('visibilitychange'))`);
await sleep(2_500);
const changed = await read();
if (!changed.text.includes('This document changed while you were reading it')) failures.push(`${drifting}: a refetch that brought a newer snapshot drew no "changed" banner`);
if (changed.approve) failures.push(`${drifting}: Approve is still pressable on a snapshot the page did not record`);
if (page.errors.length) failures.push(`${drifting}: ${page.errors[0]}`);

// Failed: the record is refused outright, so Approve is unavailable from the first render.
const unrecordable = '/initiatives/atlas/2026-10-04-index-rebuild/spec.md';
await page.open(base + unrecordable, { width: 1440, theme: 'dark' });
const failed = await read();
if (!failed.text.includes('Approve is unavailable')) failures.push(`${unrecordable}: a refused record drew no "Approve is unavailable" banner`);
if (failed.approve) failures.push(`${unrecordable}: Approve is pressable although nothing was recorded`);
if (page.errors.length) failures.push(`${unrecordable}: ${page.errors[0]}`);

page.close();
for (const f of failures) console.log('FAIL ' + f);
console.log(`\napprove banners: 2 states drawn; ${failures.length} issues`);
process.exit(failures.length ? 1 : 0);
