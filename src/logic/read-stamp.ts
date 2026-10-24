/**
 * The one sentence that says which instant an answer's figures are as of: the line every page writes in its masthead,
 * in a module of its own so the copy cannot drift page by page. `As of ${formatDateTime(…meta.asOf)}` was written out
 * in twenty-two places in `src/logic` and `src/views`; nineteen of them are this function now.
 *
 * The three that are not are the two pages and one context handed a narrowed `meta` — `PeopleShown` and
 * `InitiativesShown` carry `Pick<ReadMeta, 'asOf'>` and nothing else, so those surfaces cannot know whether their answer
 * was served and keep writing `As of …` until the payload they are handed carries `observedAt` and `cacheHit`.
 *
 * WHICH instant, and whether there are two, are different questions with different answers. Only the cache knows
 * whether an answer was served rather than computed, and it says so in `meta.cacheHit` (AC-2.2, FR-2). The two instants
 * are compared for nothing but which words to use once the hit is established, because that comparison is true on
 * almost every MISS — `asOf` is rounded up to a whole second, so a miss's two instants differ routinely. A page that
 * inferred the hit from the comparison would tell a reader that an answer it computed itself was served; the fourth
 * case of `tests/read-stamp.test.ts` is that page, and it fails.
 */
import { formatDateTime } from '@/lib/format-date';
import type { ReadMeta } from '@/lib/platform-shapes';

/**
 * `formatDateTime`'s words with the seconds its masthead form cannot show: `09 Jun 2026, 08:04:12`. The seconds of the
 * minute are the same in every reporting zone, each offset being a whole number of minutes, so reading them in UTC is
 * right for a reader in the display zone — and the rest of the line still comes from `formatDateTime`, the one module
 * this product displays a date through. An instant that cannot be parsed keeps `formatDateTime`'s own words.
 */
function clockWithSeconds(iso: string): string {
  const d = new Date(iso);
  const ss = Number.isNaN(d.getTime()) ? null : String(d.getUTCSeconds()).padStart(2, '0');
  return ss === null ? formatDateTime(iso) : `${formatDateTime(iso)}:${ss}`;
}

/** The whole second an instant falls in, which is the finest difference the reader is shown. `NaN` for one that will
 *  not parse, so two unreadable instants are never silently called the same. */
const secondOf = (iso: string): number => Math.floor(Date.parse(iso) / 1000);

/** Exactly what a stamp reads of an answer's `meta`: the computed instant, the served one, and the cache's own verdict.
 *  A whole `ReadMeta` satisfies it, and so will the narrowed payloads the console's server hands `PeopleShown` and
 *  `InitiativesShown` once those carry these three — the shape is stated here so that widening them is not a change to
 *  this module. */
export type StampMeta = Pick<ReadMeta, 'asOf' | 'observedAt' | 'cacheHit'>;

/**
 * An answer's age as its masthead says it.
 *
 * `text` is the short line. An answer computed for this request reads `As of <asOf>`. An answer the cache served reads
 * `Computed <asOf> · served <observedAt>` when the two instants differ, and names the one instant when they fall in the
 * same second — there is nothing to tell apart then, and the reader is not shown a difference of zero.
 *
 * `title` carries both instants to the second, whether or not `text` collapsed them, so a reader who wants the precision
 * a `08:04` cannot show gets it without widening the masthead.
 *
 * DELIBERATE: there is no `undefined` branch. The three fields are required on `ReadMeta`, and an answer a page holds
 * has crossed the gateway's read envelope and cannot lack them, so a guard for one would be a comparison TypeScript
 * refuses (TS2367) and a state no page can be in.
 */
export function stampOf(meta: StampMeta): { text: string; title: string } {
  const computed = formatDateTime(meta.asOf);
  // Nothing was served, so nothing in either line may say it was: the title names the one instant to the second.
  if (!meta.cacheHit) return { text: `As of ${computed}`, title: `Computed ${clockWithSeconds(meta.asOf)}` };
  // The boolean said an answer was served; the comparison only picks the words for the two instants it left behind. It
  // is on the parsed instants at the second — an instant a millisecond after another falls in the same second, and two
  // instants the reader cannot tell apart are one instant to the reader.
  const title = `Computed ${clockWithSeconds(meta.asOf)} · served ${clockWithSeconds(meta.observedAt)}`;
  const apart = secondOf(meta.asOf) !== secondOf(meta.observedAt);
  return { text: apart ? `Computed ${computed} · served ${formatDateTime(meta.observedAt)}` : `Computed ${computed}`, title };
}
