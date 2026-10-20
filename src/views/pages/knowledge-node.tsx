'use client';

import { useTransition } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, RotateCw } from 'lucide-react';
import { app, workspaces } from '@/app.config';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { Skeleton } from '@/components/ui/skeleton';
import { aligned } from '@/console/columns';
import { useServerReadLive } from '@/console/knowledge-tabs';
import { ConsolePage } from '@/console/page';
import { Panel } from '@/console/panel';
import { useDataClock } from '@/lib/api';
import type { KnowledgeBody, KnowledgeNode } from '@/lib/api-shapes';
import { plural } from '@/lib/format';
import { formatDate } from '@/lib/format-date';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { statusWord, troubleOf, type ServerRead } from '@/views/knowledge-context';
import { knowledgeNodeContext } from '@/views/knowledge-node-context';

// The markdown renderer arrives after the page's first paint: the node's own facts and its neighbours are what that
// paint shows, and the body beside them is rendered once its renderer has loaded. Loaded eagerly it was 141 KiB of this
// route's first-load JS, which put the route 83 KiB over the 820 KiB cap.
const Prose = dynamic(() => import('@/components/patterns/prose').then((m) => m.Prose), { loading: () => <Skeleton className="h-64 rounded-md" /> });

/**
 * One knowledge node, read: reached from a row on the shelf, a search result or an Ask citation. The console's server
 * reads the node and hands it here: its body carries everything but its number and its neighbours. A lesson on the
 * platform's shared shelf opens the same way, marked Shared, because a search finds it; nothing on this page changes a
 * lesson either way. Where it was learned is the initiatives of the team the reader acts for, each linked, and a count
 * of every other team's, which the answer counts and never names (reconciliation 81). Dates are absolute, because
 * they came from the server.
 *
 * DELIBERATE: no Knowledge tabs, and the lesson at the page's width with its facts under it in two columns. A node is a
 * detail page whose way back is its breadcrumb, and the tabs marked Overview as the page in view; beside its facts the
 * lesson's card stretched about 300px empty to their height, and the facts' column broke the path over four lines and
 * a cited initiative at a hyphen (Phase 7's re-review, Work F-48).
 */
export function KnowledgeNodeView({ read, team, rel }: { read: ServerRead<KnowledgeBody>; team: string; rel: string }) {
  const address = knowledgeNodeHref(team, rel);
  useLive(['knowledge'], read.state === 'ok' ? read.revisions : undefined);
  useServerReadLive(address);
  const now = useDataClock();
  const self = read.state === 'ok' ? read.data : undefined;
  const shared = self?.shelf === 'shared';
  const context = self && read.state === 'ok'
    ? knowledgeNodeContext(self, { updatedAt: read.at, now })
    : pendingContext({ view: 'knowledge_node', title: rel, address, scope: `one knowledge node of ${team}` }, read.state === 'ok' ? null : troubleOf(read));
  // A shared tag is the only link the store records between two nodes, so it is said as that and nothing more.
  // The neighbours come with the node: see `KnowledgeBody.related`.
  const related = self?.related ?? [];
  const relatedColumns: Column<KnowledgeNode>[] = aligned([
    { key: 'num', header: 'Node', width: 'w-24', cell: (n) => <span className="font-mono text-xs text-ink-3">{n.num}</span> },
    // A row opens its node: the quiet arrow says so before the pointer finds it, as every row that opens a page does
    // (Phase 7's second re-review, Work M-11).
    {
      key: 'title', header: 'Title', align: 'left', grow: true, mobile: 'title',
      cell: (n) => <span className="block py-1 leading-snug font-medium whitespace-normal text-ink">{n.title} <ArrowRight data-goes aria-hidden className="inline size-3.5 align-[-0.15em] text-ink-3 group-hover/row:text-ink" /></span>,
    },
    // A neighbour a later lesson replaced says so, and names what replaced it, a link where the successor is listed too
    // (Work F-6): unmarked, a superseded lesson read as current beside the one that replaced it.
    {
      key: 'status', header: 'Status', mobile: 'status',
      cell: (n) => (n.superseded_by
        ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Badge tone="neutral" dot>Superseded</Badge><span className="t-caption">by <Successor of={n} among={related} /></span></span>
        : <Badge tone={n.status === 'adopted' ? 'positive' : 'neutral'} dot>{statusWord(n.status)}</Badge>),
    },
    { key: 'shared', header: 'Shared tags', hideBelow: 'lg', cell: (n) => <span className="font-mono text-xs text-ink-3">{(n.tags ?? []).filter((t) => self?.tags?.includes(t)).join(' · ')}</span> },
    { key: 'updated', header: 'Recorded', numeric: true, mobile: 'fact', cell: (n) => formatDate(n.updated) },
  ]);

  return (
    <ConsolePage
      title={self?.title ?? rel}
      // From the workspace's root, as every other Work page's breadcrumb starts (Work M-11).
      crumbs={[{ label: `${app.name} · ${workspaces.main.label}` }, { label: 'Knowledge', href: '/knowledge' }, { label: self ? `${shared ? 'Shared shelf' : team} · node ${self.num}` : team }]}
      updatedAt={read.state === 'ok' ? new Date(read.at) : null}
      context={context}
    >
      {!self ? <NodeTrouble reason={read.state === 'ok' ? '' : troubleOf(read)} /> : (
        <>
          {/* A supersession needs nobody, so the banner is neutral, as the log's act is; it names what replaced it. */}
          {self.superseded_by ? <Banner tone="neutral" title={`Superseded by node ${self.superseded_by}`}>Kept readable; it is no longer the current lesson. <Successor of={self} among={related} lead="Read " /></Banner> : null}
          {shared ? <Banner tone="accent" title="On the platform's shared shelf">Every team&rsquo;s search reads it beside the team&rsquo;s own lessons.</Banner> : null}
          <Panel title="The lesson" actions={<AskAbout question="What does this lesson mean for work we are doing now?" />}>
            {/* A lesson recorded with no text says so: an empty panel reads as a body still on its way. */}
            {self.body.trim() ? <Prose>{self.body.trim()}</Prose> : <p className="t-small text-ink-3">This lesson has no text in the store.</p>}
          </Panel>
          <Panel title="About this node">
            <KeyValue
              columns={2}
              items={[
                { label: 'Status', value: <Badge tone={self.status === 'adopted' ? 'positive' : 'neutral'} dot>{statusWord(self.status)}</Badge> },
                { label: 'Shelf', value: shared ? <Badge tone="accent">Shared</Badge> : <Badge tone="neutral">Your team</Badge> },
                { label: 'Type', value: self.type },
                // The team as words: no page this person may open is that team's own.
                { label: 'Team', value: self.team },
                { label: 'Recorded', value: formatDate(self.updated) },
                // Where it came from, so a reader can open the work that produced the lesson. The team comes from
                // the gateway's entry, not the node's: a shared lesson's are the reader's own team's. Other teams'
                // initiatives are a count, with no name and no link.
                ...(self.evidence_in?.length || self.cited_elsewhere ? [{
                  label: 'Learned in',
                  wrap: true,
                  value: (
                    <span className="flex flex-col gap-1">
                      {(self.evidence_in ?? []).map((e) => (e.team
                        // One line, never broken at a hyphen: a smaller size where the column is a phone's.
                        ? <Link key={e.name} href={`/initiatives/${e.team}/${e.name}`} title={e.name} className="link hit block truncate text-xs @min-[40rem]:text-sm">{e.name}</Link>
                        : <span key={e.name} className="[overflow-wrap:anywhere]" title="No initiative by this name on the platform">{e.name}</span>))}
                      {self.cited_elsewhere ? <span className="text-ink-2">{elsewhere(self.cited_elsewhere)}</span> : null}
                    </span>
                  ),
                }] : []),
                ...(self.tags?.length ? [{ label: 'Tags', wrap: true, value: <span className="font-mono text-xs">{self.tags.join(' · ')}</span> }] : []),
                { label: 'Path', mono: true, wrap: true, value: self.path },
              ]}
            />
          </Panel>
          {related.length ? (
            <DataTable
              caption="Nodes that share a tag"
              noun="nodes"
              rows={related}
              columns={relatedColumns}
              rowKey={(n) => n.key}
              rowHref={(n) => knowledgeNodeHref(n.team, n.path)}
              pageSize={10}
              pageSizes={[10]}
              toolbar={<div><h2 className="t-card">Shares a tag with</h2><p className="t-caption mt-1">{related.length} {plural(related.length, 'node')}</p></div>}
            />
          ) : null}
        </>
      )}
    </ConsolePage>
  );
}

/** Whether two node numbers are one node's: the gateway's carry no leading zeros where the fixture's do. */
const sameNum = (a: string, b: string) => Number(a) === Number(b) || a === b;

/**
 * The node that replaced `of`, by its number: a link to it where it is among `among`, the neighbours the node came with,
 * and its number in words where it is not, since a number alone is no address. `lead` goes before a link only.
 */
function Successor({ of, among, lead = '' }: { of: { team: string; superseded_by: string | null }; among: KnowledgeNode[]; lead?: string }) {
  const num = of.superseded_by!;
  const next = among.find((n) => n.team === of.team && sameNum(n.num, num));
  if (!next) return lead ? null : <>node {num}</>;
  return <>{lead}<Link href={knowledgeNodeHref(next.team, next.path)} className="link hit">node {num}</Link>{lead ? '.' : null}</>;
}

/** How many initiatives of other teams a lesson was learned in, said as a count alone. */
const elsewhere = (n: number) => `${n} ${plural(n, 'initiative of another team', 'initiatives of other teams')}`;

/** The node's read failed or did not answer: the reason, and Retry, which asks the server again. */
function NodeTrouble({ reason }: { reason: string }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  return (
    <Card>
      <EmptyState kind="error" title="This node did not load" className="py-16" action={<Button variant="primary" icon={<RotateCw />} busy={retrying} onClick={() => startRetry(() => router.refresh())}>Retry</Button>}>{reason}</EmptyState>
    </Card>
  );
}
