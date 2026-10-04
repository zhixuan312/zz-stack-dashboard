'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useMeridian } from '@/components/charts/meridian';
import { niceTicks } from '@/components/charts/scale';
import { useSize } from '@/components/charts/use-size';

export type Column = { key: string; label: string; value: number };

/**
 * Counts side by side: one column per category or per day. Every column is the neutral population and one, the one
 * the card is about, takes the accent. Given `dates` (one per column), it joins the page's Meridian: pointing at a
 * column points every chart on the page at that day.
 */
export function ColumnChart({
  columns,
  highlight,
  dates,
  format = (n) => n.toLocaleString('en-US'),
  axisFormat,
  height = 200,
  label,
  labelEvery: every,
  className,
}: {
  columns: Column[];
  /** The key of the column worth pointing at. */
  highlight?: string;
  /** One ISO date per column, to share the page's Meridian. */
  dates?: string[];
  format?: (n: number) => string;
  axisFormat?: (n: number) => string;
  height?: number;
  label: string;
  /** Label every nth column from the first, for a scale with its own rhythm: 6 puts hours at 00, 06, 12, 18. By
   * default labels count back from the last column, as many as fit. */
  labelEvery?: number;
  className?: string;
}) {
  const [box, { width }] = useSize<HTMLDivElement>();
  const meridian = useMeridian(dates ?? []);
  const [own, setOwn] = useState<number | null>(null);
  const timed = Boolean(dates && dates.length === columns.length);
  const active = timed ? meridian.index : own;
  const set = (i: number | null) => (timed ? meridian.setIndex(i) : setOwn(i));

  const ticks = niceTicks(Math.max(1, ...columns.map((c) => c.value)), 3);
  const top = ticks[ticks.length - 1];
  const af = axisFormat ?? format;
  const left = Math.max(...ticks.map((t) => af(t).length)) * 6.4 + 10;
  const n = columns.length;
  const longest = Math.max(...columns.map((c) => c.label.length));
  const fit = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((width - left) / (longest * 6.2 + 16)))));

  return (
    <figure ref={box} aria-label={label} className={cn('relative min-w-0 select-none', className)} onPointerLeave={() => set(null)}>
      <div className="relative" style={{ height, paddingLeft: left }}>
        {ticks.map((t) => (
          <div key={t} aria-hidden className="absolute right-0 flex items-center" style={{ left: 0, bottom: `${(t / top) * 100}%`, transform: 'translateY(50%)' }}>
            <span className="t-num w-(--w) pr-2.5 text-right text-2xs text-ink-3" style={{ ['--w' as string]: `${left}px` }}>{af(t)}</span>
            <span className={cn('h-px flex-1', t === 0 ? 'bg-chart-axis' : 'bg-chart-grid')} />
          </div>
        ))}
        <div className="relative flex h-full items-end gap-0.5">
          {columns.map((c, i) => {
            const hot = active === i || (active === null && c.key === highlight);
            return (
              <div key={c.key} className="group/col relative flex h-full min-w-0 flex-1 items-end" onPointerEnter={() => set(i)} onPointerDown={() => set(i)}>
                <div
                  className={cn('grow-y w-full rounded-t-[4px] transition-colors duration-(--dur-hover)', hot ? 'bg-accent' : 'bg-chart-neutral group-hover/col:bg-chart-neutral-strong')}
                  style={{ height: `${(c.value / top) * 100}%`, minHeight: c.value > 0 ? 2 : 0, ['--i' as string]: i }}
                />
                {active === i ? (
                  <span aria-hidden className="t-num pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-sm bg-surface-inverse px-1.5 py-1 text-2xs font-medium whitespace-nowrap text-ink-inverse shadow-overlay" style={{ bottom: `calc(${(c.value / top) * 100}% + 6px)` }}>
                    {format(c.value)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div aria-hidden className="mt-2 flex gap-0.5 text-2xs text-ink-3" style={{ paddingLeft: left }}>
        {columns.map((c, i) => (
          <span key={c.key} className="relative h-4 min-w-0 flex-1">
            {(every ? i % (every * Math.ceil(fit / every)) === 0 : (n - 1 - i) % fit === 0) || active === i ? (
              <span className={cn('absolute left-1/2 -translate-x-1/2 whitespace-nowrap', active === i ? 'z-10 rounded-xs bg-surface px-1 text-ink' : '')}>{c.label}</span>
            ) : null}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{columns.map((c) => <tr key={c.key}><th>{c.label}</th><td>{format(c.value)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
