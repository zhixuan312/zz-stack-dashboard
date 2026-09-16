'use client';

import { Archive, GitFork, History, PlusCircle } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { KnowledgeTabs } from '@/components/knowledge/KnowledgeTabs';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, EmptyState, PageControl, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time,
  TZ_LABEL, usePaged,
} from '@/components/ui';
import { useConsole, type KnowledgeLogEntry } from '@/lib/api';

/**
 * Log — what this team recorded, what replaced what, and who wrote it down.
 *
 * READ FROM A REAL LOG, not derived from the nodes. zz-core writes a `knowledge.add` or
 * `knowledge.supersede` event at the moment it mints or retires a node, beside the
 * `_knowledge/log.md` it has always written — see `knowledgeEvent` there. Deriving this
 * from node timestamps instead would have looked identical and been a different claim:
 * `updated` says when a node last CHANGED, so a superseded node's own date is the day it
 * was retired and the day it was recorded is gone. And no node can tell you who wrote it.
 *
 * NOT FILTERED OUT OF `tool_call` ROWS either, which was the other tempting shortcut.
 * Those carry no actor on purpose — "no address on a measurement", tool-telemetry.ts — and
 * they include `search_knowledge` reads, which are not journal entries at all.
 */
export default function KnowledgeLogPage() {
  const q = useConsole<{ entries: KnowledgeLogEntry[] }>('/knowledge/log');
  const entries = q.data?.entries ?? [];
  const added = entries.filter((e) => e.kind === 'knowledge.add').length;
  const superseded = entries.length - added;
  const teams = [...new Set(entries.map((e) => e.team).filter(Boolean))];

  return (
    <DashboardPage
      title="Knowledge"
      description="Every node this team recorded or retired, newest first."
      showPeriod={false}
      updatedAt={new Date()}
      subnav={<KnowledgeTabs active="log" />}
      metrics={[
        { label: 'Entries', value: entries.length, muted: entries.length === 0,
          sublabel: 'Recorded acts', icon: <History /> },
        { label: 'Recorded', value: added, muted: added === 0,
          sublabel: 'Nodes minted', icon: <PlusCircle /> },
        { label: 'Superseded', value: superseded, muted: superseded === 0,
          sublabel: 'Replaced by a newer node', icon: <GitFork /> },
        { label: 'Last entry', value: entries[0] ? entries[0].ts.slice(0, 10) : '—',
          muted: !entries[0], sublabel: 'Most recent act', icon: <Archive /> },
      ]}
    >
      <Query query={q}>
        {() => (
          <Panel
            title="Journal"
            aside={entries.length ? `${entries.length} entries` : undefined}
            padded={false}
          >
            {entries.length === 0 ? (
              <EmptyState
                illustration={{ src: '/assets/brand/state-empty.png', width: 96, height: 96 }}
                icon={<History className="size-5" aria-hidden />}
                title="Nothing recorded yet"
                description={
                  'This log starts the next time a node is minted or superseded. Nodes recorded ' +
                  'before the log existed are on the Nodes tab — they are not missing, they were ' +
                  'written before anything was watching.'
                }
              />
            ) : (
              <JournalTable entries={entries} teams={teams.length} />
            )}
          </Panel>
        )}
      </Query>
    </DashboardPage>
  );
}

/** Its own component so it can hold the page state — a hook cannot run inside `Query`. */
function JournalTable({ entries, teams }: { entries: KnowledgeLogEntry[]; teams: number }) {
  const { page, controls } = usePaged(entries);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When <span className="font-normal text-ink-faint">({TZ_LABEL})</span></TableHead>
            <TableHead hideBelow="md">Act</TableHead>
            <TableHead>Node</TableHead>
            {teams > 1 ? <TableHead hideBelow="xl">Team</TableHead> : null}
            <TableHead hideBelow="lg">Who</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((e) => (
            <TableRow key={`${e.ts}-${e.node}-${e.kind}`}>
              <TableCell className="whitespace-nowrap text-xs tabular-nums">
                <Time value={e.ts} />
              </TableCell>
              <TableCell hideBelow="md">
                {e.kind === 'knowledge.add'
                  ? <Badge variant="sage" dot size="sm">recorded</Badge>
                  : <Badge variant="amber" dot size="sm">superseded</Badge>}
              </TableCell>
              <TableCell className="max-w-[48ch]">
                {/* THE TITLE AS IT STANDS NOW, falling back to the one typed at the
                    time. A log row reading "node 3" is a number nobody recognises;
                    the current title is what the reader is looking for, and the
                    recorded one is what is left when the node is gone from the
                    shelf — which is a thing that happened, not a row to hide. */}
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] leading-snug text-ink">
                    {e.node_title ?? e.recorded_title ?? <span className="italic text-ink-faint">no longer on the shelf</span>}
                  </span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    node {e.node}
                    {e.superseded_by ? ` → ${e.superseded_by}` : ''}
                  </span>
                </span>
              </TableCell>
              {teams > 1 ? (
                <TableCell hideBelow="xl">
                  {e.team ? <Badge variant="neutral" size="sm">{e.team}</Badge> : '—'}
                </TableCell>
              ) : null}
              <TableCell hideBelow="lg" className="whitespace-nowrap text-xs text-ink-soft">
                {e.actor ? e.actor.split('@')[0] : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
