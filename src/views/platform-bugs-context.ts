/**
 * Bugs' shared contexts (decision 0011), and every word the queue, its figures and a report are drawn with: the four
 * tiles, the weeks by the week filed, the outcomes, the impacts, the queue's filters and one report's page. The pages
 * draw these words and `view_bugs` and `view_bug` build the same contexts from the same responses, so the assistant
 * quotes the figures the screen shows.
 *
 * A report is filed by choice, so its count is neither a count of distinct defects nor a measure of quality: fewer
 * reports is not better, and nothing here says it is. Every figure is over every real report; the filters narrow the
 * queue alone. A week's resolved count and its median are of the reports filed that week, so a report filed one week
 * and resolved the next is counted in the week it was filed. A missing figure is said as missing, never as zero.
 *
 * What a member reads is the gateway's safe row: a title generated from the report's canonical surface, and its typed
 * metadata. The superadmin's rows add the reporter's own title and the team, and only theirs open the report's page.
 *
 * The queue's filters and page are in its address (`?state=&impact=&surface=&page=`), and the gateway filters and pages
 * the rows: the page's first read on the console's server, its later reads in the browser, its context and
 * `view_bugs` all ask `bugsPath` for the address.
 */
import type { AdminBugRow, BugReport, Bugs, Figure, PublicBugRow } from '@/lib/platform-shapes';
import { plural } from '@/lib/format';
import { formatDateTime, formatDay } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, clip, type Arrival } from './context';

type Impact = PublicBugRow['impact'];
type Status = PublicBugRow['status'];
export type Cohort = Bugs['cohorts'][number];

/* The queue's filters and its address */

/** The rows one page of the queue holds. */
export const PAGE_SIZE = 10;

/** The states, impacts and statuses the route knows, each in the order a filter or a legend lists them. */
export const BUG_STATES = ['open', 'resolved'] as const;
export const BUG_IMPACTS = ['blocks_work', 'wrong_result', 'confusing', 'cosmetic'] as const satisfies readonly Impact[];
export const BUG_STATUSES = ['open', 'fixed', 'not_a_bug', 'duplicate'] as const satisfies readonly Status[];

/** The surfaces every deployment has, whatever tools its doors register: the three doors and the console. */
const BASE_SURFACES = ['core', 'manage', 'eval', 'console'] as const;

/** What the queue keeps in its address; `all` is no filter, `1` the first page. */
export type BugsFilters = { state: string; impact: string; surface: string; page: string };
export const BUGS_DEFAULTS: BugsFilters = { state: 'all', impact: 'all', surface: 'all', page: '1' };

/** Rows of the queue by the route's own arguments: `limit` of them from `offset`. */
type BugsRows = { limit: number; offset: number };

/** The page asked for, from 1, whatever the address holds. */
const pageOf = (f: BugsFilters): number => Math.max(1, Math.floor(Number(f.page)) || 1);

/** A surface as the route's vocabulary spells one: a tool's name, a door or `console`. Anything else is no filter. */
const SURFACE = /^[a-z][a-z0-9_]*$/;
const surfaceOf = (f: BugsFilters): string | null => (f.surface !== 'all' && SURFACE.test(f.surface) ? f.surface : null);

/** The gateway address of the queue for `f`: the ten rows of its page unless `rows` names others, as `view_bugs` may. */
export function bugsPath(f: BugsFilters, rows: BugsRows = { limit: PAGE_SIZE, offset: (pageOf(f) - 1) * PAGE_SIZE }): string {
  const p = new URLSearchParams();
  if ((BUG_STATES as readonly string[]).includes(f.state)) p.set('state', f.state);
  if ((BUG_IMPACTS as readonly string[]).includes(f.impact)) p.set('impact', f.impact);
  const surface = surfaceOf(f);
  if (surface) p.set('surface', surface);
  p.set('limit', String(rows.limit));
  p.set('offset', String(rows.offset));
  return `/platform/bugs?${p}`;
}

/** The page's address for rows read from `offset` under `f`'s filters: the page of ten the offset falls in. */
export const pageAt = (f: BugsFilters, offset: number): BugsFilters => ({ ...f, page: String(Math.floor(offset / PAGE_SIZE) + 1) });

/** Whether any filter narrows the queue. */
export const narrowed = (f: BugsFilters): boolean => f.state !== 'all' || f.impact !== 'all' || f.surface !== 'all';

/** The filters a page's address names, as Next hands a server page its search parameters: one value each, the first. */
export function filtersOf(params: Record<string, string | string[] | undefined>): BugsFilters {
  const one = (k: keyof BugsFilters) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? BUGS_DEFAULTS[k];
  };
  return { state: one('state'), impact: one('impact'), surface: one('surface'), page: one('page') };
}

/** The page's address read back from a gateway path `bugsPath` wrote: its filters, and the page of ten the offset falls in. */
export function filtersOfPath(path: string): BugsFilters {
  const q = new URLSearchParams(path.split('?')[1] ?? '');
  const offset = Math.max(0, Number(q.get('offset')) || 0);
  return { state: q.get('state') ?? 'all', impact: q.get('impact') ?? 'all', surface: q.get('surface') ?? 'all', page: String(Math.floor(offset / PAGE_SIZE) + 1) };
}

/** One report's gateway address, and its page's; its duplicate targets' gateway address. */
export const bugPath = (id: string): string => `/platform/bugs/${encodeURIComponent(id)}`;
export const duplicatesPath = (id: string): string => `${bugPath(id)}/duplicates`;

/* The reads */

/** How long the console's server waits for a Bugs read: half a second under five, for a phone to draw what it says. */
export const BUGS_BOUND_MS = 4_500;

/** The queue's own read, as the console's server or the browser made it: the answer, a failure, or no answer in time. */
export type BugsRead =
  | { state: 'ok'; path: string; data: Bugs }
  | { state: 'failed'; path: string; reason: string }
  | { state: 'slow'; path: string };

/** `GET /platform/bugs/:id/duplicates`: the reports `bug_resolve` would accept as this one's target, newest first.
 *  COUPLED: the gateway's console/platform-bugs.ts and the fake's `duplicates`. */
export type BugDuplicates = { rows: { id: string; title: string; status: string; reportedAt: string }[] };

/** One report's read: the answer, no report of that id, a failure, or no answer in time. */
export type BugRead =
  | { state: 'ok'; data: BugReport }
  | { state: 'missing' }
  | { state: 'failed'; reason: string }
  | { state: 'slow' };

/** A report's duplicate targets, read beside it. */
export type DuplicatesRead =
  | { state: 'ok'; data: BugDuplicates }
  | { state: 'failed'; reason: string }
  | { state: 'slow' };

/** The sentence a read's trouble is told in, on the page and to the assistant. */
export function bugsTrouble(read: { state: 'failed'; reason: string } | { state: 'slow' }): string {
  return read.state === 'slow' ? `The read did not answer within ${BUGS_BOUND_MS / 1000} seconds.` : read.reason;
}

/* The words */

export const IMPACT: Record<Impact, string> = { blocks_work: 'Blocks work', wrong_result: 'Wrong result', confusing: 'Confusing', cosmetic: 'Cosmetic' };
export const STATUS: Record<Status, string> = { open: 'Open', fixed: 'Fixed', not_a_bug: 'Not a bug', duplicate: 'Duplicate' };
/** A word the gateway sent that this page does not know, as it is, rather than dropped. */
export const impactOf = (v: string): string => IMPACT[v as Impact] ?? v;
export const statusOf = (v: string): string => STATUS[v as Status] ?? v;

/** The four tiles, as the page labels them and the assistant is told what each counts. */
export const TILES = {
  open: { label: 'Open', definition: 'Real reports not yet resolved.' },
  oldest: { label: 'Oldest open', definition: 'How long the longest-open report has waited, to the read\'s cutoff.' },
  rate: { label: 'Reports per 1,000 calls', definition: 'Reports filed in the last whole week per 1,000 real-work tool calls that week.' },
  median: { label: 'Median hours to resolve', definition: 'Median hours from filing to resolution, over every resolved report.' },
} as const;

const ONE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const HOUR = 3_600_000;
const WEEK = 7 * 24 * HOUR;

/** A figure's value, or null when there is none to draw: never a zero in its place. */
export const valueOf = (f: Figure): number | null => (f.why === 'unavailable' ? null : f.value);

/** Hours as a figure reads them: `41.5 h`. */
export const formatHours = (h: number): string => `${ONE.format(h)} h`;

/** A count of a week, or the word for why there is none. */
const countIn = (f: Figure): string => (f.why === 'unavailable' ? 'unavailable' : f.value === null ? 'no data' : formatCount(f.value));

/** A week's reports per 1,000 calls, as a cell or a line says it: `2.4`, `2.4, under 30 calls`, `no calls`. */
export function rateIn(f: Figure): string {
  if (f.why === 'unavailable') return 'unavailable';
  if (f.value === null) return 'no calls';
  return `${ONE.format(f.value)}${f.why === 'insufficient' ? ', under 30 calls' : ''}`;
}

/** A week's rate as a sentence says it: `16.0 per 1,000 calls`, `166.7 per 1,000 calls (under 30 calls)`, `no calls`. */
const perThousand = (f: Figure): string => (f.why === 'unavailable' || f.value === null ? rateIn(f) : `${ONE.format(f.value)} per 1,000 calls${f.why === 'insufficient' ? ' (under 30 calls)' : ''}`);

/** A week's median as a sentence says it, or why there is none: no report of the week was resolved. */
const medianIn = (f: Figure): string => (f.why === 'unavailable' ? 'median unavailable' : f.value === null ? 'none resolved' : `median ${formatHours(f.value)}`);

/* The weeks */

/** Whether the last cohort is the week still running at the read's cutoff, as the route's last week always is. */
export const cohortsRunning = (cohorts: Cohort[], asOf: string): boolean =>
  cohorts.length > 0 && Date.parse(cohorts[cohorts.length - 1].week) + WEEK > Date.parse(asOf);

/** The last week that has ended, the one a week's figure is told for; null before any has. */
export function lastWhole(cohorts: Cohort[], asOf: string): Cohort | null {
  const whole = cohortsRunning(cohorts, asOf) ? cohorts.slice(0, -1) : cohorts;
  return whole.at(-1) ?? null;
}

/** How long a report has waited at `asOf`: `3 days`, `5 hours`. */
export function waited(filedAt: string, asOf: string): string {
  const hours = Math.max(0, (Date.parse(asOf) - Date.parse(filedAt)) / HOUR);
  if (hours < 48) return `${Math.floor(hours)} ${plural(Math.floor(hours), 'hour')}`;
  const days = Math.floor(hours / 24);
  return `${days} ${plural(days, 'day')}`;
}

/** The surfaces the queue's filter offers: the doors and the console, every canonical surface the page's rows name, and
 *  the one the address filters by, each once, in that order. The route's vocabulary is its doors' registered tools, which
 *  no read lists, so a tool is offered once a report on the page names it. */
export function surfacesOf(rows: PublicBugRow[], current: string): string[] {
  const named = rows.map((r) => r.surface).filter((s): s is string => s !== null);
  return [...new Set([...BASE_SURFACES, ...named, ...(current !== 'all' && SURFACE.test(current) ? [current] : [])])];
}

/** Whether a row is the superadmin's, with the reporter's own title and the team. */
export const isAdminRow = (r: PublicBugRow): r is AdminBugRow => 'internalTitle' in r;

/* What the assistant is told */

/** How many reports of a page, and how many weeks, the context names. */
const NAMED = 4;
const WEEKS_TOLD = 5;

/** One queue row as the assistant is told it: its title (the reporter's own for the superadmin), its impact, surface and state. */
function rowLine(r: PublicBugRow): string {
  const title = isAdminRow(r) ? `${clip(r.internalTitle, 48)} (${clip(r.team ?? 'no team', 24)})` : r.title;
  const resolved = r.resolvedAt ? ` on ${formatDay(r.resolvedAt)}` : '';
  return `${title}: ${impactOf(r.impact).toLowerCase()}, ${r.surface ?? 'no surface named'}, filed ${formatDay(r.filedAt)}, ${statusOf(r.status).toLowerCase()}${resolved}`;
}

function weeksLine(cohorts: Cohort[], asOf: string): string | null {
  const running = cohortsRunning(cohorts, asOf);
  const whole = (running ? cohorts.slice(0, -1) : cohorts).slice(-WEEKS_TOLD);
  if (!whole.length) return null;
  const now = running ? cohorts[cohorts.length - 1] : null;
  const week = (c: Cohort) => `${formatDay(c.week)}: ${countIn(c.filed)} filed, ${countIn(c.resolved)} resolved, ${perThousand(c.filedPer1000)}, ${medianIn(c.medianResolveHours)}`;
  return `By the week filed, oldest first: ${whole.map(week).join('; ')}`
    + `${now ? `; the week of ${formatDay(now.week)} is still running, ${countIn(now.filed)} filed so far` : ''}.`;
}

/** What every view of the bugs says it cannot say. */
const UNKNOWNS = [
  'Reports are filed by choice: they are not a count of distinct defects, and fewer is not better.',
  'A week\'s resolved count and median are of the reports filed that week; an open report is in no median.',
  'Under 30 calls a week\'s rate is too few to compare; no calls is no rate, not zero.',
];

/** The figures the tiles draw, as facts: each with its value as the screen shows it, or why it has none. */
function tileFacts(data: Bugs): Fact[] {
  const counts = data.counts.state === 'ok' ? data.counts.data : null;
  const asOf = data.meta.asOf;
  const week = lastWhole(data.cohorts, asOf);
  const median = valueOf(data.medianResolveHours);
  return [
    { label: TILES.open.label, value: counts ? formatCount(counts.open) : 'unavailable', definition: TILES.open.definition },
    {
      label: TILES.oldest.label, value: data.oldestOpenAt ? waited(data.oldestOpenAt, asOf) : 'none open',
      ...(data.oldestOpenAt ? { change: `filed ${formatDateTime(data.oldestOpenAt)}` } : {}), definition: TILES.oldest.definition,
    },
    {
      label: TILES.rate.label, value: week ? rateIn(week.filedPer1000) : 'no whole week yet',
      ...(week ? { change: `the week of ${formatDay(week.week)}, ${countIn(week.filed)} filed` } : {}), definition: TILES.rate.definition,
    },
    {
      label: TILES.median.label, value: median === null ? 'none resolved' : formatHours(median),
      ...(counts ? { change: `over ${formatCount(counts.resolved)} resolved; ${formatCount(counts.open)} still open` } : {}), definition: TILES.median.definition,
    },
  ];
}

/**
 * `filters` is the page's address. `read` is how `view_bugs` read the rows, by the route's `limit` and `offset`, when it
 * did: the address is then the page of ten the offset falls in, and rows off the page's grid are said to be so.
 */
export function bugsContext(data: Bugs, { filters, read, ...arrival }: { filters: BugsFilters; read?: BugsRows } & Arrival): SharedContext {
  const page = pageOf(filters);
  const first = read ? read.offset : (page - 1) * PAGE_SIZE;
  const onGrid = !read || (read.limit === PAGE_SIZE && read.offset % PAGE_SIZE === 0);
  const address = addressOf('/platform/bugs', filters, BUGS_DEFAULTS);
  const counts = data.counts.state === 'ok' ? data.counts.data : null;
  const queue = data.queue;
  const rows = queue.state === 'ok' ? queue.data.rows : [];
  const total = queue.state === 'ok' ? queue.data.total : null;
  const insights: Insight[] = [];
  // The queue first, the page's protagonist; then the splits; the weeks are the first to go over the budget.
  if (rows.length) insights.push({ text: `The queue, newest first: ${listed(rows, rowLine, 'see the page', NAMED)}.`, evidence: address });
  if (counts) {
    insights.push({ text: `Outcomes of every report: ${BUG_STATUSES.map((s) => `${formatCount(counts.byStatus[s])} ${STATUS[s].toLowerCase()}`).join(', ')}.`, evidence: '/platform/bugs' });
    insights.push({ text: `By impact, every report: ${BUG_IMPACTS.map((i) => `${formatCount(counts.byImpact[i])} ${IMPACT[i].toLowerCase()}`).join(', ')}.`, evidence: '/platform/bugs' });
  }
  const weeks = weeksLine(data.cohorts, data.meta.asOf);
  if (weeks) insights.push({ text: weeks, evidence: '/platform/bugs' });
  const shown = first + rows.length;
  const narrow = narrowed(filters);
  return budgeted({
    view: 'bugs',
    title: 'Bugs',
    address,
    scope: `every real bug report${narrow ? `; the queue narrowed to ${filterWords(filters)}` : ''}${rows.length && total !== null ? `; queue rows ${first + 1} to ${shown} of ${formatCount(total)}` : ''}`,
    freshness: arrived(arrival),
    facts: tileFacts(data),
    insights,
    unknowns: [
      ...UNKNOWNS,
      ...(narrow ? ['The filters narrow the queue alone: every figure is over every real report.'] : []),
      ...(data.meta.scope === 'platform-admin' ? [] : ['A member reads each report by a title generated from its surface and its typed metadata alone: never its own words, its team or its resolution.']),
      ...(counts ? [] : [`The counts could not be read (${data.counts.state === 'unavailable' ? data.counts.reason : 'unknown'}); the weeks and the queue stand.`]),
      ...(queue.state === 'unavailable' ? [`The queue could not be listed (${queue.reason}); the figures stand.`] : []),
      ...(weeks ? [] : ['No whole week has ended since the record began, so no week is stated.']),
      ...(onGrid ? [] : [`The page lists the queue ten a page, so ${address} does not show exactly these ${formatCount(rows.length)} rows.`]),
      ...(total !== null && total > shown ? [`${formatCount(total - shown)} more ${plural(total - shown, 'report')} on later pages.`] : []),
      ...(queue.state === 'ok' && !rows.length ? [narrow ? 'No report matches these filters.' : 'No report is recorded.'] : []),
    ],
  });
}

/** The filters as words: `open, blocks work, surface core`. */
function filterWords(f: BugsFilters): string {
  return [
    f.state !== 'all' ? f.state : null,
    f.impact !== 'all' ? impactOf(f.impact).toLowerCase() : null,
    surfaceOf(f) ? `surface ${surfaceOf(f)}` : null,
  ].filter(Boolean).join(', ');
}

/** How much of a report's own words the context quotes: what holds the budget beside its facts. */
const DETAIL_TOLD = 900;

/** A report's page, as the superadmin reads it: its words, its metadata and what was decided, or that it is open. */
export function bugContext(report: BugReport, duplicates: BugDuplicates | null, arrival: Arrival): SharedContext {
  const open = report.status === 'open';
  return budgeted({
    view: 'bug',
    title: clip(report.title, 80),
    address: bugPath(report.id),
    scope: `one bug report, filed ${formatDateTime(report.reportedAt)}${report.team ? ` in ${report.team}` : ' in no team'}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'Status', value: statusOf(report.status), ...(report.resolvedAt ? { change: `resolved ${formatDateTime(report.resolvedAt)}` } : {}) },
      { label: 'Impact', value: impactOf(report.impact) },
      { label: 'Surface', value: report.surface ?? 'None named' },
      { label: 'Team', value: report.team ?? 'No team' },
      { label: 'Filed against', value: report.platformVersion ?? 'Not recorded' },
      { label: 'Filed', value: formatDateTime(report.reportedAt) },
      ...(report.duplicateOf ? [{ label: 'Duplicate of', value: report.duplicateOf }] : []),
    ],
    insights: [
      { text: `Its title, as filed: ${clip(report.title, 200)}` },
      { text: `What the reporter wrote: ${clip(report.detail.replace(/\s+/g, ' ').trim(), DETAIL_TOLD)}` },
      ...(report.resolution ? [{ text: `What was decided: ${clip(report.resolution, 300)}` }] : []),
      ...(open && duplicates ? [{ text: duplicates.rows.length
        ? `It may be closed as a duplicate of ${formatCount(duplicates.rows.length)} ${plural(duplicates.rows.length, 'report')} of its team: ${listed(duplicates.rows, (d) => `${clip(d.title, 48)} (${statusOf(d.status).toLowerCase()}, ${d.id})`, 'see the page', 3)}.`
        : 'No other report of its team exists, so it cannot be closed as a duplicate.' }] : []),
    ],
    unknowns: [
      'A report is closed on its page by a person, never by the assistant: the assistant reads it and changes nothing.',
      open ? 'It is open: nobody has decided it yet.' : 'A closed report is not reopened: a wrong decision is a new report naming this one.',
      'A duplicate is read within one team\'s reports, a report in no team with another in none.',
    ],
  });
}
