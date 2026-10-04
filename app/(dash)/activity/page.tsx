'use client';

import { DataTable, useQueryState, type Column } from '@/components/patterns/data-table';
import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import { aligned } from '@/console/columns';
import { ConsolePage } from '@/console/page';
import { When } from '@/console/when';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import type { ActivityEvent } from '@/lib/api-shapes';

/** A dash where nothing was involved: a token issued is a thing a person did, not a thing a team did. */
const dash = <span className="text-ink-3">—</span>;

/** Two events can share a second, a kind and a subject, so a row's identity is its place in the feed. */
type Row = ActivityEvent & { id: string };

const COLUMNS: Column<Row>[] = aligned([
  { key: 'when', header: 'When', width: 'w-28', mobile: 'fact', cell: (e) => <When at={e.ts} /> },
  { key: 'kind', header: 'Kind', mobile: 'title', cell: (e) => <span className="font-mono text-xs text-ink">{e.kind}</span> },
  { key: 'subject', header: 'Subject', hideBelow: 'lg', truncate: true, cell: (e) => (e.subject ? <span title={e.subject} className="font-mono text-xs">{e.subject}</span> : dash) },
  { key: 'actor', header: 'Actor', hideBelow: 'md', cell: (e) => (e.actor ? <span title={e.actor}>{e.actor.split('@')[0]}</span> : dash) },
  { key: 'team', header: 'Team', hideBelow: 'xl', cell: (e) => e.team ?? dash },
  // A refusal is the row worth finding, so it alone carries colour; ok is the normal case and stays neutral.
  { key: 'result', header: 'Result', mobile: 'status', cell: (e) => (e.ok === false ? <Badge tone="critical" dot>Refused</Badge> : e.ok === true ? <Badge tone="neutral">OK</Badge> : dash) },
  { key: 'refusal', header: 'Refusal', align: 'left', hideBelow: 'xl', truncate: true, cell: (e) => (e.refusal ? <span title={e.refusal} className="text-critical-ink">{e.refusal}</span> : '') },
]);

/**
 * The audit view: every tool call, gate and admin act, newest first. A blank team is not missing data: the gateway
 * reads the team through its foreign key, so a blank means no team was involved.
 */
export default function ActivityPage() {
  const { mode } = useConsoleMode();
  const [f, set] = useQueryState({ show: 'all', page: '1' });
  const q = useConsole<{ events: ActivityEvent[]; limit: number }>(`/activity?limit=200${f.show === 'failed' ? '&failed=1' : ''}`);
  const events: Row[] = (q.data?.events ?? []).map((e, i) => ({ ...e, id: String(i) }));

  return (
    <ConsolePage
      title="Activity"
      description={mode === 'team' ? 'Everything recorded for your team, newest first.' : 'Everything the platform recorded, newest first.'}
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      actions={<Segmented label="Show" value={f.show} onChange={(v) => set({ show: v, page: '1' })} options={[{ value: 'all', label: 'Everything' }, { value: 'failed', label: 'Refusals only' }]} />}
    >
      <DataTable
        caption="Activity"
        noun="events"
        rows={events}
        columns={COLUMNS}
        rowKey={(e) => e.id}
        loading={q.isPending}
        error={q.error?.message}
        onRetry={() => void q.refetch()}
        state={{ sort: '', dir: 'desc', page: f.page }}
        onStateChange={(p) => set({ page: p.page ?? f.page })}
        filtered={f.show === 'failed'}
        onClearFilters={() => set({ show: 'all', page: '1' })}
        empty={{ title: 'Nothing recorded yet' }}
        toolbar={<div><h2 className="t-card">Events</h2><p className="t-caption mt-1">The latest {q.data?.limit ?? 200}{f.show === 'failed' ? ' refusals' : ''}</p></div>}
      />
    </ConsolePage>
  );
}
