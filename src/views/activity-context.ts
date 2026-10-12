/** The Activity page's shared context (decision 0011): the latest events the platform recorded, newest first. */
import type { ActivityEvent } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDateTime } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, shareOf, whose, type Arrival, type ViewMode } from './context';

/** The most of anything named in a tally. */
const TOP = 5;

function tally<T>(items: T[], key: (t: T) => string | null): [string, number][] {
  const counts = new Map<string, number>();
  for (const i of items) { const k = key(i); if (k) counts.set(k, (counts.get(k) ?? 0) + 1); }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, TOP);
}

export function activityContext(events: ActivityEvent[], { show, limit, mode, ...arrival }: { show: string; limit: number; mode: ViewMode } & Arrival): SharedContext {
  const refused = events.filter((e) => e.ok === false);
  const insights: Insight[] = [];
  const span = events.length ? `from ${formatDateTime(events.at(-1)!.ts)} to ${formatDateTime(events[0].ts)}` : '';
  const kinds = tally(events, (e) => e.kind);
  if (kinds.length) insights.push({ text: `By kind: ${kinds.map(([k, n]) => `${k} ${n}`).join(', ')}.` });
  const actors = tally(events, (e) => e.actor);
  if (actors.length) insights.push({ text: `By actor: ${actors.map(([a, n]) => `${a.split('@')[0]} ${n}`).join(', ')}.` });
  if (refused.length) {
    const messages = tally(refused, (e) => e.refusal);
    const subjects = tally(refused, (e) => e.subject);
    insights.push({ text: `${formatCount(refused.length)} of these ${formatCount(events.length)} events were refused (${shareOf(refused.length, events.length)})${subjects.length ? `, most on ${subjects.map(([s, n]) => `${s} ${n}`).join(', ')}` : ''}.`, evidence: '/activity?show=failed' });
    if (messages.length) insights.push({ text: `The commonest refusals: ${messages.map(([m, n]) => `"${m}" ${n} ${plural(n, 'time')}`).join('; ')}.` });
  }
  if (events.length) insights.push({ text: `The newest: ${listed(events, (e) => `${formatDateTime(e.ts)} ${e.kind}${e.subject ? ` ${e.subject}` : ''}${e.actor ? ` by ${e.actor.split('@')[0]}` : ''}${e.team ? ` (${e.team})` : ''}${e.ok === false ? ' REFUSED' : ''}`, 'see /activity', 8)}.` });
  return budgeted({
    view: 'activity',
    title: 'Activity',
    address: addressOf('/activity', { show }, { show: 'all' }),
    scope: `the latest ${limit} ${show === 'failed' ? 'refusals' : 'events'} recorded for ${whose(mode)}, newest first${span ? `, ${span}` : ''}`,
    freshness: arrived(arrival),
    facts: [
      { label: show === 'failed' ? 'Refusals shown' : 'Events shown', value: formatCount(events.length), definition: `Every tool call, gate and admin act. The page shows at most the latest ${limit}.` },
      { label: 'Refused', value: formatCount(refused.length), definition: 'Calls a platform door refused rather than answered.' },
    ],
    insights,
    unknowns: [
      ...(events.length >= limit ? [`Only the latest ${limit} are here, so every count on this page is a count of those, never of all time. The Overview has the totals for a period.`] : []),
      'An event with no team is not missing data: no team was involved, as when a person issues a token.',
      ...(events.length ? [] : ['Nothing has been recorded yet.']),
    ],
  });
}
