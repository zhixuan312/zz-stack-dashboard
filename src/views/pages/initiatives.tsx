'use client';

import { useMemo } from 'react';
import { DataTable, useQueryState, useSearchDraft, type Column } from '@/components/patterns/data-table';
import { AskAbout } from '@/components/patterns/ask-about';
import { FilterBar } from '@/components/patterns/filter-bar';
import { Records } from '@/components/templates/records';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole } from '@/lib/api';
import { plural } from '@/lib/format';
import type { Me } from '@/lib/api-shapes';
import { useLive } from '@/lib/live';
import type { InitiativeList, InitiativeRow } from '@/lib/work-shapes';
import { pendingContext } from '@/views/context';
import { initiativesContext, nextOf } from '@/views/initiatives-context';
import { LIST_STATES, PAGE_SIZE, STATE_LABEL, listPath, narrowed, offsetOf } from '@/views/initiatives-filter';

/** One rule per colour, as every state badge: warning means a person must act, positive closed with what was asked. */
const TONE: Record<InitiativeRow['state'], 'warning' | 'positive' | 'neutral'> = {
  waiting: 'warning', accepted: 'positive', delivered: 'positive', open: 'neutral', quiet: 'neutral', abandoned: 'neutral',
};

/** The table's columns, in the server's order: the list is sorted and paged where it is read. */
const COLUMNS: Column<InitiativeRow>[] = aligned([
  // Wrap rather than truncate: a slug's tail tells two pieces of work of one project apart.
  { key: 'slug', header: 'Initiative', grow: true, mobile: 'title', cell: (r) => <span title={r.slug} className="font-medium whitespace-normal text-ink [overflow-wrap:anywhere]">{r.slug}</span> },
  { key: 'next', header: 'Flow position', hideBelow: 'lg', mobile: 'fact', cell: (r) => <span className="text-xs text-ink-2" title={r.nextMove?.why}>{r.flow ? nextOf(r) : 'No flow'}</span> },
  { key: 'state', header: 'State', mobile: 'status', cell: (r) => <Badge tone={TONE[r.state]} dot>{STATE_LABEL[r.state]}</Badge> },
  { key: 'gates', header: 'Gates', numeric: true, hideBelow: 'xl', cell: (r) => (r.gates.of ? `${r.gates.passed} of ${r.gates.of}` : '—') },
  { key: 'touched', header: 'Last touched', numeric: true, mobile: 'fact', cell: (r) => <When at={r.lastTouched} />, mobileCell: (r) => <>Touched <When at={r.lastTouched} /></> },
]);

const STATE_OPTIONS = [{ value: 'all', label: 'All' }, ...LIST_STATES.map((s) => ({ value: s, label: STATE_LABEL[s] }))];

/** The active team's work, open or closed, and where each goes next. Filtered, searched and paged by the server. */
export function InitiativesView() {
  useLive(['initiatives']);
  const [f, set] = useQueryState({ q: '', state: 'all', flow: 'all', page: '1' });
  const [draft, setDraft] = useSearchDraft(f.q, (q) => set({ q, page: '1' }));
  const filters = useMemo(() => ({ q: f.q, state: f.state, flow: f.flow }), [f.q, f.state, f.flow]);
  const page = Math.max(1, Number(f.page) || 1);
  const me = useConsole<Me>('/me');
  const q = useConsole<InitiativeList>(listPath(filters, { offset: offsetOf(page) }));
  const arrival = useArrival(q);
  const context = q.data
    ? initiativesContext(q.data, { filters, page, ...arrival })
    : pendingContext({ view: 'initiatives', title: 'Initiatives', address: '/initiatives', scope: 'your active team\'s work' }, failureOf(q));
  // The flows the filtered population holds, and the one chosen, which a narrower filter could otherwise drop.
  const flows = useMemo(() => {
    const named = q.data?.summary.state === 'ok' ? q.data.summary.data.byFlow.flatMap((b) => (b.flow ? [b.flow] : [])) : [];
    return [...new Set([...named, ...(f.flow === 'all' ? [] : [f.flow])])];
  }, [q.data, f.flow]);
  const filtered = narrowed(filters);
  const clear = () => set({ q: '', state: 'all', flow: 'all', page: '1' });
  const team = me.data?.activeTeam;

  return (
    <ConsolePage
      title="Initiatives"
      description="Every piece of work your active team has open or closed, and where each goes next."
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      context={context}
    >
      <Records>
        <DataTable
          caption="Initiatives"
          noun="initiatives"
          rows={q.data?.rows ?? []}
          columns={COLUMNS}
          rowKey={(r) => r.slug}
          rowHref={team ? (r) => `/initiatives/${team}/${r.slug}` : undefined}
          manual
          total={q.data?.total ?? 0}
          pageSize={PAGE_SIZE}
          pageSizes={[PAGE_SIZE]}
          loading={q.isPending}
          error={failureOf(q)}
          onRetry={() => void q.refetch()}
          state={{ sort: '', dir: 'desc', page: String(page) }}
          onStateChange={(p) => { if (p.page) set({ page: p.page }); }}
          filtered={filtered}
          onClearFilters={clear}
          empty={{ title: 'No initiative yet', body: 'An initiative starts with initiative_open, and every document written afterwards lands under it.' }}
          toolbar={
            <FilterBar
              search={{ value: draft, onChange: setDraft, placeholder: 'Search initiatives' }}
              filters={[
                { key: 'state', label: 'State', value: f.state, onChange: (v) => set({ state: v, page: '1' }), options: STATE_OPTIONS },
                { key: 'flow', label: 'Flow', value: f.flow, onChange: (v) => set({ flow: v, page: '1' }), options: [{ value: 'all', label: 'All' }, ...flows.map((v) => ({ value: v, label: v }))] },
              ]}
              result={<>{q.data ? `${q.data.total} ${plural(q.data.total, 'initiative')}` : '…'}</>}
              ask={<AskAbout question={filtered ? 'What do the initiatives in this list have in common, and which needs me next?' : 'Which initiatives need me next, and what is each waiting on?'} />}
              onClear={clear}
            />
          }
        />
      </Records>
    </ConsolePage>
  );
}
