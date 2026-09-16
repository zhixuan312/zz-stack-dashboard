'use client';

import { useState } from 'react';
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
  Badge, Button, EmptyState, PageControl, SearchInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time, Toolbar, TZ_LABEL, usePaged,
} from '@/components/ui';
import { useConsole, type Initiative } from '@/lib/api';

/** One facet, as a Select built from the rows themselves.
 *
 * NOT A CHIP ROW, and not a fixed list of teams. Chips were a third button style beside the
 * kit's own controls, they stacked into three rows above the table, and they break the moment
 * there are ten teams — which is a thing that happens without this file being touched. A
 * Select carries its own active state in its trigger, keeps the counts beside each option,
 * and comes with keyboard and screen-reader behaviour that hand-rolled buttons do not.
 *
 * "All" is the absence of a choice rather than an option beside the others: an unselected
 * facet already means all of them, and a pill saying so is a control that does nothing.
 */
function Facet({ all, values, value, onChange }: {
  all: string; values: [string, number][]; value: string | null; onChange: (v: string | null) => void;
}) {
  // RENDERED IN THE ORDER GIVEN, which is the caller's decision and not this component's:
  // `tally` sorts by frequency, right for teams and flows; `tallyStates` keeps the state
  // vocabulary's own progression, because a reader scanning for "Waiting on you" should
  // find it in the same place every time rather than wherever this week's counts put it.
  if (values.length < 2) return null;
  return (
    <Select value={value ?? '*'} onValueChange={(v) => onChange(v === '*' ? null : v)}>
      <SelectTrigger className="w-[13rem]">
        <SelectValue placeholder={all} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="*">{all}</SelectItem>
        {values.map(([v, n]) => (
          <SelectItem key={v} value={v}>
            <span className="flex w-full items-center justify-between gap-4">
              <span className="truncate">{v}</span>
              <span className="tabular-nums text-ink-faint">{n}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const tally = (xs: (string | null)[]): [string, number][] => {
  const m = new Map<string, number>();
  for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

/** The same tally, in the vocabulary's own order, dropping states nothing is in — an
 *  option counting zero is a filter that empties the table by design. */
const tallyStates = (xs: string[]): [string, number][] => {
  const m = new Map(tally(xs));
  return INITIATIVE_STATES.filter((st) => m.has(st)).map((st) => [st, m.get(st)!] as [string, number]);
};

export default function InitiativesPage() {
  const q = useConsole<{ initiatives: Initiative[] }>('/initiatives');
  const [filter, setFilter] = useState('');
  const [team, setTeam] = useState<string | null>(null);
  const [flow, setFlow] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  // THE DATE IS THE REPORTING PERIOD, the same control the Overview carries, held in the
  // same context — so a window chosen on one page is still the window on the other. It sits
  // in the page header rather than in the toolbar below because it scopes what this page is
  // ABOUT, where the facets narrow within that; and because a second, differently-shaped
  // date control beside the Selects would be a fourth control style on one screen.
  const { period, setPeriod } = usePeriod();
  const needle = filter.trim().toLowerCase();

  return (
    <DashboardPage
      title="Initiatives"
      description="Every piece of work on the platform, and how far through the flow it got."
      showPeriod
      updatedAt={new Date()}
    >
      <Query query={q}>
        {(d) => {
          // THE WINDOW IS APPLIED FIRST, and the facet counts are tallied from what
          // survives it. A date range is not a fourth facet — it says which initiatives
          // this page is talking about at all — so a flow reading "ops-flow 50" while the
          // last 7 days hold three of them is a count that answers a question nobody asked
          // and empties the table when clicked. Narrowing WITHIN the window is what the
          // Selects do, and their counts stay stable as the others move, which is the same
          // rule the knowledge shelf's tag facet follows.
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
            // "Needs a signature" is the question this page gets opened for, and it was the
            // one thing the list could not be narrowed to.
            && (!openOnly || i.gates.some((g) => !g.passed)));
          return (
            <Panel
                title="All initiatives"
                // NAMES THE WINDOW when there is one. "12 of 57" under a 7-day period reads
                // as 45 missing initiatives rather than 45 untouched ones, and the reader
                // has no way to tell which from the number alone.
                aside={
                  since
                    ? `${rows.length} of ${inWindow.length} updated · ${PERIOD_LABEL[period].toLowerCase()}`
                    : `${rows.length} of ${d.initiatives.length}`
                }
                padded={false}
              >
                {/* THE CONTROL BELONGS TO THE LIST IT FILTERS. It floated above the
                    panel as an input attached to nothing, and the relationship
                    between typing there and the rows changing was left to be
                    inferred. Pinned inside the panel, above its own table. */}
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
                {rows.length === 0 && (
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
 * ITS OWN COMPONENT so it can hold the page state: the rows are computed inside a `Query`
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
            {/* THE FLOW ITSELF, which this table never showed. "Flow position" is
                FLOW-RELATIVE -- S5 is `plan audit` on sdlc-flow and `build` on
                ops-flow -- so two rows both reading "S5" were at unrelated stages and
                the page gave no way to tell them apart. The flow was already in the
                payload; only the facet used it. It sits immediately left of the
                position so the two read as one fact.
                Docs went to make room: a bare document count answered nothing this
                page is opened for, while Gates answers "does this need a signature". */}
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
              {/* `flow` is NULLABLE, and a blank cell would hide why. An initiative
                  with no flow has no chain of gates resolved against it -- no required
                  document and no closing rule is enforced on it -- so it is a defect
                  the page should name, not whitespace. */}
              <TableCell hideBelow="2xl" className="whitespace-nowrap text-[13px]">
                {i.flow
                  ? <span className="text-ink-soft">{i.flow}</span>
                  : <span className="text-ink-faint italic">not declared</span>}
              </TableCell>
              <TableCell hideBelow="lg"><FlowMini at={i.at} of={i.of} name={i.stage} /></TableCell>
              <TableCell><StateBadge of={i} /></TableCell>
              <TableCell hideBelow="lg" className="whitespace-nowrap text-xs tabular-nums">
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
