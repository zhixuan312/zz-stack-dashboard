'use client';

import { useState } from 'react';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Segmented } from '@/components/ui/segmented';
import { aligned } from '@/console/columns';
import type { Skill } from '@/lib/api-shapes';
import { formatCount, formatSeconds } from '@/lib/format';

type Axis = 'calls' | 'runs' | 'median' | 'total';

/** `noun` completes "by ___" in the line under the title, so the sentence stays true on every toggle. */
const AXES: { value: Axis; label: string; noun: string }[] = [
  { value: 'calls', label: 'Calls', noun: 'tool calls' },
  { value: 'runs', label: 'Runs', noun: 'number of runs' },
  { value: 'median', label: 'Median time', noun: 'how long a typical run takes' },
  { value: 'total', label: 'Total time', noun: 'total time spent in it' },
];

/** Null sorts and scales as 0: a skill with no timed run is not the longest one. */
function metric(k: Skill, axis: Axis): number {
  if (axis === 'calls') return k.calls;
  if (axis === 'runs') return k.runs;
  if (axis === 'median') return k.durationMedian ?? 0;
  return k.durationTotal ?? 0;
}

/**
 * Where the work happens: every skill that ran in the window, ranked on whichever cost the reader asks about. The four
 * axes are four questions and the ranking flips between them: the skill run most often is not the one the platform
 * spends its life inside. The bar carries the chosen axis as a share of its total, so it is never a picture of a
 * different quantity than the order.
 */
export function SkillWorkPanel({ skills }: { skills: Skill[] }) {
  const [axis, setAxis] = useState<Axis>('calls');
  const a = AXES.find((x) => x.value === axis)!;
  const rows = [...skills].sort((x, y) => metric(y, axis) - metric(x, axis));
  const total = rows.reduce((n, k) => n + metric(k, axis), 0);
  // Stated once and only when it applies: a single-call run has one timestamp, so no span to report.
  const untimed = skills.reduce((n, k) => n + (k.runs - k.timedRuns), 0);

  const columns: Column<Skill>[] = aligned([
    {
      key: 'skill', header: 'Skill', grow: true, mobile: 'title',
      cell: (k) => (
        <span className="block min-w-0">
          <span className="font-medium text-ink">{k.name}</span> <span className="font-mono text-xs text-ink-3">{k.version}</span>
          {/* Retired travels with the row: these rows own their history and must not read as current. */}
          {k.retired ? <span className="t-caption ml-1.5">retired</span> : null}
        </span>
      ),
    },
    { key: 'runs', header: 'Runs', numeric: true, mobile: 'fact', cell: (k) => formatCount(k.runs), mobileCell: (k) => `${formatCount(k.runs)} runs` },
    {
      key: 'median', header: 'Median', numeric: true,
      cell: (k) => (
        <span className="inline-flex flex-col items-center">
          <span className={k.durationMedian === null ? 'text-ink-3' : undefined}>{formatSeconds(k.durationMedian)}</span>
          {/* What the median is a median of, whenever that is not the run count beside it. */}
          {k.timedRuns < k.runs ? <span className="t-caption">{k.timedRuns ? `${k.timedRuns} of ${k.runs} timed` : 'none timed'}</span> : null}
        </span>
      ),
    },
    { key: 'total', header: 'Total time', numeric: true, hideBelow: 'xl', cell: (k) => <span className={k.durationTotal === null ? 'text-ink-3' : undefined}>{formatSeconds(k.durationTotal)}</span> },
    { key: 'calls', header: 'Calls', numeric: true, hideBelow: 'md', mobile: 'fact', cell: (k) => formatCount(k.calls), mobileCell: (k) => `${formatCount(k.calls)} calls` },
    {
      key: 'share', header: `Share of ${a.label.toLowerCase()}`, hideBelow: 'md', width: 'w-40',
      cell: (k) => {
        const share = total > 0 ? metric(k, axis) / total : 0;
        return (
          <span title={`${(share * 100).toFixed(1)}% of all ${a.label.toLowerCase()}`} className="block h-1.5 overflow-hidden rounded-full bg-fill-track">
            <span className="grow-x block h-full rounded-full bg-chart-neutral" style={{ width: `${share > 0 ? Math.max(1.5, share * 100) : 0}%` }} />
          </span>
        );
      },
    },
    // Ink, not a red pill: nearly every skill refuses something, and red on every row says nothing. The rate is on hover.
    {
      key: 'refused', header: 'Refused', numeric: true, hideBelow: 'lg',
      cell: (k) => (k.refusals ? <span title={k.calls ? `${((k.refusals / k.calls) * 100).toFixed(1)}% of its calls refused` : undefined}>{formatCount(k.refusals)}</span> : <span className="text-ink-3">—</span>),
    },
  ]);

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        caption="Skills by work done"
        noun="skills"
        rows={rows}
        columns={columns}
        rowKey={(k) => `${k.name}-${k.version}`}
        empty={{ title: 'No skill ran in this period' }}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="t-card">Where the work happens</h2>
              <p className="t-caption mt-1">Every skill that ran in this window, by {a.noun}</p>
            </div>
            <Segmented size="sm" label="Rank skills by" value={axis} onChange={setAxis} options={AXES.map((x) => ({ value: x.value, label: x.label }))} />
          </div>
        }
      />
      {untimed > 0 ? (
        <p className="t-caption px-1">
          A run&rsquo;s duration is the span between its first and last tool call, so the {formatCount(untimed)} single-call {untimed === 1 ? 'run' : 'runs'} in this window have no span to report. Times are taken over the rest.
        </p>
      ) : null}
    </div>
  );
}
