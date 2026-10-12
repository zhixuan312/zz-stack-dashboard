/** The Teams list's shared context (decision 0011): what the page and the assistant are both told about every team and what it holds. */
import type { Team } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { largest } from '@/lib/insight';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, shareOf, type Arrival } from './context';

/** The filters the Teams list keeps in its address. */
type TeamsFilters = { q: string; status: string };

/** The rows the list shows for `f`: the page's own filter, so the page and the context cannot disagree. */
export function filterTeams(teams: Team[], f: TeamsFilters): Team[] {
  const needle = f.q.trim().toLowerCase();
  return teams.filter((t) => (f.status === 'all' || t.status === f.status) && (!needle || t.slug.includes(needle) || t.name.toLowerCase().includes(needle)));
}

export function teamsContext(teams: Team[], { filters, ...arrival }: { filters: TeamsFilters } & Arrival): SharedContext {
  const rows = filterTeams(teams, filters);
  const active = teams.filter((t) => t.status === 'active').length;
  const sum = (pick: (t: Team) => number) => rows.reduce((a, t) => a + pick(t), 0);
  const narrowed = filters.q !== '' || filters.status !== 'all';
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
    scope: narrowed ? `${rows.length} of ${teams.length} teams, ${[filters.status !== 'all' ? `status ${filters.status}` : '', filters.q ? `matching "${filters.q}"` : ''].filter(Boolean).join(', ')}` : 'every team on the platform',
    freshness: arrived(arrival),
    facts: [
      { label: 'Teams', value: `${formatCount(rows.length)}${narrowed ? ` of ${formatCount(teams.length)}` : ''}`, definition: `${active} of the ${teams.length} are active; the rest are archived and kept readable.` },
      { label: 'Initiatives', value: formatCount(sum((t) => t.initiatives)), definition: 'Pieces of work the listed teams have opened, open or closed.' },
      { label: 'Documents', value: formatCount(sum((t) => t.documents)), definition: 'Written documents in the listed teams. Sources are counted apart.' },
      { label: 'Knowledge', value: `${formatCount(sum((t) => t.knowledge))} ${plural(sum((t) => t.knowledge), 'node')}`, definition: 'Knowledge nodes on the listed teams\' shelves.' },
    ],
    insights,
    unknowns: [
      'People is counted per team, so someone in two teams is counted in both and the column does not sum to the number of people.',
      ...(rows.length ? [] : [narrowed ? 'No team matches these filters.' : 'No team exists yet; a superadmin creates the first one on the Settings page.']),
    ],
  });
}
