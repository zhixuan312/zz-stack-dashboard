'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { Facet, tally } from '@/components/TableFacet';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, Button, EmptyState, PageControl, SearchInput, Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, Toolbar, usePaged,
} from '@/components/ui';
import { formatCount } from '@/lib/format';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import { type Team } from '@/lib/api-shapes';

export default function TeamsPage() {
  const { mode } = useConsoleMode();
  const q = useConsole<{ teams: Team[] }>('/teams');

  return (
    <DashboardPage
      title="Teams"
      description={mode === 'team'
        ? 'Your team: who is in it and what it holds.'
        : 'Every team on the platform: who is in it and what it holds.'}
      showPeriod={false}
      updatedAt={freshnessOf(q)}
    >
      <Query query={q}>
        {(d) => (
          <TeamsPanel teams={d.teams} />
        )}
      </Query>
    </DashboardPage>
  );
}

/** Count headers never wrap; where each column ALIGNS is the Table's own rule. */
const NUM = 'whitespace-nowrap';

/**
 * Its own component so it can hold the filter and page state — see `InitiativeTable` on
 * /initiatives, whose toolbar this matches deliberately.
 *
 * THE SAME TOOLBAR EVERYWHERE OR IT IS NOT A TOOLBAR. This table had a pager and no filter,
 * which is the half that stops mattering first: paging answers "show me more" and filtering
 * answers "show me the one I came for", and a reader who has learned the second control on
 * /initiatives finds nothing here. Three teams do not need either — a hundred do, and the
 * page that acquires them should not be the one that has to grow the control.
 */
function TeamsPanel({ teams }: { teams: Team[] }) {
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const needle = filter.trim().toLowerCase();
  const rows = teams.filter((t) =>
    (!needle || t.slug.toLowerCase().includes(needle) || t.name.toLowerCase().includes(needle))
    && (!status || t.status === status));

  return (
    <Panel
      title="All teams"
      // THE SHOWN COUNT AND THE TOTAL, because a filtered table whose header still says
      // "3 total" is a table claiming to show rows it is hiding.
      aside={rows.length === teams.length
        ? `${teams.length} total`
        : `${rows.length} of ${teams.length}`}
      padded={false}
    >
      {teams.length === 0
        ? <p className="p-6 text-sm text-ink-faint">No team yet.</p>
        : (
          <>
            <Toolbar className="border-b border-line p-3">
              <div className="min-w-0 flex-1">
                <SearchInput label="teams" value={filter} onChange={setFilter} />
              </div>
              {/* Counted over every team rather than over the filtered rows, so the numbers
                  beside the options do not change as the search narrows — a facet whose
                  counts move while you type cannot be used to decide what to pick. */}
              <Facet all="All statuses" values={tally(teams.map((t) => t.status))}
                     value={status} onChange={setStatus} />
            </Toolbar>
            {rows.length === 0
              ? (
                <EmptyState
                  illustration={{ src: '/assets/brand/state-empty.png', width: 96, height: 96 }}
                  icon={<SearchX className="size-5" aria-hidden />}
                  title="No team matches"
                  description="Nothing here matches the search and filter above."
                  action={<Button variant="secondary" onClick={() => { setFilter(''); setStatus(null); }}>Clear</Button>}
                />
              )
              : <TeamTable teams={rows} resetKey={`${needle}|${status ?? ''}`} />}
          </>
        )}
    </Panel>
  );
}

function TeamTable({ teams, resetKey }: { teams: Team[]; resetKey: string }) {
  const { page, controls } = usePaged(teams, resetKey);
  const count = (n: number) => (n ? formatCount(n) : '—');
  return (
    <>
      {/* HOW THE WIDTH IS SHARED. Every count column is the same width; Team gets a share
          of its own; Status is as wide as its badge. The spare width is spread across all of
          them, never handed to one column — Team taking everything left over put half the
          table between the names and the first figure. Headers never wrap; where each column
          aligns is the Table primitive's rule, not this page's. */}
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
            <TableHead hideBelow="md" className={NUM}>Status</TableHead>
            <TableHead hideBelow="md" className={NUM}>People</TableHead>
            <TableHead className={NUM}>Initiatives</TableHead>
            <TableHead hideBelow="xl" className={NUM}>Documents</TableHead>
            <TableHead hideBelow="xl" className={NUM}>Sources</TableHead>
            <TableHead hideBelow="lg" className={NUM} title="Knowledge nodes on the team's shelf">Knowledge</TableHead>
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
              <TableCell hideBelow="md">
                <Badge variant={t.status === 'active' ? 'sage' : 'neutral'} dot>
                  {t.status}
                </Badge>
              </TableCell>
              <TableCell hideBelow="md" className="tabular-nums">{t.members}</TableCell>
              <TableCell className="tabular-nums">{count(t.initiatives)}</TableCell>
              <TableCell hideBelow="xl" className="tabular-nums">{count(t.documents)}</TableCell>
              <TableCell hideBelow="xl" className="tabular-nums">{count(t.sources)}</TableCell>
              <TableCell hideBelow="lg" className="tabular-nums">{count(t.knowledge)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
