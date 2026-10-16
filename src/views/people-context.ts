/** The People list's shared context (decision 0011): who the platform knows, their teams, and whether their tokens are live. */
import { teamSlug, type Person } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import { formatDate } from '@/lib/format-date';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, whose, type Arrival, type ViewMode } from './context';
import { filterPeople, type PeopleFilters } from './people-filter';

export function peopleContext(people: Person[], total: number, { filters, mode, ...arrival }: { filters: PeopleFilters; mode: ViewMode } & Arrival): SharedContext {
  const rows = filterPeople(people, filters);
  const narrowed = filters.q !== '' || filters.team !== 'all';
  // The read takes the most one page the gateway answers (`?limit=100`), so `people` is a page of `total` and not the
  // population. Every count here is over that page, and the assistant is told which page it was told about — the
  // console's whole contract with it is that it quotes the figures the screen shows, and the screen says so.
  const capped = people.length < total;
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
      { label: 'People', value: formatCount(total), change: `${supers.length} ${plural(supers.length, 'superadmin')}${capped ? ` among the first ${formatCount(people.length)} read` : ''}`, definition: capped ? `Everybody the platform knows. This read takes the first ${formatCount(people.length)}; every other count here is over those.` : 'Everybody the platform knows.' },
      { label: 'Live tokens', value: formatCount(tokens), change: `held by ${holders} ${plural(holders, 'person', 'people')}`, definition: 'Platform tokens not yet revoked. A token is what a client authenticates with.' },
      { label: 'Never used a token', value: formatCount(never.length), definition: 'People with no platform call on record.' },
      { label: 'Teams', value: formatCount(new Set(rows.flatMap((p) => p.teams.map(teamSlug))).size), definition: `Distinct teams across the people listed, for ${whose(mode)}.` },
    ],
    insights,
    unknowns: [`A token's value is never shown: the store keeps a hash. Only its count and when it last worked are known.`, ...(capped ? [`The list is a page of ${formatCount(total)}: the first ${formatCount(people.length)} were read, so a fact about a person past them is not in this context.`] : []), ...(rows.length ? [] : [narrowed ? 'Nobody matches these filters.' : 'Nobody has been added yet.'])],
  });
}
