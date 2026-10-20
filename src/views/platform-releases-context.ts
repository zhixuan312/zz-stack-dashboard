/**
 * Releases' shared contexts (decision 0011), and every word a release and its windows are drawn with: the four tiles,
 * the weeks, the table of releases and one release's page. The pages draw these words and `view_releases` and
 * `view_release` build the same contexts from the same responses, so the assistant quotes the figures the screen shows.
 *
 * A window is what was observed in the 72 hours either side of a release, never what the release did: other releases,
 * the mix of tools and the traffic move it too. So nothing here compares the two sides as a verdict on the version, a
 * window still running or begun before the record is said to be partial, and no calls is no rate, never a zero.
 *
 * The list's page is in its address (`?page=`), and the gateway pages the rows: the page's first read on the console's
 * server, its later reads in the browser, its context and `view_releases` all ask `releasesPath` for the address.
 */
import type { Figure, ReleaseDetail, ReleaseRow, Releases } from '@/lib/platform-shapes';
import { plural } from '@/lib/format';
import { formatDateTime, formatDay } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { READ_BOUND_MS, addressOf, budgeted, clip } from './context';
import { rostered } from './platform-roster';

type Side = ReleaseRow['before'];

/* The list's page and its address */

/** The rows one page of the table holds. */
export const PAGE_SIZE = 10;

/** The page the list keeps in its address, from 1. */
export type ReleasesFilters = { page: string };
export const RELEASES_DEFAULTS: ReleasesFilters = { page: '1' };

/** Rows of the list by the route's own arguments: `limit` of them from `offset`. */
type ReleasesRows = { limit: number; offset: number };

/** The page asked for, from 1, whatever the address holds. */
const pageOf = (f: ReleasesFilters): number => Math.max(1, Math.floor(Number(f.page)) || 1);

/** The gateway address of the list: the ten rows of the page unless `rows` names others, as `view_releases` may. */
export const releasesPath = (f: ReleasesFilters, rows: ReleasesRows = { limit: PAGE_SIZE, offset: (pageOf(f) - 1) * PAGE_SIZE }): string =>
  `/platform/releases?limit=${rows.limit}&offset=${rows.offset}`;

/** The page's address for rows read from `offset`: the page of ten the offset falls in. */
export const pageAt = (offset: number): ReleasesFilters => ({ page: String(Math.floor(offset / PAGE_SIZE) + 1) });

/** The page's address read back from a gateway path `releasesPath` wrote: the page of ten the offset falls in. */
export const filtersOfPath = (path: string): ReleasesFilters => pageAt(Math.max(0, Number(new URLSearchParams(path.split('?')[1] ?? '').get('offset')) || 0));

/** The page the address names, as Next hands a server page its search parameters: one value, the first. */
export function filtersOf(params: Record<string, string | string[] | undefined>): ReleasesFilters {
  const v = params.page;
  return { page: (Array.isArray(v) ? v[0] : v) ?? RELEASES_DEFAULTS.page };
}

/** One release's gateway address, and its page's. */
export const releasePath = (version: string): string => `/platform/releases/${encodeURIComponent(version)}`;

/* The reads */

/** The list's own read, as the console's server or the browser made it: the answer, a failure, or no answer in time. */
export type ReleasesRead =
  | { state: 'ok'; path: string; data: Releases }
  | { state: 'failed'; path: string; reason: string }
  | { state: 'slow'; path: string };

/** One release's read: the answer, no release of that version, a failure, or no answer in time. */
export type ReleaseRead =
  | { state: 'ok'; data: ReleaseDetail }
  | { state: 'missing' }
  | { state: 'failed'; reason: string }
  | { state: 'slow' };

/** The sentence a read's trouble is told in, on the page and to the assistant. */
export function releasesTrouble(read: { state: 'failed'; reason: string } | { state: 'slow' }): string {
  return read.state === 'slow' ? `The read did not answer within ${READ_BOUND_MS / 1000} seconds.` : read.reason;
}

/* The words */

/** The four tiles, as the page labels them and the assistant is told what each counts. */
export const TILES = {
  releases: { label: 'Releases', definition: 'Every release recorded, each once, at the time its tag was made.' },
  lastWeek: { label: 'Last week', definition: 'Releases tagged in the last whole week, Monday to Sunday.' },
  latest: { label: 'Latest tag', definition: 'The newest tag recorded, and when: a tag, not a deployment.' },
  migrations: { label: 'Migrations applied', definition: 'Migrations the platform\'s database records as applied.' },
} as const;

/** The sentence every view of a release says of its windows. */
export const NOT_A_VERDICT = 'Each window is what was observed in the 72 hours either side of a release, not what the release did: other releases, the mix of tools and the traffic move it too.';

const ONE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** How much of a window the record observed: all of it, part of it (still running, or begun before the record), or none. */
type Observed = 'complete' | 'partial' | 'unobserved';
export const observedOf = (s: Side): Observed => (s.window.observedFrom === null ? 'unobserved' : s.window.complete ? 'complete' : 'partial');
export const OBSERVED: Record<Observed, string> = { complete: 'complete', partial: 'partial', unobserved: 'not observed' };

/** Whether a window ends after the read's cutoff, so it is still being observed. */
const running = (s: Side, asOf: string): boolean => Date.parse(s.window.to) > Date.parse(asOf);

/** A count in a window: its value, or the word for why there is none. */
const countIn = (f: Figure): string => (f.why === 'unavailable' ? 'Unavailable' : f.value === null ? 'No data' : formatCount(f.value));

/** A figure no window has when nothing was observed, or when it saw no calls: never a zero. */
function noneIn(s: Side, f: Figure): string | null {
  if (observedOf(s) === 'unobserved') return 'Not observed';
  if (f.why === 'unavailable') return 'Unavailable';
  if (f.value === null) return s.calls.value === 0 ? 'No calls' : 'No data';
  return null;
}
const few = (f: Figure) => (f.why === 'insufficient' ? ', under 30 calls' : '');

/** A window's malformed calls per 1,000 as a cell reads it: `4.2`, `4.2, under 30 calls`, `No calls`, `Not observed`. */
export const rateIn = (s: Side): string => noneIn(s, s.malformedPer1000) ?? `${ONE.format(s.malformedPer1000.value!)}${few(s.malformedPer1000)}`;
/** A window's 95th percentile call duration, the same way. */
export const p95In = (s: Side): string => noneIn(s, s.p95Ms) ?? `${WHOLE.format(s.p95Ms.value!)} ms${few(s.p95Ms)}`;
/** A window's tool failures: a count, which a window that saw no calls has as 0. */
export const failuresIn = (s: Side): string => (observedOf(s) === 'unobserved' ? 'Not observed' : countIn(s.toolFailures));
/** A window's real-work calls. */
export const callsIn = (s: Side): string => (observedOf(s) === 'unobserved' ? 'Not observed' : countIn(s.calls));
/** A window's malformed calls. */
export const malformedIn = (s: Side): string => (observedOf(s) === 'unobserved' ? 'Not observed' : countIn(s.malformed));

/** Hours between two instants, whole. */
const hoursBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 3_600_000);

/**
 * What of a window was observed, in a sentence with one range: its bounds when complete; for a partial window, how many
 * of its hours were observed, the range that was, and why it is partial.
 */
export function observedText(s: Side, asOf: string): string {
  const { from, to, observedFrom, observedThrough } = s.window;
  if (observedOf(s) === 'unobserved') return `Not observed: the record of calls had not begun (${formatDateTime(from)} to ${formatDateTime(to)})`;
  const bounds = `${formatDateTime(observedFrom!)} to ${formatDateTime(observedThrough!)}`;
  if (observedOf(s) === 'complete') return bounds;
  const of = `${hoursBetween(observedFrom!, observedThrough!)} of ${hoursBetween(from, to)} hours`;
  if (Date.parse(observedFrom!) > Date.parse(from)) return `Observed ${of}: ${bounds}, the record began inside it`;
  return running(s, asOf) ? `Observed ${of} so far: ${bounds}` : `Observed ${of}: ${bounds}`;
}

/** The other releases inside either of a release's windows, each once, in the order the windows name them. */
export const overlapsOf = (r: ReleaseRow): string[] => [...new Set([...r.before.overlappingVersions, ...r.after.overlappingVersions])];

/** A release's overlap as a line: `Within 72 hours of 0.97.0`, or nothing. */
export const overlapText = (r: ReleaseRow): string | null => {
  const others = overlapsOf(r);
  return others.length ? `Within 72 hours of ${others.join(', ')}` : null;
};

/** What the record writes for a tag with no changelog section, the spec's words. COUPLED: `UNKNOWN_ACTION` in zz-stack's
 *  scripts/release-record.ts. */
const UNKNOWN_ACTION = 'Unknown — no recorded upgrade notes';

/**
 * What clients must do: the recorded action, `Nothing to do` when it is positively known that none is needed, and `Not
 * recorded` for a tag whose section recorded none, as the release's page says of a console it has no version of: after
 * `Clients:` on a phone card the record's own words were a second colon.
 */
export const clientActionOf = (r: ReleaseRow): string =>
  r.clientAction === null ? 'Nothing to do' : r.clientAction === UNKNOWN_ACTION ? 'Not recorded' : r.clientAction;

/** A window's word as it reads after a label or mid-sentence, `no calls`; a figure as it is. */
export const midSentence = (v: string): string => (/^\d/.test(v) ? v : v.charAt(0).toLowerCase() + v.slice(1));

/* The weeks */

export type Week = Releases['weeks'][number];
/** Whether the last week is still running. */
export const weeksRunning = (weeks: Week[]): boolean => weeks.length > 0 && !weeks[weeks.length - 1].window.complete;
/** The last whole week, the one the Last week tile counts: the week before the running one, when the record reaches it. */
export const lastWholeWeek = (weeks: Week[]): Week | null => (weeksRunning(weeks) ? weeks.at(-2) : weeks.at(-1)) ?? null;
/** A week's malformed calls per 1,000 as a column draws it: a week with no figure is no data, never a zero. */
export const weekRate = (w: Week): number | null => (w.malformedPer1000.figure.why === 'unavailable' ? null : w.malformedPer1000.figure.value);

/** How many weeks the context names: the latest, oldest of them first. */
const WEEKS_TOLD = 8;

function weeksLine(weeks: Week[]): string | null {
  const whole = weeks.filter((w) => w.window.complete).slice(-WEEKS_TOLD);
  if (!whole.length) return null;
  const now = weeksRunning(weeks) ? weeks[weeks.length - 1] : null;
  const rate = (w: Week) => { const v = weekRate(w); return v === null ? 'no rate' : `${ONE.format(v)} per 1,000`; };
  return `By week, oldest first, releases and malformed calls per 1,000: ${whole.map((w) => `week of ${formatDay(w.window.from)} ${w.releases} (${rate(w)})`).join('; ')}`
    + `${now ? `; the week of ${formatDay(now.window.from)} is still running, ${now.releases} so far` : ''}.`;
}

/* What the assistant is told */

/** How many releases of a page the context names at most, each whole and as many as fit, and says how many more. */
const NAMED = 5;
/** How many of a release's overlapping versions a line names before it counts the rest. */
const OVERLAPS_TOLD = 2;

/** A sentence somebody wrote, as a fact's value: the context's own full stop follows it. */
const unstopped = (text: string): string => text.replace(/\.$/, '');

/** One release as the assistant is told it: when, both sides' figures (`partial` where a side is), the client action and its overlap. */
function releaseLine(r: ReleaseRow): string {
  const rate = (s: Side) => `${rateIn(s)}${observedOf(s) === 'partial' ? ' (partial)' : ''}`;
  const others = overlapsOf(r);
  const overlap = others.length
    ? `; within 72 hours of ${others.slice(0, OVERLAPS_TOLD).join(', ')}${others.length > OVERLAPS_TOLD ? ` and ${others.length - OVERLAPS_TOLD} more` : ''}`
    : '';
  return `${r.version} (${formatDay(r.releasedAt)}): malformed per 1,000 ${rate(r.before)} then ${rate(r.after)}; tool failures ${failuresIn(r.before)} then ${failuresIn(r.after)}; `
    + `p95 ${p95In(r.before)} then ${p95In(r.after)}; clients: ${unstopped(clientActionOf(r))}${overlap}`;
}

/** What every view of releases says it cannot say. */
const UNKNOWNS = [
  NOT_A_VERDICT,
  'A release\'s time is its tag\'s: historical timing, not when it reached a deployment.',
  'Under 30 calls a window\'s rate and p95 keep their value but are too few to compare; no calls is no rate, not zero.',
  'A partial side was observed in part: an after-window still running, or a before-window the record began inside.',
];

/**
 * `filters` is the page's address. `read` is how `view_releases` read the rows, by the route's `limit` and `offset`, when
 * it did: the address is then the page of ten the offset falls in, and rows off the page's grid are said to be so.
 */
export function releasesContext(data: Releases, { filters, read }: { filters: ReleasesFilters; read?: ReleasesRows }): SharedContext {
  const page = pageOf(filters);
  const first = read ? read.offset : (page - 1) * PAGE_SIZE;
  const onGrid = !read || (read.limit === PAGE_SIZE && read.offset % PAGE_SIZE === 0);
  const address = addressOf('/platform/releases', filters, RELEASES_DEFAULTS);
  const { tiles } = data;
  const part = data.rows;
  const rows = part.state === 'ok' ? part.data.rows : [];
  const total = part.state === 'ok' ? part.data.total : null;
  const facts: Fact[] = [
    { label: TILES.releases.label, value: formatCount(tiles.releases), definition: TILES.releases.definition },
    { label: TILES.lastWeek.label, value: formatCount(tiles.lastWeek), ...(lastWholeWeek(data.weeks) ? { change: `the week of ${formatDay(lastWholeWeek(data.weeks)!.window.from)}` } : {}), definition: TILES.lastWeek.definition },
    { label: TILES.latest.label, value: tiles.latest?.version ?? 'None recorded', ...(tiles.latest ? { change: `tagged ${formatDateTime(tiles.latest.releasedAt)}` } : {}), definition: TILES.latest.definition },
    { label: TILES.migrations.label, value: formatCount(tiles.migrations.applied), change: tiles.migrations.lastAt ? `last ${formatDateTime(tiles.migrations.lastAt)}` : 'none recorded', definition: TILES.migrations.definition },
  ];
  // The releases first, the table being the page's protagonist; the weeks are the first to go over the budget.
  const weeks = weeksLine(data.weeks);
  const roster = (n: number) => listed(rows, releaseLine, 'see the page', n);
  const insights = (n: number): Insight[] => [
    ...(rows.length ? [{ text: `The releases on this page, newest first, each side before then after: ${roster(n)}.`, evidence: address }] : []),
    ...(weeks ? [{ text: weeks, evidence: '/platform/releases' }] : []),
  ];
  const shown = first + rows.length;
  return rostered((n) => ({
    view: 'releases',
    title: 'Releases',
    address,
    scope: `every recorded release${rows.length && total !== null ? `; rows ${first + 1} to ${shown} of ${formatCount(total)}` : ''}`,
    freshness: `As of ${formatDateTime(data.meta.asOf)}.`,
    facts,
    insights: insights(n),
    unknowns: [
      ...UNKNOWNS,
      ...(part.state === 'unavailable' ? [`The releases could not be listed (${part.reason}); the tiles and the weeks stand.`] : []),
      ...(weeks ? [] : ['No whole week has ended since the record began, so no week is stated.']),
      ...(onGrid ? [] : [`The page lists the releases ten a page, so ${address} does not show exactly these ${formatCount(rows.length)} rows.`]),
      ...(total !== null && total > shown ? [`${formatCount(total - shown)} more ${plural(total - shown, 'release')} on later pages.`] : []),
      ...(part.state === 'ok' && !rows.length ? ['No release is recorded on this page.'] : []),
    ],
  }), roster, NAMED);
}

/** How much of a changelog and of its upgrade notes the context quotes: what holds the budget beside the windows. */
const CHANGELOG_TOLD = 700;
const NOTES_TOLD = 300;
/** Published Markdown as one line of text: its marks and its line breaks out, its words as written. */
const plain = (md: string): string => md.replace(/^#{1,6}\s+/gm, '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();

/**
 * Published Markdown with its headings lifted so the shallowest is a `##`, which the renderer draws as an h3 under its
 * card's h2: a published section is cut from under its release's own `##`, so it starts at `###` and its first heading
 * skipped a level. Fenced code is left as written, and a text whose headings start at `#` or `##` is left as it is.
 */
export function lifted(md: string): string {
  let fenced = false;
  const levels = md.split('\n').map((line) => {
    if (/^ {0,3}(```|~~~)/.test(line)) fenced = !fenced;
    const heading = fenced ? null : /^ {0,3}(#{1,6})\s/.exec(line);
    return heading ? heading[1].length : 0;
  });
  const found = levels.filter(Boolean);
  const by = found.length ? Math.min(...found) - 2 : 0;
  if (by <= 0) return md;
  return md.split('\n').map((line, i) => (levels[i] ? line.replace(/^( {0,3})#+/, (_, indent: string) => indent + '#'.repeat(levels[i] - by)) : line)).join('\n');
}

/** One window as a fact: its rate, its counts and what of it was observed. */
function windowFact(label: string, s: Side, asOf: string): Fact {
  return {
    label, value: `${rateIn(s)} malformed per 1,000`,
    change: `${callsIn(s)} calls, ${malformedIn(s)} malformed, ${failuresIn(s)} ${s.toolFailures.value === 1 ? 'tool failure' : 'tool failures'}, p95 ${p95In(s)}; ${observedOf(s) === 'unobserved' ? observedText(s, asOf) : `${OBSERVED[observedOf(s)]}, ${observedText(s, asOf)}`}`,
  };
}

export function releaseContext(release: ReleaseDetail, { asOf }: { asOf: string }): SharedContext {
  const overlap = overlapText(release);
  const notes = release.upgradeNotes ? plain(release.upgradeNotes) : null;
  return budgeted({
    view: 'release',
    title: `Release ${release.version}`,
    address: releasePath(release.version),
    scope: `one release, tagged ${formatDateTime(release.releasedAt)}`,
    facts: [
      { label: 'Tagged', value: formatDateTime(release.releasedAt) },
      { label: 'Console', value: release.consoleVersion ?? 'Not recorded' },
      { label: 'Client action', value: unstopped(clientActionOf(release)) },
      windowFact('Before', release.before, asOf),
      windowFact('After', release.after, asOf),
      { label: 'Other releases within 72 hours', value: overlapsOf(release).join(', ') || 'None' },
    ],
    insights: [
      { text: `Its summary: ${clip(release.summary, 200)}` },
      { text: `Its changelog, as published: ${clip(plain(release.changelog), CHANGELOG_TOLD)}` },
      ...(notes ? [{ text: `Its upgrade notes: ${clip(notes, NOTES_TOLD)}` }] : []),
    ],
    unknowns: [
      ...UNKNOWNS,
      ...(overlap ? [`${overlap}, so its windows hold those releases' calls too.`] : []),
      ...(notes ? [] : [release.clientAction === UNKNOWN_ACTION ? 'No upgrade notes are recorded, so what clients must do is not known.'
        : release.clientAction ? 'No upgrade notes are recorded; the client action is all that is.' : 'No upgrade notes are recorded, and none are needed.']),
    ],
  });
}
