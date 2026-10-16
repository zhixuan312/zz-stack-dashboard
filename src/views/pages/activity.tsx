'use client';

import { useMemo } from 'react';
import { Activity, Ban, Wrench } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, useQueryState, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Segmented } from '@/components/ui/segmented';
import { aligned } from '@/console/columns';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole } from '@/lib/api';
import type { ActivityLog, ActivityRow, ActivitySummary } from '@/lib/destination-shapes';
import { plural } from '@/lib/format';
import { useLive } from '@/lib/live';
import { OWNER_LABEL, PAGE_SIZE, activityContext, activityPath, narrowed } from '@/views/activity-context';
import { pendingContext } from '@/views/context';

/** A dash where nothing was involved: an event that is not a tool call names no tool. */
const dash = <span className="text-ink-3">—</span>;

const COLUMNS: Column<ActivityRow>[] = aligned([
  { key: 'when', header: 'When', width: 'w-28', mobile: 'fact', cell: (e) => <When at={e.ts} /> },
  { key: 'kind', header: 'Kind', mobile: 'title', cell: (e) => <span className="font-mono text-xs text-ink">{e.kind}</span> },
  { key: 'tool', header: 'Tool', hideBelow: 'lg', truncate: true, cell: (e) => (e.tool ? <span title={e.tool} className="font-mono text-xs">{e.tool}</span> : dash) },
  { key: 'initiative', header: 'Initiative', hideBelow: 'xl', truncate: true, cell: (e) => (e.initiative ? <span title={e.initiative} className="text-xs">{e.initiative}</span> : dash) },
  // The local part alone — `jane.doe`, never the domain — and `title` carries the whole address on hover.
  { key: 'actor', header: 'Actor', hideBelow: 'md', mobile: 'fact', cell: (e) => (e.actor ? <span title={e.actor}>{e.actor.split('@')[0]}</span> : dash) },
  // A refusal is the row worth finding, so it alone carries colour; ok is the normal case and stays neutral.
  { key: 'result', header: 'Result', mobile: 'status', cell: (e) => (e.ok === false ? <Badge tone="critical" dot>Refused</Badge> : e.ok === true ? <Badge tone="neutral">OK</Badge> : dash) },
  { key: 'owner', header: 'Why', hideBelow: 'lg', cell: (e) => (e.ok === false ? OWNER_LABEL[e.owner ?? 'other'] : '') },
  { key: 'message', header: 'Message', align: 'left', hideBelow: 'xl', truncate: true, cell: (e) => (e.ok !== false ? '' : e.message ? <span title={e.message} className="text-critical-ink">{e.message}</span> : <span className="text-ink-3">No message recorded</span>) },
]);

/**
 * The active team's real work, newest first, with last week's calls and refusals above it. Each refusal is counted
 * under one owner, and the log is filtered and paged by the server.
 */
export function ActivityView() {
  useLive(['activity']);
  const [f, set] = useQueryState({ kind: 'all', tool: 'all', initiative: 'all', refused: 'all', page: '1' });
  const filters = useMemo(() => ({ kind: f.kind, tool: f.tool, initiative: f.initiative, refused: f.refused }), [f.kind, f.tool, f.initiative, f.refused]);
  const page = Math.max(1, Number(f.page) || 1);
  const summary = useConsole<ActivitySummary>('/activity/summary');
  const log = useConsole<ActivityLog>(activityPath(filters, { offset: (page - 1) * PAGE_SIZE }));
  const tiles = summary.data?.tiles;
  const filtered = narrowed(filters);
  const clear = () => set({ kind: 'all', tool: 'all', initiative: 'all', refused: 'all', page: '1' });
  const arrival = useArrival(summary, log);
  const context = summary.data
    ? activityContext({ summary: summary.data, log: log.data, filters, page, ...arrival })
    : pendingContext({ view: 'activity', title: 'Activity', address: '/activity', scope: 'your active team\'s real work' }, failureOf(summary));
  const mark = summary.isPending ? '…' : '—';
  // The log read stops at its own ceiling, so past it the page holds the latest matching events alone and a count
  // that printed the total by itself would read as the whole of them. `…` is coming and `—` is not: a failed read of
  // the log must not keep saying "a moment".
  const counted = log.data
    ? `${log.data.total} ${plural(log.data.total, 'event')}${log.data.total >= log.data.ceiling ? `, of the latest ${log.data.ceiling} read` : ''}`
    : log.isPending ? '…' : '—';
  const option = (v: string) => ({ value: v, label: v });

  return (
    <ConsolePage
      title="Activity"
      description="Everything your team's real work recorded, newest first."
      showPeriod={false}
      updatedAt={freshnessOf(summary, log)}
      context={context}
      actions={<Segmented label="Show" value={f.refused} onChange={(v) => set({ refused: v, page: '1' })} options={[{ value: 'all', label: 'Everything' }, { value: 'true', label: 'Refusals only' }]} />}
    >
      <Row split="tiles">
        <MetricTile label="Calls last week" icon={<Activity />} value={tiles?.calls.figure.value ?? mark} note="Real work, refused or not" />
        <MetricTile label="Refused last week" icon={<Ban />} value={tiles?.refused.figure.value ?? mark}
                    note={tiles ? `${tiles.refused.owners.guardrail} guardrail, ${tiles.refused.owners.ours} malformed, ${tiles.refused.owners.theirs} tool, ${tiles.refused.owners.other} other` : 'By who it is put down to'} />
        <MetricTile label="Most refused" icon={<Wrench />} value={tiles ? (tiles.mostRefused?.count ?? 'None') : mark} note={tiles?.mostRefused ? `${tiles.mostRefused.tool}, of ${tiles.mostRefused.of}` : 'The tool refused most'} />
      </Row>
      {/* Every tile above is a dash on a failed summary read, which is the mark an empty week wears too, so the page
          says which of the two it is. */}
      {summary.error && summary.error.status !== 401 ? <EmptyState kind="error" title="The week's figures did not load" action={<Button size="sm" onClick={() => void summary.refetch()}>Retry</Button>}>{summary.error.message}</EmptyState> : null}
      <DataTable
        caption="Activity"
        noun="events"
        rows={log.data?.rows ?? []}
        columns={COLUMNS}
        rowKey={(e) => e.id}
        manual
        total={log.data?.total ?? 0}
        pageSize={PAGE_SIZE}
        pageSizes={[PAGE_SIZE]}
        loading={log.isPending}
        error={failureOf(log)}
        onRetry={() => void log.refetch()}
        state={{ sort: '', dir: 'desc', page: String(page) }}
        onStateChange={(p) => { if (p.page) set({ page: p.page }); }}
        filtered={filtered}
        onClearFilters={clear}
        empty={{ title: 'Nothing recorded yet' }}
        toolbar={
          <FilterBar
            filters={[
              { key: 'kind', label: 'Kind', value: f.kind, onChange: (v) => set({ kind: v, page: '1' }), options: [{ value: 'all', label: 'All' }, ...(log.data?.kinds ?? []).map(option)] },
              { key: 'tool', label: 'Tool', value: f.tool, onChange: (v) => set({ tool: v, page: '1' }), options: [{ value: 'all', label: 'All' }, ...(log.data?.tools ?? []).map(option)] },
            ]}
            result={counted}
            ask={<AskAbout question={f.refused === 'true' ? 'Which of these refusals matter most, and what would stop them?' : 'What went wrong last week, and which group of refusals should we fix first?'} />}
            onClear={clear}
          />
        }
      />
    </ConsolePage>
  );
}
