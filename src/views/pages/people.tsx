'use client';

import { useMemo } from 'react';
import { KeyRound, UserRound, UserX, Users } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { DataTable, useQueryState, useSearchDraft, type Column } from '@/components/patterns/data-table';
import { AskAbout } from '@/components/patterns/ask-about';
import { FilterBar } from '@/components/patterns/filter-bar';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { facet } from '@/console/facets';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import { plural } from '@/lib/format';
import { teamSlug, type Person } from '@/lib/api-shapes';
import { formatDate } from '@/lib/format-date';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { peopleContext } from '@/views/people-context';
import { filterPeople } from '@/views/people-filter';

const COLUMNS: Column<Person>[] = aligned([
  {
    key: 'person', header: 'Person', grow: true, truncate: true, mobile: 'title', sortValue: (p) => p.name || p.email,
    cell: (p) => (
      <span className="flex min-w-0 items-center gap-3">
        <Avatar name={p.name || p.email} size="sm" />
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink" title={p.name || p.email}>{p.name || p.email}</span>
          {p.name ? <span className="t-caption block truncate" title={p.email}>{p.email}</span> : null}
        </span>
      </span>
    ),
    mobileCell: (p) => p.name || p.email,
  },
  // A superadmin is the exception worth seeing; a member is the normal case and stays quiet. Deactivated says so.
  {
    key: 'role', header: 'Role', mobile: 'status', sortValue: (p) => p.role,
    cell: (p) => (p.status !== 'active' ? <Badge tone="warning" dot>Deactivated</Badge> : <Badge tone={p.role === 'superadmin' ? 'accent' : 'neutral'}>{p.role === 'superadmin' ? 'Superadmin' : 'Member'}</Badge>),
  },
  { key: 'teams', header: 'Teams', hideBelow: 'lg', cell: (p) => (p.teams.length ? p.teams.map(teamSlug).join(', ') : <span className="text-ink-3">None</span>) },
  // Never the tokens themselves: the store keeps a hash. This says whether one is live and when it last worked.
  { key: 'tokens', header: 'Tokens', numeric: true, hideBelow: 'md', mobile: 'fact', sortValue: (p) => p.tokens, cell: (p) => p.tokens || '—', mobileCell: (p) => `${p.tokens} ${plural(p.tokens, 'token')}` },
  { key: 'used', header: 'Last used', hideBelow: 'md', mobile: 'fact', sortValue: (p) => p.last_used ?? '', cell: (p) => <When at={p.last_used} />, mobileCell: (p) => (p.last_used ? <>Used <When at={p.last_used} /></> : 'Never used') },
  { key: 'created', header: 'Joined', numeric: true, hideBelow: 'xl', sortValue: (p) => p.created, cell: (p) => formatDate(p.created) },
]);

/** Everyone the platform knows, the teams they belong to, and whether their tokens are live. */
export function PeopleView() {
  useLive(['people']);
  const { mode } = useConsoleMode();
  // The read pages at 10 by default; this page filters and pages the rows itself, so it asks for the most one read
  // takes, which the gateway caps. `total` is what counts everybody, so it is what the page reports as the
  // population — the rows alone are its first page, and every count taken over them is taken over that page.
  const q = useConsole<{ people: Person[]; total: number }>('/people?limit=100');
  const people = useMemo(() => q.data?.people ?? [], [q.data]);
  const [f, set] = useQueryState({ q: '', team: 'all', sort: 'used', dir: 'desc', page: '1' });
  const [draft, setDraft] = useSearchDraft(f.q, (q) => set({ q, page: '1' }));
  const rows = useMemo(() => filterPeople(people, { q: f.q, team: f.team }), [people, f.q, f.team]);
  const arrival = useArrival(q);
  const context = q.data
    ? peopleContext(people, { filters: { q: f.q, team: f.team }, mode, ...arrival })
    : pendingContext({ view: 'people', title: 'People', address: '/people', scope: mode === 'platform' ? 'everyone the platform knows' : 'everyone on your team' }, failureOf(q));
  const clear = () => set({ q: '', team: 'all', page: '1' });
  const tokens = people.reduce((a, p) => a + p.tokens, 0);
  // Counted once and pluralised at the caption: `2 superadmin` and `Held by 1 people` were both printing here, which
  // is the seventh and eighth place this round found a number followed by a noun that does not agree with it.
  const supers = people.filter((p) => p.role === 'superadmin').length;
  const holders = people.filter((p) => p.tokens > 0).length;
  const everyone = q.data?.total ?? people.length;
  // The page holds the first page of that population, so once it is shorter than `total` every figure here counts a
  // part of it — and a part of it is not the whole.
  const capped = people.length < everyone;
  // What a figure counted when it counted less than everybody; nothing when it counted everybody.
  const ofFirst = capped ? `, of the first ${people.length} read` : '';

  return (
    <ConsolePage
      title="People"
      description={mode === 'team' ? 'Everyone on your team, and what they can reach.' : 'Everyone the platform knows, and what they can reach.'}
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      context={context}
    >
      <Row split="tiles">
        {/* A note is gated exactly as its value is: left ungated it printed "0 superadmins" over a read that failed,
            which is a measured nothing where there is no measurement at all. */}
        <MetricTile label="People" icon={<UserRound />} value={q.data ? everyone : q.isPending ? '…' : '—'} note={q.data ? `${supers} ${plural(supers, 'superadmin')}${ofFirst}` : undefined} />
        <MetricTile label="Live tokens" icon={<KeyRound />} value={q.data ? tokens : q.isPending ? '…' : '—'} note={q.data ? `Held by ${holders} ${plural(holders, 'person', 'people')}${ofFirst}` : undefined} />
        <MetricTile label="Never used a token" icon={<UserX />} value={q.data ? people.filter((p) => !p.last_used).length : q.isPending ? '…' : '—'} note={q.data ? 'No platform call on record' : undefined} />
        <MetricTile label="Teams" icon={<Users />} value={q.data ? new Set(people.flatMap((p) => p.teams.map(teamSlug))).size : q.isPending ? '…' : '—'} note={q.data ? (capped ? `Across the first ${people.length} people` : 'Across everyone listed') : undefined} />
      </Row>
      <DataTable
        caption="People"
        noun="people"
        rows={rows}
        columns={COLUMNS}
        rowKey={(p) => p.email}
        loading={q.isPending}
        error={failureOf(q)}
        onRetry={() => void q.refetch()}
        state={{ sort: f.sort, dir: f.dir, page: f.page }}
        onStateChange={set}
        filtered={f.q !== '' || f.team !== 'all'}
        onClearFilters={clear}
        empty={{ title: 'Nobody yet', body: 'A superadmin adds the first person in Settings.' }}
        toolbar={
          <FilterBar
            search={{ value: draft, onChange: setDraft, placeholder: 'Search people' }}
            filters={mode === 'platform' ? [{ key: 'team', label: 'Team', value: f.team, onChange: (v) => set({ team: v, page: '1' }), options: facet('All', people.flatMap((p) => p.teams.map(teamSlug))) }] : []}
            result={q.data ? (capped ? `the first ${people.length} of ${everyone}, ${rows.length} matching` : `${rows.length} of ${everyone}`) : undefined}
            ask={<AskAbout question="Who has a live token they have never used, and who has no token at all?" />}
            onClear={clear}
          />
        }
      />
    </ConsolePage>
  );
}
