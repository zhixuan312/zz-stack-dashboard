'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Row } from '@/components/base/shell';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { KeyValue } from '@/components/ui/key-value';
import { Skeleton } from '@/components/ui/skeleton';
import { aligned } from '@/console/columns';
import { KnowledgeTabs } from '@/console/knowledge-tabs';
import { AskAbout } from '@/components/patterns/ask-about';
import { ConsolePage, useArrival } from '@/console/page';
import { Panel } from '@/console/panel';
import { Query, failureOf } from '@/console/query';
import { When } from '@/console/when';
import { decodePath } from '@/lib/address';
import { freshnessOf, useConsole } from '@/lib/api';
import type { KnowledgeBody, KnowledgeNode } from '@/lib/api-shapes';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { knowledgeNodeContext } from '@/views/knowledge-node-context';

// The markdown renderer arrives only with the node's body: the node's own facts and its neighbours are what a first
// paint shows, and the body is fetched after that either way. Loaded eagerly it was 141 KiB of this route's first-load
// JS, which put the route 83 KiB over the 820 KiB cap.
const Prose = dynamic(() => import('@/components/patterns/prose').then((m) => m.Prose), { loading: () => <Skeleton className="h-64 rounded-md" /> });

/**
 * One knowledge node, read: reached from a row on the shelf or from an Ask citation. The node's own body carries
 * everything but its number and its neighbours; those come from the shelf, the same cached read the list used.
 */
export default function KnowledgeNodePage({ params }: { params: Promise<{ team: string; path: string[] }> }) {
  useLive(['knowledge']);
  const { team: rawTeam, path } = use(params);
  const team = decodeURIComponent(rawTeam);
  const rel = decodePath(path);
  const body = useConsole<KnowledgeBody>(`/knowledge/${team}/${rel}`);
  const self = body.data;
  const multiTeam = body.data?.multi_team ?? false;
  const arrival = useArrival(body);
  const context = body.data
    ? knowledgeNodeContext(body.data, arrival)
    : pendingContext({ view: 'knowledge_node', title: rel, address: `/knowledge/${team}/${rel}`, scope: `one knowledge node of ${team}` }, failureOf(body));
  // A shared tag is the only link the store records between two nodes, so it is said as that and nothing more.
  // The neighbours come with the node: see `KnowledgeBody.related`.
  const related = body.data?.related ?? [];
  const relatedColumns: Column<KnowledgeNode>[] = aligned([
    { key: 'num', header: 'Node', width: multiTeam ? 'w-36' : 'w-24', cell: (n) => <span className="font-mono text-xs text-ink-3">{multiTeam ? `${n.team} · ${n.num}` : n.num}</span> },
    { key: 'title', header: 'Title', align: 'left', grow: true, mobile: 'title', cell: (n) => <span className="block py-1 leading-snug font-medium whitespace-normal text-ink">{n.title}</span> },
    { key: 'shared', header: 'Shared tags', hideBelow: 'lg', cell: (n) => <span className="font-mono text-xs text-ink-3">{(n.tags ?? []).filter((t) => self?.tags?.includes(t)).join(' · ')}</span> },
    { key: 'updated', header: 'Recorded', numeric: true, mobile: 'fact', cell: (n) => <When at={n.updated} /> },
  ]);

  return (
    <ConsolePage
      title={body.data?.title ?? rel}
      crumbs={[{ label: 'Knowledge', href: '/knowledge' }, { label: self ? `${team} · node ${self.num}` : team }]}
      showPeriod={false}
      updatedAt={freshnessOf(body)}
      context={context}
      toolbar={<KnowledgeTabs active="nodes" />}
    >
      <Query query={body} what="This node" skeleton={<Row split="2/3"><Skeleton className="h-80 rounded-lg" /><Skeleton className="h-80 rounded-lg" /></Row>}>
        {(b) => (
          <>
            {b.superseded_by ? <Banner tone="warning" title={`Superseded by node ${b.superseded_by}`}>Kept readable; it is no longer the current lesson.</Banner> : null}
            <Row split="2/3">
              <Panel title="The lesson" actions={<AskAbout iconBelowSm question="What does this lesson mean for work we are doing now?" />}>
                <Prose>{b.body.trim()}</Prose>
              </Panel>
              <Panel title="About this node">
                <KeyValue
                  items={[
                    { label: 'Status', value: <Badge tone={b.status === 'adopted' ? 'positive' : 'neutral'} dot>{b.status}</Badge> },
                    { label: 'Type', value: b.type },
                    { label: 'Team', value: <Link href={`/teams/${b.team}`} className="link">{b.team}</Link> },
                    { label: 'Recorded', value: <When at={b.updated} /> },
                    // Where it came from, so a reader can open the work that produced the lesson. The team comes from
                    // the gateway's entry, not the node's: a node may cite an initiative in another team.
                    ...(b.evidence_in?.length ? [{
                      label: 'Learned in',
                      wrap: true,
                      value: (
                        <span className="flex flex-col gap-1">
                          {b.evidence_in.map((e) => (e.team
                            ? <Link key={e.name} href={`/initiatives/${e.team}/${e.name}`} className="link hit [overflow-wrap:anywhere]">{e.name}</Link>
                            : <span key={e.name} className="[overflow-wrap:anywhere]" title="No initiative by this name on the platform">{e.name}</span>))}
                        </span>
                      ),
                    }] : []),
                    ...(b.tags?.length ? [{ label: 'Tags', wrap: true, value: <span className="font-mono text-xs">{b.tags.join(' · ')}</span> }] : []),
                    { label: 'Path', mono: true, wrap: true, value: b.path },
                  ]}
                />
              </Panel>
            </Row>
            {related.length ? (
              <DataTable
                caption="Nodes that share a tag"
                noun="nodes"
                rows={related}
                columns={relatedColumns}
                rowKey={(n) => n.key}
                rowHref={(n) => knowledgeNodeHref(n.team, n.path)}
                pageSize={10}
                pageSizes={[10, 20, 50]}
                toolbar={<div><h2 className="t-card">Shares a tag with</h2><p className="t-caption mt-1">{related.length} nodes</p></div>}
              />
            ) : null}
          </>
        )}
      </Query>
    </ConsolePage>
  );
}
