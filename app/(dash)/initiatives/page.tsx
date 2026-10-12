'use client';

import { useMemo } from 'react';
import { DataTable, useQueryState } from '@/components/patterns/data-table';
import { AskAbout } from '@/components/patterns/ask-about';
import { FilterBar } from '@/components/patterns/filter-bar';
import { Segmented } from '@/components/ui/segmented';
import { facet } from '@/console/facets';
import { initiativeColumns } from '@/console/initiative';
import { INITIATIVE_STATES, initiativeState } from '@/console/initiative-state';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { usePeriod } from '@/console/period';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import type { Initiative } from '@/lib/api-shapes';
import { PERIOD_LABEL } from '@/lib/period';
import { useLive } from '@/lib/live';
import { pendingContext, whose } from '@/views/context';
import { initiativesContext } from '@/views/initiatives-context';
import { filterInitiatives, inPeriod } from '@/views/initiatives-filter';

// One set per view, built once: in the team view every row is the same team, so the column would be a constant.
const COLUMNS = { platform: initiativeColumns({ team: true }), team: initiativeColumns() };

/** Every piece of work, open or closed, and how far through its flow it got. Windowed on when it was last touched. */
export default function InitiativesPage() {
  useLive(['initiatives']);
  const { mode } = useConsoleMode();
  const { period } = usePeriod();
  const q = useConsole<{ initiatives: Initiative[] }>('/initiatives');
  const [f, set] = useQueryState({ q: '', team: 'all', flow: 'all', state: 'all', show: 'all', sort: 'updated', dir: 'desc', page: '1' });

  // The window first: it says which initiatives the page is about at all. The filters narrow within it, and their
  // counts are taken from what survives it.
  const arrival = useArrival(q);
  const filters = useMemo(() => ({ q: f.q, team: f.team, flow: f.flow, state: f.state, show: f.show }), [f.q, f.team, f.flow, f.state, f.show]);
  // Against the data's clock, as the context is: the page and the assistant then window the same initiatives.
  const inWindow = useMemo(() => inPeriod(q.data?.initiatives ?? [], period, new Date(arrival.now)), [q.data, period, arrival.now]);
  const rows = useMemo(() => filterInitiatives(inWindow, filters), [inWindow, filters]);
  const context = q.data
    ? initiativesContext(q.data.initiatives, { filters, period, mode, ...arrival })
    : pendingContext({ view: 'initiatives', title: 'Initiatives', address: '/initiatives', scope: `${PERIOD_LABEL[period].toLowerCase()}, ${whose(mode)}` }, failureOf(q));
  const filtered = f.q !== '' || f.team !== 'all' || f.flow !== 'all' || f.state !== 'all' || f.show !== 'all';
  const clear = () => set({ q: '', team: 'all', flow: 'all', state: 'all', show: 'all', page: '1' });
  const page = (patch: Partial<typeof f>) => set({ ...patch, page: '1' });

  return (
    <ConsolePage
      title="Initiatives"
      description={mode === 'team' ? 'Every piece of work your team has open or closed, and how far through its flow it got.' : 'Every piece of work on the platform, and how far through its flow it got.'}
      updatedAt={freshnessOf(q)}
      context={context}
    >
      <DataTable
        caption="Initiatives"
        noun="initiatives"
        rows={rows}
        columns={COLUMNS[mode]}
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
            ask={<AskAbout question={f.show === 'waiting' ? 'Which of these should be approved first, and what is each waiting on?' : filtered ? 'What do the initiatives in this list have in common, and which are stuck?' : 'Which initiatives are stuck, and what is each waiting on?'} />}
            onClear={clear}
          />
        }
      />
    </ConsolePage>
  );
}
