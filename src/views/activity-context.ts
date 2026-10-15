/**
 * The Activity page's shared context (decision 0011): what the page and the assistant are both told about the active
 * team's real work, from the `ActivitySummary` the gateway answered and, on the page, the one page of the log it shows.
 * Every refusal is counted once, under one of its four owners, and its message is the team's own as the platform stored
 * it. The log, its filters and its page are read at one address, built here, which the page and the `activity`
 * collection both ask for.
 */
import type { ActivityLog, ActivitySummary, RefusalOwner } from '@/lib/destination-shapes';
import { formatCount } from '@/lib/format-units';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { listed, type Fact, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, clip, type Arrival } from './context';

/** How each owner reads: a guardrail that held, a call made wrong, a tool that failed, and the rest. */
export const OWNER_LABEL: Record<RefusalOwner, string> = { guardrail: 'A guardrail held', ours: 'Malformed call', theirs: 'Tool failure', other: 'Other' };
const OWNERS: RefusalOwner[] = ['guardrail', 'ours', 'theirs', 'other'];

/** The rows one page of the log holds. */
export const PAGE_SIZE = 10;

/** The filters the log keeps in its address; `all` is no filter, and `refused` is `true` for refused calls alone. */
type ActivityFilters = { kind: string; tool: string; initiative: string; refused: string };
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

/** The owners in a count, briefly: `3 guardrail, 1 tool failure`. */
const SHORT: Record<RefusalOwner, string> = { guardrail: 'guardrail', ours: 'malformed', theirs: 'tool failure', other: 'other' };
const owners = (o: Record<RefusalOwner, number>) => OWNERS.filter((k) => o[k]).map((k) => `${o[k]} ${SHORT[k]}`).join(', ') || 'none';

export function activityContext({ summary, log, filters = NO_FILTER, page = 1, ...arrival }: { summary: ActivitySummary; log?: ActivityLog; filters?: ActivityFilters; page?: number } & Arrival): SharedContext {
  const { calls, refused, mostRefused } = summary.tiles;
  const insights: Insight[] = [];
  const groups = summary.groups.state === 'ok' ? summary.groups.data : null;
  if (groups?.rows.length) {
    insights.push({ text: `The team's refusals grouped by owner, tool and message, most first (${formatCount(groups.groups)} groups): ${listed(groups.rows, (g) => `${OWNER_LABEL[g.owner]} on ${g.tool}, "${clip(g.message ?? 'No message recorded', 100)}" ${g.count}×, last ${formatDate(g.lastSeen)}`, 'see /activity', 5)}.`, evidence: '/activity?refused=true' });
  }
  const weeks = summary.weeks.state === 'ok' ? summary.weeks.data : [];
  if (weeks.length) insights.push({ text: `Refused by week, oldest first: ${weeks.map((w) => `${formatDate(w.window.from)} ${w.refused} of ${w.calls} calls${w.refused ? ` (${owners(w.owners)})` : ''}${w.complete ? '' : ', running'}`).join('; ')}.` });
  if (summary.maintenance.calls) insights.push({ text: `The platform's own maintenance made ${formatCount(summary.maintenance.calls)} calls, ${formatCount(summary.maintenance.refused)} refused; they are left out of every figure here.` });
  if (log?.rows.length) {
    const first = (page - 1) * PAGE_SIZE;
    insights.push({
      text: `Events ${first + 1} to ${first + log.rows.length} of ${log.total}, newest first: ${listed(log.rows, (e) => `${formatDateTime(e.ts)} ${e.kind}${e.tool ? ` ${e.tool}` : ''}${e.ok === false ? ` REFUSED (${SHORT[e.owner ?? 'other']})` : ''}`, 'page or filter on /activity', 5)}.`,
      evidence: addressOf('/activity', { ...filters, page: String(page) }, { ...NO_FILTER, page: '1' }),
    });
  }
  const said = [filters.kind !== 'all' ? `kind ${filters.kind}` : '', filters.tool !== 'all' ? `tool ${filters.tool}` : '', filters.initiative !== 'all' ? `initiative ${filters.initiative}` : '', filters.refused === 'true' ? 'refused calls only' : ''].filter(Boolean);
  const facts: Fact[] = [
    { label: 'Calls last week', value: formatCount(calls.figure.value), definition: 'Real-work tool calls in the last whole week, refused or not.' },
    { label: 'Refused last week', value: formatCount(refused.figure.value), change: owners(refused.owners), definition: 'Each refusal counted once, under one owner: a guardrail held, a malformed call, a tool failure or other. The four sum to the total.' },
    { label: 'Most refused', value: mostRefused ? `${mostRefused.tool}, ${mostRefused.count} of ${mostRefused.of}` : 'nothing refused', definition: 'The tool refused most in the last whole week, of every refusal that week.' },
    ...(log ? [{ label: 'Events', value: formatCount(log.total), definition: narrowed(filters) ? 'All that these filters match, up to the latest 500.' : 'The team\'s real-work events, up to the latest 500.' }] : []),
  ];
  return budgeted({
    view: 'activity',
    title: 'Activity',
    address: addressOf('/activity', { ...filters, page: String(page) }, { ...NO_FILTER, page: '1' }),
    scope: `your active team's real work by week, last week ${formatDate(calls.window.from)} to ${formatDate(calls.window.to)}${said.length ? `; the events filtered to ${said.join(', ')}` : ''}`,
    freshness: arrived(arrival),
    facts,
    insights,
    unknowns: [
      'Activity is your active team\'s real work: page views and the platform\'s own maintenance are left out.',
      'A refusal\'s message is your team\'s own, as the platform stored it with quoted text, addresses and numbers taken out.',
      ...(summary.groups.state === 'ok' ? [] : ['The refusals could not be grouped; the counts stand.']),
      ...(log && log.total >= log.ceiling ? [`Only the latest ${log.ceiling} events that match are read, so an older one is not in the log.`] : []),
      ...(log && !log.rows.length ? [narrowed(filters) ? 'No event matches these filters.' : 'Nothing has been recorded yet.'] : []),
    ],
  });
}
