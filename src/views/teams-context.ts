/** The Teams list's shared context (decision 0011): what the page and the assistant are both told about every team and what it holds. */
import type { Team } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, shareOf, type Arrival } from './context';
import { filterTeams, type TeamsFilters } from './teams-filter';

/** The part that contributes most to a total, and its share of it. `null` for an empty or zero total. Meridian's own
 *  until 0.16.0 removed it from `src/lib/insight.ts`; written here from its 0.15.0 source. */
function largest<T>(items: T[], value: (t: T) => number): { item: T; share: number } | null {
  const total = items.reduce((s, t) => s + value(t), 0);
  if (!items.length || !(total > 0)) return null;
  const item = items.reduce((m, t) => (value(t) > value(m) ? t : m));
  return { item, share: value(item) / total };
}

export function teamsContext(teams: Team[], total: number, { filters, ...arrival }: { filters: TeamsFilters } & Arrival): SharedContext {
  const rows = filterTeams(teams, filters);
  const active = teams.filter((t) => t.status === 'active').length;
  const sum = (pick: (t: Team) => number) => rows.reduce((a, t) => a + pick(t), 0);
  const narrowed = filters.q !== '' || filters.status !== 'all';
  // The read takes the most one page the gateway answers (`?limit=100`), so `teams` is a page of `total`. The search
  // and the status filter run in the browser over that page, so past the cap they narrow a part of the platform and
  // say nothing about the rest — which is what the page says too, and what the assistant has to be told to say.
  const capped = teams.length < total;
  const insights: Insight[] = [];
  const busiest = largest(rows, (t) => t.initiatives);
  if (busiest && busiest.item.initiatives) insights.push({ text: `${busiest.item.slug} runs the most work: ${formatCount(busiest.item.initiatives)} of the ${formatCount(sum((t) => t.initiatives))} initiatives listed (${shareOf(busiest.item.initiatives, sum((t) => t.initiatives))}).`, evidence: `/teams/${busiest.item.slug}` });
  const idle = rows.filter((t) => t.status === 'active' && !t.initiatives);
  if (idle.length) insights.push({ text: `${idle.length} active ${plural(idle.length, 'team')} ${idle.length === 1 ? 'has' : 'have'} started no initiative: ${listed(idle, (t) => t.slug, 'see /teams')}.` });
  if (rows.length) insights.push({ text: `The teams listed: ${listed(rows, (t) => `${t.slug} (${t.status}, ${t.members} ${plural(t.members, 'person', 'people')}, ${t.initiatives} ${plural(t.initiatives, 'initiative')}, ${t.knowledge} knowledge ${plural(t.knowledge, 'node')})`, 'filter or search on /teams')}.` });
  return budgeted({
    view: 'teams',
    title: 'Teams',
    address: addressOf('/teams', { q: filters.q, status: filters.status }, { status: 'all' }),
    scope: narrowed ? `${rows.length} of ${teams.length} teams, ${[filters.status !== 'all' ? `status ${filters.status}` : '', filters.q ? `matching "${filters.q}"` : ''].filter(Boolean).join(', ')}` : capped ? `the first ${formatCount(teams.length)} of ${formatCount(total)} teams on the platform` : 'every team on the platform',
    freshness: arrived(arrival),
    facts: [
      { label: 'Teams', value: formatCount(total), definition: `${active} of the ${formatCount(teams.length)} read are active; the rest are archived and kept readable.${capped ? ` This read takes the first ${formatCount(teams.length)} of ${formatCount(total)}, and every other count here is over those.` : ''}` },
      { label: 'Initiatives', value: formatCount(sum((t) => t.initiatives)), definition: 'Pieces of work the listed teams have opened, open or closed.' },
      { label: 'Documents', value: formatCount(sum((t) => t.documents)), definition: 'Written documents in the listed teams. Sources are counted apart.' },
      { label: 'Knowledge', value: `${formatCount(sum((t) => t.knowledge))} ${plural(sum((t) => t.knowledge), 'node')}`, definition: 'Knowledge nodes on the listed teams\' shelves.' },
    ],
    insights,
    unknowns: [
      'People is counted per team, so someone in two teams is counted in both and the column does not sum to the number of people.',
      ...(capped ? [`The list is a page of ${formatCount(total)} teams: the first ${formatCount(teams.length)} were read, so a fact about a team past them is not in this context.`] : []),
      ...(rows.length ? [] : [narrowed ? 'No team matches these filters.' : 'No team exists yet; a superadmin creates the first one on the Settings page.']),
    ],
  });
}
