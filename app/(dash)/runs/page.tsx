'use client';

import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Banner, MetricCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { formatCount } from '@/lib/format';
import { useConsole, type Runs, type Skill } from '@/lib/api';

function dur(s: number): string {
  if (!s) return '—';
  if (s >= 3600) return `${(s / 3600).toFixed(1)} h`;
  if (s >= 60) return `${Math.round(s / 60)} min`;
  return `${Math.round(s)} s`;
}

export default function RunsPage() {
  const runs = useConsole<Runs>('/runs');
  const skills = useConsole<{ skills: Skill[] }>('/skills');

  return (
    <DashboardPage
      title="Runs"
      description="Every recorded run, by the skill that drove it."
      showPeriod={false}
      updatedAt={new Date()}
    >
      <Query query={runs}>
        {(r) => (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Runs" value={formatCount(r.totals.runs)} />
              <MetricCard label="Tool calls" value={formatCount(r.totals.calls)}
                sublabel={`${formatCount(r.totals.refusals)} refused`} />
              {/* The sublabel is a CLAIM, so it only appears when there is something to
                  claim it about. It read "recorded, but not linked to a run" beside a zero
                  on a platform that has never run anything, which describes a defect that
                  is really an empty table. */}
              <MetricCard label="LLM turns" value={r.gaps.turnEvents ? formatCount(r.gaps.turnEvents) : '—'}
                sublabel={r.gaps.turnEvents && !r.gaps.turnsAttributed ? 'recorded, but not linked to a run' : undefined}
                emphasis muted={!r.gaps.turnsAttributed} />
              <MetricCard label="Payload moved" value={`${r.totals.mb} MB`} />
            </div>

            {/* The gaps are stated as data, not as a hardcoded caveat — they
                disappear from the page by themselves the day the platform
                starts recording these. */}
            {!r.gaps.turnsAttributed ? (
              <Banner
                variant="warning"
                title="Turns are recorded but not attributed"
                description={`zz.run.turns is 0 on all ${r.totals.runs} rows, while the event log holds ${formatCount(r.gaps.turnEvents)} turn events with no step and no run id. Cost per document is therefore unanswerable today. It is a one-column platform fix.`}
              />
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <Panel title="Every skill, side by side" padded={false}>
                <Query query={skills} skeletonRows={6}>
                  {(s) => (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Skill</TableHead>
                          <TableHead className="text-right">Runs</TableHead>
                          <TableHead className="text-right">Calls</TableHead>
                          <TableHead className="text-right">Avg</TableHead>
                          <TableHead className="text-right">Peak</TableHead>
                          <TableHead className="text-right">Refused</TableHead>
                          <TableHead className="text-right">Median</TableHead>
                          <TableHead className="text-right">Longest</TableHead>
                          <TableHead className="text-right">Per run</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...s.skills].sort((a, b) => b.runs - a.runs).map((k) => (
                          <TableRow key={`${k.name}-${k.version}`}>
                            <TableCell className="whitespace-nowrap">
                              <span className="font-medium text-ink">{k.name}</span>{' '}
                              <span className="font-mono text-xs text-ink-faint">{k.version}</span>
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{k.runs}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCount(k.calls)}</TableCell>
                            <TableCell className="text-right tabular-nums">{k.callsAvg.toFixed(1)}</TableCell>
                            <TableCell className="text-right tabular-nums text-xs">{k.callsMax}</TableCell>
                            <TableCell className="text-right tabular-nums text-xs">
                              {k.refusals
                                ? <span className="text-[var(--rose-deep)]">{k.refusals}</span>
                                : <span className="text-ink-faint">—</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs">{dur(k.durationMedian)}</TableCell>
                            <TableCell className="text-right tabular-nums text-xs">{dur(k.durationMax)}</TableCell>
                            <TableCell className="whitespace-nowrap text-right tabular-nums text-xs">
                              {k.kbPerRun >= 1024 ? `${(k.kbPerRun / 1024).toFixed(1)} MB` : `${Math.round(k.kbPerRun)} KB`}
                            </TableCell>
                          </TableRow>
                        ))}
                        {s.skills.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-ink-faint">
                              No skill in this flow has a recorded run yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Query>
              </Panel>
            </div>
          </div>
        )}
      </Query>
    </DashboardPage>
  );
}
