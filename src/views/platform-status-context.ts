/**
 * The platform's Status page's shared context (decision 0011), and every word and figure the page is drawn with: what
 * needs attention, the paired figures (malformed calls per 1,000 and refusals put right, week by week), the scoreboard
 * of the eight measures, each door's days, what is running and the reader's own team's share. The page draws these
 * values and the assistant is told the same ones, as the page's shared context and through `view_platform_status`,
 * which reduces the same response with `statusRead` (`src/views/tools/platform-status.ts`).
 *
 * Every finding is the gateway's (`finding.text`, `headline`, `judgement`): the page computes none. What is computed
 * here is arithmetic over the read's own facts, a change between two weeks and a sum of the doors' counts, each in the
 * unit the spec gives it: a rate per 1,000 and a share in its own unit, a duration in milliseconds, a count in percent
 * unless the week before was zero, when the change is the absolute one.
 */
import type { Figure, Measure, PeriodFigure, PlatformStatus } from '@/lib/platform-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatCalendarDate, formatDateTime, formatDay, formatShortDate } from '@/lib/format-date';
import type { Fact, Insight, SharedContext } from '@/lib/shared-context';
import { budgeted, pendingContext } from './context';

/** How long the page waits for the status read before it says the read is unavailable: half a second under five, for a
 *  phone to draw what it says, the bound the browser's own reads keep (`src/lib/api.ts`). */
export const STATUS_BOUND_MS = 4_500;

/** What the page's one read came back as: the whole response, a read that failed, or one that did not answer within `STATUS_BOUND_MS`. */
export type StatusRead = { state: 'ok'; status: PlatformStatus } | { state: 'failed' } | { state: 'slow' };

/** The status read as the page and the assistant hold it. */
export const statusRead = (status: PlatformStatus): StatusRead => ({ state: 'ok', status });

type Key = Measure['key'];
type Kind = 'rate' | 'share' | 'ms' | 'count';
type Needs = PlatformStatus['needs'];
type Door = Extract<PlatformStatus['doors'], { state: 'ok' }>['data'][number];

/** Each measure as the page names it, the unit it is printed in, and what it counts. */
const MEASURES: Record<Key, { label: string; kind: Kind; hint: string }> = {
  malformed_per_1000: { label: 'Malformed calls per 1,000', kind: 'rate', hint: 'Tool calls refused for their shape in every 1,000 real-work calls of a whole week: a missing argument, an invalid value, a name that does not resolve. The release check, imports and the doctor are not real work.' },
  same_tool_followup_pct: { label: 'Refusals put right', kind: 'share', hint: 'Of the refusals that could be followed, the share followed within 120 seconds by an answered call of the same tool in the same session. It says whether a refusal told the agent what to do, not that the work recovered.' },
  call_p50_ms: { label: 'Median call duration', kind: 'ms', hint: 'The middle recorded duration of the week\'s real-work calls. Calls with no recorded duration are left out.' },
  call_p95_ms: { label: '95th percentile call duration', kind: 'ms', hint: 'The duration 95 in every 100 of the week\'s timed real-work calls finished within. Calls with no recorded duration are left out.' },
  searches_with_results_pct: { label: 'Searches that found something', kind: 'share', hint: 'Completed searches whose results were not empty, of every completed search. Retrieval, not proof an answer was right.' },
  bugs_per_1000: { label: 'Bug reports per 1,000 calls', kind: 'rate', hint: 'Real bug reports filed for every 1,000 real-work calls. A report is filed by choice, so fewer is not better.' },
  sessions: { label: 'Sessions', kind: 'count', hint: 'Distinct sessions with a real-work call. Activity: a quiet week is not a worse one.' },
  work_finished: { label: 'Work finished', kind: 'count', hint: 'Initiatives closed as accepted or delivered. Volume, not quality.' },
};
/** The five measures with a favourable direction, and the three that are activity, in the spec's order. */
const DIRECTIONAL: Key[] = ['malformed_per_1000', 'same_tool_followup_pct', 'call_p50_ms', 'call_p95_ms', 'searches_with_results_pct'];
const ACTIVITY: Key[] = ['bugs_per_1000', 'sessions', 'work_finished'];

const ONE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
/** A rate per 1,000, to one decimal place: `64.0`. */
const formatRate = (n: number): string => ONE.format(n);
/** A share, to one decimal place: `84.0%`. */
const formatShare = (n: number): string => `${ONE.format(n)}%`;
/** A value in its measure's unit, at the precision the page prints it. */
export const valueIn = (kind: Kind, n: number): string =>
  kind === 'rate' ? formatRate(n) : kind === 'share' ? formatShare(n) : kind === 'ms' ? `${WHOLE.format(n)} ms` : WHOLE.format(n);
/** A value rounded to the precision the page prints it at, so two weeks that read alike are unchanged. */
const printed = (kind: Kind, n: number) => (kind === 'rate' || kind === 'share' ? Math.round(n * 10) / 10 : Math.round(n));

/** The week a figure is for, in a sentence: `week of 5 Oct`. */
const weekOf = (p: PeriodFigure): string => `week of ${formatDay(p.window.from)}`;
/** A local date the gateway names (`2026-10-05`) as the day it is, in a table cell: `05 Oct 2026`, padded as a cell's day. */
export const dayCell = (date: string): string => { const [, d, m, y] = formatCalendarDate(date).split(' '); return `${d.padStart(2, '0')} ${m} ${y}`; };
/** The same day inside a sentence, where the year is noise: `5 Oct`. */
export const dayIn = (date: string): string => formatCalendarDate(date).split(' ').slice(1, 3).join(' ');

/** A week's figure as its cell prints it: the value, or the word for why there is none. A missing week is never a zero. */
function figureText(kind: Kind, p: PeriodFigure | null): string {
  if (!p) return 'No whole week yet';
  return wordFor(p.figure) ?? valueIn(kind, p.figure.value!);
}
const wordFor = (f: Figure): string | null => (f.why === 'unavailable' ? 'Unavailable' : f.why === 'no_data' || f.value === null ? 'No data' : null);

/** A figure with the week it is for, by the instant the week began: a cell writes it `Week of 05 Oct` under the value,
 *  a sentence `week of 5 Oct` (`weekIn`). */
export type Dated = { value: string; from: string | null };
const dated = (kind: Kind, p: PeriodFigure | null, none = 'No comparable week yet'): Dated =>
  (p ? { value: `${figureText(kind, p)}${p.figure.why === 'insufficient' ? ', too few' : ''}`, from: p.window.from } : { value: none, from: null });
/** A dated figure's week as its table cell prints it, the day padded as a cell's is. */
export const weekCell = (d: Dated): string | null => (d.from ? `Week of ${formatShortDate(d.from)}` : null);
/** A dated figure's week inside a sentence. */
export const weekIn = (d: Dated): string | null => (d.from ? `week of ${formatDay(d.from)}` : null);

/**
 * The change from the week before to the last whole week, as the Delta draws it: `value` its signed size (a fraction
 * for a count over a week that had some, otherwise the difference in the measure's unit), `format` its size as printed,
 * and `words` the sentence. `value` is null when the two weeks do not compare, and 0 when they read alike.
 */
type Change = { value: number | null; format: (n: number) => string; words: string };
function changeOf(m: Measure): Change {
  const { kind } = MEASURES[m.key];
  const a = m.previous?.figure, b = m.last?.figure;
  const unit = (n: number) => (kind === 'share' ? `${ONE.format(Math.abs(n))} pts` : kind === 'ms' ? `${WHOLE.format(Math.abs(n))} ms` : kind === 'rate' ? ONE.format(Math.abs(n)) : WHOLE.format(Math.abs(n)));
  if (m.judgement === 'not_comparable' || !a || !b || a.value === null || b.value === null || a.why || b.why) {
    return { value: null, format: unit, words: 'not comparable with the week before' };
  }
  const before = printed(kind, a.value), after = printed(kind, b.value);
  if (before === after) return { value: 0, format: unit, words: 'unchanged on the week before' };
  // A count compares in percent over a week that had some; from a week of none, the change is the count itself.
  const percent = kind === 'count' && before !== 0;
  const value = percent ? (after - before) / before : printed(kind, after - before);
  const format = percent ? (n: number) => `${ONE.format(Math.abs(n * 100))}%` : unit;
  return { value, format, words: `${value > 0 ? 'up' : 'down'} ${format(value)} on the week before` };
}

/** The measure of `key` in the read, or undefined when the read did not carry it: its row is then unavailable. */
const measureOf = (s: PlatformStatus, key: Key): Measure | undefined => s.measures.find((m) => m.key === key);

/* What needs attention */

const KIND: Record<Needs['rows'][number]['kind'], string> = { bugs: 'bug reports', door: 'doors', evaluation: 'evaluation', approvals: 'approvals', drift: 'latency drift' };
/**
 * The list's foot: what overflowed by kind, and which checks did not answer; null when there is neither, since the
 * headline already counts what is shown.
 */
export function needsFoot(needs: Needs): string | null {
  const over = Object.entries(needs.overflowByKind).filter(([, n]) => n);
  const more = over.reduce((n, [, k]) => n + (k ?? 0), 0);
  const parts = [
    ...(more ? [`${formatCount(more)} more not shown: ${over.map(([k, n]) => `${KIND[k as keyof typeof KIND]} ${formatCount(n!)}`).join(', ')}`] : []),
    ...(needs.unavailableKinds.length ? [`Not checked: ${needs.unavailableKinds.map((k) => KIND[k]).join(', ')}`] : []),
  ];
  return parts.length ? `${parts.join('. ')}.` : null;
}

/* The paired figures */

/**
 * One half of the Featured metric: its figure, its weeks for the Column chart, its caption and the gateway's finding.
 * A week with no figure has `value` null, which the card draws as a dash, and its caption says why: the card sets any
 * figure longer than nine characters at a glance, so a word in the figure's place would be drawn as a number.
 */
export type Half = {
  label: string; kind: Kind; value: number | null; caption: string; finding: string | null;
  columns: { key: string; label: string; value: number | null }[]; dates: string[]; running: boolean;
};
/** The week a figure is for, found among a measure's weeks by its start: an array entry beside the weeks is read at its index. */
const indexOf = (m: Measure, p: PeriodFigure | null) => (p ? m.weeks.findIndex((w) => w.window.from === p.window.from) : -1);

function half(m: Measure | undefined, key: 'malformed_per_1000' | 'same_tool_followup_pct'): Half {
  const { label, kind } = MEASURES[key];
  if (!m) return { label, kind, value: null, caption: 'Unavailable: the read did not carry this measure.', finding: null, columns: [], dates: [], running: false };
  const last = m.last;
  const none = !last ? 'No whole week has ended since the record began.'
    : last.figure.why === 'unavailable' ? `Unavailable: not worked out for the ${weekOf(last)}.`
    : last.figure.why === 'no_data' || last.figure.value === null ? `${key === 'malformed_per_1000' ? 'No calls' : 'No refusals to follow'} that week, the ${weekOf(last)}.`
    : null;
  return {
    label, kind, value: none ? null : last!.figure.value!,
    caption: none ?? captionOf(m, key, last!),
    finding: m.finding?.text ?? null,
    columns: m.weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), value: w.figure.value })),
    dates: m.weeks.map((w) => w.window.from),
    running: m.weeks.length > 0 && !m.weeks[m.weeks.length - 1].window.complete,
  };
}

function captionOf(m: Measure, key: 'malformed_per_1000' | 'same_tool_followup_pct', last: PeriodFigure): string {
  const { numerator: n, denominator: d } = last;
  const few = last.figure.why === 'insufficient' ? `. Too few ${key === 'malformed_per_1000' ? 'calls' : 'refusals'} to compare` : '';
  if (n === null || d === null) return `Week of ${formatDay(last.window.from)}${few}`;
  if (key === 'malformed_per_1000') return `${formatCount(n)} of ${formatCount(d)} real-work calls, ${weekOf(last)}${few}`;
  const c = m.followupCounts?.[indexOf(m, last)];
  return `${formatCount(n)} of ${formatCount(d)} refusals that could be followed were put right, ${weekOf(last)}${c ? `; ${formatCount(c.refusals)} refused in all` : ''}${few}`;
}

/** Both halves, the malformed-call rate first. */
export const pairOf = (s: PlatformStatus): [Half, Half] =>
  [half(measureOf(s, 'malformed_per_1000'), 'malformed_per_1000'), half(measureOf(s, 'same_tool_followup_pct'), 'same_tool_followup_pct')];

/** The Featured metric's foot: the best week for malformed calls, the days in a row with work, and every door's tool failures with their calls. */
export function footOf(s: PlatformStatus): { label: string; value: string }[] {
  const best = measureOf(s, 'malformed_per_1000')?.best ?? null;
  const doors = s.doors.state === 'ok' ? s.doors.data : null;
  const sum = (f: (d: Door) => number) => (doors ?? []).reduce((n, d) => n + f(d), 0);
  return [
    { label: 'Best week, malformed calls', value: best && best.figure.value !== null ? `${formatRate(best.figure.value)}, ${weekOf(best)}` : 'No comparable week yet' },
    { label: 'Days in a row with work', value: s.records.state === 'ok' ? formatCount(s.records.data.daysWithWork) : 'Unavailable' },
    { label: 'Tool failures, every door', value: doors ? `${formatCount(sum((d) => d.totals.toolFailures))} in ${formatCount(sum((d) => d.totals.calls))} calls` : 'Unavailable' },
  ];
}

/* The scoreboard */

/** One measure's row: its first comparable week, its best (or its high and low), its last whole week, the change and its weeks' shape. */
export type ScoreRow = {
  key: Key; label: string; hint: string; first: Dated; best: Dated | null; high: Dated | null; low: Dated | null; last: Dated;
  change: Change; intent: Measure['better']; points: (number | null)[];
};
function scoreRow(s: PlatformStatus, key: Key): ScoreRow {
  const { label, kind, hint } = MEASURES[key];
  const m = measureOf(s, key);
  const none: Dated = { value: 'Unavailable', from: null };
  if (!m) return { key, label, hint, first: none, best: null, high: null, low: null, last: none, change: { value: null, format: String, words: 'not comparable with the week before' }, intent: 'neutral', points: [] };
  const directional = m.better !== 'neutral';
  return {
    key, label, hint,
    first: dated(kind, m.first),
    best: directional ? dated(kind, m.best) : null,
    high: directional ? null : dated(kind, m.highest),
    low: directional ? null : dated(kind, m.lowest),
    last: dated(kind, m.last, 'No whole week yet'),
    change: changeOf(m), intent: m.better,
    // Whole weeks only, a missing one a gap: the Sparkline breaks its line there rather than falling to zero.
    points: m.weeks.filter((w) => w.window.complete).map((w) => w.figure.value),
  };
}

/** The scoreboard: the five directional measures under the count of those better than the week before, and the three activity measures apart. */
export function scoreOf(s: PlatformStatus): { caption: string; directional: ScoreRow[]; activity: ScoreRow[] } {
  const better = DIRECTIONAL.filter((k) => measureOf(s, k)?.judgement === 'improved').length;
  return {
    caption: `${better} of 5 measures are better than the week before`,
    directional: DIRECTIONAL.map((k) => scoreRow(s, k)),
    activity: ACTIVITY.map((k) => scoreRow(s, k)),
  };
}

/* The doors */

/** One door's row: its daily tool-failure rates over the whole days that had calls, its counts, its last fault day (a local date, null when none is recorded), the gateway's sentence for its run, and today apart. */
export type DoorRow = { door: Door['door']; rates: number[]; daysWithCalls: number; faultDays: number; lastFaultDay: string | null; run: string; today: string | null };
export function doorRow(d: Door): DoorRow {
  const whole = d.days.filter((x) => x.complete && x.calls !== null && x.calls > 0 && x.toolFailures !== null);
  const today = d.days.find((x) => !x.complete);
  return {
    door: d.door,
    rates: whole.map((x) => (100 * x.toolFailures!) / x.calls!),
    daysWithCalls: whole.length,
    faultDays: d.totals.faultDays,
    lastFaultDay: d.totals.lastFaultDay,
    run: d.finding.text,
    today: !today ? null
      : today.calls === null || today.toolFailures === null ? 'Unavailable so far'
      : `${formatCount(today.toolFailures)} in ${formatCount(today.calls)} calls so far`,
  };
}

/* What is running */

/** What is running, and `tagged`: the newest tag beside the running version where a newer one is recorded and not yet
 *  deployed, null where the running version is the newest. */
type Running =
  | { state: 'ok'; items: { label: string; value: string }[]; tagged: string | null }
  | { state: 'unrecorded' } | { state: 'unavailable'; reason: string };
export function runningOf(s: PlatformStatus): Running {
  const r = s.running;
  if (r.state === 'unavailable') return r.reason === 'unrecorded' ? { state: 'unrecorded' } : { state: 'unavailable', reason: r.reason };
  const d = r.data;
  return {
    state: 'ok',
    tagged: d.latest === d.platform ? null : `${d.latest} is tagged; the platform runs ${d.platform}`,
    items: [
      { label: 'Platform', value: d.platform },
      { label: 'Console', value: d.console ?? 'Not recorded' },
      { label: 'Tagged', value: formatDateTime(d.releasedAt) },
      { label: 'The release before', value: d.previous ?? 'None recorded' },
      { label: 'Migrations applied', value: d.migrations === null ? 'Unavailable' : formatCount(d.migrations) },
    ],
  };
}
export const UNRECORDED = 'The running version is unrecorded: no release on record names it.';

/* The reader's own team */

type OwnTile = { label: string; hint: string; kind: Kind; value: number | string; note: string | undefined; points: (number | null)[] };
type Own = { state: 'ok'; tiles: OwnTile[]; bugs: string } | { state: 'none' } | { state: 'unavailable'; reason: string };
export const NO_TEAM = 'You act for no team, so nothing here is your team\'s own.';

/** Why a member's approvals row names no team, in the words Usage says it of its weeks. */
const NO_TEAM_NAMED = 'No team is named here.';

function ownTile(label: string, hint: string, kind: Kind, weeks: PeriodFigure[], noun: string): OwnTile {
  const last = weeks.filter((w) => w.window.complete).at(-1) ?? null;
  const counts = last && last.numerator !== null && last.denominator !== null ? `${formatCount(last.numerator)} of ${formatCount(last.denominator)} ${noun}, ` : '';
  return {
    label, hint, kind,
    value: last ? (wordFor(last.figure) ?? last.figure.value!) : 'No whole week yet',
    note: last ? `${counts}${weekOf(last)}` : undefined,
    points: weeks.filter((w) => w.window.complete).map((w) => w.figure.value),
  };
}

/** The reader's active team's malformed calls, refusals put right and sessions, each its last whole week, and one line of its bug reports. */
export function ownOf(s: PlatformStatus): Own {
  if (s.own.state === 'unavailable') return s.own.reason === 'no_team' ? { state: 'none' } : { state: 'unavailable', reason: s.own.reason };
  const o = s.own.data;
  return {
    state: 'ok',
    tiles: [
      ownTile('Your team\'s malformed calls per 1,000', 'Your team\'s calls refused for their shape in every 1,000 of its real-work calls, over its last whole week. No sample minimum: the counts beside it keep it honest.', 'rate', o.malformed, 'calls'),
      ownTile('Your team\'s refusals put right', 'Your team\'s refusals that could be followed and were followed by an answered call of the same tool within 120 seconds, over its last whole week.', 'share', o.followup, 'refusals'),
      ownTile('Your team\'s sessions', 'Distinct sessions with a real-work call your team\'s agents made, over its last whole week. Agents\' activity, not anyone\'s hours.', 'count', o.sessions, 'sessions'),
    ],
    bugs: `Your team's bug reports: ${formatCount(o.bugs.filed)} filed, ${formatCount(o.bugs.fixed)} fixed, ${formatCount(o.bugs.notABug)} not a bug, ${formatCount(o.bugs.duplicate)} duplicate, ${formatCount(o.bugs.open)} open.`,
  };
}

/* The masthead and a read that brought nothing */

/** The page's as-of line: the read's own cutoff, in the console's zone. */
export const asOfLine = (meta: PlatformStatus['meta']): string => `As of ${formatDateTime(meta.asOf)}`;

/** What a read that brought nothing is called on the page, and the one sentence under it. */
export function troubleOf(state: Exclude<StatusRead['state'], 'ok'>): { title: string; detail: string } {
  if (state === 'slow') return { title: "The platform's status is unavailable", detail: `It did not answer within ${STATUS_BOUND_MS / 1000} seconds. Nothing on this page was read.` };
  return { title: "The platform's status did not load", detail: 'The platform did not answer the read. Nothing on this page was read.' };
}

/** The question Ask hands the assistant from the paired figures. */
export function askOf(s: PlatformStatus): string {
  const last = measureOf(s, 'malformed_per_1000')?.last;
  return last
    ? `What do malformed calls per 1,000 and refusals put right in the week of ${formatDay(last.window.from)} say about how real work calls tools?`
    : 'Why is there no whole week of malformed calls per 1,000 to read yet?';
}

/* What the assistant is told */

const VIEW = { view: 'platform_status', title: 'Status', address: '/platform' } as const;

/** A dated figure as the context says it, its week by the day it began: `20.0 (21 Sept)`. */
const said = (d: Dated | null, word: string, day = true) => (d ? `${word} ${d.value}${day && d.from ? ` (${formatDay(d.from)})` : ''}` : null);

/** One measure's line: its last whole week (its day only when it is not the read's last week), the change, and its first and best, or its high and low. */
function measureFact(row: ScoreRow, week: string | null, counts: string | null): Fact {
  const value = row.last.from && row.last.from !== week ? `${row.last.value} (${formatDay(row.last.from)})` : row.last.value;
  const parts = [counts, row.change.words.replace(' on the week before', ''), row.best ? said(row.first, 'first', false) : null, said(row.best, 'best'), said(row.high, 'high'), said(row.low, 'low')];
  return { label: row.label, value, change: parts.filter(Boolean).join('; ') };
}

/** The counts behind a paired figure's last whole week, in few words. */
function countsOf(m: Measure | undefined): string | null {
  const last = m?.last;
  if (!m || !last || last.numerator === null || last.denominator === null) return null;
  if (m.key === 'malformed_per_1000') return `${formatCount(last.numerator)} of ${formatCount(last.denominator)} calls`;
  const c = m.followupCounts?.[indexOf(m, last)];
  return `${formatCount(last.numerator)} of ${formatCount(last.denominator)} followable refusals${c ? `, ${formatCount(c.refusals)} refused` : ''}`;
}

export function platformStatusContext(read: StatusRead): SharedContext {
  if (read.state !== 'ok') {
    const { title, detail } = troubleOf(read.state);
    return pendingContext({ ...VIEW, scope: 'real-work tool calls across the platform' }, `${title}. ${detail}`);
  }
  const s = read.status;
  const score = scoreOf(s);
  const last = measureOf(s, 'malformed_per_1000')?.last ?? null;
  const week = last?.window.from ?? null;
  const facts: Fact[] = [];
  const unknowns: string[] = [];
  const insights: Insight[] = [];
  const unavailable = (part: string, reason: string) => unknowns.push(`${part} could not be read (${reason}).`);

  if (s.needs.state === 'unavailable') unknowns.push(`${s.needs.headline}: nothing here says whether anything needs attention.`);
  else facts.push({ label: 'What needs attention', value: s.needs.headline, ...(needsFoot(s.needs) ? { change: needsFoot(s.needs)!.replace(/\.$/, '') } : {}) });
  if (s.needs.state === 'partial') unknowns.push('Some checks did not answer, so more may need attention than is listed.');

  facts.push({ label: 'Scoreboard', value: score.caption });
  for (const row of [...score.directional, ...score.activity]) {
    facts.push(measureFact(row, week, row.key === 'malformed_per_1000' || row.key === 'same_tool_followup_pct' ? countsOf(measureOf(s, row.key)) : null));
  }
  const [, days, failures] = footOf(s);
  facts.push({ label: days.label, value: days.value }, { label: failures.label, value: failures.value });

  if (s.doors.state === 'ok') {
    for (const d of s.doors.data.map(doorRow)) {
      const lastFault = d.faultDays && d.lastFaultDay ? ` (last ${dayIn(d.lastFaultDay)})` : '';
      facts.push({ label: `The ${d.door} door`, value: `${d.faultDays} ${plural(d.faultDays, 'fault day')}${lastFault} in ${d.daysWithCalls} ${plural(d.daysWithCalls, 'day')} with calls`, change: [d.today ? `today ${d.today.replace(' calls so far', ' so far')}` : null, d.run].filter(Boolean).join('; ') });
    }
  } else unavailable('The doors', s.doors.reason);

  const running = runningOf(s);
  if (running.state === 'ok') {
    const [platform, consoleVersion, tagged, before, migrations] = running.items.map((i) => i.value);
    facts.push({ label: 'Running', value: `platform ${platform}, console ${consoleVersion}`, change: `tagged ${tagged}, ${before === 'None recorded' ? 'no release before it recorded' : `after ${before}`}; ${migrations} migrations${running.tagged ? `; ${running.tagged}` : ''}` });
  }
  else if (running.state === 'unrecorded') unknowns.push(UNRECORDED);
  else unavailable('What is running', running.reason);

  const own = ownOf(s);
  if (own.state === 'ok') {
    const tile = (t: OwnTile) => {
      const counts = t.note?.replace(/(, )?week of .+$/, '');
      return `${typeof t.value === 'number' ? valueIn(t.kind, t.value) : t.value}${counts ? ` (${counts})` : ''}`;
    };
    const [m, f, n] = own.tiles;
    facts.push({ label: 'Your team', value: `malformed per 1,000 ${tile(m)}; refusals put right ${tile(f)}; sessions ${tile(n)}`, change: own.bugs.replace(/^Your team's bug reports:/, 'bug reports').replace(/\.$/, '') });
  } else if (own.state === 'none') unknowns.push(NO_TEAM);
  else unavailable('Your team\'s own counts', own.reason);
  if (s.records.state === 'unavailable') unavailable('The days in a row with work', s.records.reason);

  // What needs attention, then the gateway's findings: the first to go when the context is over its budget. A need's
  // page is its evidence only where it names a record (a team's page); Bugs, Usage and Evaluation are the Platform page
  // of the need's kind, which view_bugs, view_usage and view_evaluation read, and their addresses cost every need its room.
  // A member's approvals are one row with no page, the teams counted and never named, and the row says so itself: a line
  // of its own would cost the context the row it explains.
  for (const r of s.needs.rows) {
    const named = r.kind !== 'approvals' || r.href ? '' : ` ${NO_TEAM_NAMED}`;
    insights.push({ text: `${r.title}.${named}`, ...(r.href && r.kind === 'approvals' ? { evidence: r.href } : {}) });
  }
  for (const k of [...DIRECTIONAL, ...ACTIVITY]) {
    const m = measureOf(s, k);
    if (m?.finding) insights.push({ text: `${MEASURES[k].label}: ${m.finding.text}.` });
  }
  unknowns.push(
    'A fault day is tool failures at 1% of a day\'s calls or more: nothing here says whether a door could be reached.',
    'Activity measures are never better or worse; days with work are agents\' calls, not anyone\'s hours. Under 30 is too few to compare; no data is not zero.',
  );
  return budgeted({
    ...VIEW,
    scope: `the platform's real work${last ? `; last whole week: the ${weekOf(last)}` : ''}`,
    freshness: `${asOfLine(s.meta)}.`,
    facts, insights, unknowns,
  });
}
