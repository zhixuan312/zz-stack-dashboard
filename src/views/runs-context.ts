/**
 * The Runs page's shared context (decision 0011), its address and the words its tiles are drawn with: every run the
 * active team recorded since its first, by the skill that drove it and lately, from the one `Runs` the gateway answered.
 * A run's bytes are the response bytes of its own calls, its observed output, which is neither what a model read nor
 * anything paid for; and a run is never said to be running.
 *
 * The gateway narrows to a skill, counts, takes every median and states every run, so the page's first read on the
 * console's server, its later reads in the browser, its context and `view_runs` all ask this module for the address,
 * and none of them works a figure out itself.
 */
import type { RunRow, Runs } from '@/lib/destination-shapes';
import type { Catalog } from './plugins-context';
import { plural } from '@/lib/format';
import { formatCount, formatKb, formatSeconds } from '@/lib/format-units';
import { dayOf, formatDate, formatDateTime, formatDay } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, clip, type Arrival } from './context';
import { perRunOf } from './runs-figures';

/** The recent runs one page holds, as every table pages. */
export const PAGE_SIZE = 10;

/** The skill and the page Runs keeps in its address; `all` is every skill, `1` the first page. */
export type RunsFilters = { skill: string; page: string };

/** The address with nothing in it: every skill, the first page of recent runs. */
export const RUNS_DEFAULTS: RunsFilters = { skill: 'all', page: '1' };

/** Recent runs by the route's own arguments: `limit` of them from `offset`. */
type RunsRows = { limit: number; offset: number };

/** The page asked for, from 1, whatever the address holds. */
export const pageOf = (f: RunsFilters): number => Math.max(1, Math.floor(Number(f.page)) || 1);

/** The gateway address of the team's runs for `f`: narrowed to its skill unless `all`, the ten recent runs of its page unless `rows` names others. */
export function runsPath(f: RunsFilters, rows: RunsRows = { limit: PAGE_SIZE, offset: (pageOf(f) - 1) * PAGE_SIZE }): string {
  const p = new URLSearchParams();
  if (f.skill !== 'all' && f.skill !== '') p.set('skill', f.skill);
  p.set('limit', String(rows.limit));
  p.set('offset', String(rows.offset));
  return `/runs?${p}`;
}

/** The page's address read back from a gateway path `runsPath` wrote: its skill, and the page of ten the offset falls in. */
export function filtersOfPath(path: string): RunsFilters {
  const q = new URLSearchParams(path.split('?')[1] ?? '');
  return { skill: q.get('skill') ?? 'all', page: String(Math.floor(Math.max(0, Number(q.get('offset')) || 0) / PAGE_SIZE) + 1) };
}

/** The filters a page's address names, as Next hands a server page its search parameters: one value each, the first. */
export function filtersOf(params: Record<string, string | string[] | undefined>): RunsFilters {
  const one = (k: keyof RunsFilters) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) || RUNS_DEFAULTS[k];
  };
  return { skill: one('skill'), page: one('page') };
}

/** The page's own read, as the console's server made it: the answer, a failure, or no answer in time. */
export type RunsRead =
  | { state: 'ok'; path: string; data: Runs }
  | { state: 'failed'; path: string; reason: string }
  | { state: 'slow'; path: string };

/** How long the console's server waits for the runs: half a second under five, for a phone to draw what it says. */
export const RUNS_BOUND_MS = 4_500;

/** The sentence a read's trouble is told in, on the page and to the assistant. */
export function runsTrouble(read: Exclude<RunsRead, { state: 'ok' }>): string {
  return read.state === 'slow' ? `The read did not answer within ${RUNS_BOUND_MS / 1000} seconds.` : read.reason;
}

/** The three tiles, as the page labels them and the assistant is told what each counts. */
export const TILES = {
  runs: { label: 'Runs', definition: 'Skill runs recorded: one skill followed by one caller, from its first call to its last.' },
  outputPerRun: { label: 'Observed output per run', definition: 'The response bytes of a run\'s own calls, the mean over the runs that measured them.' },
  largest: { label: 'Largest run', definition: 'The run whose own calls answered the most bytes.' },
} as const;

/** Observed output in words, from bytes; a run nothing measured has none to quote. */
export const outputOf = (bytes: number | null): string => (bytes === null ? 'Not measured' : formatKb(bytes / 1024));

/** Observed output inside a sentence: the unit as the page prints it, `454 KB`, and `not measured` in lower case. */
const outputSaid = (bytes: number | null): string => (bytes === null ? 'not measured' : outputOf(bytes));

/** A state inside a sentence: its first letter lowered, and a month's name left as the page prints it. */
const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/** Each skill's own page by its name, `/plugins/<plugin>/<skill>`: where a row of the runs by skill goes. */
export type SkillPages = Record<string, string>;

/** Every skill the catalog ships, by name, with the address of its page under the plugin that ships it. */
export const skillPagesOf = (catalog: Catalog): SkillPages =>
  Object.fromEntries(catalog.plugins.flatMap((p) => p.skills.map((k) => [k.name, `/plugins/${encodeURIComponent(p.plugin)}/${encodeURIComponent(k.name)}`])));

/** How a run stands, as the gateway states it: active while its last call is recent, and never running beyond it. */
export const stateOf = (r: RunRow): string => (r.state === 'active' ? 'Active' : r.state === 'one_call' ? 'One call' : `Last call at ${formatDateTime(r.lastCallAt)}`);

/**
 * A run's state as its table cell says it, on one line: the last call's time alone when the run started that day, which
 * the Started column beside it says, and its day and time when it did not, or where no Started column is drawn. The
 * assistant reads `stateOf`'s whole date.
 */
export const stateCellOf = (r: RunRow, { started = true }: { started?: boolean } = {}): string => {
  if (r.state !== 'last_call') return stateOf(r);
  const time = formatDateTime(r.lastCallAt).slice(-5);
  return started && dayOf(r.lastCallAt) === dayOf(r.startedAt) ? `Last call ${time}` : `Last call ${formatDay(r.lastCallAt)}, ${time}`;
};

/** A share refused, to a tenth of a percent, or nothing for a skill with no call to share out. */
export const refusedOf = (share: number | null): string | null => (share === null ? null : `${(share * 100).toFixed(1)}%`);

/** What a skill's typical length rests on, when it is not every run beside it. */
export const timedOf = (k: { runs: number; timed: number }): string | null => (k.timed >= k.runs ? null : k.timed ? `${formatCount(k.timed)} of ${formatCount(k.runs)} timed` : 'none timed');

/**
 * `filters` is the page's address. `read` is how `view_runs` read the recent runs, by the route's `limit` and `offset`,
 * when it did: the address is then the page of ten the offset falls in, and rows off the page's grid are said to be so.
 */
export function runsContext(runs: Runs, { filters, read, ...arrival }: { filters: RunsFilters; read?: RunsRows } & Arrival): SharedContext {
  const { tiles, coverage } = runs;
  const insights: Insight[] = [];
  const bySkill = runs.bySkill.state === 'ok' ? runs.bySkill.data.rows : [];
  const recent = runs.recent.state === 'ok' ? runs.recent.data : null;
  const first = read ? read.offset : (pageOf(filters) - 1) * PAGE_SIZE;
  const onGrid = !read || (read.limit === PAGE_SIZE && read.offset % PAGE_SIZE === 0);
  const address = addressOf('/runs', filters, RUNS_DEFAULTS);
  const one = filters.skill !== 'all';
  insights.push({ text: `The runs cover ${formatSeconds(coverage.coverageMs / 1000)}, overlapping time counted once, against ${formatSeconds(coverage.summedMs / 1000)} summed; at most ${coverage.peak} ran at once, and ${formatCount(coverage.oneCall)} ${plural(coverage.oneCall, 'was', 'were')} one call.` });
  if (bySkill.length) {
    insights.push({ text: `By skill, the most observed output per run first: ${listed(bySkill, (s) => `${clip(s.skill, 40)} (${formatCount(s.runs)} ${plural(s.runs, 'run')}, ${perRunOf(s.callsPerRun)} calls a run, ${s.outputPerRun === null ? 'output not measured' : `${formatKb(s.outputPerRun / 1024)} a run`}, ${s.typicalMs === null ? 'none longer than one call' : `typically ${formatSeconds(s.typicalMs / 1000)}${timedOf(s) ? `, over ${timedOf(s)}` : ''}`}${s.shareRefused ? `, ${refusedOf(s.shareRefused)} refused` : ''})`, 'see /runs', 5)}.`, evidence: address });
  }
  if (recent?.rows.length) {
    insights.push({ text: `The recent runs, newest last call first, rows ${first + 1} to ${first + recent.rows.length} of ${formatCount(recent.total)}: ${listed(recent.rows, (r) => `${clip(r.skill, 40)} on ${clip(r.initiative ?? 'no initiative', 40)}, ${formatCount(r.calls)} ${plural(r.calls, 'call')}, ${outputSaid(r.bytes)}, ${lowerFirst(stateOf(r))}`, 'the rest on /runs', 5)}.`, evidence: address });
  }
  return budgeted({
    view: 'runs',
    title: 'Runs',
    address,
    scope: `your active team's runs${one ? ` of ${filters.skill}` : ''}, every one${runs.since ? ` since ${formatDate(runs.since)}` : ''}`,
    freshness: arrived(arrival),
    facts: [
      { label: TILES.runs.label, value: formatCount(tiles.runs.value), definition: TILES.runs.definition },
      { label: TILES.outputPerRun.label, value: outputSaid(tiles.outputPerRun.value), change: tiles.outputPerRun.unmeasured ? `${formatCount(tiles.outputPerRun.unmeasured)} not measured` : undefined, definition: TILES.outputPerRun.definition },
      { label: TILES.largest.label, value: tiles.largest ? `${outputOf(tiles.largest.bytes)}, ${tiles.largest.skill}` : 'none measured', definition: `${TILES.largest.definition}${tiles.largest?.initiative ? ` On ${tiles.largest.initiative}.` : ''}` },
    ],
    insights,
    unknowns: [
      'Observed output is the bytes a run\'s calls answered: it is not what a model read, and not anything paid for.',
      'A run is active while its last call is within five minutes; nothing says one is still running after that.',
      ...(tiles.outputPerRun.unmeasured ? [`${formatCount(tiles.outputPerRun.unmeasured)} ${plural(tiles.outputPerRun.unmeasured, 'run')} had no output measured, which is unknown, not zero.`] : []),
      ...(runs.bySkill.state === 'unavailable' ? [`The runs by skill could not be read: ${runs.bySkill.reason}`] : []),
      ...(runs.recent.state === 'unavailable' ? [`The recent runs could not be read: ${runs.recent.reason}`] : []),
      ...(onGrid ? [] : [`The page lists the recent runs ten a page, so ${address} does not show exactly these rows.`]),
      ...(tiles.runs.value ? [] : [one ? `No run of ${filters.skill} has been recorded.` : 'No run has been recorded yet.']),
    ],
  });
}
