'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-date';
import { formatBy, type NumberFormat } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Delta } from '@/components/ui/delta';
import { Tooltip } from '@/components/ui/tooltip';
import { Sparkline } from '@/components/charts/sparkline';
import { useMeridianIndex } from '@/components/charts/meridian';

/**
 * One number the page exists to show, with its change and its shape. The figure is set at the figure size with
 * its unit and fraction stepped down. When the page's Meridian points at a day, the tile reads that day instead.
 * One tile per row may be `emphasis`: the finding. Its figure takes the accent; every other tile stays ink.
 */
export function MetricTile({
  label,
  hint,
  value,
  delta,
  note,
  compare = 'vs previous period',
  intent = 'up',
  daily,
  format,
  split,
  emphasis,
  icon,
  className,
}: {
  label: string;
  /** What the number counts, behind the info button beside the label. */
  hint?: string;
  /** The figure: a number, or a word for a categorical state ("Likely new", "On track"), shown as it is. */
  value: number | string;
  /** Change against the previous period, as a fraction. */
  delta?: number | null;
  /** A short line where the change would sit, for a figure no period comparison fits: who is past due, what is next. */
  note?: ReactNode;
  /** What the change is measured against, beside it: "vs previous period", "vs the half hour before". */
  compare?: string;
  intent?: 'up' | 'down' | 'neutral';
  /** One value per day of the period, for the sparkline and the Meridian readout. */
  daily?: number[];
  /** A formatter name (serialisable, so a server page can render the tile) or a function. Ignored for a word value. */
  format?: NumberFormat | ((n: number) => string);
  /** Split a formatted value into prefix, integer, fraction and unit for the figure; defaults to a sensible split. */
  split?: (s: string) => { pre?: string; int: string; frac?: string; unit?: string };
  emphasis?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const { index, dates } = useMeridianIndex();
  const reading = index !== null && daily && index < daily.length ? daily[index] : null;
  const fmt = typeof format === 'function' ? format : (n: number) => formatBy(format ?? 'count', n);
  const word = typeof value === 'string';
  const text = word && reading === null ? value : fmt(reading ?? (word ? 0 : value));
  const parts = word && reading === null ? { int: value } : (split ?? defaultSplit)(text);
  // Phones, without a sparkline: one row, the label and its line on the left and the figure on the right, so a stack
  // of four tiles is half a screen rather than a whole one. Designed for the width, not shrunk to it.
  const row = !daily;
  return (
    <Card className={cn('gap-0 overflow-hidden px-(--card-pad) pt-[calc(var(--card-pad)-2px)] pb-0', row && 'max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-4 max-sm:py-3.5', className)}>
      <div className={cn('flex items-center gap-2', row && 'max-sm:col-start-1 max-sm:row-start-1')}>
        {icon ? <span className="text-ink-3 [&_svg]:size-3.5">{icon}</span> : null}
        <h2 className="t-small min-w-0 flex-1 truncate font-medium text-ink-2">{label}</h2>
        {hint ? (
          <Tooltip content={hint} toggle>
            <button type="button" aria-label={`About ${label}`} className="hit grid size-5 place-items-center rounded-full text-ink-3 hover:bg-fill-hover hover:text-ink-2">
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M8 7.2v3.8M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </Tooltip>
        ) : null}
      </div>
      {/* Phones: the sparkline sits beside the figure, so a stack of tiles stays short. */}
      <div className={cn('grid grid-cols-1', daily && 'max-sm:grid-cols-[minmax(0,1fr)_7rem] max-sm:items-end max-sm:gap-4 max-sm:pb-(--card-pad)', row && 'max-sm:contents')}>
        <div className={cn('min-w-0', row && 'max-sm:contents')}>
          <p className={cn(word && reading === null ? 'mt-3 text-2xl leading-[1.15] font-semibold tracking-[-0.02em] text-balance' : 't-figure t-num mt-3', emphasis ? 'text-accent-ink' : 'text-ink', row && 'max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1 max-sm:mt-0 max-sm:text-right max-sm:text-xl')} aria-live="off">
            {parts.pre ? <span className="unit pre">{parts.pre}</span> : null}
            {parts.int}
            {parts.frac ? <span className="frac">{parts.frac}</span> : null}
            {parts.unit ? <span className="unit">{parts.unit}</span> : null}
          </p>
          <div className={cn('mt-2 flex h-5 items-center gap-2 text-xs', row && 'max-sm:col-start-1 max-sm:row-start-2 max-sm:mt-0.5 max-sm:min-w-0')}>
            {reading !== null ? (
              <span className="t-num font-medium text-ink-2">{formatDate(dates[index!])}</span>
            ) : delta === null ? (
              <span className="truncate text-ink-3">No earlier period to compare</span>
            ) : delta !== undefined ? (
              <>
                <Delta value={delta} intent={intent} />
                <span className="truncate text-ink-3">{compare}</span>
              </>
            ) : note ? (
              <span className="truncate text-ink-3">{note}</span>
            ) : null}
          </div>
        </div>
        {daily ? (
          <div className="-mx-(--card-pad) mt-3 max-sm:mx-0 max-sm:mt-0">
            <Sparkline values={daily} color={emphasis ? 'accent' : 'neutral'} height={40} />
          </div>
        ) : (
          <div className="h-(--card-pad) max-sm:hidden" />
        )}
      </div>
    </Card>
  );
}

/** "$298.43" steps the cents down; "2.9M", "0.90%" and "294ms" keep the number whole and step the unit down. */
function defaultSplit(s: string) {
  const m = s.match(/^([^\d\s.,-]*)([\d,]+)(\.\d+)?\s*([%a-zA-Z]*)$/);
  if (!m) return { int: s };
  const money = Boolean(m[1]);
  return { pre: m[1] || undefined, int: money ? m[2] : m[2] + (m[3] ?? ''), frac: money ? m[3] : undefined, unit: m[4] || undefined };
}
