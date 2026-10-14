'use client';

import { DataTable, useQueryState, type Column } from '@/components/patterns/data-table';
import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import { aligned } from '@/console/columns';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import { useLive } from '@/lib/live';
import { activityContext } from '@/views/activity-context';
import { addressOf, pendingContext, whose } from '@/views/context';
import type { ActivityEvent } from '@/lib/api-shapes';

/** A dash where nothing was involved: a token issued is a thing a person did, not a thing a team did. */
const dash = <span className="text-ink-3">—</span>;

/** Two events can share a second, a kind and a subject, so a row's identity is its place in the feed. */
type Row = ActivityEvent & { id: string };

const COLUMNS: Column<Row>[] = aligned([
  { key: 'when', header: 'When', width: 'w-28', mobile: 'fact', cell: (e) => <When at={e.ts} /> },
  // No `align` here, and the stand-in that used to be is gone. It existed because a card's title took the table's
  // alignment, and `aligned` centres this column — `When` precedes it — so a phone card opened on a centred title with
  // no left edge to come back to. **0.14.1 fixes that in the component**: `@max-[640px]:[&_td[data-mobile=title]]:!text-left`
  // puts a card's title at the left edge whatever the column order. So the column takes the console's own rule again.
  { key: 'kind', header: 'Kind', mobile: 'title', cell: (e) => <span className="font-mono text-xs text-ink">{e.kind}</span> },
  { key: 'subject', header: 'Subject', hideBelow: 'lg', truncate: true, cell: (e) => (e.subject ? <span title={e.subject} className="font-mono text-xs">{e.subject}</span> : dash) },
  // On the phone card too: a feed of everything the platform recorded, with nobody named on it, cannot answer who
  // did it. The local part alone — `jane.doe`, never the domain — and `title` carries the whole address on hover.
  { key: 'actor', header: 'Actor', hideBelow: 'md', mobile: 'fact', cell: (e) => (e.actor ? <span title={e.actor}>{e.actor.split('@')[0]}</span> : dash) },
  { key: 'team', header: 'Team', hideBelow: 'xl', cell: (e) => e.team ?? dash },
  // A refusal is the row worth finding, so it alone carries colour; ok is the normal case and stays neutral.
  { key: 'result', header: 'Result', mobile: 'status', cell: (e) => (e.ok === false ? <Badge tone="critical" dot>Refused</Badge> : e.ok === true ? <Badge tone="neutral">OK</Badge> : dash) },
  { key: 'refusal', header: 'Refusal', align: 'left', hideBelow: 'xl', truncate: true, cell: (e) => (e.refusal ? <span title={e.refusal} className="text-critical-ink">{e.refusal}</span> : '') },
]);

/**
 * The audit view: every tool call, gate and admin act, newest first. A blank team is not missing data: the gateway
 * reads the team through its foreign key, so a blank means no team was involved.
 */
export function ActivityView() {
  useLive(['activity']);
  const { mode } = useConsoleMode();
  const [f, set] = useQueryState({ show: 'all', page: '1' });
  const q = useConsole<{ events: ActivityEvent[]; limit: number }>(`/activity?limit=200${f.show === 'failed' ? '&failed=1' : ''}`);
  const events: Row[] = (q.data?.events ?? []).map((e, i) => ({ ...e, id: String(i) }));
  const arrival = useArrival(q);
  const context = q.data
    ? activityContext(q.data.events, { show: f.show, limit: q.data.limit, mode, ...arrival })
    : pendingContext({ view: 'activity', title: 'Activity', address: addressOf('/activity', { show: f.show }, { show: 'all' }), scope: `the latest events recorded for ${whose(mode)}` }, failureOf(q));

  return (
    <ConsolePage
      title="Activity"
      description={mode === 'team' ? 'Everything recorded for your team, newest first.' : 'Everything the platform recorded, newest first.'}
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      context={context}
      actions={<Segmented label="Show" value={f.show} onChange={(v) => set({ show: v, page: '1' })} options={[{ value: 'all', label: 'Everything' }, { value: 'failed', label: 'Refusals only' }]} />}
    >
      <DataTable
        caption="Activity"
        noun="events"
        rows={events}
        columns={COLUMNS}
        rowKey={(e) => e.id}
        loading={q.isPending}
        error={failureOf(q)}
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
