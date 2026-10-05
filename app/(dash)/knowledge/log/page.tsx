'use client';

import { GitFork, History, PlusCircle } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { KnowledgeTabs } from '@/console/knowledge-tabs';
import { ConsolePage } from '@/console/page';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import type { KnowledgeLogEntry } from '@/lib/api-shapes';

function columns(multiTeam: boolean): Column<KnowledgeLogEntry>[] {
  return aligned([
    { key: 'when', header: 'When', width: 'w-32', mobile: 'fact', cell: (e) => <When at={e.ts} /> },
    // Recorded is the ordinary act; superseded is the one a reader looks for, so it carries the colour.
    { key: 'act', header: 'Act', hideBelow: 'md', mobile: 'status', cell: (e) => (e.kind === 'knowledge.add' ? <Badge tone="neutral" dot>Recorded</Badge> : <Badge tone="warning" dot>Superseded</Badge>) },
    {
      // The title as it stands now, falling back to the one typed at the time: "node 3" is a number nobody recognises.
      key: 'node', header: 'Node', align: 'left', grow: true, mobile: 'title',
      cell: (e) => (
        <span className="block py-1 whitespace-normal">
          <span className="block leading-snug text-ink">{e.node_title ?? e.recorded_title ?? <span className="text-ink-3">No longer on the shelf</span>}</span>
          <span className="t-caption block font-mono">node {e.node}{e.superseded_by ? ` → ${e.superseded_by}` : ''}</span>
        </span>
      ),
      mobileCell: (e) => e.node_title ?? e.recorded_title ?? `node ${e.node}`,
    },
    ...(multiTeam ? [{ key: 'team', header: 'Team', hideBelow: 'xl' as const, cell: (e: KnowledgeLogEntry) => e.team ?? '—' }] : []),
    { key: 'who', header: 'Who', hideBelow: 'lg', cell: (e) => (e.actor ? e.actor.split('@')[0] : '—') },
  ]);
}

/**
 * What was recorded, what replaced what, and who wrote it down. Read from the log zz-core writes when it mints or
 * retires a node, not derived from the nodes: a node's date is when it last changed, and no node says who wrote it.
 */
export default function KnowledgeLogPage() {
  const { mode } = useConsoleMode();
  const q = useConsole<{ entries: KnowledgeLogEntry[] }>('/knowledge/log');
  const entries = q.data?.entries ?? [];
  const added = entries.filter((e) => e.kind === 'knowledge.add').length;
  const multiTeam = new Set(entries.map((e) => e.team).filter(Boolean)).size > 1;

  return (
    <ConsolePage
      title="Knowledge"
      description={mode === 'team' ? 'Every node this team recorded or retired, newest first.' : 'Every node recorded or retired across the platform, newest first.'}
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      toolbar={<KnowledgeTabs active="log" />}
    >
      <Row split="tiles">
        <MetricTile label="Entries" icon={<History />} value={q.data ? entries.length : q.isPending ? '…' : '—'} note={entries[0] ? <>Latest <When at={entries[0].ts} /></> : 'Nothing yet'} />
        <MetricTile label="Recorded" icon={<PlusCircle />} value={q.data ? added : q.isPending ? '…' : '—'} note="Nodes minted" />
        <MetricTile label="Superseded" icon={<GitFork />} value={q.data ? entries.length - added : q.isPending ? '…' : '—'} note="Replaced by a newer node" />
      </Row>
      <DataTable
        caption="Knowledge log"
        noun="entries"
        rows={entries}
        columns={columns(multiTeam)}
        rowKey={(e) => `${e.ts}-${e.team}-${e.node}-${e.kind}`}
        loading={q.isPending}
        error={failureOf(q)}
        onRetry={() => void q.refetch()}
        empty={{ title: 'Nothing recorded yet', body: 'The log starts the next time a node is minted or superseded. Older nodes are on the Nodes tab.' }}
      />
    </ConsolePage>
  );
}
