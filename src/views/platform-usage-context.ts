/**
 * Usage's shared context (decision 0011), and the words its cards are drawn with: what the page and the assistant are
 * both told about how real work called the platform, from the one `GET /platform/usage` the console's server read. A
 * superadmin's weeks carry their split by team, a member's none, and nothing else differs.
 *
 * Every figure is the gateway's, and each is an observation with its population named: more calls, sessions or
 * refusals are never said to be better or worse, and a week the gateway could not count is missing, never zero.
 */
import type { Tile, Usage } from '@/lib/fleet-shapes';
import { plural } from '@/lib/format';
import { formatDateTime, formatDay } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { Figure, PeriodFigure, Window } from '@/lib/platform-shapes';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { budgeted, pendingContext } from './context';

/** How long the console's server waits for the read: half a second under five, for a phone to draw what it says. */
export const USAGE_BOUND_MS = 4_500;

/** What the page's one read came back as: the whole response, the gateway's sentence, or no answer within the bound. */
export type UsageRead = { state: 'ok'; usage: Usage } | { state: 'failed'; reason: string } | { state: 'slow' };

/** Why the read is not on the page, in words. */
export function usageTrouble(read: Exclude<UsageRead, { state: 'ok' }>): { title: string; detail: string } {
  if (read.state === 'slow') return { title: 'Usage is unavailable', detail: `The read did not answer within ${USAGE_BOUND_MS / 1000} seconds. Nothing on this page was read.` };
  return { title: 'Usage did not load', detail: `${read.reason.replace(/\.?$/, '.')} Nothing on this page was read.` };
}

type Kind = 'count' | 'ratio' | 'share' | 'ms' | 'seconds';
const ONE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
/** A value in its unit, at the precision the page prints it. */
export const valueIn = (kind: Kind, n: number): string =>
  kind === 'share' ? `${ONE.format(n)}%` : kind === 'ratio' ? ONE.format(n) : kind === 'ms' ? `${WHOLE.format(n)} ms` : kind === 'seconds' ? `${WHOLE.format(n)} s` : formatCount(n);

/** The word a figure with no value reads as: a week the gateway could not count is unavailable, one with nothing in it no data. */
const wordFor = (f: Figure): string | null => (f.value !== null ? null : f.why === 'unavailable' ? 'Unavailable' : 'No data');
/** A figure as a cell prints it: its value, with `too few` beside one under the sample a comparison needs. */
export const figureText = (kind: Kind, f: Figure): string => wordFor(f) ?? `${valueIn(kind, f.value!)}${f.why === 'insufficient' ? ', too few' : ''}`;
/** A share over the count it is of, its caveat after the whole: `87.5% of 16 refused sessions · too few to judge`. */
export const shareOf = (f: Figure, of: number | null, noun: string): string =>
  wordFor(f) ?? `${valueIn('share', f.value!)}${of ? ` of ${formatCount(of)} ${noun}` : ''}${f.why === 'insufficient' ? ' · too few to judge' : ''}`;

/** A week as a person reads it: `week of 5 Oct`. */
export const weekOf = (w: Window): string => `week of ${formatDay(w.from)}`;

/** The tiles, as the page labels them and the assistant is told what each counts. */
export const TILES = {
  calls: { label: 'Calls', kind: 'count', definition: 'Real-work tool calls in the last whole week, refused or answered; maintenance is left out.' },
  refusedShare: { label: 'Share refused', kind: 'share', definition: 'The share of those calls refused, whoever the refusal is put down to.' },
  p95Ms: { label: 'Slowest 5% of calls', kind: 'ms', definition: 'The time 95% of those calls finished within; a call with no duration is left out.' },
  sessions: { label: 'Sessions', kind: 'count', definition: 'Distinct agent sessions that made a real-work call that week.' },
} as const satisfies Record<keyof Extract<Usage['tiles'], { state: 'ok' }>['data'], { label: string; kind: Kind; definition: string }>;
export type TileKey = keyof typeof TILES;
export const TILE_KEYS = Object.keys(TILES) as TileKey[];

/** A tile's change on the week before, as a fraction, or null when either week has no figure to set beside the other. */
export function changeOf(t: Tile): number | null {
  const [last, previous] = [t.last.figure.value, t.previous.figure.value];
  return last === null || previous === null || previous === 0 ? null : (last - previous) / previous;
}

/** The owners of a refusal, and the platform's own maintenance, as the composition of all refusals names them. */
export const REFUSAL_PARTS = [
  { key: 'theirs', label: 'Tool failures', color: 'critical' },
  { key: 'ours', label: 'Malformed calls', color: 'warning' },
  { key: 'guardrail', label: 'A guardrail held', color: 'neutral' },
  { key: 'other', label: 'Other', color: 'neutral-ink' },
  { key: 'maintenance', label: 'Maintenance', color: 'neutral' },
] as const;

/** The parts a superadmin's weeks split into, in the order the first week with parts names them; none for a member. */
export function teamParts(u: Usage): string[] {
  if (u.callsByWeek.state !== 'ok') return [];
  return u.callsByWeek.data.weeks.find((w) => w.parts)?.parts?.map((p) => p.label) ?? [];
}

/** The last whole week the calls by week hold, by its index: the week the cards are about. */
export function lastWhole<T extends { window: Window }>(weeks: T[]): number {
  for (let i = weeks.length - 1; i >= 0; i--) if (weeks[i].window.complete) return i;
  return -1;
}

/** The followed refusals of one week, in words, for the line under the chart and the assistant alike. */
export function followupLine(w: Extract<Usage['followup'], { state: 'ok' }>['data']['weeks'][number]): { label: string; value: string }[] {
  const continued = w.sessionsContinued;
  return [
    { label: 'Put right', value: shareOf(w.putRight.figure, w.putRight.denominator, 'followable') },
    { label: 'Median seconds', value: figureText('seconds', w.medianSeconds) },
    { label: 'Sessions continued', value: shareOf(continued.figure, continued.denominator, 'refused sessions') },
    { label: 'Could not be judged', value: `${formatCount(w.unassessable)} ${plural(w.unassessable, 'refusal')}` },
  ];
}

/** Calls per recorded approval in one week: the ratio, or why there is none, with the counts it is over. */
export function perApprovalText(p: PeriodFigure): string {
  if (p.denominator === 0) return 'No approval recorded';
  const counts = p.numerator !== null && p.denominator !== null ? ` (${formatCount(p.numerator)} calls, ${formatCount(p.denominator)} ${plural(p.denominator, 'approval')})` : '';
  return `${figureText('ratio', p.figure)}${counts}`;
}

/** What the platform's model calls cost: nothing records it. */
export const NOT_RECORDED = 'Not recorded';

/** The question the Ask on the calls by week hands the assistant, about the week pointed at or the last whole week. */
export const askOf = (week: string | null, split: boolean): string => (week
  ? `What made up real work's calls in the week of ${formatDay(week)}${split ? ', by team' : ''}?`
  : `How did real work's calls move week by week${split ? ', and which teams made them' : ''}?`);

/** The read's own cutoff, as the masthead says it. */
export const asOfLine = (u: Usage): string => `As of ${formatDateTime(u.meta.asOf)}`;

const VIEW = { view: 'usage', title: 'Usage', address: '/platform/usage' } as const;

/**
 * The context the page shares and `view_usage` answers with, from the same read. The tiles and the composition of a
 * week are facts; the weeks, the tools and the follow-ups are insights, the first to go when the budget is tight.
 */
export function usageContext(read: UsageRead): SharedContext {
  if (read.state !== 'ok') {
    const { title, detail } = usageTrouble(read);
    return pendingContext({ ...VIEW, scope: 'real-work tool calls across the platform' }, `${title}. ${detail}`);
  }
  const u = read.usage;
  const facts: Fact[] = [];
  const insights: Insight[] = [];
  const unknowns: string[] = [];
  const unavailable = (part: string, reason: string) => unknowns.push(`${part} could not be read (${reason}).`);
  let week: Window | null = null;

  if (u.tiles.state === 'ok') {
    week = u.tiles.data.calls.last.window;
    for (const k of TILE_KEYS) {
      const t = u.tiles.data[k];
      facts.push({ label: TILES[k].label, value: figureText(TILES[k].kind, t.last.figure), change: `the week before ${figureText(TILES[k].kind, t.previous.figure)}`, definition: TILES[k].definition });
    }
  } else unavailable('The tiles', u.tiles.reason);

  if (u.traffic.state === 'ok') {
    const { work, maintenance } = u.traffic.data;
    facts.push({ label: 'The platform\'s own traffic', value: `${formatCount(work)} real work, ${formatCount(maintenance)} maintenance`, change: weekOf(u.traffic.data.window) });
  } else unavailable('The platform\'s own traffic', u.traffic.reason);
  if (u.refusals.state === 'ok') {
    const r = u.refusals.data;
    facts.push({ label: 'All refusals by population', value: REFUSAL_PARTS.map((p) => `${formatCount(r[p.key])} ${p.label.toLowerCase()}`).join(', '), change: weekOf(r.window) });
  } else unavailable('All refusals by population', u.refusals.reason);
  if (u.perApproval.state === 'ok') {
    facts.push({ label: 'Calls per recorded approval', value: perApprovalText(u.perApproval.data.last), change: `the week before ${perApprovalText(u.perApproval.data.previous)}` });
  } else unavailable('Calls per recorded approval', u.perApproval.reason);
  if (u.modelCalls.state === 'ok') {
    const { last, previous, byPurpose } = u.modelCalls.data;
    facts.push({
      label: 'The platform\'s model calls', value: `${formatCount(last.calls)}, ${formatCount(last.failed)} failed, cost ${NOT_RECORDED.toLowerCase()}`,
      change: `the week before ${formatCount(previous.calls)}; by purpose ${byPurpose.map((p) => `${p.purpose} ${formatCount(p.calls)}`).join(', ') || 'none'}`,
    });
  } else unavailable('The platform\'s model calls', u.modelCalls.reason);

  if (u.callsByWeek.state === 'ok') {
    const parts = teamParts(u);
    // A part with no calls that week is left unsaid, so the split fits beside the rest.
    const split = (w: (typeof u.callsByWeek.data.weeks)[number]) => (w.parts ?? []).filter((p) => p.calls > 0).map((p) => `${p.label} ${formatCount(p.calls)}`).join(', ');
    const said = (w: (typeof u.callsByWeek.data.weeks)[number]) => `${formatDay(w.window.from)} ${figureText('count', w.calls)}${split(w) ? ` (${split(w)})` : ''}${w.window.complete ? '' : ', so far'}`;
    insights.push({ text: `Calls by week, oldest first${parts.length ? ', by team, the three with the most calls and Other' : ''}: ${u.callsByWeek.data.weeks.map(said).join('; ')}.` });
  } else unavailable('The calls by week', u.callsByWeek.reason);
  if (u.followup.state === 'ok') {
    const weeks = u.followup.data.weeks;
    const at = lastWhole(weeks);
    if (at >= 0) insights.push({ text: `Refusals followed in the ${weekOf(weeks[at].window)}: ${followupLine(weeks[at]).map((l) => `${l.label.toLowerCase()} ${l.value}`).join('; ')}.` });
    insights.push({ text: `Refusals put right by week: ${weeks.map((w) => `${formatDay(w.window.from)} ${figureText('share', w.putRight.figure)}`).join('; ')}.` });
  } else unavailable('The refusals put right', u.followup.reason);
  if (u.tools.state === 'ok') {
    const line = (r: (typeof u.tools.data.rows)[number]) => `${r.tool} ${figureText('ms', r.first.medianMs)} (${formatDay(r.first.window.from)}) to ${figureText('ms', r.last.medianMs)}`;
    insights.push({ text: `Each tool's median call, first comparable week to last: ${listed(u.tools.data.rows, line, 'the table on /platform/usage', 6)}.` });
  } else unavailable('Each tool\'s median call', u.tools.reason);
  if (u.mostUsed.state === 'ok') {
    insights.push({ text: `Tools called most last week: ${listed(u.mostUsed.data.rows, (t) => `${t.tool} ${formatCount(t.calls)}`, 'the list on /platform/usage', 8)}.` });
  } else unavailable('The tools called most', u.mostUsed.reason);
  if (u.rhythm.state !== 'ok') unavailable('The weekday by hour', u.rhythm.reason);

  unknowns.push(
    'These are observations: more calls, sessions or refusals are not better or worse, and a week with no figure is missing, not zero.',
    `Refusals that could not be judged (no session, or still inside the 120 seconds) are counted apart. Weekday and hour are in ${u.meta.timezone}.`,
  );
  if (!teamParts(u).length) unknowns.push('No team is named here: these weeks carry no split by team.');
  return budgeted({
    ...VIEW,
    scope: `real-work tool calls across the platform${week ? `; last whole week: the ${weekOf(week)}` : ''}`,
    freshness: `${asOfLine(u)}.`,
    facts, insights, unknowns,
  });
}
