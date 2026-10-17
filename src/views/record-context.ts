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
import { formatDate, formatDateTime, formatDay } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { Fact, Insight, SharedContext } from '@/lib/shared-context';
import type { Figure, PeriodFigure, Window } from '@/lib/platform-shapes';
import type { RecordRead, WritingCoverage } from '@/lib/work-shapes';
import { addressOf, budgeted, clip, pendingContext } from './context';

/** How long the console's server waits for Record's read before it says the read is unavailable. */
export const RECORD_BOUND_MS = 5_000;

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
  return read.state === 'slow' ? `The platform did not answer within ${RECORD_BOUND_MS / 1000} seconds.` : read.reason;
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

/** Hours as the page says them: one decimal under ten, whole above. */
export const formatHours = (h: number): string => `${h < 10 ? h.toFixed(1) : formatCount(Math.round(h))} h`;

/** What a figure with no value is called, by why it has none. */
function absent(why: Figure['why']): string {
  if (why === 'no_data') return 'None recorded';
  if (why === 'insufficient') return 'Too few to say';
  return 'Unavailable';
}
const said = (f: Figure, format: (n: number) => string = formatCount): string => (f.value === null ? absent(f.why) : format(f.value));

/** Whether a series of periods is weeks or months, as the gateway's grain cut them. */
const weekly = (windows: Window[]): boolean => !windows.length || Date.parse(windows[0].to) - Date.parse(windows[0].from) <= 8 * 86_400_000;
/** The words for one period of a series: `Week of 5 Oct` or `Oct 2026`. */
export function tickOf(windows: Window[]): (date: string) => string {
  if (weekly(windows)) return (d) => `Week of ${formatDay(d)}`;
  return (d) => { const s = formatDate(d); return s.slice(s.indexOf(' ') + 1); };
}
/** `by week` or `by month`, as a chart of the period's series is named. */
export const grainWords = (windows: Window[]): string => (weekly(windows) ? 'by week' : 'by month');

/* The lead */

export const LEAD = {
  kicker: 'One person, writing this',
  chart: 'Words added, a running total',
  note: 'the time one person would take to write them at that pace: an estimate, not a measurement',
  unread: 'The retained text could not be read, so there is no estimate.',
} as const;
const BASIS = { retained_stock: 'your documents and lessons retain', period_net_additions: 'added in the period' } as const;

/** What the words are counted over, and what they leave out, in one line. */
export function coverageLine(c: WritingCoverage): string {
  const gaps = [
    c.importMade ? `${formatCount(c.importMade)} made by an import left out` : '',
    c.unrecorded ? `${formatCount(c.unrecorded)} with no recorded write` : '',
    c.missingLegacy ? `${formatCount(c.missingLegacy)} missing an earlier revision` : '',
  ].filter(Boolean);
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
    { key: 'versions', label: 'Versions written', value: said(versions) },
    { key: 'approvals', label: 'Approvals in your name', value: said(approvalsInYourName) },
  ];
}

/* The slices */

/** A tile as it reads: its figure (a number, or a word when there is none), how the number reads, and the line under it. */
export type Tile = { key: string; label: string; hint: string; value: number | string; format: (n: number) => string; note: string };
export const tileText = (t: Tile): string => (typeof t.value === 'number' ? t.format(t.value) : t.value);

const tile = (key: string, label: string, hint: string, f: Figure, note: string, format: (n: number) => string = formatCount): Tile =>
  ({ key, label, hint, value: f.value ?? absent(f.why), format, note });
const median = (key: string, label: string, hint: string, p: PeriodFigure): Tile =>
  tile(key, label, hint, p.figure, p.denominator !== null ? `Over ${formatCount(p.denominator)} ${plural(p.denominator, 'piece')} of work` : 'Over the period', formatHours);

export type SliceKey = 'work' | 'documents' | 'knowledge' | 'agents' | 'firsts';
/** Each slice's heading, and what it is a slice of. */
export const SLICES: Record<SliceKey, { title: string; unread: string }> = {
  work: { title: 'Work', unread: 'The work could not be read.' },
  documents: { title: 'Documents', unread: 'The documents could not be read.' },
  knowledge: { title: 'Knowledge', unread: 'The knowledge could not be read.' },
  agents: { title: 'Your agents', unread: 'Your agents\' runs could not be read.' },
  firsts: { title: 'Firsts and bests', unread: 'The firsts and bests could not be read.' },
};

/** The four tiles of each slice that could be read; null for a slice that could not. */
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
        median('medianAbandon', 'Median hours until abandoned work stopped', 'From opening to abandoning, over the work abandoned in the period.', w.medianHoursToAbandon),
      ];
    })(),
    documents: d && [
      tile('flowDocuments', 'Flow documents', 'Flow documents created in the period.', d.flowDocuments, 'Created in the period'),
      tile('versions', 'Versions written', 'Revisions of the team\'s documents written in the period.', d.versions, 'Written in the period'),
      tile('sources', 'Median sources under a gated document', 'The sources supporting each gated document created in the period.', d.sourcesUnderGated.median, `The most under one: ${said(d.sourcesUnderGated.largest)}`),
      tile('citations', 'Citations', 'Links from one of the team\'s documents to another, first recorded in the period.', d.citations, 'First recorded in the period'),
    ],
    knowledge: k && [
      tile('adopted', 'Lessons adopted', 'Lessons the team made in the period, an import\'s left out.', k.adopted, 'Outside an import'),
      tile('ownReturned', 'Times your lessons were returned', 'How often a search returned one of the team\'s own lessons: retrieval, not a proven answer.', k.ownReturned, 'By a search in the period'),
      tile('meanResults', 'Mean results a search returns', 'The entries a completed search returned, on average.', k.meanResults, 'Per completed search', (n) => n.toFixed(1)),
      tile('sharedResults', 'Results from the shared shelf', 'Entries searches returned from the shelf every team shares.', k.sharedResults, 'In the period'),
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
  most_versions: { label: 'Most versions of one document', hint: 'The most revisions one flow document was given in the period.' },
  most_sources: { label: 'Most sources under one document', hint: 'The most sources registered in the period supporting one flow document.' },
  most_words_week: { label: 'Most words added in a week', hint: 'The most words added in one complete week of the period.' },
  most_open: { label: 'Most open at once', hint: 'The most initiatives open at one moment in the period.' },
} as const;

/** The dated firsts' names, the earliest first: the whole record's, never the period's. */
export const FIRST = {
  closed: 'First piece of work closed', approved: 'First document approved', lesson: 'First lesson adopted',
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

/** The context of the record the page draws for `filters`, or of the read that has not brought one. */
export function recordContext(r: RecordRead | null, { filters, trouble = null }: { filters: RecordFilters; trouble?: string | null }): SharedContext {
  const address = addressOf('/record', { period: filters.period, page: filters.page }, RECORD_DEFAULTS);
  const view = { view: 'record', title: 'Record', address } as const;
  if (!r) return pendingContext({ ...view, scope: 'your team\'s record' }, trouble);
  const lead = leadOf(r);
  const tiles = tilesOf(r);
  const facts: Fact[] = [
    { label: 'Period', value: periodLine(r), definition: 'Every figure below the lead is the period\'s' },
    { label: LEAD.kicker, value: lead.pace ? `${lead.text}, ${lead.pace}` : lead.text, change: `as of ${formatDateTime(r.lead.asOf)}`, definition: lead.words ? `Over ${lead.words}: ${LEAD.note}` : LEAD.unread },
    ...footOf(r).map((f): Fact => ({ label: f.label, value: f.value })),
    ...(Object.keys(SLICES) as SliceKey[]).flatMap((k): Fact[] => {
      const t = tiles[k];
      // A note that only names the period is said once, by the Period fact; one that carries a figure or a date stays.
      return t ? [{ label: SLICES[k].title, value: t.map((x) => `${x.label.toLowerCase()} ${tileText(x)}${/\d|import/.test(x.note) ? ` (${x.note})` : ''}`).join('; ') }] : [];
    }),
  ];
  const summary = summaryLine(r);
  if (summary) facts.push({ label: 'The record', value: summary, definition: 'Every initiative opened before the cutoff' });

  const insights: Insight[] = [];
  const unknowns: string[] = [];
  if (r.firsts.state === 'ok' && r.firsts.data.firsts.length) {
    insights.push({ text: `Firsts over the whole record: ${r.firsts.data.firsts.map((f) => `${FIRST[f.key].toLowerCase()} ${formatDate(f.at)}`).join('; ')}.` });
  }
  if (r.documents.state === 'ok' && r.documents.data.mostRewritten.length) {
    insights.push({ text: `Most rewritten in the period: ${r.documents.data.mostRewritten.slice(0, 3).map((m) => `${clip(`${m.initiative}/${m.path}`)} (${m.versions} versions)`).join('; ')}.` });
  }
  if (r.agents.state === 'ok' && r.agents.data.bySkill.length) {
    insights.push({ text: `Runs by skill in the period: ${r.agents.data.bySkill.slice(0, 4).map((s) => `${clip(s.skill, 40)} ${formatCount(s.runs)}`).join('; ')}.`, evidence: '/runs' });
  }
  if (r.knowledge.state === 'ok' && r.knowledge.data.byKind.length) {
    insights.push({ text: `Standing lessons by kind as of the cutoff: ${r.knowledge.data.byKind.map((b) => `${b.kind} ${formatCount(b.lessons)}`).join('; ')}.`, evidence: '/knowledge' });
  }
  if (lead.coverage) unknowns.push(`The estimate: ${lead.coverage}`);
  else unknowns.push(LEAD.unread);
  for (const k of Object.keys(SLICES) as SliceKey[]) if (!tiles[k]) unknowns.push(SLICES[k].unread);
  if (r.record.state !== 'ok') unknowns.push('The record of initiatives could not be read.');

  return budgeted({ ...view, scope: `${r.meta.population}, ${periodLine(r)}`, freshness: `${asOfLine(r)}.`, facts, insights, unknowns });
}
