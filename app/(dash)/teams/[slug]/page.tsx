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
import { freshnessOf, useConsole } from '@/lib/api';
import { type Initiative, type Team, type TeamDetail } from '@/lib/api-shapes';

/**
 * One team: what it is working on, what it holds, and who is in it.
 *
 * Four tiles, the team's work as one full-width list, then its members, so the page opens
 * as the Overview does rather than as a table with a title.
 */
export default function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const team = useConsole<TeamDetail>(`/teams/${slug}`);
  const inits = useConsole<{ initiatives: Initiative[] }>(`/initiatives?team=${slug}`);
  // The counts come from the teams list, not a second query for the same numbers: that
  // endpoint is the one definition of what a team holds.
  const teams = useConsole<{ teams: Team[] }>('/teams');
  const held = teams.data?.teams.find((t) => t.slug === slug);
  const list = inits.data?.initiatives;
  const waiting = list?.filter((i) => initiativeState(i) === 'Waiting on you').length;

  return (
    <DashboardPage
      title={slug}
      description={team.data?.team.name ?? 'Team'}
      showPeriod={false}
      updatedAt={freshnessOf(team, inits)}
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

/** The team's initiatives, paged. Its own component so it can hold the page state: the table
 *  renders inside a `Query` render prop, and a hook cannot be called from a callback. */
function InitiativeTable({ initiatives }: { initiatives: Initiative[] }) {
  const { page, controls } = usePaged(initiatives);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Initiative</TableHead>
            {/* COUPLED: Flow sits immediately left of Flow position, as on /initiatives. A
                position like "S5" is flow-relative — the same number names a different step in
                each flow — so the two read as one fact and sit together. */}
            <TableHead hideBelow="lg">Flow</TableHead>
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
              {/* `flow` is nullable and renders as "not declared" rather than blank: an
                  initiative with no flow has no chain of gates resolved against it, so no
                  required document and no closing rule is enforced on it. COUPLED: the same
                  words on /initiatives. */}
              <TableCell hideBelow="lg" className="whitespace-nowrap text-[13px]">
                {i.flow
                  ? <span className="text-ink-soft">{i.flow}</span>
                  : <span className="text-ink-faint italic">not declared</span>}
              </TableCell>
              <TableCell hideBelow="md"><FlowMini at={i.at} of={i.of} name={i.stage} /></TableCell>
              <TableCell><StateBadge of={i} /></TableCell>
              <TableCell hideBelow="xl" className="tabular-nums">{i.documents}</TableCell>
              <TableCell hideBelow="lg" className="whitespace-nowrap tabular-nums text-xs">
                {i.gates.filter((g) => g.role !== 'handover' && g.passed).length} of{' '}
                {i.gates.filter((g) => g.role !== 'handover').length}
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
