'use client';

import { use, type ReactNode } from 'react';
import Link from 'next/link';
import { DashboardPage } from '@/components/DashboardPage';
import { KnowledgeTabs } from '@/components/knowledge/KnowledgeTabs';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, PageControl, Row, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time,
  usePaged,
} from '@/components/ui';
import { useConsole } from '@/lib/api';
import { type KnowledgeBody, type KnowledgeNode } from '@/lib/api-shapes';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';

/**
 * One knowledge node, read — reached from a row on the shelf or from an Ask citation.
 *
 * The node's own `/knowledge/<team>/<path>` body carries everything but its number and its
 * neighbours; those come from the shelf read, which is the same cached query the list used.
 */
export default function KnowledgeNodePage({
  params,
}: {
  params: Promise<{ team: string; path: string[] }>;
}) {
  const { team: rawTeam, path } = use(params);
  const team = decodeURIComponent(rawTeam);
  const rel = path.map(decodeURIComponent).join('/');
  const body = useConsole<KnowledgeBody>(`/knowledge/${team}/${rel}`);
  const list = useConsole<{ nodes: KnowledgeNode[] }>('/knowledge');
  const nodes = list.data?.nodes ?? [];
  const self = nodes.find((n) => n.team === team && n.path === rel);
  // Nodes that share a tag with this one — the store records no node-to-node link, so a
  // shared subject is the honest form of "related", and it is labelled as that rather than
  // dressed up as a citation.
  const related = self
    ? nodes.filter((n) => n.key !== self.key && (n.tags ?? []).some((t) => (self.tags ?? []).includes(t)))
    : [];

  return (
    <DashboardPage
      title={body.data?.title ?? rel}
      breadcrumb={[{ label: 'Knowledge', href: '/knowledge' }, { label: self ? `node ${self.num}` : rel }]}
      showPeriod={false}
      subnav={<KnowledgeTabs active="nodes" />}
    >
      <Query query={body} skeletonRows={10}>
        {(b) => (
          <>
            <Row split="2/3">
              <Panel title="Node">
                <article className="flex flex-col gap-4">
                  {b.superseded_by ? (
                    <div className="rounded-[var(--r)] border border-[var(--amber)] bg-[var(--amber-tint)] px-3 py-2 text-xs text-[var(--amber-text)]">
                      Superseded by {b.superseded_by} — kept readable, no longer current.
                    </div>
                  ) : null}
                  {/* Fills its card, like every other piece of content in this console. It
                      was capped at 74ch, which left a node's text using half its panel while
                      the panel and everything beside it used all of it. */}
                  <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.85] text-ink-soft">
                    {b.body.trim()}
                  </p>
                </article>
              </Panel>
              <Panel title="About this node">
                <dl className="flex flex-col gap-3 text-[13px]">
                  <Fact label="Status">
                    <Badge variant={b.status === 'adopted' ? 'sage' : 'neutral'} dot>{b.status}</Badge>
                  </Fact>
                  <Fact label="Type"><Badge variant="neutral">{b.type}</Badge></Fact>
                  <Fact label="Team">
                    <Link href={`/teams/${b.team}`} className="text-accent hover:underline">{b.team}</Link>
                    {self ? <span className="ml-2 font-mono text-xs text-ink-faint">node {self.num}</span> : null}
                  </Fact>
                  <Fact label="Recorded"><Time value={b.updated} /></Fact>
                  {/* WHERE IT CAME FROM. Without this a node reads as an assertion from
                      nowhere; with it, the reader can open the work that produced the lesson. */}
                  {b.evidence_in?.length ? (
                    <Fact label="Learned in">
                      <span className="flex flex-col gap-1">
                        {/* THE TEAM THE INITIATIVE IS ACTUALLY IN, from the API. Linked under
                            `b.team` this pointed a platform-shelf node's evidence at
                            /initiatives/zz-platform/<slug> — the initiative is the tenant's —
                            and every one of those links answered "not found". An entry the
                            platform cannot place is its own name, not a dead link. */}
                        {b.evidence_in.map((e) => (
                          e.team ? (
                            <Link
                              key={e.name}
                              href={`/initiatives/${e.team}/${e.name}`}
                              className="break-all font-medium text-accent hover:underline"
                            >
                              {e.name}
                            </Link>
                          ) : (
                            <span key={e.name} className="break-all text-ink-soft" title="no initiative by this name on the platform">
                              {e.name}
                            </span>
                          )
                        ))}
                      </span>
                    </Fact>
                  ) : null}
                  {b.tags?.length ? (
                    <Fact label="Tags">
                      <span className="flex flex-wrap gap-1.5">
                        {b.tags.map((t) => (
                          <span key={t} className="rounded-[var(--r-sm)] bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-faint">
                            {t}
                          </span>
                        ))}
                      </span>
                    </Fact>
                  ) : null}
                  <Fact label="Path">
                    <span className="break-all font-mono text-xs text-ink-faint">{b.path}</span>
                  </Fact>
                </dl>
              </Panel>
            </Row>
            {related.length ? (
              <Panel title="Shares a subject with" aside={`${related.length} nodes`} padded={false}>
                <RelatedTable rows={related} tags={self?.tags ?? []} multiTeam={new Set(nodes.map((n) => n.team)).size > 1} />
              </Panel>
            ) : null}
          </>
        )}
      </Query>
    </DashboardPage>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** Its own component so the page state lives outside the `Query` render prop. */
function RelatedTable({ rows, tags, multiTeam }: { rows: KnowledgeNode[]; tags: string[]; multiTeam: boolean }) {
  const { page, controls } = usePaged(rows);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[1%]">Node</TableHead>
            <TableHead>Title</TableHead>
            <TableHead hideBelow="lg">Shared tags</TableHead>
            <TableHead hideBelow="md">Recorded</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((n) => (
            <TableRow key={n.key}>
              <TableCell className="whitespace-nowrap font-mono text-xs text-ink-faint">
                {multiTeam ? `${n.team} · ${n.num}` : n.num}
              </TableCell>
              <TableCell>
                <Link href={knowledgeNodeHref(n.team, n.path)} className="font-medium leading-snug text-accent hover:underline">
                  {n.title}
                </Link>
              </TableCell>
              <TableCell hideBelow="lg">
                <span className="inline-flex flex-wrap gap-1">
                  {(n.tags ?? []).filter((t) => tags.includes(t)).map((t) => (
                    <span key={t} className="rounded-[var(--r-sm)] bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-faint">
                      {t}
                    </span>
                  ))}
                </span>
              </TableCell>
              <TableCell hideBelow="md"><Time value={n.updated} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
