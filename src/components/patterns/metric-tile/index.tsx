'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { formatDate } from '../../../lib/format-date';
import { fitFigure, formatBy, splitFigure, type NumberFormat } from '../../../lib/format';
import { Card } from '../../ui/card/index';
import { Delta } from '../../ui/delta/index';
import { Tooltip } from '../../ui/tooltip/index';
import { Sparkline } from '../../charts/sparkline/index';
import { useMeridianIndex, usePointMeridian } from '../../charts/meridian/index';
import { StatusDot } from '../../ui/status-dot/index';

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
  baseline,
  finding,
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
  /** What is usual for one day of `daily` (its median): when the Meridian points at a day, the tile says how that day compares ("2.7× usual"). */
  baseline?: number;
  /**
   * One thing the period's figures say that the number does not: "2.7× usual on 21 and 22 Sept". Computed by code, the
   * same finding both agents read. With `day`, it is a button that points the page's Meridian at that day.
   */
  finding?: { text: string; day?: string };
  className?: string;
}) {
  const { index, dates } = useMeridianIndex();
  const point = usePointMeridian();
  const reading = index !== null && daily && index < daily.length ? daily[index] : null;
  const fmt = typeof format === 'function' ? format : (n: number) => formatBy(format ?? 'count', n);
  const word = typeof value === 'string';
  const text = word && reading === null ? value : fitFigure(fmt(reading ?? (word ? 0 : value)), reading ?? (word ? 0 : (value as number)));
  const parts = word && reading === null ? { int: value } : (split ?? splitFigure)(text);
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
          {/* One line, high enough for one line: a part that does not fit wraps out of sight whole, rather than ending
              "vs previou…". A screen reader still hears it, and the page's head says the period. */}
          <div className={cn('mt-2 flex h-5 flex-wrap content-start items-center gap-x-2 overflow-hidden text-xs', row && 'max-sm:col-start-1 max-sm:row-start-2 max-sm:mt-0.5 max-sm:min-w-0')}>
            {reading !== null ? (
              <>
                <span className="t-num font-medium text-ink-2">{formatDate(dates[index!])}</span>
                {baseline ? <span className="t-num leading-5 whitespace-nowrap text-ink-3">{(reading / baseline).toFixed(1)}× usual</span> : null}
              </>
            ) : delta === null ? (
              <span className="truncate text-ink-3" title="No earlier period to compare">No earlier period to compare</span>
            ) : delta !== undefined ? (
              <>
                <Delta value={delta} intent={intent} />
                <span className="leading-5 whitespace-nowrap text-ink-3">{compare}</span>
              </>
            ) : note ? (
              // One line, cut where the tile ends: a line of text keeps the whole of itself in its title.
              <span className="truncate text-ink-3" title={typeof note === 'string' ? note : undefined}>{note}</span>
            ) : null}
          </div>
          {finding ? (
            finding.day ? (
              <button
                type="button"
                onClick={() => point(finding.day!)}
                aria-label={`${finding.text}. Point at ${formatDate(finding.day)}`}
                className={cn('hit -mx-1 mt-1 flex max-w-full min-w-0 items-start gap-1.5 rounded-sm px-1 text-left text-xs text-ink-2 transition-colors duration-(--dur-hover) hover:text-ink', row && 'max-sm:col-start-1 max-sm:row-start-3')}
              >
                {/* A finding is short and its words are the point: it wraps rather than losing its end. */}
                <StatusDot tone="warning" className="mt-[0.3em]" />
                <span className="min-w-0 text-pretty">{finding.text}</span>
              </button>
            ) : (
              <p className={cn('mt-1 flex min-w-0 items-start gap-1.5 text-xs text-ink-2', row && 'max-sm:col-start-1 max-sm:row-start-3')}>
                <StatusDot tone="warning" className="mt-[0.3em]" />
                <span className="min-w-0 text-pretty">{finding.text}</span>
              </p>
            )
          ) : null}
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

