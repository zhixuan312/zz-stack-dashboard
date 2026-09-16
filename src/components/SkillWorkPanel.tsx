'use client';

import { useState } from 'react';
import { Panel } from '@/components/Panel';
import {
  Badge, Segmented, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCount, formatSeconds } from '@/lib/format';
import { CHART_EDGE } from '@/lib/tints';
import type { Skill } from '@/lib/api';

/**
 * Where the work happens — every skill that ran in the window, ranked on whichever cost the
 * reader is asking about.
 *
 * THE FOUR AXES ARE FOUR DIFFERENT QUESTIONS and the ranking flips between them. Measured on
 * this deployment: sdlc-explore leads on runs (60) and is nearly last on total time (28s);
 * sdlc-spec 1.2 ran six times and spent seven hours. "Which skill is the platform busiest
 * with" and "which skill is the platform spending its life inside" have different answers,
 * and a table sorted one way only ever tells one of them.
 *
 * THE BAR CARRIES THE SELECTED AXIS, not a fixed column. A bar that always drew calls beside
 * a table sorted by time would be a picture of the wrong quantity — the toggle has to move
 * the visual or it is only a sort, and the reader is left comparing a bar against a ranking
 * it does not explain. One bar, and the segmented control says what it means.
 *
 * This replaced a nine-column table (runs · calls · avg · peak · refused · median · longest ·
 * per run) that ranked by runs forever and truncated on any laptop. Every column it dropped
 * was a second-order statistic nobody sorted by; what it gained is the team and the total.
 */
export function SkillWorkPanel({ skills }: { skills: Skill[] }) {
  const [axis, setAxis] = useState<Axis>('calls');

  const rows = [...skills].sort((a, b) => metric(b, axis) - metric(a, axis));
  const scale = Math.max(...rows.map((k) => metric(k, axis)), 0);
  const totalRuns = skills.reduce((n, k) => n + k.runs, 0);
  const totalCalls = skills.reduce((n, k) => n + k.calls, 0);
  /* The caveat is stated once, as a measurement, and only when it applies — see the gateway's
     /skills comment for why a single-call run has no span to report. On an empty window there
     is nothing to caveat, and a note that fires on emptiness teaches the reader to skip it. */
  const untimed = skills.reduce((n, k) => n + (k.runs - k.timedRuns), 0);

  return (
    <Panel
      title={
        <span className="flex flex-col gap-1">
          <span>Where the work happens</span>
          <span className="t-micro font-normal text-ink-faint">
            Every skill that ran in this window, by {AXES.find((a) => a.value === axis)!.noun}.
          </span>
        </span>
      }
      aside={
        <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <span className="tabular-nums text-ink-soft">
            {formatCount(totalRuns)} runs · {formatCount(totalCalls)} calls
          </span>
          <Segmented
            label="Rank skills by"
            value={axis}
            onChange={(v) => setAxis(v as Axis)}
            options={AXES.map((a) => ({ value: a.value, label: a.label }))}
          />
        </span>
      }
      padded={false}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Skill</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">Runs</TableHead>
            <TableHead className="text-right">Median</TableHead>
            <TableHead className="text-right">Total time</TableHead>
            <TableHead className="text-right">Calls</TableHead>
            {/* The bar's header is the axis it is drawing, so the column is never an
                unlabelled decoration the way it is when the toggle only sorts. */}
            <TableHead className="w-[9rem]">{AXES.find((a) => a.value === axis)!.label}</TableHead>
            <TableHead className="text-right">Refused</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((k) => {
            const v = metric(k, axis);
            const pct = scale > 0 && v > 0 ? Math.max(1.5, (v / scale) * 100) : 0;
            return (
              <TableRow key={`${k.name}-${k.version}`}>
                <TableCell className="whitespace-nowrap">
                  <span className="font-medium text-ink">{k.name}</span>{' '}
                  <span className="font-mono text-xs text-ink-faint">{k.version}</span>
                  {/* Retired travels with the row for the same reason the gateway emits it:
                      these rows own their history and must not read as current. */}
                  {k.retired ? <span className="ml-1.5 t-micro text-ink-faint">retired</span> : null}
                </TableCell>
                <TableCell>
                  {k.teams.length === 0 ? (
                    // NOT AN EMPTY CELL. 28 runs on this deployment carry no initiative and so
                    // no team; a blank reads as "we failed to look it up" rather than as the
                    // fact that a block usage skill runs outside any initiative.
                    <span className="t-micro text-ink-faint">no team</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {k.teams.map((t) => (
                        <Badge key={t} size="sm" variant="neutral">{t}</Badge>
                      ))}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{k.runs}</TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  <span className={cn(k.durationMedian === null && 'text-ink-faint')}>
                    {formatSeconds(k.durationMedian)}
                  </span>
                  {/* WHAT THE MEDIAN IS A MEDIAN OF, whenever that is not the run count in the
                      column beside it. sdlc-plan reads "25 min · 3 of 34 timed" — a real number
                      resting on thin evidence, which is a different thing from a typical run
                      and the reader cannot tell them apart without this. */}
                  {k.timedRuns < k.runs ? (
                    <span className="block t-micro text-ink-faint">
                      {k.timedRuns ? `${k.timedRuns} of ${k.runs} timed` : 'none timed'}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  <span className={cn(k.durationTotal === null && 'text-ink-faint')}>
                    {formatSeconds(k.durationTotal)}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(k.calls)}</TableCell>
                <TableCell>
                  <span className="block h-1.5 overflow-hidden rounded-[var(--r-sm)] bg-surface-2">
                    <span
                      className="block h-full rounded-[var(--r-sm)]"
                      style={{ width: `${pct}%`, background: 'var(--line-strong)', boxShadow: CHART_EDGE }}
                    />
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-xs">
                  {k.refusals
                    ? <span className="text-[var(--rose-deep)]">{k.refusals}</span>
                    : <span className="text-ink-faint">—</span>}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-ink-faint">
                No skill has a recorded run in this period.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {untimed > 0 ? (
        <p className="border-t border-line px-4 py-3 t-micro leading-snug text-ink-faint">
          A run&rsquo;s duration is the span between its first and last tool call, so the{' '}
          {formatCount(untimed)} single-call {untimed === 1 ? 'run' : 'runs'} in this window have
          no span to report. Times here are taken over the rest.
        </p>
      ) : null}
    </Panel>
  );
}

type Axis = 'calls' | 'runs' | 'median' | 'total';

/** `noun` completes "…by ___" in the subtitle, so the sentence stays true on every toggle. */
const AXES: { value: Axis; label: string; noun: string }[] = [
  { value: 'calls', label: 'calls', noun: 'tool calls' },
  { value: 'runs', label: 'runs', noun: 'number of runs' },
  { value: 'median', label: 'median time', noun: 'how long a typical run takes' },
  { value: 'total', label: 'total time', noun: 'total time spent in it' },
];

/** Null sorts and scales as 0: a skill with no timed run is not the longest one. */
function metric(k: Skill, axis: Axis): number {
  if (axis === 'calls') return k.calls;
  if (axis === 'runs') return k.runs;
  if (axis === 'median') return k.durationMedian ?? 0;
  return k.durationTotal ?? 0;
}
