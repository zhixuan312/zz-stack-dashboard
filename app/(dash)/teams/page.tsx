'use client';

import Link from 'next/link';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, PageControl, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, usePaged,
} from '@/components/ui';
import { formatCount } from '@/lib/format';
import { useConsole, type Team } from '@/lib/api';

export default function TeamsPage() {
  const q = useConsole<{ teams: Team[] }>('/teams');

  return (
    <DashboardPage
      title="Teams"
      description="Every team on the platform: who is in it and what it holds."
      showPeriod={false}
      updatedAt={new Date()}
    >
      <Query query={q}>
        {(d) => (
          <Panel
            title="All teams"
            aside={`${d.teams.length} total`}
            padded={false}
          >
            {d.teams.length === 0
              ? <p className="p-6 text-sm text-ink-faint">No team yet.</p>
              : <TeamTable teams={d.teams} />}
          </Panel>
        )}
      </Query>
    </DashboardPage>
  );
}

/** Alignment: the first column left, the last right, every column between centred. */
const MID = 'whitespace-nowrap text-center';
const LAST = 'whitespace-nowrap text-right';

/** Its own component so it can hold the page state — see `InitiativeTable` on /initiatives. */
function TeamTable({ teams }: { teams: Team[] }) {
  const { page, controls } = usePaged(teams);
  const count = (n: number) => (n ? formatCount(n) : '—');
  return (
    <>
      {/* HOW THE WIDTH IS SHARED. Every count column is the same width; Team gets a share
          of its own; Status is as wide as its badge. The spare width is spread across all of
          them, never handed to one column — Team taking everything left over put half the
          table between the names and the first figure. Headers never wrap; header and cell
          share an alignment — first column left, last right, the rest centred. */}
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[18%]" />
          <col className="hidden w-28 md:table-column" />
          <col className="hidden md:table-column" />
          <col />
          <col className="hidden xl:table-column" />
          <col className="hidden xl:table-column" />
          <col className="hidden lg:table-column" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead hideBelow="md" className={MID}>Status</TableHead>
            <TableHead hideBelow="md" className={MID}>People</TableHead>
            <TableHead className={MID}>Initiatives</TableHead>
            <TableHead hideBelow="xl" className={MID}>Documents</TableHead>
            <TableHead hideBelow="xl" className={MID}>Sources</TableHead>
            <TableHead hideBelow="lg" className={LAST} title="Knowledge nodes on the team's shelf">Knowledge</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((t) => (
            <TableRow key={t.slug}>
              <TableCell>
                <Link href={`/teams/${t.slug}`} className="font-medium text-accent hover:underline">
                  {t.slug}
                </Link>
                <span className="block text-xs text-ink-faint">{t.name}</span>
              </TableCell>
              <TableCell hideBelow="md" className="text-center">
                <Badge variant={t.status === 'active' ? 'sage' : 'neutral'} dot>
                  {t.status}
                </Badge>
              </TableCell>
              <TableCell hideBelow="md" className="text-center tabular-nums">{t.members}</TableCell>
              <TableCell className="text-center tabular-nums">{count(t.initiatives)}</TableCell>
              <TableCell hideBelow="xl" className="text-center tabular-nums">{count(t.documents)}</TableCell>
              <TableCell hideBelow="xl" className="text-center tabular-nums">{count(t.sources)}</TableCell>
              <TableCell hideBelow="lg" className="text-right tabular-nums">{count(t.knowledge)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
