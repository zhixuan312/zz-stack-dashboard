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
 * Compact, from 14rem of the tile's own width, border to border (196px, a rem being the root's 14px): the name and the
 * change share the first row, the change's figure at the right, so the changes of a wall stand in one column down its
 * right edge, and the line has the whole width under them. Narrower, as two to a row on a phone, the three are three
 * rows: the name has the whole width and the change stands under it, at the left edge of every tile. A container query
 * decides it, so the server draws the layout the browser keeps.
 *
 * A container query measures the container's content box, so the container is `COMPACT_MEASURE`, an element with no
 * padding of its own straight inside the Card: the side padding is on the grid within it and is no part of the step.
 * What the measure still leaves out is the Card's 1px hairline on each side, which is the 2px the step takes off. Were
 * the Card's border to change, that number changes with it. Literal strings, so Tailwind finds them.
 */
const COMPACT_MEASURE = '@container flex min-w-0 flex-col';
const COMPACT = 'grid grid-cols-1 items-center gap-y-0.5 px-4 pt-3 @min-[calc(14rem-2px)]:grid-cols-[minmax(0,1fr)_auto] @min-[calc(14rem-2px)]:gap-x-3';
const COMPACT_NAME = '@min-[calc(14rem-2px)]:col-start-1 @min-[calc(14rem-2px)]:row-start-1';
const COMPACT_CHANGE = '@min-[calc(14rem-2px)]:col-start-2 @min-[calc(14rem-2px)]:row-start-1 @min-[calc(14rem-2px)]:justify-self-end';
const COMPACT_LINE = '@min-[calc(14rem-2px)]:col-span-2 @min-[calc(14rem-2px)]:row-start-2';

/**
 * One number the page exists to show, with its change and its shape. The figure is set at the figure size with
 * its unit and fraction stepped down. When the page's Meridian points at a point, the tile reads that point instead,
 * as long as its points are the page's: one for each of the Meridian's dates.
 * One tile per row may be `emphasis`: the one figure the page is about — its finding where it has one, and otherwise
 * the figure a person opens the page for (open tickets, revenue, what is live). Its figure takes the accent, as a hero
 * card's protagonist figure does; every other tile stays ink. That figure is not the first tile on every page, and it
 * is the same device in either place; two accented tiles in one row would leave neither reading as the one to look at.
 *
 * `size="compact"` is the same tile for a wall of many: the name, the change's figure, one line that is the figure and
 * then the note, and the shape. What the change is against is said once, by the card that holds the wall. It has no figure at the figure size, no hint, no icon and no finding, whatever it is passed, and
 * its line keeps the period's figure whatever the page points at.
 */
export function MetricTile({
  label,
  hint,
  value,
  delta,
  note,
  compare = 'vs previous period',
  intent = 'up',
  points,
  format,
  split,
  emphasis,
  icon,
  baseline,
  finding,
  size,
  className,
}: {
  label: string;
  /** What the number counts, behind the info button beside the label. */
  hint?: string;
  /** The figure: a number, or a word for a categorical state ("Likely new", "On track"), shown as it is. */
  value: number | string;
  /** Change against the previous period, as a fraction. */
  delta?: number | null;
  /**
   * A short line where the change would sit, for a figure no period comparison fits: who is past due, what is next.
   * On a compact tile it follows the figure on the tile's one line: "$41.2K · next plan".
   */
  note?: ReactNode;
  /**
   * What the change is measured against, beside it: "vs previous period", "vs the half hour before". A compact tile
   * does not draw it, and says it after the change to a screen reader.
   */
  compare?: string;
  intent?: 'up' | 'down' | 'neutral';
  /**
   * One value a point of the period, oldest first, for the sparkline; `null` where nothing was measured for that point,
   * which the Sparkline draws as a gap rather than a fall to zero. The tile reads the pointed point only when it has one
   * for each of the Meridian's dates.
   */
  points?: (number | null)[];
  /** A formatter name (serialisable, so a server page can render the tile) or a function. Ignored for a word value. */
  format?: NumberFormat | ((n: number) => string);
  /** Split a formatted value into prefix, integer, fraction and unit for the figure; defaults to a sensible split. */
  split?: (s: string) => { pre?: string; int: string; frac?: string; unit?: string };
  emphasis?: boolean;
  icon?: ReactNode;
  /** What is usual for one of `points` (its median): when the Meridian points at a day, the tile says how that day compares ("2.7× usual"). */
  baseline?: number;
  /**
   * One thing the period's figures say that the number does not, computed by code, the same finding both agents read.
   * Its `tone` says what kind it is, and the caller always says: `neutral` for a fact ("357 of 360 days"), beside a
   * neutral dot; `warning` for one that needs a look ("2.7× usual on 21 and 22 Sept"), beside the warning dot. With
   * `day`, it is a button that points the page's Meridian at that day.
   */
  finding?: { text: string; day?: string; tone: 'neutral' | 'warning' };
  /** `compact` for a wall of many tiles: the name, the change, one line and the shape. */
  size?: 'compact';
  className?: string;
}) {
  const { index, dates } = useMeridianIndex();
  const point = usePointMeridian();
  const compact = size === 'compact';
  // The page's cursor is this tile's only when the tile has a value for each of the page's dates: the rule a chart joins
  // the Meridian by. A tile with any other number of points keeps its period and its change, and so does a compact one.
  const reading = !compact && index !== null && points && points.length === dates.length ? points[index] : null;
  const fmt = typeof format === 'function' ? format : (n: number) => formatBy(format ?? 'count', n);
  const word = typeof value === 'string';
  const text = word && reading === null ? value : fitFigure(fmt(reading ?? (word ? 0 : value)), reading ?? (word ? 0 : (value as number)));
  const parts = word && reading === null ? { int: value } : (split ?? splitFigure)(text);
  // Under two values there is no shape to draw, so the tile is laid out as one that was given none.
  const shape = points && points.length > 1 ? points : null;
  if (compact) {
    return (
      <Card data-size="compact" className={cn('gap-0 overflow-hidden', className)}>
        <div className={COMPACT_MEASURE}>
          <div className={cn(COMPACT, !shape && 'pb-3')}>
            {/* A wall is scanned by name, so the name is the ink; a long one is cut and keeps the whole of itself in its title. */}
            <h2 className={cn('t-small min-w-0 truncate font-medium text-ink', COMPACT_NAME)} title={label}>{label}</h2>
            {delta !== undefined ? (
              // The figure alone is drawn. Down a wall the words it is against would stand once a tile, so the card that
              // holds the wall says them; here they follow the figure for a screen reader, which meets a tile on its own.
              <p className={cn('flex h-5 items-center justify-self-start', COMPACT_CHANGE)}>
                <Delta value={delta} intent={intent} />
                <span className="sr-only">{' '}{delta === null ? 'No earlier period to compare' : compare}</span>
              </p>
            ) : null}
            {/* The figure comes first, so what a narrow tile cuts is the end of the note, never the number. */}
            <p data-line className={cn('min-w-0 truncate text-xs leading-5 text-ink-3', COMPACT_LINE)} title={!note ? text : typeof note === 'string' ? `${text} · ${note}` : undefined}>
              <span className={cn('t-num font-medium', emphasis ? 'text-accent-ink' : 'text-ink-2')}>{text}</span>
              {note ? <>{' · '}{note}</> : null}
            </p>
          </div>
          {/* Outside the padded grid, so the shape runs from edge to edge with no margin to undo. */}
          {shape ? (
            <div className="mt-2">
              <Sparkline values={shape} color={emphasis ? 'accent' : 'neutral'} height={28} />
            </div>
          ) : null}
        </div>
      </Card>
    );
  }
  // Phones, without a sparkline: one row, the label and its line on the left and the figure on the right, so a stack
  // of four tiles is half a screen rather than a whole one. Designed for the width, not shrunk to it.
  const row = !shape;
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
      <div className={cn('grid grid-cols-1', shape && 'max-sm:grid-cols-[minmax(0,1fr)_7rem] max-sm:items-end max-sm:gap-4 max-sm:pb-(--card-pad)', row && 'max-sm:contents')}>
        <div className={cn('min-w-0', row && 'max-sm:contents')}>
          <p data-value className={cn(word && reading === null ? 'mt-3 text-2xl leading-[1.15] font-semibold tracking-[-0.02em] text-balance' : 't-figure t-num mt-3', emphasis ? 'text-accent-ink' : 'text-ink', row && 'max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1 max-sm:mt-0 max-sm:text-right max-sm:text-xl')} aria-live="off">
            {parts.pre ? <span className="unit pre">{parts.pre}</span> : null}
            {parts.int}
            {parts.frac ? <span className="frac">{parts.frac}</span> : null}
            {parts.unit ? <span className="unit">{parts.unit}</span> : null}
          </p>
          {/* One line, high enough for one line: a part that does not fit wraps out of sight whole, rather than ending
              "vs previou…". A screen reader still hears it, and the page's head says the period. A note is words read
              whole, so it takes a second line first. */}
          <div className={cn('mt-2 flex flex-wrap content-start items-center gap-x-2 overflow-hidden text-xs', reading === null && delta === undefined && note ? 'min-h-5' : 'h-5', row && 'max-sm:col-start-1 max-sm:row-start-2 max-sm:mt-0.5 max-sm:min-w-0')}>
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
              // Two lines, cut where the second ends: a line of text keeps the whole of itself in its title.
              <span data-note className="line-clamp-2 min-w-0 leading-5 text-ink-3" title={typeof note === 'string' ? note : undefined}>{note}</span>
            ) : null}
          </div>
          {finding ? (
            finding.day ? (
              <button
                type="button"
                data-finding
                onClick={() => point(finding.day!)}
                aria-label={`${finding.text}. Point at ${formatDate(finding.day)}`}
                className={cn('hit -mx-1 mt-1 flex max-w-full min-w-0 items-start gap-1.5 rounded-sm px-1 text-left text-xs text-ink-2 transition-colors duration-(--dur-hover) hover:text-ink', row && 'max-sm:col-start-1 max-sm:row-start-3')}
              >
                {/* A finding is short and its words are the point: it wraps rather than losing its end. Its dot is the
                    caller's to say: neutral for a fact, the warning dot for one that needs a look. */}
                <StatusDot tone={finding.tone} className="mt-[0.3em]" />
                <span className="min-w-0 text-pretty">{finding.text}</span>
              </button>
            ) : (
              <p data-finding className={cn('mt-1 flex min-w-0 items-start gap-1.5 text-xs text-ink-2', row && 'max-sm:col-start-1 max-sm:row-start-3')}>
                <StatusDot tone={finding.tone} className="mt-[0.3em]" />
                <span className="min-w-0 text-pretty">{finding.text}</span>
              </p>
            )
          ) : null}
        </div>
        {shape ? (
          <div className="-mx-(--card-pad) mt-3 max-sm:mx-0 max-sm:mt-0">
            <Sparkline values={shape} color={emphasis ? 'accent' : 'neutral'} height={40} />
          </div>
        ) : (
          <div className="h-(--card-pad) max-sm:hidden" />
        )}
      </div>
    </Card>
  );
}

