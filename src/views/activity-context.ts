/**
 * The Activity page's shared context (decision 0011), and the words its cards are drawn with: what the page and the
 * assistant are both told about the active team's real work, from the `ActivitySummary` the console's server read and,
 * on the page, the one page of the log the browser read. Every refusal is counted once, under one of its four owners,
 * and its message is the team's own as the platform stored it. The log, its filters and its page are read at one
 * address, built here, which the page and `view_activity` both ask for.
 *
 * Nothing here counts an owner or filters a row: the owners, the weeks, the groups and the log are the gateway's.
 */
import type { ColumnPart } from '@/components/charts/column-chart';
import type { ActivityLog, ActivitySummary, RefusalGroup, RefusalOwner } from '@/lib/destination-shapes';
import { formatCount } from '@/lib/format-units';
import { formatDate, formatDateTime, formatDay } from '@/lib/format-date';
import type { PeriodFigure, Window } from '@/lib/platform-shapes';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, clip, type Arrival } from './context';

/** How each owner reads: a guardrail that held, a call made wrong, a tool that failed, and the rest. */
export const OWNER_LABEL: Record<RefusalOwner, string> = { guardrail: 'A guardrail held', ours: 'Malformed call', theirs: 'Tool failure', other: 'Other' };
const OWNERS: RefusalOwner[] = ['guardrail', 'ours', 'theirs', 'other'];

/**
 * The four owners as the refusals chart stacks them, the first at the bottom: the platform's own failures critical, a
 * malformed call a warning, and a guardrail that held and the rest neutral, each named. Four parts, so none is folded.
 */
export const REFUSAL_PARTS: (ColumnPart & { key: RefusalOwner })[] = [
  { key: 'theirs', label: OWNER_LABEL.theirs, tone: 'critical' },
  { key: 'ours', label: OWNER_LABEL.ours, tone: 'warning' },
  { key: 'guardrail', label: OWNER_LABEL.guardrail, tone: 'neutral' },
  { key: 'other', label: OWNER_LABEL.other, tone: 'neutral' },
];

/** The rows one page of the log holds, and one page of the refusal groups. */
export const PAGE_SIZE = 10;

/** How long the console's server waits for the summary: half a second under five, for a phone to draw what it says. */
export const ACTIVITY_BOUND_MS = 4_500;

/** The summary as the console's server read it: the gateway's answer and when it came, its sentence, or no answer in time. */
export type ActivityRead =
  | { state: 'ok'; data: ActivitySummary; at: string }
  | { state: 'failed'; reason: string }
  | { state: 'slow' };

/** Why the summary is not on the page, in words: the gateway's sentence, or the bound it missed. */
export const activityTrouble = (read: Exclude<ActivityRead, { state: 'ok' }>): string =>
  (read.state === 'slow' ? `It did not answer within ${ACTIVITY_BOUND_MS / 1000} seconds.` : read.reason);

/** The filters the log keeps in its address; `all` is no filter, and `refused` is `true` or `false` when it is one. */
export type ActivityFilters = { kind: string; tool: string; initiative: string; refused: string };
export const NO_FILTER: ActivityFilters = { kind: 'all', tool: 'all', initiative: 'all', refused: 'all' };

/** The gateway address of the log for `f`, `limit` events from `offset`: one page of 10 from the first unless asked. */
export function activityPath(f: ActivityFilters, { limit = PAGE_SIZE, offset = 0 }: { limit?: number; offset?: number } = {}): string {
  const p = new URLSearchParams();
  for (const k of ['kind', 'tool', 'initiative', 'refused'] as const) if (f[k] !== 'all') p.set(k, f[k]);
  p.set('limit', String(limit));
  p.set('offset', String(offset));
  return `/activity?${p}`;
}

/** Whether any filter narrows the log. */
export const narrowed = (f: ActivityFilters) => Object.values(f).some((v) => v !== 'all');

/** The owners in a count, briefly, those with none left out: `3 guardrail, 1 tool failure`. */
const SHORT: Record<RefusalOwner, string> = { guardrail: 'guardrail', ours: 'malformed', theirs: 'tool failure', other: 'other' };
const owners = (o: Record<RefusalOwner, number>) => OWNERS.filter((k) => o[k]).map((k) => `${o[k]} ${SHORT[k]}`).join(', ') || 'none';
/** All four owners of a count, none left out, as the refused tile says them: `4 guardrail, 2 malformed, 0 tool failure, 1 other`. */
export const fourOwners = (o: Record<RefusalOwner, number>) => OWNERS.map((k) => `${formatCount(o[k])} ${SHORT[k]}`).join(', ');

/** A week as a person reads it: `week of 5 Oct`. */
export const weekOf = (w: Window): string => `week of ${formatDay(w.from)}`;

/** A week's figure as it reads: its count, or `unavailable` when the gateway could not read it. */
const figure = (f: PeriodFigure) => (f.figure.value === null ? 'unavailable' : formatCount(f.figure.value));

/** The tiles, as the page labels them and the assistant is told what each counts. */
export const TILES = {
  calls: { label: 'Calls last week', definition: 'Real-work tool calls in the last whole week, refused or not; page views and the platform\'s own maintenance are left out.' },
  refused: { label: 'Refused last week', definition: 'Each refusal counted once, under one owner: a guardrail held, a malformed call, a tool failure or other. The four sum to the total.' },
  mostRefused: { label: 'Most refused', definition: 'The tool refused most in the last whole week, of every refusal that week.' },
} as const;

/** One group as the assistant is told it, the message the team's own: `A guardrail held on core:document_approve, "…" 5×`. */
const groupLine = (g: RefusalGroup) => `${OWNER_LABEL[g.owner]} on ${g.tool}, "${clip(g.message ?? 'No message recorded', 100)}" ${g.count}×, last ${formatDate(g.lastSeen)}`;

/** The groups the table shows on its page `page`, in the gateway's order, most first. */
function groupsOn(summary: ActivitySummary, page: number): RefusalGroup[] {
  if (summary.groups.state !== 'ok') return [];
  return summary.groups.data.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

/** The filters in words, for the scope line: `kind tool_call, refused calls only`. */
function saidOf(f: ActivityFilters): string[] {
  return [
    f.kind !== 'all' ? `kind ${f.kind}` : '',
    f.tool !== 'all' ? `tool ${f.tool}` : '',
    f.initiative !== 'all' ? `initiative ${f.initiative}` : '',
    f.refused === 'true' ? 'refused calls only' : f.refused === 'false' ? 'calls not refused and other events' : '',
  ].filter(Boolean);
}

/**
 * `index` is the week the refusals chart's cursor rests on, or none: it is part of what the page shows, so "why this
 * week?" has a referent. `groupsPage` is the page of the groups table in view. `read` is how `view_activity` read the
 * log, by the route's `limit` and `offset`, when it did: rows off the page's grid of ten are said to be so.
 */
export function activityContext({ summary, log, filters = NO_FILTER, page = 1, index = null, groupsPage = 1, read, ...arrival }: {
  summary: ActivitySummary; log?: ActivityLog; filters?: ActivityFilters; page?: number; index?: number | null; groupsPage?: number;
  read?: { limit: number; offset: number };
} & Arrival): SharedContext {
  const { calls, refused, mostRefused } = summary.tiles;
  const insights: Insight[] = [];
  const unknowns: string[] = [];
  const address = addressOf('/activity', { ...filters, page: String(page) }, { ...NO_FILTER, page: '1' });

  const weeks = summary.weeks.state === 'ok' ? summary.weeks.data : null;
  const pointed = index !== null && weeks?.[index] ? weeks[index] : null;
  const focus = pointed
    ? `the ${weekOf(pointed.window)}${pointed.complete ? '' : ', so far'}: ${formatCount(pointed.calls)} calls, ${formatCount(pointed.refused)} refused (${fourOwners(pointed.owners)})`
    : undefined;

  if (summary.groups.state === 'ok' && summary.groups.data.rows.length) {
    const { rows, groups, rest } = summary.groups.data;
    const shown = groupsOn(summary, groupsPage);
    const first = (groupsPage - 1) * PAGE_SIZE;
    insights.push({
      text: `The team's refusals grouped by owner, tool and message, most first, groups ${first + 1} to ${first + shown.length} of ${formatCount(groups)} in view: ${listed(shown, groupLine, 'see /activity', 5)}.`
        + (rest ? ` The ${formatCount(rest.groups)} smallest groups, ${formatCount(rest.count)} refusals, are counted together and not listed.` : '')
        + (rows.length > first + shown.length ? ` ${formatCount(rows.length - first - shown.length)} more groups are on the table's later pages.` : ''),
      evidence: '/activity?refused=true',
    });
  }
  if (weeks?.length) insights.push({ text: `Refused by week, oldest first: ${weeks.map((w) => `${formatDate(w.window.from)} ${w.refused} of ${w.calls} calls${w.refused ? ` (${owners(w.owners)})` : ''}${w.complete ? '' : ', running'}`).join('; ')}.` });
  if (summary.maintenance.calls) insights.push({ text: `The platform's own maintenance made ${formatCount(summary.maintenance.calls)} calls, ${formatCount(summary.maintenance.refused)} refused; they are left out of every figure here.` });
  if (log?.rows.length) {
    const first = read ? read.offset : (page - 1) * PAGE_SIZE;
    insights.push({
      text: `Events ${first + 1} to ${first + log.rows.length} of ${log.total}, newest first: ${listed(log.rows, (e) => `${formatDateTime(e.ts)} ${e.kind}${e.tool ? ` ${e.tool}` : ''}${e.ok === false ? ` REFUSED (${SHORT[e.owner ?? 'other']})` : ''}`, 'page or filter on /activity', 5)}.`,
      evidence: address,
    });
    if (read && (read.limit !== PAGE_SIZE || read.offset % PAGE_SIZE)) unknowns.push(`The page lists the events ten a page, so ${address} does not show exactly these ${formatCount(log.rows.length)}.`);
  }

  const said = saidOf(filters);
  const facts: Fact[] = [
    { label: TILES.calls.label, value: figure(calls), definition: TILES.calls.definition },
    { label: TILES.refused.label, value: figure(refused), change: owners(refused.owners), definition: TILES.refused.definition },
    { label: TILES.mostRefused.label, value: mostRefused ? `${mostRefused.tool}, ${mostRefused.count} of ${mostRefused.of}` : 'nothing refused', definition: TILES.mostRefused.definition },
    ...(log ? [{ label: 'Events', value: formatCount(log.total), definition: narrowed(filters) ? 'All that these filters match, up to the latest 500.' : 'The team\'s real-work events, up to the latest 500.' }] : []),
  ];
  return budgeted({
    view: 'activity',
    title: 'Activity',
    address,
    scope: `your active team's real work by week, last week ${formatDate(calls.window.from)} to ${formatDate(calls.window.to)}${said.length ? `; the events filtered to ${said.join(', ')}` : ''}`,
    freshness: arrived(arrival),
    focus,
    facts,
    insights,
    unknowns: [
      'Activity is your active team\'s real work: page views and the platform\'s own maintenance are left out.',
      'A refusal\'s message is your team\'s own, as the platform stored it with quoted text, addresses and numbers taken out.',
      ...(calls.figure.value === null ? ['Last week\'s calls and refusals could not be read; nothing is said about them.'] : []),
      ...(weeks ? [] : ['The refusals by week could not be read; the tiles stand.']),
      ...(summary.groups.state === 'ok' ? [] : ['The refusals could not be grouped; the counts stand.']),
      ...unknowns,
      ...(log && log.total >= log.ceiling ? [`Only the latest ${log.ceiling} events that match are read, so an older one is not in the log.`] : []),
      ...(log && !log.rows.length ? [narrowed(filters) ? 'No event matches these filters.' : 'Nothing has been recorded yet.'] : []),
    ],
  });
}
