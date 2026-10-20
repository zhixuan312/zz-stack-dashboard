/**
 * Record's shared context (decision 0011), and every word its cards are drawn with: the active team's retained text as
 * of the read's cutoff, the period's work in its slices, and the record of every initiative, from the one `RecordRead`
 * the gateway answered. The page draws these words, `Copy as text` copies them (`src/console/record-text.ts`), and the
 * assistant is told the same ones, as the page's shared context and through `view_record`, which reads the same
 * response, so all three say the figures the screen shows.
 *
 * Nothing here works a figure out: the estimate, its pace, the medians and the counts are the gateway's, and a figure the
 * gateway could not read is said to be so, never drawn as zero. The lead is a stock as of the cutoff, the same in every
 * period, so it is labelled as of it; everything else is the period's and labelled with it.
 *
 * The page's address keeps the period and the table's page; the gateway pages the table, so the page's first read on
 * the console's server, its later reads in the browser, its shared context and `view_record` all ask `recordPath` for
 * the address, and none of them pages rows itself.
 */
import { formatPercent, plural } from '@/lib/format';
import { formatDate, formatDateTime, formatDay, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { grainOf } from '@/lib/grain';
import { listed, type Fact, type SharedContext } from '@/lib/shared-context';
import type { Figure, PeriodFigure, Window } from '@/lib/platform-shapes';
import type { RecordRead, WritingCoverage } from '@/lib/work-shapes';
import { READ_BOUND_MS, addressOf, clip, pendingContext, sectioned, type Section } from './context';
import { LESSONS_MADE, NO_DATA, gapsOf } from './record-names';

/** The periods the route takes, in the order the control offers them; all of the record when none is named. */
export const RECORD_PERIODS = ['quarter', 'year', 'all'] as const;
export type RecordPeriod = (typeof RECORD_PERIODS)[number];

/** The rows one page of the record holds: ten, as every table pages. */
export const PAGE_SIZE = 10;

/** The period and the table's page the address keeps; `1` is the first page. */
export type RecordFilters = { period: string; page: string };
export const RECORD_DEFAULTS: RecordFilters = { period: 'all', page: '1' };

export const periodOf = (f: RecordFilters): RecordPeriod => ((RECORD_PERIODS as readonly string[]).includes(f.period) ? (f.period as RecordPeriod) : 'all');
const pageOf = (f: RecordFilters): number => Math.max(1, Math.floor(Number(f.page)) || 1);

/** The gateway address of `f`: its period, and the ten rows of its page. */
export function recordPath(f: RecordFilters): string {
  const p = new URLSearchParams({ period: periodOf(f), limit: String(PAGE_SIZE), offset: String((pageOf(f) - 1) * PAGE_SIZE) });
  return `/record?${p}`;
}

/** The page's address read back from a gateway path `recordPath` wrote: its period, and the page of ten the offset falls in. */
export function filtersOfPath(path: string): RecordFilters {
  const q = new URLSearchParams(path.split('?')[1] ?? '');
  return { period: periodOf({ period: q.get('period') ?? 'all', page: '1' }), page: String(Math.floor(Math.max(0, Number(q.get('offset')) || 0) / PAGE_SIZE) + 1) };
}

/** The filters a page's address names, as Next hands a server page its search parameters: one value each, the first. */
export function filtersOf(params: Record<string, string | string[] | undefined>): RecordFilters {
  const one = (k: keyof RecordFilters) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? RECORD_DEFAULTS[k];
  };
  return { period: one('period'), page: one('page') };
}

/** What the page's server read came back as, for its address: the record with the team it is for, a failure, or slow. */
export type RecordServed =
  | { state: 'ok'; path: string; data: RecordRead; team: string | null }
  | { state: 'failed'; path: string; reason: string }
  | { state: 'slow'; path: string };

/** The one sentence a read that brought nothing says. */
export function recordTrouble(read: Exclude<RecordServed, { state: 'ok' }>): string {
  return read.state === 'slow' ? `The platform did not answer within ${READ_BOUND_MS / 1000} seconds.` : read.reason;
}

/** The control's options: what each period is called on it, and in full. */
export const PERIOD_OPTIONS = [
  { value: 'quarter', short: 'Quarter', label: 'This quarter' },
  { value: 'year', short: 'Year', label: 'This year' },
  { value: 'all', short: 'All', label: 'All of the record' },
] as const satisfies readonly { value: RecordPeriod; short: string; label: string }[];
const PERIOD_NAME: Record<RecordPeriod, string> = { quarter: 'This quarter', year: 'This year', all: 'All of the record' };

/** The period as every slice is labelled with it: `This quarter, 1 Oct to 17 Oct`. */
export const periodLine = (r: RecordRead): string => `${PERIOD_NAME[r.period]}, ${formatDay(r.meta.period.from)} to ${formatDay(r.meta.period.to)}`;
/** The read's cutoff, the instant the lead is a stock as of. */
export const asOfLine = (r: RecordRead): string => `As of ${formatDateTime(r.lead.asOf)}`;
/** The cutoff inside a sentence: `as of 19 Oct 2026, 16:50`, the month as every date writes it. */
export const asOfWords = (r: RecordRead): string => `as of ${formatDateTime(r.lead.asOf)}`;

/** Hours as the page says them: one decimal under ten, whole above. */
export const formatHours = (h: number): string => `${h < 10 ? h.toFixed(1) : formatCount(Math.round(h))} h`;
/** An hours axis's tick: whole where the tick is, as a count's is. `formatHours` read the baseline "0.0 h" under
 *  "200 h" (Phase 7's re-review, Work F-41); a tick between whole hours keeps its fraction, never rounded to a neighbour. */
export const hourTick = (h: number): string => `${Number.isInteger(h) ? formatCount(h) : String(Math.round(h * 100) / 100)} h`;

/**
 * What Record counts in a document's history, said against what the document's own page counts. The gateway counts
 * every write of a document as a revision, an approval's included; the document's page numbers its versions, which a
 * revision that only approves does not add to. Record said "versions" for revisions, and a document Record gave 7 read
 * v1 to v3 on its own page (Phase 7's re-review, Work N-4).
 */
export const REVISION = 'every write is a revision, an approval\'s included, where a document\'s own page counts its versions';

/** What a figure with no value is called, by why it has none. */
function absent(why: Figure['why']): string {
  if (why === 'no_data') return 'None recorded';
  if (why === 'insufficient') return 'Too few to say';
  return 'Unavailable';
}
const said = (f: Figure, format: (n: number) => string = formatCount): string => (f.value === null ? absent(f.why) : format(f.value));

/**
 * The words for one period of a series, on the axis and in the readout: `05 Oct` for a week, as every weekly chart in
 * the console writes it, and `Oct 2026` for a month and for a quarter, its first month. The chart's title says the grain
 * (`by week`), so a tick needs only the date. DELIBERATE: no longer than nine characters. The Trend chart spaces its
 * labels 92px apart and sets the last one to end at the plot's edge, so a label of more than about nine characters ran
 * into its neighbour ("Week of 20 SeptWeek of 18 Oct", Phase 7's review, Work F-13).
 */
export function tickOf(windows: Window[]): (date: string) => string {
  if (grainOf(windows) === 'week') return (d) => formatShortDate(d);
  return (d) => { const s = formatDate(d); return s.slice(s.indexOf(' ') + 1); };
}
/** `by week`, `by month` or `by quarter`, as a chart of the period's series is named: the grain the gateway cut it at. */
export const grainWords = (windows: Window[]): string => `by ${grainOf(windows)}`;

/* The lead */

export const LEAD = {
  kicker: 'One person, writing this',
  chart: 'Words added, a running total',
  // The chart counts what was added and the figure above it what is retained: two measures, said apart (Work F-2).
  added: 'every word a revision added, with nothing taken off for what a later one removed, so the total can pass the words retained',
  note: 'the time one person would take to write them at that pace: an estimate, not a measurement',
  unread: 'The retained text could not be read, so there is no estimate.',
} as const;
const BASIS = { retained_stock: 'your documents and lessons retain', period_net_additions: 'added in the period' } as const;

/** What the words are counted over, and what they leave out, in one line. */
export function coverageLine(c: WritingCoverage): string {
  const gaps = gapsOf(c);
  return `Counted over ${formatCount(c.documents)} ${plural(c.documents, 'document')} and ${formatCount(c.revisions)} ${plural(c.revisions, 'revision')}${gaps.length ? `; ${gaps.join(', ')}` : ''}.`;
}

/** The lead as it reads: the hours (NaN when there are none), their words, the pace, the words counted (with the cutoff, as `basis`) and the coverage. */
export function leadOf(r: RecordRead): { hours: number; text: string; kicker: string; pace: string | null; words: string | null; basis: string | null; coverage: string | null } {
  const e = r.lead.estimate;
  const kicker = `${LEAD.kicker} · as of ${formatDay(r.lead.asOf)}`;
  if (!e) return { hours: Number.NaN, text: 'Unavailable', kicker, pace: null, words: null, basis: null, coverage: null };
  const words = `${e.words === null ? 'no words' : `${formatCount(e.words)} ${plural(e.words, 'word')}`} ${BASIS[e.basis]}`;
  return {
    hours: e.hours ?? Number.NaN,
    text: e.hours === null ? 'No words recorded' : formatHours(e.hours),
    kicker,
    pace: `estimated at ${formatCount(e.assumedWordsPerHour)} words an hour`,
    words,
    basis: `${words} as of ${formatDateTime(r.lead.asOf)}`,
    coverage: coverageLine(e.coverage),
  };
}

/** The foot: the period's work beside the lead, each with its label. */
export function footOf(r: RecordRead): { key: string; label: string; value: string }[] {
  const { closed, opened, documents, versions, approvalsInYourName } = r.foot;
  return [
    { key: 'closed', label: 'Work closed', value: closed.value !== null && opened.value !== null ? `${formatCount(closed.value)} of ${formatCount(opened.value)} opened` : said(closed) },
    { key: 'documents', label: 'Documents created', value: said(documents) },
    { key: 'versions', label: 'Revisions written', value: said(versions) },
    { key: 'approvals', label: 'Approvals in your name', value: said(approvalsInYourName) },
  ];
}

/* The slices */

/** A tile as it reads: its figure (a number, or a word when there is none), how the number reads, and the line under it. */
export type Tile = { key: string; label: string; hint: string; value: number | string; format: (n: number) => string; note: string };
export const tileText = (t: Tile): string => (typeof t.value === 'number' ? t.format(t.value) : t.value);

const tile = (key: string, label: string, hint: string, f: Figure, note: string, format: (n: number) => string = formatCount): Tile =>
  ({ key, label, hint, value: f.value ?? absent(f.why), format, note });
/** A median of hours, its note over how many pieces of work; `named` when the label does not say it is a median. */
const median = (key: string, label: string, hint: string, p: PeriodFigure, named = false): Tile =>
  tile(key, label, hint, p.figure, `${named ? 'The median, over' : 'Over'} ${p.denominator !== null ? `${formatCount(p.denominator)} ${plural(p.denominator, 'piece')} of work` : 'the period'}`, formatHours);

export type SliceKey = 'work' | 'documents' | 'knowledge' | 'agents' | 'firsts';
/** Each slice's heading, and what it is a slice of. */
export const SLICES: Record<SliceKey, { title: string; unread: string }> = {
  work: { title: 'Work', unread: 'The work could not be read.' },
  documents: { title: 'Documents', unread: 'The documents could not be read.' },
  knowledge: { title: 'Knowledge', unread: 'The knowledge could not be read.' },
  agents: { title: 'Your agents', unread: 'Your agents\' runs could not be read.' },
  firsts: { title: 'Firsts and bests', unread: 'The firsts and bests could not be read.' },
};

/**
 * The four tiles of each slice that could be read; null for a slice that could not. A label is whole at a quarter-width
 * tile, which cuts one past about 21 characters (Work F-13): what it counts in full is its hint, and its line under it.
 * "Lessons made" are the lessons the team's own work made, an import's left out, as Home counts them; "Lessons adopted"
 * is Knowledge's, the lessons standing on the shelf, imports included (Work F-7, F-8).
 */
export function tilesOf(r: RecordRead): Record<SliceKey, Tile[] | null> {
  const w = r.work.state === 'ok' ? r.work.data : null;
  const d = r.documents.state === 'ok' ? r.documents.data : null;
  const k = r.knowledge.state === 'ok' ? r.knowledge.data : null;
  const a = r.agents.state === 'ok' ? r.agents.data : null;
  const f = r.firsts.state === 'ok' ? r.firsts.data : null;
  return {
    work: w && (() => {
      const { accepted, delivered, abandoned } = w.closedByOutcome;
      const all = [accepted, delivered, abandoned];
      const total: Figure = all.every((x) => x.value !== null) ? { value: all.reduce((n, x) => n + x.value!, 0), why: null } : accepted;
      return [
        tile('closed', 'Closed by outcome', 'Initiatives closed in the period, by the outcome each closed with.', total, `${said(accepted)} accepted, ${said(delivered)} delivered, ${said(abandoned)} abandoned`),
        tile('mostOpen', 'Most open at once', 'The most initiatives open at one moment in the period.', w.mostOpenAtOnce.value, w.mostOpenAtOnce.at ? `First reached ${formatDay(w.mostOpenAtOnce.at)}` : 'In the period'),
        median('medianClose', 'Median hours to close', 'From opening to closing, over the period\'s closures.', w.medianHoursToClose),
        median('medianAbandon', 'Hours to abandon', 'From opening to abandoning, over the work abandoned in the period: the span the record\'s Took column gives each.', w.medianHoursToAbandon, true),
      ];
    })(),
    documents: d && [
      tile('flowDocuments', 'Flow documents', 'Flow documents created in the period.', d.flowDocuments, 'Created in the period'),
      tile('versions', 'Revisions written', `Revisions of the team's documents written in the period: ${REVISION}.`, d.versions, 'Written in the period'),
      tile('sources', 'Median sources', 'The median of the sources supporting each gated document created in the period.', d.sourcesUnderGated.median, `Under a gated document; the most under one: ${said(d.sourcesUnderGated.largest)}`),
      tile('citations', 'Citations', 'Links from one of the team\'s documents to another, first recorded in the period.', d.citations, 'First recorded in the period'),
    ],
    knowledge: k && [
      tile('adopted', LESSONS_MADE, 'Lessons the team\'s own work made in the period, an import\'s left out. Knowledge\'s Lessons adopted are those standing on the shelf, imports included.', k.adopted, 'In the period, outside an import'),
      tile('ownReturned', 'Lessons returned', 'How often a search returned one of the team\'s own lessons: retrieval, not a proven answer.', k.ownReturned, 'Times a search in the period returned one'),
      tile('meanResults', 'Results per search', 'The entries a completed search returned, on average.', k.meanResults, 'The mean, over completed searches', (n) => n.toFixed(1)),
      tile('sharedResults', 'From the shared shelf', 'Entries searches returned from the shelf every team shares.', k.sharedResults, 'Results searches returned in the period'),
    ],
    agents: a && [
      tile('coverage', 'Observed run coverage', 'Hours with at least one observed run, overlapping runs counted once.', a.coverageMs, `Summed run time ${said(a.summedMs, (n) => formatHours(n / 3_600_000))}`, (n) => formatHours(n / 3_600_000)),
      tile('peak', 'Peak concurrency', 'The most observed runs at one moment.', a.peak, 'Runs at once', (n) => `${formatCount(n)} at once`),
      tile('runs', 'Runs', 'Observed runs whose first call is in the period.', a.runs, `${formatCount(a.zeroLength)} of no measurable length`),
      tile('skills', 'Skills used', 'The distinct skills the runs ran.', a.skillsUsed, 'In the period'),
    ],
    firsts: f && (Object.keys(BEST) as (keyof typeof BEST)[]).map((key) => {
      const b = f.bests.find((x) => x.key === key);
      const note = !b ? 'Nothing set in the period' : key === 'most_words_week' ? `The week of ${formatDay(b.at)}` : `${b.subject ? `${clip(b.subject, 48)}, ` : ''}${formatDay(b.at)}`;
      return { key, label: BEST[key].label, hint: BEST[key].hint, value: b ? b.value : 'None yet', format: formatCount, note };
    }),
  };
}

const BEST = {
  most_versions: { label: 'Most revisions', hint: `The most revisions one flow document was given in the period: ${REVISION}.` },
  most_sources: { label: 'Most sources', hint: 'The most sources registered in the period supporting one flow document.' },
  most_words_week: { label: 'Most words in a week', hint: 'The most words added in one complete week of the period.' },
  most_open: { label: 'Most open at once', hint: 'The most initiatives open at one moment in the period.' },
} as const;

/** The dated firsts' names, the earliest first: the whole record's, never the period's. */
export const FIRST = {
  closed: 'First piece of work closed', approved: 'First document approved', lesson: 'First lesson made',
  run: 'First observed agent run', words_week: 'First week of recorded word additions',
} as const;

/** The record's summary over every initiative, never the page: `12 initiatives: 3 open, 5 accepted, …`. */
export function summaryLine(r: RecordRead): string | null {
  if (r.record.state !== 'ok') return null;
  const { total, summary: { byOutcome: o } } = r.record.data;
  return `${formatCount(total)} ${plural(total, 'initiative')}: ${formatCount(o.open)} open, ${formatCount(o.accepted)} accepted, ${formatCount(o.delivered)} delivered, ${formatCount(o.abandoned)} abandoned`;
}

/** A share of searches, as the chart and the assistant say it: the gateway's percent, whole. */
export const formatShare = (n: number): string => formatPercent(n / 100, 0);

/* The shared context */

/** The periods of the lead's series the context says, the running one last: up to 26 weeks are drawn. */
const SERIES_PERIODS = 8;
/** The periods of every other series the context says: the lead's is the page's protagonist, these its slices'. */
const SLICE_PERIODS = 3;

/** A figure as its chart's column reads it: its value, `none` where nothing was recorded, or why else it has none. */
const figureSaid = (f: Figure, format: (n: number) => string = formatCount): string => (f.value === null ? (f.why === 'no_data' ? NO_DATA : absent(f.why)).toLowerCase() : format(f.value));

/** One chart of a slice: the name the page gives it, and each period's figure in the words its column reads. */
type Chart = { name: string; values: string[] };

/**
 * The slices' charts as one section, the periods said once, as the page draws every chart over the lead's periods: the
 * newest three, oldest first, each chart's figures in that order, and the older periods counted. Six lines each naming
 * its weeks did not fit beside the tiles (Phase 7's third re-review, Work P-2); a chart of a slice that could not be
 * read is not here, and its slice says so.
 */
function chartsOf(r: RecordRead, charts: Chart[]): Section[] {
  const windows = r.cumulative.map((p) => p.window);
  if (!windows.length || !charts.length) return [];
  const name = grainOf(windows) === 'week' ? (d: string) => formatDay(d) : tickOf(windows);
  const from = Math.max(0, windows.length - SLICE_PERIODS);
  const last = windows.length - 1;
  const dates = windows.slice(from).map((w, i) => `${name(w.from)}${from + i === last && !w.complete ? ' so far' : ''}`);
  const older = from ? `the newest ${dates.length} of ${formatCount(windows.length)}` : 'every one';
  return [{
    name: charts.map((c) => c.name).join('; '),
    insight: { text: `The charts ${grainWords(windows)}, ${older} (${dates.join('; ')}): ${charts.map((c) => `${c.name} ${c.values.slice(from).join(' / ')}`).join('; ')}.` },
  }];
}

/** A period's closures by outcome, as its column reads: `1 accepted, 1 abandoned`, `none`, or why there is no figure. */
function closuresSaid(c: { accepted: Figure; delivered: Figure; abandoned: Figure }): string {
  const parts = [['accepted', c.accepted], ['delivered', c.delivered], ['abandoned', c.abandoned]] as const;
  const missing = parts.find(([, f]) => f.value === null);
  if (missing) return figureSaid(missing[1]);
  const total = parts.reduce((n, [, f]) => n + f.value!, 0);
  return total ? parts.filter(([, f]) => f.value).map(([k, f]) => `${formatCount(f.value!)} ${k}`).join(', ') : 'none';
}

/** A spread as the typical piece of work reads it: `3, the largest 5`. */
const spreadSaid = (s: { median: Figure; largest: Figure }): string =>
  (s.median.value === null ? 'none closed' : `${formatCount(s.median.value)}, the largest ${s.largest.value === null ? 'unknown' : formatCount(s.largest.value)}`);

/**
 * The lead's running total as its chart draws it, oldest first, each period by its start: `14 Sept 29,400; …; 19 Oct
 * 56,600 so far`. A period with no figure says why; periods older than the newest eight are counted, not listed. The
 * page leads with this chart, and the context said none of it (Work M-9).
 */
function leadSeries(r: RecordRead): string {
  const windows = r.cumulative.map((p) => p.window);
  const name = grainOf(windows) === 'week' ? (d: string) => formatDay(d) : tickOf(windows);
  // Only the last period is still running: the first may be cut short by the period's start, and holds all it will.
  const last = r.cumulative.length - 1;
  const shown = r.cumulative.map((p, i) => `${name(p.window.from)} ${p.figure.value === null ? absent(p.figure.why).toLowerCase() : formatCount(p.figure.value)}${i === last && !p.window.complete ? ' so far' : ''}`).slice(-SERIES_PERIODS);
  return `${r.cumulative.length > shown.length ? `the newest ${shown.length} of ${formatCount(r.cumulative.length)}: ` : ''}${shown.join('; ')}`;
}

/** One row of the record, as its table reads it: its slug, and the day it opened while open, or how it closed and how
 *  long it took. */
type RecordRow = Extract<RecordRead['record'], { state: 'ok' }>['data']['rows'][number];
const rowSaid = (i: RecordRow): string =>
  `${clip(i.slug, 48)} (${i.outcome === null ? `open since ${formatDay(i.opened)}` : `${i.outcome}${i.tookHours === null ? '' : `, took ${formatHours(i.tookHours)}`}`})`;
/** How many of the record's rows the context names: the table pages at ten, newest first. */
const ROWS_NAMED = 3;

/**
 * Each section of the page past the facts, the most important first, so the budget drops the least important: every
 * slice's series by week, the record's first rows, then the lists. The two heatmaps are the page's alone: a week of
 * hours and a year of days are no rows a sentence names (Phase 7's third re-review, Work P-2).
 */
function sectionsOf(r: RecordRead, filters: RecordFilters): Section[] {
  const w = r.work.state === 'ok' ? r.work.data : null;
  const d = r.documents.state === 'ok' ? r.documents.data : null;
  const k = r.knowledge.state === 'ok' ? r.knowledge.data : null;
  const a = r.agents.state === 'ok' ? r.agents.data : null;
  const f = r.firsts.state === 'ok' ? r.firsts.data : null;
  const rec = r.record.state === 'ok' ? r.record.data : null;
  const sections: Section[] = chartsOf(r, [
    ...(w ? [
      { name: 'Closures by outcome', values: w.closuresByWeek.map(closuresSaid) },
      { name: 'Median hours to close', values: w.medianHoursByWeek.map((p) => figureSaid(p.figure, formatHours)) },
    ] : []),
    ...(k ? [
      { name: 'Searches with results', values: k.searchesWithResults.map((p) => figureSaid(p.figure, formatShare)) },
      { name: `${LESSONS_MADE} in all`, values: k.adoptedInAll.map((p) => figureSaid(p.figure)) },
    ] : []),
    ...(w ? [{ name: 'Closures in all', values: w.closuresInAll.map((p) => figureSaid(p.figure)) }] : []),
    ...(d ? [{ name: 'Words added', values: d.wordsByWeek.map((p) => figureSaid(p.figure)) }] : []),
  ]);
  // A record with no initiative yet is its summary's zero, and has no rows to name.
  if (rec && rec.rows.length) {
    const page = pageOf(filters);
    const shown = rec.rows.slice(0, ROWS_NAMED);
    sections.push({ name: 'The record\'s rows', insight: { text: `The record's rows, ${page > 1 ? `page ${page}'s newest` : 'the newest'} ${shown.length} of ${formatCount(rec.total)}: ${shown.map(rowSaid).join('; ')}.` } });
  }
  // A list with nothing in it is said as its card says it, so an empty card is told as one, never left out.
  if (a) {
    // The page's list names a few and counts the rest, and so does this.
    const skills = a.bySkill;
    const runs = skills.slice(4).reduce((n, s) => n + s.runs, 0);
    const more = skills.length > 4 ? `; and ${skills.length - 4} more ${plural(skills.length - 4, 'skill')}, ${formatCount(runs)} ${plural(runs, 'run')}` : '';
    sections.push({ name: 'Runs by skill', insight: { text: `Runs by skill: ${skills.length ? `${skills.slice(0, 4).map((s) => `${clip(s.skill, 40)} ${formatCount(s.runs)}`).join('; ')}${more}` : 'no run in the period'}.`, evidence: '/runs' } });
  }
  if (d) {
    const m = d.mostRewritten;
    sections.push({ name: 'Most rewritten documents', insight: { text: `Most rewritten documents (every write a revision, an approval's included): ${m.length ? `${m.slice(0, 3).map((x) => `${clip(`${x.initiative}/${x.path}`)} (${x.versions} ${plural(x.versions, 'revision')})`).join('; ')}${m.length > 3 ? `; and ${m.length - 3} more` : ''}` : 'nothing rewritten in the period'}.` } });
  }
  if (k) {
    sections.push({ name: 'Lessons adopted, by kind', insight: { text: `Lessons adopted, by kind, imports included: ${k.byKind.length ? listed(k.byKind, (b) => `${b.kind} ${formatCount(b.lessons)}`, 'the list on /knowledge', 6) : 'no lesson on the shelf'}.`, evidence: '/knowledge' } });
  }
  if (f) {
    // The year once where every first is in one, as a sentence writes a day; the dated card writes each in full.
    const years = new Set(f.firsts.map((x) => formatDate(x.at).slice(-4)));
    const one = years.size === 1 ? [...years][0] : null;
    sections.push({ name: 'Dated firsts', insight: { text: `Dated firsts${one ? `, all in ${one}` : ''}: ${f.firsts.length ? f.firsts.map((x) => `${FIRST[x.key].replace(/^First /, '')} ${one ? formatDay(x.at) : formatDate(x.at)}`).join('; ') : 'none yet'}.` } });
  }
  if (w) {
    const t = w.typical;
    sections.push({ name: 'A typical piece of work', insight: { text: `A typical piece of work, the median over the period's closures: documents ${spreadSaid(t.documents)}; revisions ${spreadSaid(t.versions)}; sources ${spreadSaid(t.sources)}; words it retains ${spreadSaid(t.words)}.` } });
  }
  if (k) {
    sections.push({ name: 'What searches returned', insight: { text: `What searches returned, by kind: ${k.returnedByKind.length ? listed(k.returnedByKind, (b) => `${b.kind} ${formatCount(b.results)}`, 'the list on /record', 4) : 'nothing in the period'}.` } });
  }
  if (a) sections.push({ name: `Weekday by hour (in ${r.meta.timezone})`, insight: null }, { name: 'Every day', insight: null });
  return sections;
}

/** The context of the record the page draws for `filters`, or of the read that has not brought one. */
export function recordContext(r: RecordRead | null, { filters, trouble = null }: { filters: RecordFilters; trouble?: string | null }): SharedContext {
  const address = addressOf('/record', { period: filters.period, page: filters.page }, RECORD_DEFAULTS);
  const view = { view: 'record', title: 'Record', address } as const;
  if (!r) return pendingContext({ ...view, scope: 'your team\'s record' }, trouble);
  const lead = leadOf(r);
  const tiles = tilesOf(r);
  // A figure the page shows twice, as the foot's and a slice's, or as a slice's and a best, is said the first time:
  // the budget went on the repeats and dropped what the page shows once (Phase 7's second re-review, Work M-9).
  const told = new Set<string>();
  const once = (label: string, value: string) => {
    const key = `${label.toLowerCase()} ${value}`;
    if (told.has(key)) return false;
    told.add(key);
    return true;
  };
  const facts: Fact[] = [
    // The value says it is an estimate at a pace; the definition what it is over.
    { label: LEAD.kicker, value: lead.pace ? `${lead.text}, ${lead.pace}` : lead.text, definition: lead.words ? `Over ${lead.words}, as of the cutoff, whatever the period` : LEAD.unread },
    ...(r.cumulative.length ? [{ label: `${LEAD.chart}, ${grainWords(r.cumulative.map((p) => p.window))}`, value: leadSeries(r), definition: 'Never less what a later revision removed, so it can pass the words retained' }] : []),
    // The foot's four figures under the lead, one fact as one row of the card.
    { label: 'In the period', value: footOf(r).filter((f) => once(f.label, f.value)).map((f) => `${f.label.toLowerCase()} ${f.value}`).join('; ') },
    ...(Object.keys(SLICES) as SliceKey[]).flatMap((k): Fact[] => {
      const t = tiles[k]?.filter((x) => once(x.label, tileText(x)));
      // A note that only names the period is said once, by the scope; one that carries a figure or a date stays.
      return t?.length ? [{ label: SLICES[k].title, value: t.map((x) => `${x.label.toLowerCase()} ${tileText(x)}${/\d|import/.test(x.note) ? ` (${x.note.replace(/^In the period, /, '')})` : ''}`).join('; ') }] : [];
    }),
  ];
  const summary = summaryLine(r);
  if (summary) facts.push({ label: 'The record', value: summary, definition: 'Whatever the period' });

  const unknowns: string[] = [];
  // What the estimate leaves out: the documents and revisions it is over are the facts above.
  const gaps = r.lead.estimate ? gapsOf(r.lead.estimate.coverage) : null;
  if (gaps) unknowns.push(gaps.length ? `The estimate: ${gaps.join(', ')}.` : 'The estimate leaves no document out.');
  else unknowns.push(LEAD.unread);
  for (const k of Object.keys(SLICES) as SliceKey[]) if (!tiles[k]) unknowns.push(SLICES[k].unread);
  if (r.record.state !== 'ok') unknowns.push('The record of initiatives could not be read.');

  return sectioned({ ...view, scope: `${r.meta.population}, ${periodLine(r)}`, freshness: `${asOfLine(r)}.`, facts, insights: [], unknowns }, sectionsOf(r, filters));
}
