'use client';

import { useState } from 'react';
import { Panel } from '@/components/Panel';
import {
  Badge, PageControl, Segmented, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, usePaged,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatCount, formatSeconds } from '@/lib/format';
import { CHART_EDGE } from '@/lib/tints';
import type { Skill } from '@/lib/api-shapes';

/**
 * Where the work happens — every skill that ran in the window, ranked on whichever cost the
 * reader is asking about.
 *
 * The four axes are four different questions and the ranking flips between them: the skill
 * the platform runs most often is not the one it spends its life inside.
 *
 * DELIBERATE: the bar carries the selected axis, not a fixed column. A bar drawing calls
 * beside a table sorted by time is a picture of the wrong quantity, and the toggle would be
 * only a sort.
 */
export function SkillWorkPanel({ skills }: { skills: Skill[] }) {
  const [axis, setAxis] = useState<Axis>('calls');

  const rows = [...skills].sort((a, b) => metric(b, axis) - metric(a, axis));
  const scale = Math.max(...rows.map((k) => metric(k, axis)), 0);
  const totalRuns = skills.reduce((n, k) => n + k.runs, 0);
  const totalCalls = skills.reduce((n, k) => n + k.calls, 0);
  /* The caveat is stated once and only when it applies — see the gateway's /skills comment
     for why a single-call run has no span to report. A note that fires on an empty window
     teaches the reader to skip it. */
  const untimed = skills.reduce((n, k) => n + (k.runs - k.timedRuns), 0);
  // The axis resets the page: it re-ranks rather than narrows, and page three of a new
  // ranking is not a place anybody asked to be.
  const { page, controls } = usePaged(rows, axis);

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
        <span className="tabular-nums text-ink-soft">
          {formatCount(totalRuns)} runs · {formatCount(totalCalls)} calls
        </span>
      }
      padded={false}
    >
      {/* In the body, not the header: the header's aside never shrinks, and four segments
          beside a title push a phone-width card past its edge. */}
      <div className="border-b border-line px-4 py-2.5">
        <Segmented
          label="Rank skills by"
          value={axis}
          onChange={(v) => setAxis(v as Axis)}
          options={AXES.map((a) => ({ value: a.value, label: a.label }))}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Skill</TableHead>
            <TableHead hideBelow="lg">Team</TableHead>
            <TableHead>Runs</TableHead>
            <TableHead>Median</TableHead>
            <TableHead hideBelow="xl">Total time</TableHead>
            <TableHead hideBelow="md">Calls</TableHead>
            {/* The bar's header is the axis it is drawing, so the column is never an
                unlabelled decoration. */}
            <TableHead hideBelow="md" className="w-[9rem]">{AXES.find((a) => a.value === axis)!.label}</TableHead>
            <TableHead hideBelow="lg">Refused</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((k) => {
            const v = metric(k, axis);
            const pct = scale > 0 && v > 0 ? Math.max(1.5, (v / scale) * 100) : 0;
            return (
              <TableRow key={`${k.name}-${k.version}`} className="transition-colors hover:bg-surface-2">
                <TableCell className="break-words">
                  <span className="font-medium text-ink">{k.name}</span>{' '}
                  <span className="font-mono text-xs text-ink-faint">{k.version}</span>
                  {/* Retired travels with the row, as the gateway emits it: these rows own
                      their history and must not read as current. */}
                  {k.retired ? <span className="ml-1.5 t-micro text-ink-faint">retired</span> : null}
                </TableCell>
                <TableCell className="font-medium tabular-nums">{k.runs}</TableCell>
                <TableCell className="tabular-nums text-xs">
                  <span className={cn(k.durationMedian === null && 'text-ink-faint')}>
                    {formatSeconds(k.durationMedian)}
                  </span>
                  {/* What the median is a median of, whenever that is not the run count in
                      the column beside it — "25 min · 3 of N timed" is a real number resting
                      on thin evidence, which the run count alone does not say. */}
                  {k.timedRuns < k.runs ? (
                    <span className="block t-micro text-ink-faint">
                      {k.timedRuns ? `${k.timedRuns} of ${k.runs} timed` : 'none timed'}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell hideBelow="xl" className="tabular-nums text-xs">
                  <span className={cn(k.durationTotal === null && 'text-ink-faint')}>
                    {formatSeconds(k.durationTotal)}
                  </span>
                </TableCell>
                <TableCell hideBelow="md" className="tabular-nums">{formatCount(k.calls)}</TableCell>
                <TableCell hideBelow="md">
                  <span className="block h-1.5 overflow-hidden rounded-[var(--r-sm)] bg-surface-2">
                    <span
                      className="block h-full rounded-[var(--r-sm)]"
                      style={{ width: `${pct}%`, background: 'var(--accent)', boxShadow: CHART_EDGE }}
                    />
                  </span>
                </TableCell>
                <TableCell hideBelow="lg" className="tabular-nums text-xs">
                  {/* A pill, not coloured text: colour alone is the one channel a reader may
                      not have, and this is the column worth scanning for. */}
                  {k.refusals
                    ? <Badge size="sm" variant="rose">{k.refusals}</Badge>
                    : <span className="text-ink-faint">—</span>}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-ink-faint">
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
      <PageControl {...controls} />
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
