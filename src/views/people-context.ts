/** The People list's shared context (decision 0011): who the platform knows, their teams, and whether their tokens are live. */
import { teamSlug, type Person } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, whose, type Arrival, type ViewMode } from './context';

/** The filters the People list keeps in its address. */
export type PeopleFilters = { q: string; team: string };

/** The rows the list shows for `f`: the page's own filter. */
export function filterPeople(people: Person[], f: PeopleFilters): Person[] {
  const needle = f.q.trim().toLowerCase();
  return people.filter((p) => (f.team === 'all' || p.teams.some((t) => teamSlug(t) === f.team)) && (!needle || p.email.includes(needle) || p.name.toLowerCase().includes(needle)));
}

export function peopleContext(people: Person[], { filters, mode, ...arrival }: { filters: PeopleFilters; mode: ViewMode } & Arrival): SharedContext {
  const rows = filterPeople(people, filters);
  const narrowed = filters.q !== '' || filters.team !== 'all';
  const supers = rows.filter((p) => p.role === 'superadmin');
  const tokens = rows.reduce((a, p) => a + p.tokens, 0);
  const holders = rows.filter((p) => p.tokens > 0).length;
  const never = rows.filter((p) => !p.last_used);
  const off = rows.filter((p) => p.status !== 'active');
  const insights: Insight[] = [];
  if (supers.length) insights.push({ text: `${plural(supers.length, 'The superadmin is', 'The superadmins are')} ${listed(supers, (p) => p.name || p.email, 'see /people')}.` });
  if (never.length) insights.push({ text: `No platform call is on record for ${listed(never, (p) => p.name || p.email, 'see /people', 10)}.` });
  if (off.length) insights.push({ text: `Deactivated: ${listed(off, (p) => p.name || p.email, 'see /people', 10)}.` });
  if (rows.length) insights.push({ text: `The people listed: ${listed(rows, (p) => `${p.name || p.email} (${p.status !== 'active' ? 'deactivated' : p.role}; ${p.teams.length ? p.teams.join(', ') : 'no team'}; ${p.tokens} ${plural(p.tokens, 'token')}${p.last_used ? `, last used ${formatDate(p.last_used)}` : ''})`, 'search or filter on /people', 15)}.` });
  return budgeted({
    view: 'people',
    title: 'People',
    address: addressOf('/people', filters, { team: 'all' }),
    scope: `${mode === 'platform' ? 'everyone the platform knows' : 'everyone on your team'}${narrowed ? `; filtered to ${[filters.team !== 'all' ? `team ${filters.team}` : '', filters.q ? `matching "${filters.q}"` : ''].filter(Boolean).join(', ')}` : ''}`,
    freshness: arrived(arrival),
    facts: [
      { label: 'People', value: `${formatCount(rows.length)}${narrowed ? ` of ${formatCount(people.length)}` : ''}`, change: `${supers.length} ${plural(supers.length, 'superadmin')}` },
      { label: 'Live tokens', value: formatCount(tokens), change: `held by ${holders} ${plural(holders, 'person', 'people')}`, definition: 'Platform tokens not yet revoked. A token is what a client authenticates with.' },
      { label: 'Never used a token', value: formatCount(never.length), definition: 'People with no platform call on record.' },
      { label: 'Teams', value: formatCount(new Set(rows.flatMap((p) => p.teams.map(teamSlug))).size), definition: `Distinct teams across the people listed, for ${whose(mode)}.` },
    ],
    insights,
    unknowns: ['A token\'s value is never shown: the store keeps a hash. Only its count and when it last worked are known.', ...(rows.length ? [] : [narrowed ? 'Nobody matches these filters.' : 'Nobody has been added yet.'])],
  });
}
