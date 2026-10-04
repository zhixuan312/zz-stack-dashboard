'use client';

import { useMemo } from 'react';
import { DataTable, useQueryState } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { Segmented } from '@/components/ui/segmented';
import { facet } from '@/console/facets';
import { INITIATIVE_STATES, initiativeColumns, initiativeState, waitingOnYou } from '@/console/initiative';
import { ConsolePage } from '@/console/page';
import { failureOf } from '@/console/query';
import { usePeriod } from '@/console/period';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import type { Initiative } from '@/lib/api-shapes';
import { PERIOD_LABEL, periodCutoff } from '@/lib/period';

const COLUMNS = initiativeColumns({ team: true });

/** Every piece of work, open or closed, and how far through its flow it got. Windowed on when it was last touched. */
export default function InitiativesPage() {
  const { mode } = useConsoleMode();
  const { period } = usePeriod();
  const q = useConsole<{ initiatives: Initiative[] }>('/initiatives');
  const [f, set] = useQueryState({ q: '', team: 'all', flow: 'all', state: 'all', show: 'all', sort: 'updated', dir: 'desc', page: '1' });

  // The window first: it says which initiatives the page is about at all. The filters narrow within it, and their
  // counts are taken from what survives it.
  const inWindow = useMemo(() => {
    const since = periodCutoff(period);
    const all = q.data?.initiatives ?? [];
    return since ? all.filter((i) => new Date(i.updated) >= since) : all;
  }, [q.data, period]);
  const rows = useMemo(() => {
    const needle = f.q.trim().toLowerCase();
    return inWindow.filter((i) =>
      (!needle || i.slug.toLowerCase().includes(needle) || i.team.includes(needle) || (i.flow ?? '').includes(needle))
      && (f.team === 'all' || i.team === f.team)
      && (f.flow === 'all' || (i.flow ?? 'No flow') === f.flow)
      && (f.state === 'all' || initiativeState(i) === f.state)
      && (f.show === 'all' || waitingOnYou(i)));
  }, [inWindow, f.q, f.team, f.flow, f.state, f.show]);
  const filtered = f.q !== '' || f.team !== 'all' || f.flow !== 'all' || f.state !== 'all' || f.show !== 'all';
  const clear = () => set({ q: '', team: 'all', flow: 'all', state: 'all', show: 'all', page: '1' });
  const page = (patch: Partial<typeof f>) => set({ ...patch, page: '1' });

  return (
    <ConsolePage
      title="Initiatives"
      description={mode === 'team' ? 'Every piece of work your team has open or closed, and how far through its flow it got.' : 'Every piece of work on the platform, and how far through its flow it got.'}
      updatedAt={freshnessOf(q)}
    >
      <DataTable
        caption="Initiatives"
        noun="initiatives"
        rows={rows}
        columns={COLUMNS}
        rowKey={(i) => `${i.team}/${i.slug}`}
        rowHref={(i) => `/initiatives/${i.team}/${i.slug}`}
        loading={q.isPending}
        error={failureOf(q)}
        onRetry={() => void q.refetch()}
        state={{ sort: f.sort, dir: f.dir, page: f.page }}
        onStateChange={set}
        filtered={filtered || inWindow.length < (q.data?.initiatives.length ?? 0)}
        onClearFilters={clear}
        empty={{ title: 'No initiative yet', body: 'An initiative starts with initiative_open, and every document written afterwards lands under it.' }}
        toolbar={
          <FilterBar
            search={{ value: f.q, onChange: (v) => page({ q: v }), placeholder: 'Search initiatives' }}
            filters={[
              ...(mode === 'platform' ? [{ key: 'team', label: 'Team', value: f.team, onChange: (v: string) => page({ team: v }), options: facet('All', inWindow.map((i) => i.team)) }] : []),
              { key: 'flow', label: 'Flow', value: f.flow, onChange: (v) => page({ flow: v }), options: facet('All', inWindow.map((i) => i.flow ?? 'No flow')) },
              { key: 'state', label: 'State', value: f.state, onChange: (v) => page({ state: v }), options: facet('All', inWindow.map(initiativeState), INITIATIVE_STATES) },
            ]}
            view={<Segmented size="sm" label="Show" value={f.show} onChange={(v) => page({ show: v })} options={[{ value: 'all', label: 'All' }, { value: 'waiting', label: 'Waiting on you' }]} />}
            result={<>{rows.length} of {inWindow.length}{period === 'all' ? '' : `, ${PERIOD_LABEL[period].toLowerCase()}`}</>}
            onClear={clear}
          />
        }
      />
    </ConsolePage>
  );
}
