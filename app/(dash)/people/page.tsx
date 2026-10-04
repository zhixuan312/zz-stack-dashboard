'use client';

import { useMemo } from 'react';
import { KeyRound, UserRound, UserX, Users } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { DataTable, useQueryState, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { facet } from '@/console/facets';
import { ConsolePage } from '@/console/page';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import { teamSlug, type Person } from '@/lib/api-shapes';
import { formatDate } from '@/lib/format-date';

const COLUMNS: Column<Person>[] = aligned([
  {
    key: 'person', header: 'Person', grow: true, truncate: true, mobile: 'title', sortValue: (p) => p.name || p.email,
    cell: (p) => (
      <span className="flex min-w-0 items-center gap-3">
        <Avatar name={p.name || p.email} size="sm" />
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{p.name || p.email}</span>
          {p.name ? <span className="t-caption block truncate">{p.email}</span> : null}
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
  { key: 'tokens', header: 'Tokens', numeric: true, hideBelow: 'md', mobile: 'fact', sortValue: (p) => p.tokens, cell: (p) => p.tokens || '—', mobileCell: (p) => `${p.tokens} tokens` },
  { key: 'used', header: 'Last used', hideBelow: 'md', mobile: 'fact', sortValue: (p) => p.last_used ?? '', cell: (p) => <When at={p.last_used} />, mobileCell: (p) => (p.last_used ? <>Used <When at={p.last_used} /></> : 'Never used') },
  { key: 'created', header: 'Joined', numeric: true, hideBelow: 'xl', sortValue: (p) => p.created, cell: (p) => formatDate(p.created) },
]);

/** Everyone the platform knows, the teams they belong to, and whether their tokens are live. */
export default function PeoplePage() {
  const { mode } = useConsoleMode();
  const q = useConsole<{ people: Person[] }>('/people');
  const people = useMemo(() => q.data?.people ?? [], [q.data]);
  const [f, set] = useQueryState({ q: '', team: 'all', sort: 'used', dir: 'desc', page: '1' });
  const rows = useMemo(() => {
    const needle = f.q.trim().toLowerCase();
    return people.filter((p) => (f.team === 'all' || p.teams.some((t) => teamSlug(t) === f.team)) && (!needle || p.email.includes(needle) || p.name.toLowerCase().includes(needle)));
  }, [people, f.q, f.team]);
  const clear = () => set({ q: '', team: 'all', page: '1' });
  const tokens = people.reduce((a, p) => a + p.tokens, 0);

  return (
    <ConsolePage
      title="People"
      description={mode === 'team' ? 'Everyone on your team, and what they can reach.' : 'Everyone the platform knows, and what they can reach.'}
      showPeriod={false}
      updatedAt={freshnessOf(q)}
    >
      <Row split="tiles">
        <MetricTile label="People" icon={<UserRound />} value={q.data ? people.length : '…'} note={`${people.filter((p) => p.role === 'superadmin').length} superadmin`} />
        <MetricTile label="Live tokens" icon={<KeyRound />} value={q.data ? tokens : '…'} note={`Held by ${people.filter((p) => p.tokens > 0).length} people`} />
        <MetricTile label="Never used a token" icon={<UserX />} value={q.data ? people.filter((p) => !p.last_used).length : '…'} note="No platform call on record" />
        <MetricTile label="Teams" icon={<Users />} value={q.data ? new Set(people.flatMap((p) => p.teams.map(teamSlug))).size : '…'} note="Across everyone listed" />
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
            search={{ value: f.q, onChange: (v) => set({ q: v, page: '1' }), placeholder: 'Search people' }}
            filters={mode === 'platform' ? [{ key: 'team', label: 'Team', value: f.team, onChange: (v) => set({ team: v, page: '1' }), options: facet('All', people.flatMap((p) => p.teams.map(teamSlug))) }] : []}
            result={<>{rows.length} of {people.length}</>}
            onClear={clear}
          />
        }
      />
    </ConsolePage>
  );
}
