'use client';

import { use } from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { FlowMini } from '@/components/Flow';
import { StateBadge } from '@/components/StateBadge';
import {
  Badge, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time,
} from '@/components/ui';
import { useConsole, type Initiative, type TeamDetail } from '@/lib/api';

/**
 * One team: what it is working on, and what it is set up with.
 *
 * "SETUP", NOT "ARCHITECTURE". The word architecture was tried and it meant
 * nothing to the people who had to read it — they could not tell whether it
 * described the platform's design or their own. Flows, agents, blocks and who
 * has connected are four concrete things, and naming them is the whole fix.
 */
export default function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const team = useConsole<TeamDetail>(`/teams/${slug}`);
  const inits = useConsole<{ initiatives: Initiative[] }>(`/initiatives?team=${slug}`);

  return (
    <DashboardPage
      title={slug}
      description={team.data?.team.name ?? 'Team'}
      showPeriod={false}
      updatedAt={new Date()}
    >
      <div className="flex flex-col gap-4">
        <Panel title="Initiatives" aside={inits.data ? `${inits.data.initiatives.length}` : undefined} padded={false}>
          <Query query={inits} skeletonRows={4}>
            {(d) =>
              d.initiatives.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Initiative</TableHead>
                      <TableHead>Flow position</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">Docs</TableHead>
                      <TableHead>Gates</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.initiatives.map((i) => (
                      <TableRow key={i.slug}>
                        <TableCell>
                          <Link
                            href={`/initiatives/${i.team}/${i.slug}`}
                            className="font-medium text-accent hover:underline"
                          >
                            {i.slug}
                          </Link>
                        </TableCell>
                        <TableCell><FlowMini at={i.at} of={i.of} name={i.stage} /></TableCell>
                        <TableCell><StateBadge of={i} /></TableCell>
                        <TableCell className="text-right tabular-nums">{i.documents}</TableCell>
                        <TableCell className="tabular-nums text-xs">
                          {i.gates.filter((g) => g.passed).length} of {i.gates.length}
                        </TableCell>
                        <TableCell><Time value={i.updated} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6">
                  <EmptyState
                    icon={<Inbox />}
                    title="No initiatives yet"
                    description={`${slug} is provisioned but nobody has started a piece of work. The first brain dump into the Solution Agent creates one.`}
                  />
                </div>
              )
            }
          </Query>
        </Panel>

        <Query query={team} skeletonRows={5}>
          {(d) => (
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Flows installed" aside={`${d.flows.length}`} padded={false}>
                <SimpleTable
                  head={['Flow', 'Version', 'Agent', 'Installed']}
                  rows={d.flows.map((f) => [f.flow, f.version, f.agent, f.installed])}
                  empty="No flow installed — this team has no agent."
                />
              </Panel>
              <Panel title="Members" aside={`${d.members.length}`} padded={false}>
                <SimpleTable
                  head={['Person', 'Role', 'Joined']}
                  rows={d.members.map((m) => [m.email, m.role, m.joined])}
                  empty="Nobody is in this team."
                />
              </Panel>
              <Panel title="Blocks granted" aside="team-wide" padded={false}>
                <SimpleTable
                  head={['Block', 'Granted']}
                  rows={d.grants.map((g) => [g.block, g.granted])}
                  empty="No blocks granted."
                />
              </Panel>
              <Panel
                title="Block connections"
                aside="per person, not per team"
                padded={false}
              >
                {d.connections.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Person</TableHead>
                        <TableHead>Block</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Expires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.connections.map((c, i) => (
                        <TableRow key={`${c.email}-${c.block}-${i}`}>
                          <TableCell className="font-mono text-xs">{c.email.split('@')[0]}</TableCell>
                          <TableCell><Badge variant="neutral">{c.block}</Badge></TableCell>
                          <TableCell className="max-w-[26ch] truncate font-mono text-[11px] text-ink-faint" title={c.scope}>
                            {c.scope}
                          </TableCell>
                          <TableCell><Time value={c.expires} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="p-5 text-sm text-ink-faint">
                    A grant is the team&apos;s permission; a connection is a person having used it.
                    Nobody on this team has signed in to a block yet.
                  </p>
                )}
              </Panel>
            </div>
          )}
        </Query>
      </div>
    </DashboardPage>
  );
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="p-5 text-sm text-ink-faint">{empty}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>{head.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            {r.map((c, j) => (
              <TableCell key={j} className={j === 0 ? 'font-medium text-ink' : 'text-xs'}>{c}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
