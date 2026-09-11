'use client';

import { AlertTriangle, Boxes, FileText, ListTree, Users } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { BarList } from '@/components/charts/BarList';
import { TrendChart } from '@/components/charts/TrendChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { formatCount } from '@/lib/format';
import { useConsole, useConsoleMode, type Overview } from '@/lib/api';
import { usePeriod } from '@/components/PeriodProvider';
import { PERIOD_LABEL } from '@/lib/period';

/**
 * The landing page — the fleet's census, or one team's.
 *
 * EVERY LABEL ON IT USED TO SAY "every team", and until the gateway's `/overview` learned
 * a scope that was simply true: the route was `teamless`, so a member's first screen was
 * the whole platform's numbers. Now that it answers per scope, the words have to move with
 * it — a page that reads "across every team" over one team's totals is worse than the leak
 * was, because the number is right and the sentence is wrong.
 *
 * TWO TILES ARE DROPPED IN TEAM MODE rather than filled in. `Teams` would read "1", and
 * `People`'s superadmin sublabel answers a platform question; a tile whose value is a
 * foregone conclusion is not a smaller version of the real one, it is furniture.
 *
 * THE PERIOD IS THE URL. `?period=` is read here and sent straight to the gateway, which
 * applies the cutoff in SQL — the page never filters rows it already has, because it does
 * not have them: 43,000 events are counted server-side and only the totals travel. That is
 * also what makes the picker linkable and refreshable, which a React state would not be.
 *
 * WHAT THE WINDOW MEANS, PER TILE, because it does not mean the same thing for all of
 * them. Events, failures, the chart, the refusal table and the event kinds are FLOWS —
 * things that happened, and a window over them is the obvious reading. Documents and
 * Initiatives are windowed on `updated_at`, so under a period they answer "touched since",
 * and the sublabel says so rather than leaving a smaller number to be read as a smaller
 * total. People and Teams are STATE, not flow: a headcount has no window that means
 * anything, so they ignore the picker and their sublabels never claim otherwise.
 */
/**
 * One bucket's axis label, in the grain the gateway chose.
 *
 * AN HOUR IS RENDERED IN THE READER'S OWN ZONE and a date is not. Every bucket arrives as
 * a UTC instant; taking `15:00` off that instant and printing it is 23:00 to somebody in
 * Singapore — eight hours wrong on every label, which is the exact failure the gateway's
 * "times go out as an instant" rule exists to prevent. A day, a week and a month need no
 * zone (the gateway's own words: "a day needs no zone"), so those are sliced from the ISO
 * string rather than pushed through a local conversion that could roll them onto the wrong
 * side of midnight.
 */
function bucketLabel(bucket: string, grain: Overview['grain']): string {
  if (grain === 'hour') {
    return new Date(bucket).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  // `2026-09-09T00:00:00Z` → `2026-09` for a month, `09-09` for a day or the week it opens.
  return grain === 'month' ? bucket.slice(0, 7) : bucket.slice(5, 10);
}

export default function OverviewPage() {
  const { period } = usePeriod();
  const q = useConsole<Overview>(period === 'all' ? '/overview' : `/overview?period=${period}`);
  const { mode } = useConsoleMode();
  const platform = mode === 'platform';
  const c = q.data?.counts;
  // "in this team" is only the whole truth when the window is all of it. Under a period
  // these two count what MOVED, and a tile that shrinks without saying why invites the
  // reader to think documents were deleted.
  const windowed = period !== 'all';
  const scopeNote = platform ? 'across every team' : 'in this team';
  const touched = windowed ? `touched · ${PERIOD_LABEL[period].toLowerCase()}` : scopeNote;

  return (
    <DashboardPage
      title="Overview"
      description={
        platform
          ? 'Everything the platform records, across every team.'
          : 'Everything the platform records for your team.'
      }
      showPeriod
      updatedAt={new Date()}
      metrics={
        c
          ? [
              ...(platform
                ? [
                    { label: 'Teams', value: formatCount(c.teams), icon: <Users />,
                      sublabel: `${c.activeTeams} active` },
                    { label: 'People', value: formatCount(c.people), icon: <Boxes />,
                      sublabel: `${c.superadmins} superadmin` },
                  ]
                : [
                    { label: 'People', value: formatCount(c.people), icon: <Boxes />,
                      sublabel: 'in this team' },
                  ]),
              { label: 'Initiatives', value: formatCount(c.initiatives), icon: <ListTree />,
                sublabel: touched },
              { label: 'Documents', value: formatCount(c.documents), icon: <FileText />,
                sublabel: windowed ? touched : undefined },
              // ONE attention tile, and it is the number somebody would act on.
              { label: 'Failing calls', value: formatCount(c.failures), icon: <AlertTriangle />,
                emphasis: true,
                sublabel: `of ${formatCount(c.events)} events` },
            ]
          : undefined
      }
    >
      <Query query={q}>
        {(d) => (
          <div className="flex flex-col gap-4">
            {/* The aside names the teamless remainder because the Teams page shows a
                per-team figure and the two will never add up: turns, tool calls made
                outside a team, and admin acts that belong to a person carry no team by
                design. A reader who tries the addition should find the answer here
                rather than assume a bug.

                NOT IN TEAM MODE, where the remainder is 0 by construction — the gateway
                reaches these events through `team_id`, so none of them can be teamless.
                "0 belong to no team" is a true sentence answering a question nobody in
                that view is asking. */}
            <Panel
              title={`Events per ${d.grain}`}
              aside={
                platform
                  ? `${formatCount(d.counts.events)} recorded · ${formatCount(d.counts.unattributedEvents)} belong to no team`
                  : `${formatCount(d.counts.events)} recorded`
              }
            >
              <TrendChart
                points={d.trend.map((x) => ({
                  date: x.bucket,
                  // AN HOUR IS RENDERED IN THE READER'S ZONE, a day is not. The gateway
                  // sends every bucket as a UTC instant; a bare `15:00` off that instant
                  // is 23:00 to somebody in Singapore, which is the exact failure the
                  // gateway's own "times go out as an instant" rule exists for. A day
                  // needs no zone, so it keeps the plain MM-DD the axis already used.
                  label: bucketLabel(x.bucket, d.grain),
                  events: x.events,
                  failures: x.failures,
                }))}
                series={[
                  { key: 'events', label: 'Events', shape: 'area' },
                  { key: 'failures', label: 'Refusals', shape: 'line', tint: 'rose' },
                ]}
              />
            </Panel>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Panel
                title="Most-refused calls"
                aside={`${formatCount(d.counts.failures)} failures`}
                padded={false}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tool</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead>Why it refused</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.refusals.map((r) => (
                      <TableRow key={`${r.block}-${r.tool}-${r.n}`}>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-ink">
                          {r.tool}
                          <span className="block text-[11px] text-ink-faint">{r.block}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{r.n}</TableCell>
                        <TableCell className="max-w-[36ch] truncate text-xs" title={r.refusal}>
                          {r.refusal}
                        </TableCell>
                      </TableRow>
                    ))}
                  
                    {d.refusals.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="py-8 text-center text-ink-faint">No block has refused a call in this window.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Panel>

              <Panel title="Event kinds" aside={`${d.eventKinds.length} kinds`}>
                <BarList
                  limit={10}
                  rows={d.eventKinds.map((k) => ({
                    key: k.kind,
                    label: <span className="font-mono text-xs">{k.kind}</span>,
                    value: k.n,
                    caption: k.failed ? `${k.failed} refused` : undefined,
                    tint: k.failed ? 'rose' : undefined,
                  }))}
                />
              </Panel>
            </div>
          </div>
        )}
      </Query>
    </DashboardPage>
  );
}
