'use client';

import { useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { useSize } from '@/components/charts/use-size';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Six steps from nothing to the most: an empty track, then the accent mixed into the surface. */
const STEPS = ['var(--fill-track)', 18, 34, 52, 74, 100].map((s) => (typeof s === 'string' ? s : `color-mix(in oklab, var(--accent) ${s}%, var(--surface))`));

/**
 * When the load comes: weekday by hour, one cell per hour, darker where there is more. A sequential ramp of the
 * accent in six steps, never a rainbow. On a narrow container the hours group in threes, so a cell is never too
 * small to point at. The grid is one Tab stop: the arrow keys move a cursor cell by cell (Home and End to the ends of a
 * row, Escape to leave), with the same readout as the pointer, announced to screen readers.
 */
export function Heatmap({
  values,
  format = (n) => n.toLocaleString('en-US'),
  unit = 'requests',
  label,
  className,
}: {
  /** Seven rows (Monday first) of twenty-four hourly values (UTC). */
  values: number[][];
  format?: (n: number) => string;
  /** What a cell counts, in the tooltip: "requests". */
  unit?: string;
  label: string;
  className?: string;
}) {
  const [box, { width }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<{ d: number; h: number; x: number; y: number } | null>(null);
  const group = width > 0 && width < 560 ? 3 : 1;
  const cols = 24 / group;
  const grid = values.map((row) => Array.from({ length: cols }, (_, c) => row.slice(c * group, c * group + group).reduce((a, b) => a + b, 0)));
  const max = Math.max(1, ...grid.flat());
  const step = (v: number) => (v <= 0 ? 0 : Math.min(5, 1 + Math.floor((v / max) * 4.999)));
  const hourLabel = (c: number) => String(c * group).padStart(2, '0');
  const range = (c: number) => (group === 1 ? `${hourLabel(c)}:00` : `${hourLabel(c)}:00–${String(c * group + group).padStart(2, '0')}:00`);

  /** Place the readout over a cell, from the pointer or the keyboard. */
  const point = (d: number, h: number) => {
    const cell = box.current?.querySelector<HTMLElement>(`[data-cell="${d}-${h}"]`);
    if (!cell || !box.current) return;
    const r = cell.getBoundingClientRect(), o = box.current.getBoundingClientRect();
    setHover({ d, h, x: r.left - o.left + r.width / 2, y: r.top - o.top });
  };
  const keys = (e: KeyboardEvent) => {
    const at = hover ?? { d: 0, h: 0 };
    const moves: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (e.key === 'Escape') return setHover(null);
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); return point(at.d, e.key === 'Home' ? 0 : cols - 1); }
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    if (!hover) return point(0, 0);
    point(Math.min(6, Math.max(0, at.d + m[0])), Math.min(cols - 1, Math.max(0, at.h + m[1])));
  };

  return (
    <figure ref={box} aria-label={label} className={cn('relative min-w-0', className)} onPointerLeave={() => setHover(null)}>
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2">
        <div />
        <div aria-hidden className="mb-2 grid text-2xs text-ink-3 tabular-nums" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, c) => (
            <span key={c} className="text-left">{(c * group) % 6 === 0 ? hourLabel(c) : ''}</span>
          ))}
        </div>
        <div
          role="group"
          tabIndex={0}
          aria-label={`${label}. Use the arrow keys to read one ${group === 1 ? 'hour' : 'three-hour block'}.`}
          onKeyDown={keys}
          onBlur={() => setHover(null)}
          className="col-span-2 grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <span aria-hidden className="flex items-center text-2xs text-ink-3">{DAYS[d]}</span>
            <div className="grid gap-0.5 py-px" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {row.map((v, c) => {
                const on = hover?.d === d && hover?.h === c;
                return (
                  <span
                    key={c}
                    aria-hidden
                    data-cell={`${d}-${c}`}
                    onPointerEnter={() => point(d, c)}
                    className={cn('h-6 rounded-xs transition-[box-shadow] duration-(--dur-hover) sm:h-7', on && 'ring-2 ring-ink ring-offset-1 ring-offset-surface')}
                    style={{ background: STEPS[step(v)] }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{hover ? `${DAYS[hover.d]} ${range(hover.h)} UTC: ${format(grid[hover.d][hover.h])} ${unit}` : ''}</p>
      <figcaption className="mt-4 flex items-center justify-end gap-2 text-2xs text-ink-3">
        <span>Less</span>
        <span aria-hidden className="flex gap-0.5">
          {STEPS.map((s, i) => <span key={i} className="size-3 rounded-[3px]" style={{ background: s }} />)}
        </span>
        <span>More</span>
      </figcaption>
      {hover ? (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-sm bg-surface-inverse px-2 py-1.5 text-xs whitespace-nowrap text-ink-inverse shadow-overlay"
          style={{ left: hover.x, top: hover.y - 6 }}
        >
          <span className="font-medium">{format(grid[hover.d][hover.h])} {unit}</span>
          <span className="opacity-70"> · {DAYS[hover.d]} {range(hover.h)} UTC</span>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Day</th>{Array.from({ length: 24 }, (_, h) => <th key={h}>{String(h).padStart(2, '0')}:00</th>)}</tr></thead>
        <tbody>{values.map((row, d) => <tr key={d}><th>{DAYS[d]}</th>{row.map((v, h) => <td key={h}>{format(v)}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  );
}
