'use client';

import { GitFork, History, PlusCircle } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { KnowledgeTabs } from '@/console/knowledge-tabs';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import type { KnowledgeLogEntry } from '@/lib/api-shapes';
import { useLive } from '@/lib/live';
import { pendingContext, whose } from '@/views/context';
import { knowledgeLogContext } from '@/views/knowledge-log-context';

function columns(multiTeam: boolean): Column<KnowledgeLogEntry>[] {
  return aligned([
    { key: 'when', header: 'When', width: 'w-32', mobile: 'fact', cell: (e) => <When at={e.ts} /> },
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
    // The row's name leads, then what happened to it: Meridian's phone rules give the title and the status the same
    // `order`, so the column order decides which of the two sits on the card's left edge, and a status ahead of the name
    // pushed the title into whatever width the badge left it. Every other list here leads with the name.
    // Recorded is the ordinary act; superseded is the one a reader looks for, so it carries the colour.
    { key: 'act', header: 'Act', hideBelow: 'md', mobile: 'status', cell: (e) => (e.kind === 'knowledge.add' ? <Badge tone="neutral" dot>Recorded</Badge> : <Badge tone="warning" dot>Superseded</Badge>) },
    ...(multiTeam ? [{ key: 'team', header: 'Team', hideBelow: 'xl' as const, cell: (e: KnowledgeLogEntry) => e.team ?? '—' }] : []),
    { key: 'who', header: 'Who', hideBelow: 'lg', cell: (e) => (e.actor ? e.actor.split('@')[0] : '—') },
  ]);
}

/**
 * What was recorded, what replaced what, and who wrote it down. Read from the log zz-core writes when it mints or
 * retires a node, not derived from the nodes: a node's date is when it last changed, and no node says who wrote it.
 */
export function KnowledgeLogView() {
  useLive(['knowledge']);
  const { mode } = useConsoleMode();
  const q = useConsole<{ entries: KnowledgeLogEntry[] }>('/knowledge/log');
  const entries = q.data?.entries ?? [];
  const added = entries.filter((e) => e.kind === 'knowledge.add').length;
  const multiTeam = new Set(entries.map((e) => e.team).filter(Boolean)).size > 1;
  const arrival = useArrival(q);
  const context = q.data
    ? knowledgeLogContext(entries, { mode, ...arrival })
    : pendingContext({ view: 'knowledge_log', title: 'Knowledge log', address: '/knowledge/log', scope: `every node recorded or retired, for ${whose(mode)}` }, failureOf(q));

  return (
    <ConsolePage
      title="Knowledge"
      description={mode === 'team' ? 'Every node this team recorded or retired, newest first.' : 'Every node recorded or retired across the platform, newest first.'}
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      context={context}
      toolbar={<KnowledgeTabs active="log" />}
    >
      <Row split="tiles">
        {/* Gated exactly as the value beside it is: over a failed read this note said "Nothing yet", which is the
            all-clear a failure must never wear. */}
        <MetricTile label="Entries" icon={<History />} value={q.data ? entries.length : q.isPending ? '…' : '—'} note={!q.data ? undefined : entries[0] ? <>Latest <When at={entries[0].ts} /></> : 'Nothing yet'} />
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
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="t-card">Recorded and superseded</h2>
              <p className="t-caption mt-1">Newest first</p>
            </div>
            <AskAbout question="What was recorded and superseded most recently, by whom, and what replaced what?" />
          </div>
        }
      />
    </ConsolePage>
  );
}
