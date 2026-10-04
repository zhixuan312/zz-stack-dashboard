'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-date';
import { Delta } from '@/components/ui/delta';
import { useMeridianIndex } from '@/components/charts/meridian';

/**
 * The page's protagonist: the one number a dashboard leads with, at hero size, in the one card that carries the
 * accent's light. Its chart sits inside it. A page has at most one; every other figure is a Metric tile.
 * When the Meridian points at a day, the figure reads that day and the caption names it.
 */
export function FeaturedMetric({
  kicker,
  value,
  daily,
  format,
  delta,
  intent = 'up',
  caption,
  actions,
  children,
  className,
}: {
  /** Mono caps: what the number is and over which period: "Requests · last 30 days". */
  kicker: ReactNode;
  value: number;
  daily?: number[];
  format: (n: number) => string;
  delta?: number | null;
  intent?: 'up' | 'down' | 'neutral';
  /** One line under the figure that makes it concrete: "About 98K a day; the busiest day was 22 Sept". */
  caption?: ReactNode;
  actions?: ReactNode;
  /** The chart: a Trend chart at `fill` height. */
  children?: ReactNode;
  className?: string;
}) {
  const { index, dates } = useMeridianIndex();
  const reading = index !== null && daily && index < daily.length ? daily[index] : null;
  const text = format(reading ?? value);
  const m = text.match(/^([$€£]?)([\d,.]+)\s*([%A-Za-z]*)$/);
  return (
    <section
      className={cn(
        'edge-lit relative isolate flex min-w-0 flex-col rounded-xl border border-line bg-surface shadow-halo',
        'before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:bg-(image:--glow-feature)',
        className,
      )}
    >
      <div className="flex items-start gap-4 px-(--card-pad) pt-(--card-pad)">
        <p className="t-kicker min-w-0 flex-1 !text-accent-ink">{kicker}</p>
        {actions ? <div className="-mt-1.5 flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2 px-(--card-pad) pt-4">
        <p className="t-hero t-num">
          {m ? (
            <>
              {m[1] ? <span className="unit pre">{m[1]}</span> : null}
              {m[1] && m[2].includes('.') ? (
                <>
                  {m[2].slice(0, m[2].indexOf('.'))}
                  <span className="frac">{m[2].slice(m[2].indexOf('.'))}</span>
                </>
              ) : (
                m[2]
              )}
              {m[3] ? <span className="unit">{m[3]}</span> : null}
            </>
          ) : text}
        </p>
        <div className="pb-2.5">
          {reading !== null ? (
            <span className="t-num inline-flex h-7 items-center rounded-full bg-surface-inverse px-3 text-xs font-medium text-ink-inverse">{formatDate(dates[index!])}</span>
          ) : delta !== undefined ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line-strong bg-surface/60 px-3 text-xs text-ink-2 backdrop-blur-md">
              <Delta value={delta} intent={intent} /> vs previous period
            </span>
          ) : null}
        </div>
      </div>
      {caption ? <p className="t-small px-(--card-pad) pt-3 text-ink-2">{caption}</p> : null}
      {children ? <div className="flex min-h-0 flex-1 flex-col px-[calc(var(--card-pad)-8px)] pt-4 pb-3">{children}</div> : <div className="h-(--card-pad)" />}
    </section>
  );
}
