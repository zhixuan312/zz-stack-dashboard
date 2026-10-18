'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GitFork, History, PlusCircle, RotateCw } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { aligned } from '@/console/columns';
import { KnowledgeTabs, useServerReadLive } from '@/console/knowledge-tabs';
import { ConsolePage } from '@/console/page';
import { useDataClock } from '@/lib/api';
import type { KnowledgeLogEntry } from '@/lib/api-shapes';
import { formatDate } from '@/lib/format-date';
import { useLive } from '@/lib/live';
import { pendingContext, whose } from '@/views/context';
import { troubleOf, type ServerRead } from '@/views/knowledge-context';
import { knowledgeLogContext } from '@/views/knowledge-log-context';

function columns(): Column<KnowledgeLogEntry>[] {
  return aligned([
    { key: 'when', header: 'When', width: 'w-32', mobile: 'fact', cell: (e) => <time dateTime={e.ts}>{formatDate(e.ts)}</time> },
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
    { key: 'who', header: 'Who', hideBelow: 'lg', cell: (e) => (e.actor ? e.actor.split('@')[0] : '—') },
  ]);
}

/**
 * Knowledge's log: what was recorded, what replaced what, and who wrote it down, drawn at `/knowledge/log`, a tab of
 * Knowledge (FR-18). Read from the log zz-core writes when it mints or retires a node, not derived from the nodes: a
 * node's date is when it last changed, and no node says who wrote it. The console's server reads the active team's log
 * and hands it here; its dates are absolute, because they came from the server.
 */
export function KnowledgeLogView({ read }: { read: ServerRead<{ entries: KnowledgeLogEntry[] }> }) {
  useLive(['knowledge']);
  useServerReadLive('/knowledge/log');
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const now = useDataClock();
  const entries = read.state === 'ok' ? read.data.entries : [];
  const added = entries.filter((e) => e.kind === 'knowledge.add').length;
  const updatedAt = read.state === 'ok' ? new Date(read.at) : null;
  const context = read.state === 'ok'
    ? knowledgeLogContext(entries, { updatedAt, now })
    : pendingContext({ view: 'knowledge_log', title: 'Knowledge log', address: '/knowledge/log', scope: `every node recorded or retired, for ${whose('team')}` }, troubleOf(read));
  const failed = read.state !== 'ok';

  return (
    <ConsolePage
      title="Knowledge"
      description="Every lesson this team recorded or superseded, newest first."
      showPeriod={false}
      updatedAt={updatedAt}
      context={context}
      toolbar={<KnowledgeTabs active="log" />}
    >
      <Row split="tiles">
        {/* Gated exactly as the value beside it is: over a failed read this note said "Nothing yet", which is the
            all-clear a failure must never wear. */}
        <MetricTile label="Entries" icon={<History />} value={failed ? '—' : entries.length} note={failed ? undefined : entries[0] ? `Latest ${formatDate(entries[0].ts)}` : 'Nothing yet'} />
        <MetricTile label="Recorded" icon={<PlusCircle />} value={failed ? '—' : added} note="Nodes minted" />
        <MetricTile label="Superseded" icon={<GitFork />} value={failed ? '—' : entries.length - added} note="Replaced by a newer node" />
      </Row>
      {read.state !== 'ok' ? (
        <EmptyState kind="error" title="The entries did not load" action={<Button size="sm" icon={<RotateCw />} busy={retrying} onClick={() => startRetry(() => router.refresh())}>Retry</Button>}>{troubleOf(read)}</EmptyState>
      ) : (
        <DataTable
          caption="Knowledge log"
          noun="entries"
          rows={entries}
          columns={columns()}
          rowKey={(e) => `${e.ts}-${e.team}-${e.node}-${e.kind}`}
          empty={{ title: 'Nothing recorded yet', body: 'The log starts the next time a node is minted or superseded. Older nodes are on the shelf, under Overview.' }}
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
      )}
    </ConsolePage>
  );
}
