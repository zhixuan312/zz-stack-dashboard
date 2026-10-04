'use client';

import { useMemo } from 'react';
import { DataTable, useQueryState, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { ConsolePage } from '@/console/page';
import { failureOf } from '@/console/query';
import { freshnessOf, useConsole } from '@/lib/api';
import type { Team } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format';

/** A zero is a dash: a team with no documents has nothing to count, and "0" reads as a measured result. */
const count = (n: number) => (n ? formatCount(n) : '—');

const columns: Column<Team>[] = aligned([
  {
    key: 'team', header: 'Team', grow: true, mobile: 'title', sortValue: (t) => t.slug,
    cell: (t) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium text-ink">{t.slug}</span>
        {t.name !== t.slug ? <span className="t-caption block truncate">{t.name}</span> : null}
      </span>
    ),
    mobileCell: (t) => t.slug,
  },
  // Colour only where a row needs a look: active is the normal case, so it stays quiet.
  { key: 'status', header: 'Status', mobile: 'status', sortValue: (t) => t.status, cell: (t) => <Badge tone={t.status === 'active' ? 'neutral' : 'warning'} dot>{t.status === 'active' ? 'Active' : 'Archived'}</Badge> },
  { key: 'members', header: 'People', numeric: true, hideBelow: 'md', sortValue: (t) => t.members, cell: (t) => count(t.members) },
  { key: 'initiatives', header: 'Initiatives', numeric: true, mobile: 'fact', sortValue: (t) => t.initiatives, cell: (t) => count(t.initiatives), mobileCell: (t) => `${count(t.initiatives)} initiatives` },
  { key: 'documents', header: 'Documents', numeric: true, hideBelow: 'lg', mobile: 'fact', sortValue: (t) => t.documents, cell: (t) => count(t.documents), mobileCell: (t) => `${count(t.documents)} documents` },
  { key: 'sources', header: 'Sources', numeric: true, hideBelow: 'xl', sortValue: (t) => t.sources, cell: (t) => count(t.sources) },
  { key: 'knowledge', header: 'Knowledge', numeric: true, hideBelow: 'lg', sortValue: (t) => t.knowledge, cell: (t) => count(t.knowledge) },
]);

/** Every team on the platform: who is in it and what it holds. A platform page; a member's own team is the Overview. */
export default function TeamsPage() {
  const q = useConsole<{ teams: Team[] }>('/teams');
  const [f, set] = useQueryState({ q: '', status: 'all', sort: 'initiatives', dir: 'desc', page: '1' });
  const teams = useMemo(() => q.data?.teams ?? [], [q.data]);
  const rows = useMemo(() => {
    const needle = f.q.trim().toLowerCase();
    return teams.filter((t) => (f.status === 'all' || t.status === f.status) && (!needle || t.slug.includes(needle) || t.name.toLowerCase().includes(needle)));
  }, [teams, f.q, f.status]);
  const filtered = f.q !== '' || f.status !== 'all';
  const clear = () => set({ q: '', status: 'all', page: '1' });

  return (
    <ConsolePage title="Teams" description="Every team on the platform: who is in it and what it holds." showPeriod={false} updatedAt={freshnessOf(q)}>
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
            search={{ value: f.q, onChange: (v) => set({ q: v, page: '1' }), placeholder: 'Search teams' }}
            filters={[{ key: 'status', label: 'Status', value: f.status, onChange: (v) => set({ status: v, page: '1' }), options: [{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }] }]}
            result={<>{rows.length} of {teams.length}</>}
            onClear={clear}
          />
        }
      />
    </ConsolePage>
  );
}
