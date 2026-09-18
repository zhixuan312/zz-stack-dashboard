'use client';

import { use } from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { FlowMini } from '@/components/Flow';
import { StateBadge, initiativeState } from '@/components/StateBadge';
import {
  EmptyState, PageControl, Table, TableBody, TableCell, TableHead, TableHeader,
  TableRow, Time, usePaged,
} from '@/components/ui';
import { useConsole, type Initiative, type Team, type TeamDetail } from '@/lib/api';

/**
 * One team: what it is working on, what it holds, and who is in it.
 *
 * THE DETAIL SHAPE: four tiles, the team's work as one full-width list, then its members. The tiles are what makes this page open like the Overview rather than like a
 * table with a title — the four things somebody arrives here to learn, before any list.
 */
export default function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const team = useConsole<TeamDetail>(`/teams/${slug}`);
  const inits = useConsole<{ initiatives: Initiative[] }>(`/initiatives?team=${slug}`);
  // THE COUNTS FROM THE TEAMS LIST, not a second query for the same numbers: that endpoint is
  // the one definition of what a team holds.
  const teams = useConsole<{ teams: Team[] }>('/teams');
  const held = teams.data?.teams.find((t) => t.slug === slug);
  const list = inits.data?.initiatives;
  const waiting = list?.filter((i) => initiativeState(i) === 'Waiting on you').length;

  return (
    <DashboardPage
      title={slug}
      description={team.data?.team.name ?? 'Team'}
      showPeriod={false}
      updatedAt={new Date()}
      metrics={
        list && team.data && held
          ? [
              { label: 'Initiatives', value: list.length, muted: list.length === 0,
                sublabel: `${list.filter((i) => !i.closed).length} still open` },
              { label: 'Waiting on you', value: waiting ?? 0, muted: !waiting, emphasis: !!waiting,
                sublabel: 'a gate needs a signature' },
              { label: 'Members', value: team.data.members.length, muted: team.data.members.length === 0,
                sublabel: `${team.data.members.filter((m) => m.role === 'admin').length} admin` },
              { label: 'Knowledge nodes', value: held.knowledge, muted: held.knowledge === 0,
                sublabel: `${held.documents} documents · ${held.sources} sources` },
            ]
          : undefined
      }
    >
      <Panel title="Initiatives" aside={list ? `${list.length}` : undefined} padded={false}>
        <Query query={inits} skeletonRows={4}>
          {(d) =>
            d.initiatives.length ? (
              <InitiativeTable initiatives={d.initiatives} />
            ) : (
              <div className="p-6">
                <EmptyState
                  illustration={{ src: '/assets/brand/state-empty.png', width: 96, height: 96 }}
                  icon={<Inbox />}
                  title="No initiatives yet"
                  description={`${slug} is provisioned but nobody has started a piece of work. The first brain dump into the Operations Agent creates one.`}
                />
              </div>
            )
          }
        </Query>
      </Panel>

      <Query query={team} skeletonRows={5}>
        {(d) => (
          <Panel title="Members" aside={`${d.members.length}`} padded={false}>
            <SimpleTable
              head={['Person', 'Role', 'Joined']}
              rows={d.members.map((m) => [m.email, m.role, m.joined])}
              empty="Nobody is in this team."
            />
          </Panel>
        )}
      </Query>
    </DashboardPage>
  );
}

/** The team's initiatives, paged. ITS OWN COMPONENT so it can hold the page state: the
 *  table is rendered inside a `Query` render prop, and a hook cannot be called from a
 *  callback. */
function InitiativeTable({ initiatives }: { initiatives: Initiative[] }) {
  const { page, controls } = usePaged(initiatives);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Initiative</TableHead>
            <TableHead hideBelow="md">Flow position</TableHead>
            <TableHead>State</TableHead>
            <TableHead hideBelow="xl">Docs</TableHead>
            <TableHead hideBelow="lg">Gates</TableHead>
            <TableHead hideBelow="lg">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((i) => (
            <TableRow key={i.slug}>
              <TableCell className="max-w-0 w-[40%]">
                <Link
                  href={`/initiatives/${i.team}/${i.slug}`}
                  title={i.slug}
                  className="block truncate font-medium text-accent hover:underline"
                >
                  {i.slug}
                </Link>
              </TableCell>
              <TableCell hideBelow="md"><FlowMini at={i.at} of={i.of} name={i.stage} /></TableCell>
              <TableCell><StateBadge of={i} /></TableCell>
              <TableCell hideBelow="xl" className="tabular-nums">{i.documents}</TableCell>
              <TableCell hideBelow="lg" className="whitespace-nowrap tabular-nums text-xs">
                {i.gates.filter((g) => g.passed).length} of {i.gates.length}
              </TableCell>
              <TableCell hideBelow="lg" className="whitespace-nowrap"><Time value={i.updated} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  const { page, controls } = usePaged(rows);
  if (!rows.length) return <p className="p-5 text-sm text-ink-faint">{empty}</p>;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>{head.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {page.map((r, i) => (
            <TableRow key={i}>
              {r.map((c, j) => (
                <TableCell key={j} className={j === 0 ? 'break-all font-medium text-ink' : 'text-xs'}>{c}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
