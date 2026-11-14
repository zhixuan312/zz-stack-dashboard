'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { Readout } from '../readout';
import { cn } from '../../../lib/cn';
import { dayOf } from '../../../lib/format-date';
import { heldTicks } from '../scale';
import { useSize } from '../use-size';

/** One run: when it started, when it ended, how it went, and what it was. An end still open is a run in progress. */
export type TimelineRun = { from: string; to: string | null; tone: 'neutral' | 'warning' | 'critical'; label: string };
export type TimelineRow = { key: string; label: string; runs: TimelineRun[] };

/** A run narrower than this many pixels is drawn as a marker rather than widened, so lengths stay proportional. */
const MARKER = 3;
const TONES = { neutral: 'bg-chart-neutral-strong', warning: 'bg-warning', critical: 'bg-critical' } as const;
const TONE_WORD = { neutral: 'Completed', warning: 'Needs attention', critical: 'Failed' } as const;

const ms = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

/**
 * What ran and when, on one time axis: each row a series of runs from start to end, told apart by tone and, on pointing,
 * by word. A run's length stays proportional to the time it took; a run too short to draw at the plot's width keeps a
 * minimum-width marker instead of a widened bar, so a two-second job beside a two-hour one is still two seconds. An
 * `end` includes a "now" line when the window holds the moment passed to `now`.
 *
 * Runs are read by pointing at them or stepping through them with the arrow keys, in the order they start, and the
 * readout names the run, its times and its length. Rows are not links: a row that has a page takes `href` on the row's
 * label. Under 640px the axis keeps three ticks, and a run whose label would not fit says nothing until pointed at.
 */
export function IntervalTimeline({
  rows,
  label,
  start,
  end,
  tick,
  now,
  className,
}: {
  rows: TimelineRow[];
  label: string;
  /** The window's first and last instant, as dates or date-times: `2026-10-01` or `2026-10-01T09:00`. */
  start: string;
  end: string;
  /** How an instant on the axis reads: a date by default, "09:00" for an hour. */
  tick?: (iso: string) => string;
  /** The moment to draw a "now" line at, when the window holds it. Omit it for a window that has closed. */
  now?: string;
  className?: string;
}) {
  const [box, { width }] = useSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const from = ms(start), to = ms(end);
  const valid = from !== null && to !== null && to > from;
  const span = valid ? to - from : 1;
  const at = (iso: string) => {
    const t = ms(iso);
    if (t === null || from === null) return null;
    return ((t - from) / span) * 100;
  };
  const ticks = useMemo(() => {
    if (from === null || to === null || !valid) return [] as number[];
    const levels = heldTicks(from, to).filter((t) => t >= from && t <= to);
    const shown = width === 0 ? levels : width < 640 ? [levels[0], levels[Math.floor(levels.length / 2)], levels[levels.length - 1]] : levels;
    return [...new Set(shown)];
  }, [from, to, valid, width]);
  // A moment outside the window is not drawn: the line belongs to the plot, and an open run must not run off it.
  const nowAt = now === undefined ? null : (() => { const p = at(now); return p !== null && p >= 0 && p <= 100 ? p : null; })();

  // Every run in the order it starts, so one Tab stop on the plot steps through them: a keyboard user reads the same
  // runs the pointer finds, each named by its row, its times and its length.
  const ordered = useMemo(
    () => rows.flatMap((row, r) => row.runs.map((run, k) => ({ row, r, k, run, start: ms(run.from) ?? 0 }))).sort((a, b) => a.start - b.start),
    [rows],
  );
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const key = e.key;
    if (!ordered.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(key)) return;
    e.preventDefault();
    if (key === 'Escape') return setActive(null);
    const cur = active ?? -1;
    setActive(key === 'Home' ? 0 : key === 'End' ? ordered.length - 1 : key === 'ArrowLeft' ? Math.max(0, cur - 1) : Math.min(ordered.length - 1, cur + 1));
  };
  const pointing = active !== null && active < ordered.length ? ordered[active] : null;
  // An instant as the axis reads it, and a run's length in words: both are used by the axis and by every run's name.
  const read = useCallback((iso: string) => (tick ? tick(iso) : dayOf(iso)), [tick]);
  const words = useCallback((run: TimelineRun) => {
    const a = ms(run.from), b = run.to === null ? null : ms(run.to);
    const s = a === null || b === null ? null : Math.max(0, Math.round((b - a) / 1000));
    const m = s === null ? null : Math.round(s / 60);
    const length = s === null ? 'still running' : s < 60 ? `${s} s` : m! < 60 ? `${m} min` : `${Math.floor(m! / 60)} h ${m! % 60 ? `${m! % 60} min` : ''}`.trim();
    return `${run.label}, ${TONE_WORD[run.tone]}: ${read(run.from)}–${run.to === null ? 'now' : read(run.to)}, ${length}`;
  }, [read]);

  // One axis line and one row of ticks serve every row: a timeline read across rows needs one axis, not one per row.
  return (
    <div ref={box} className={cn('flex flex-col gap-2', className)}>
      {valid ? (
        <>
          <div aria-hidden className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-x-3">
            <span />
            <div className="relative h-4">
              {nowAt !== null ? <span data-now className="absolute inset-y-0 w-px bg-accent" style={{ left: `${nowAt}%` }} /> : null}
            </div>
          </div>
          <ul aria-label={label} className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.key} data-row={row.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] items-center gap-x-3">
                <span className="min-w-0 truncate text-sm text-ink-2">{row.label}</span>
                <div
                  className="relative h-6 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  role="group"
                  tabIndex={0}
                  aria-label={`${label}: ${row.label}. Use the arrow keys to read one run.`}
                  onKeyDown={keys}
                  onBlur={() => setActive(null)}
                >
                  {/* The plot's own baseline, so a row with no runs still reads as an empty stretch of time. */}
                  <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-chart-grid" />
                  {nowAt !== null ? <span aria-hidden data-now className="absolute inset-y-0 w-px bg-accent" style={{ left: `${nowAt}%` }} /> : null}
                  {row.runs.map((run, k) => {
                    const a = at(run.from), b = run.to === null ? nowAt : at(run.to);
                    if (a === null || b === null) return null;
                    const left = Math.min(a, b), right = Math.max(a, b);
                    const pxWidth = ((right - left) / 100) * width;
                    const short = width > 0 && pxWidth < MARKER;
                    return (
                      <span
                        key={`${run.label}:${k}`}
                        data-run
                        data-tone={run.tone}
                        data-short={short ? '' : undefined}
                        title={words(run)}
                        data-active={pointing?.r === rows.indexOf(row) && pointing.k === k ? '' : undefined}
                        onPointerEnter={() => setActive(ordered.findIndex((o) => o.r === rows.indexOf(row) && o.k === k))}
                        onPointerLeave={() => setActive(null)}
                        className={cn(
                          'absolute top-1/2 rounded-full',
                          TONES[run.tone],
                          run.to === null && 'opacity-70',
                          short ? 'h-3 w-3 -translate-y-1/2' : 'h-2 -translate-y-1/2',
                        )}
                        style={short ? { left: `calc(${left}% - 6px)` } : { left: `${left}%`, width: `${right - left}%` }}
                      >
                        <span className="sr-only">{words(run)}</span>
                      </span>
                    );
                  })}
                  {/* The readout names the run the pointer or the keys found: a bar's length and tone are shapes, and the
                      words are the only place a reader learns which run it is. It sits in this row's own plot, so its `at`
                      is a pixel of the width that plot was drawn at, not a share of the chart. */}
                  {pointing && pointing.k >= 0 && rows.findIndex((r) => r.key === pointing.row.key) === rows.indexOf(row) ? (
                    <Readout percent={at(pointing.run.to ?? now ?? pointing.run.from) ?? 0} after={false} top={0} visible>
                      <p className="t-eyebrow mb-0.5 break-words">{pointing.row.label}</p>
                      <p className="text-xs text-ink">{pointing.run.label}</p>
                      <p className="t-num text-2xs text-ink-2">{words(pointing.run)}</p>
                    </Readout>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <div aria-hidden className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-x-3">
            <span />
            <div className="relative h-4">
              {ticks.map((t) => (
                <span key={t} data-tick className="t-num absolute -translate-x-1/2 text-2xs leading-4 whitespace-nowrap text-ink-3" style={{ left: `${at(new Date(t).toISOString())}%` }}>
                  {read(new Date(t).toISOString())}
                </span>
              ))}
            </div>
          </div>
          {nowAt !== null ? <p data-now-key className="text-2xs text-ink-3">Now · {read(now!)}</p> : null}
          <p className="sr-only" aria-live="polite">{pointing ? words(pointing.run) : ''}</p>
        </>
      ) : null}
    </div>
  );
}
