'use client';

import { useMemo } from 'react';
import { DataTable, useQueryState, useSearchDraft, type Column } from '@/components/patterns/data-table';
import { AskAbout } from '@/components/patterns/ask-about';
import { FilterBar } from '@/components/patterns/filter-bar';
import { Badge } from '@/components/ui/badge';
import { count } from '@/console/words';
import { plural } from '@/lib/format';
import { aligned } from '@/console/columns';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { freshnessOf, useConsole } from '@/lib/api';
import type { Team } from '@/lib/api-shapes';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { teamsContext } from '@/views/teams-context';
import { filterTeams } from '@/views/teams-filter';

const columns: Column<Team>[] = aligned([
  {
    key: 'team', header: 'Team', grow: true, mobile: 'title', sortValue: (t) => t.slug,
    cell: (t) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium text-ink" title={t.slug}>{t.slug}</span>
        {t.name !== t.slug ? <span className="t-caption block truncate" title={t.name}>{t.name}</span> : null}
      </span>
    ),
    mobileCell: (t) => t.slug,
  },
  // Colour only where a row needs a look: active is the normal case, so it stays quiet.
  { key: 'status', header: 'Status', mobile: 'status', sortValue: (t) => t.status, cell: (t) => <Badge tone={t.status === 'active' ? 'neutral' : 'warning'} dot>{t.status === 'active' ? 'Active' : 'Archived'}</Badge> },
  { key: 'members', header: 'People', numeric: true, hideBelow: 'md', sortValue: (t) => t.members, cell: (t) => count(t.members) },
  { key: 'initiatives', header: 'Initiatives', numeric: true, mobile: 'fact', sortValue: (t) => t.initiatives, cell: (t) => count(t.initiatives), mobileCell: (t) => `${count(t.initiatives)} ${plural(t.initiatives, 'initiative')}` },
  { key: 'documents', header: 'Documents', numeric: true, hideBelow: 'lg', mobile: 'fact', sortValue: (t) => t.documents, cell: (t) => count(t.documents), mobileCell: (t) => `${count(t.documents)} ${plural(t.documents, 'document')}` },
  { key: 'sources', header: 'Sources', numeric: true, hideBelow: 'xl', sortValue: (t) => t.sources, cell: (t) => count(t.sources) },
  { key: 'knowledge', header: 'Knowledge', numeric: true, hideBelow: 'lg', sortValue: (t) => t.knowledge, cell: (t) => count(t.knowledge) },
]);

/** Every team on the platform: who is in it and what it holds. A platform page; a member's own team is the Overview. */
export function TeamsView() {
  useLive(['teams']);
  // Every team on one page: the gateway pages at 10 rows by default and caps the page it takes, so this asks for the
  // cap. `total` is what counts every team, and the rows are the first page of them.
  const q = useConsole<{ teams: Team[]; total: number }>('/teams?limit=100');
  const [f, set] = useQueryState({ q: '', status: 'all', sort: 'initiatives', dir: 'desc', page: '1' });
  const [draft, setDraft] = useSearchDraft(f.q, (q) => set({ q, page: '1' }));
  const teams = useMemo(() => q.data?.teams ?? [], [q.data]);
  const rows = useMemo(() => filterTeams(teams, { q: f.q, status: f.status }), [teams, f.q, f.status]);
  const arrival = useArrival(q);
  const context = q.data
    ? teamsContext(teams, q.data.total, { filters: { q: f.q, status: f.status }, ...arrival })
    : pendingContext({ view: 'teams', title: 'Teams', address: '/teams', scope: 'every team on the platform' }, failureOf(q));
  const filtered = f.q !== '' || f.status !== 'all';
  const clear = () => set({ q: '', status: 'all', page: '1' });
  const everyone = q.data?.total ?? teams.length;
  // Both the search and the status filter run in the browser over the teams read, so past the cap they narrow a part
  // of the platform and say nothing about the rest.
  const capped = teams.length < everyone;

  return (
    <ConsolePage title="Teams" description="Every team on the platform: who is in it and what it holds." showPeriod={false} updatedAt={freshnessOf(q)} context={context}>
      <DataTable
        caption="Teams"
        noun="teams"
        rows={rows}
        columns={columns}
        rowKey={(t) => t.slug}
        rowHref={(t) => `/teams/${t.slug}`}
        loading={q.isPending}
        error={failureOf(q)}
        onRetry={() => void q.refetch()}
        state={{ sort: f.sort, dir: f.dir, page: f.page }}
        onStateChange={set}
        filtered={filtered}
        onClearFilters={clear}
        empty={{ title: 'No team yet', body: 'A superadmin creates the first one in Settings.' }}
        toolbar={
          <FilterBar
            search={{ value: draft, onChange: setDraft, placeholder: 'Search teams' }}
            filters={[{ key: 'status', label: 'Status', value: f.status, onChange: (v) => set({ status: v, page: '1' }), options: [{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }] }]}
            result={q.data ? (capped ? `the first ${teams.length} of ${everyone}, ${rows.length} matching` : `${rows.length} of ${everyone}`) : undefined}
            ask={<AskAbout question={filtered ? 'What do the teams in this list have in common?' : 'Which teams are doing the most work, and which have gone quiet?'} />}
            onClear={clear}
          />
        }
      />
    </ConsolePage>
  );
}
