'use client';

import { useState } from 'react';
import { Facet, tally } from '@/components/TableFacet';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { FlowMini } from '@/components/Flow';
import { INITIATIVE_STATES, StateBadge, initiativeState } from '@/components/StateBadge';
import { usePeriod } from '@/components/PeriodProvider';
import { DEFAULT_PERIOD, PERIOD_LABEL, periodCutoff } from '@/lib/period';
import {
  Badge, Button, EmptyState, PageControl, SearchInput, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time, Toolbar, TZ_LABEL, usePaged,
} from '@/components/ui';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import { type Initiative } from '@/lib/api-shapes';


/** The same tally, in the vocabulary's own order, dropping states nothing is in — an
 *  option counting zero is a filter that empties the table by design. */
const tallyStates = (xs: string[]): [string, number][] => {
  const m = new Map(tally(xs));
  return INITIATIVE_STATES.filter((st) => m.has(st)).map((st) => [st, m.get(st)!] as [string, number]);
};

export default function InitiativesPage() {
  const { mode } = useConsoleMode();
  const q = useConsole<{ initiatives: Initiative[] }>('/initiatives');
  const [filter, setFilter] = useState('');
  const [team, setTeam] = useState<string | null>(null);
  const [flow, setFlow] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  // The date is the reporting period, held in the same context the Overview reads, so a
  // window chosen on one page is still the window on the other. It sits in the page header
  // rather than the toolbar because it scopes what this page is about; the facets narrow
  // within that.
  const { period, setPeriod } = usePeriod();
  const needle = filter.trim().toLowerCase();

  return (
    <DashboardPage
      title="Initiatives"
      // The scope the read actually has: the gateway narrows this list to the caller's own
      // team unless they are in platform mode, so the sentence switches on `mode` too.
      description={mode === 'team'
        ? "Every piece of work your team has open or closed, and how far through the flow it got."
        : "Every piece of work on the platform, and how far through the flow it got."}
      showPeriod
      updatedAt={freshnessOf(q)}
    >
      <Query query={q}>
        {(d) => {
          // The window is applied first and the facet counts are tallied from what survives
          // it, because a date range says which initiatives this page is talking about at
          // all. The Selects narrow within it, and their counts stay stable as the others
          // move.
          const since = periodCutoff(period);
          const inWindow = since
            ? d.initiatives.filter((i) => new Date(i.updated) >= since)
            : d.initiatives;
          const rows = inWindow.filter((i) =>
            (!needle || i.slug.toLowerCase().includes(needle) || i.team.toLowerCase().includes(needle)
              || (i.flow ?? '').toLowerCase().includes(needle))
            && (!team || i.team === team)
            && (!flow || i.flow === flow)
            && (!state || initiativeState(i) === state)
            // Written and unsigned. An unwritten gate document is not "needs a signature":
            // there is nothing for a person to read, so `!passed` alone would list
            // initiatives nobody can act on.
            && (!openOnly || i.gates.some((g) => g.role !== 'handover' && g.written && !g.passed)));
          // Whether the reader narrowed anything — the date window included, since it is a
          // control on this page like any other.
          const filtered = !!needle || !!team || !!flow || !!state || openOnly
            || period !== DEFAULT_PERIOD;
          return (
            <Panel
                title="All initiatives"
                // Names the window when there is one: "12 of 57" alone reads as 45 missing
                // initiatives rather than 45 untouched ones.
                aside={
                  since
                    ? `${rows.length} of ${inWindow.length} updated · ${PERIOD_LABEL[period].toLowerCase()}`
                    : `${rows.length} of ${d.initiatives.length}`
                }
                padded={false}
              >
                {/* The control belongs to the list it filters, so it sits inside the panel
                    above its own table rather than floating over it. */}
                <Toolbar className="border-b border-line p-3">
                  <div className="min-w-0 flex-1">
                    <SearchInput label="initiatives" value={filter} onChange={setFilter} />
                  </div>
                  <Facet all="All teams" values={tally(inWindow.map((i) => i.team))}
                         value={team} onChange={setTeam} />
                  <Facet all="All flows" values={tally(inWindow.map((i) => i.flow))}
                         value={flow} onChange={setFlow} />
                  <Facet all="All states"
                         values={tallyStates(inWindow.map(initiativeState))}
                         value={state} onChange={setState} />
                  <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[13px] text-ink-soft">
                    <Switch checked={openOnly} onCheckedChange={setOpenOnly} />
                    Open gates only
                  </label>
                </Toolbar>
                <InitiativeTable
                  rows={rows}
                  resetKey={JSON.stringify([needle, team, flow, state, openOnly, period])}
                />
                {/* Two empty states: only one of them is the reader's doing. On a fresh
                    install with every facet unset, "nothing matches those filters" blames
                    filters nobody set and offers a Clear button that does nothing. */}
                {rows.length === 0 && (
                  filtered ? (
                    <EmptyState
                      illustration={{ src: '/assets/brand/state-empty.png', width: 96, height: 96 }}
                      icon={<SearchX className="size-5" aria-hidden />}
                      title="Nothing matches those filters"
                      description="No initiative matches every filter at once. The date window counts too."
                      action={
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setFilter(''); setTeam(null); setFlow(null); setState(null);
                            setOpenOnly(false); setPeriod(DEFAULT_PERIOD);
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      illustration={{ src: '/assets/brand/state-empty.png', width: 96, height: 96 }}
                      icon={<SearchX className="size-5" aria-hidden />}
                      title="No initiatives yet"
                      description="Nothing has been opened here. An initiative starts with initiative_open, and every document written afterwards lands under it."
                    />
                  )
                )}
              </Panel>
          );
        }}
      </Query>
    </DashboardPage>
  );
}

/** The list, ten rows at a time, like every list in the console.
 *
 * Its own component so it can hold the page state: the rows are computed inside a `Query`
 * render prop, and a hook cannot be called from a callback. `resetKey` is every filter at
 * once, so narrowing the list always lands on its first page. */
function InitiativeTable({ rows, resetKey }: { rows: Initiative[]; resetKey: string }) {
  const { page, controls } = usePaged(rows, resetKey);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Initiative</TableHead>
            <TableHead hideBelow="md">Team</TableHead>
            {/* "Flow position" is flow-relative — S5 is `plan audit` on sdlc-flow and
                `report` on zz-plugin-eval — so the flow sits immediately left of the position
                and the two read as one fact. */}
            <TableHead hideBelow="2xl">Flow</TableHead>
            <TableHead hideBelow="lg">Flow position</TableHead>
            <TableHead>State</TableHead>
            <TableHead hideBelow="lg">Gates</TableHead>
            <TableHead hideBelow="lg">Updated <span className="font-normal text-ink-faint">({TZ_LABEL})</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((i) => (
            <TableRow key={`${i.team}/${i.slug}`}>
              <TableCell className="w-[32%] max-w-0">
                <Link
                  href={`/initiatives/${i.team}/${i.slug}`}
                  title={i.slug}
                  className="block truncate whitespace-nowrap font-medium text-accent hover:underline"
                >
                  {i.slug}
                </Link>
              </TableCell>
              <TableCell hideBelow="md"><Badge variant="neutral">{i.team}</Badge></TableCell>
              {/* `flow` is nullable and a blank cell would hide why: an initiative with
                  no flow has no chain of gates resolved against it, so no required
                  document and no closing rule is enforced on it. */}
              <TableCell hideBelow="2xl" className="whitespace-nowrap text-[13px]">
                {i.flow
                  ? <span className="text-ink-soft">{i.flow}</span>
                  : <span className="text-ink-faint italic">not declared</span>}
              </TableCell>
              <TableCell hideBelow="lg"><FlowMini at={i.at} of={i.of} name={i.stage} /></TableCell>
              <TableCell><StateBadge of={i} /></TableCell>
              <TableCell hideBelow="lg" className="whitespace-nowrap text-xs tabular-nums">
                {/* The flow's own gates. The derived handover is a real gate, but it is
                    signed after the close, so counting it leaves an initiative that passed
                    every gate its flow declares reading as one short. */}
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
