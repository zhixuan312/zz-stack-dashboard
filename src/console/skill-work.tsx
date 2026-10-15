'use client';

import { useState, type ReactNode } from 'react';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Segmented } from '@/components/ui/segmented';
import { aligned } from '@/console/columns';
import type { SkillRunRow } from '@/lib/destination-shapes';
import { formatCount, formatKb, formatSeconds } from '@/lib/format-units';
import { plural } from '@/lib/format';

type Axis = 'output' | 'runs' | 'calls' | 'typical';

/** `noun` completes "by ___" in the line under the title, so the sentence stays true on every toggle. */
const AXES: { value: Axis; label: string; noun: string }[] = [
  { value: 'output', label: 'Output', noun: 'observed output per run' },
  { value: 'runs', label: 'Runs', noun: 'number of runs' },
  { value: 'calls', label: 'Calls', noun: 'calls per run' },
  { value: 'typical', label: 'Length', noun: 'how long a typical run takes' },
];

/** Null sorts and scales as 0: a skill whose output nothing measured is not the heaviest one. */
function metric(k: SkillRunRow, axis: Axis): number {
  if (axis === 'output') return k.outputPerRun ?? 0;
  if (axis === 'runs') return k.runs;
  if (axis === 'calls') return k.callsPerRun;
  return k.typicalMs ?? 0;
}

/**
 * Where the team's work happens: every skill it ran, ranked on whichever measure the reader asks about. The four axes
 * are four questions and the ranking flips between them: the skill run most often is not the one whose runs answer the
 * most. The bar carries the chosen axis as a share of its total, so it is never a picture of a different quantity than
 * the order. Output is the response bytes of a run's own calls, observed output, never what a model read.
 */
/** `ask` is the page's Ask about, drawn in the table's head beside the ranking control. */
export function SkillWorkPanel({ skills, loading, error, onRetry, ask }: { skills: SkillRunRow[]; loading?: boolean; error?: string; onRetry?: () => void; ask?: ReactNode }) {
  const [axis, setAxis] = useState<Axis>('output');
  const a = AXES.find((x) => x.value === axis)!;
  const rows = [...skills].sort((x, y) => metric(y, axis) - metric(x, axis));
  const total = rows.reduce((n, k) => n + metric(k, axis), 0);
  // Stated once and only when it applies: a single-call run has one timestamp, so no span to report.
  const untimed = skills.reduce((n, k) => n + (k.runs - k.timed), 0);

  const columns: Column<SkillRunRow>[] = aligned([
    { key: 'skill', header: 'Skill', grow: true, mobile: 'title', cell: (k) => <span className="font-medium text-ink">{k.skill}</span> },
    { key: 'runs', header: 'Runs', numeric: true, mobile: 'fact', cell: (k) => formatCount(k.runs), mobileCell: (k) => `${formatCount(k.runs)} ${plural(k.runs, 'run')}` },
    { key: 'output', header: 'Output per run', numeric: true, cell: (k) => <span className={k.outputPerRun === null ? 'text-ink-3' : undefined}>{k.outputPerRun === null ? 'Not measured' : formatKb(k.outputPerRun / 1024)}</span> },
    {
      key: 'typical', header: 'Typical length', numeric: true, hideBelow: 'md',
      cell: (k) => (
        <span className="inline-flex flex-col items-center">
          <span className={k.typicalMs === null ? 'text-ink-3' : undefined}>{formatSeconds(k.typicalMs === null ? null : k.typicalMs / 1000)}</span>
          {/* What the median is a median of, whenever that is not the run count beside it. */}
          {k.timed < k.runs ? <span className="t-caption">{k.timed ? `${k.timed} of ${k.runs} timed` : 'none timed'}</span> : null}
        </span>
      ),
    },
    { key: 'calls', header: 'Calls per run', numeric: true, hideBelow: 'lg', mobile: 'fact', cell: (k) => k.callsPerRun.toFixed(1), mobileCell: (k) => `${k.callsPerRun.toFixed(1)} calls a run` },
    {
      key: 'share', header: `Share of ${a.label.toLowerCase()}`, hideBelow: 'md', width: 'w-40',
      cell: (k) => {
        const share = total > 0 ? metric(k, axis) / total : 0;
        return (
          <span title={`${(share * 100).toFixed(1)}% of the ${a.noun} summed over these skills`} className="block h-1.5 overflow-hidden rounded-full bg-fill-track">
            <span className="grow-x block h-full rounded-full bg-chart-neutral-strong" style={{ width: `${share > 0 ? Math.max(1.5, share * 100) : 0}%` }} />
          </span>
        );
      },
    },
    // Ink, not a red pill: nearly every skill refuses something, and red on every row says nothing.
    { key: 'refused', header: 'Refused', numeric: true, hideBelow: 'lg', cell: (k) => (k.shareRefused ? `${(k.shareRefused * 100).toFixed(1)}%` : <span className="text-ink-3">—</span>) },
  ]);

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        caption="Skills by the work their runs did"
        noun="skills"
        rows={rows}
        columns={columns}
        rowKey={(k) => k.skill}
        loading={loading}
        error={error}
        onRetry={onRetry}
        empty={{ title: 'Your team has run no skill yet' }}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="t-card">Where the work happens</h2>
              <p className="t-caption mt-1">Every skill your team ran, by {a.noun}</p>
            </div>
            <div className="flex items-center gap-1.5">{ask}<Segmented size="sm" label="Rank skills by" value={axis} onChange={setAxis} options={AXES.map((x) => ({ value: x.value, label: x.label }))} /></div>
          </div>
        }
      />
      {untimed > 0 ? (
        <p className="t-caption px-1">
          A run&rsquo;s length is the span between its first and last tool call, so the {formatCount(untimed)} single-call {plural(untimed, 'run')} have no span to report. Lengths are taken over the rest.
        </p>
      ) : null}
    </div>
  );
}
