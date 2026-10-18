'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';
import { formatDate } from '../../../lib/format-date';
import { fitFigure, splitFigure } from '../../../lib/format';
import { Delta } from '../../ui/delta/index';
import { StatusDot } from '../../ui/status-dot/index';
import { useMeridianIndex } from '../../charts/meridian/index';

/** One figure of the card: what it is, its value, its change, the line that makes it concrete, one fact and its chart. */
export type FeaturedFigure = {
  /** Mono caps: what the number is and over which period: "Requests · last 30 days". */
  kicker: ReactNode;
  /** The period's figure; `null` when the period has no number: nothing was recorded, or the read was unavailable. */
  value: number | null;
  /**
   * The words in the figure's place when it has no number: "No words recorded", "Unavailable". Set at the figure's own
   * height, so a period with no number and one with a number draw the same card. "Not recorded" by default.
   */
  missing?: string;
  /**
   * One value a point of the page's Meridian, `null` where that point has no number. The figure reads the pointed point
   * only when it has one for each of the Meridian's dates.
   */
  points?: (number | null)[];
  format: (n: number) => string;
  delta?: number | null;
  intent?: 'up' | 'down' | 'neutral';
  /** What the change is against, in the words after it: "vs previous period" by default, "vs the week before". */
  compare?: string;
  /** One line under the figure that makes the period concrete, in words that stay true while a point is read: "The last 30 days averaged 99K a day. The busiest day was 1 Oct, with 128K." */
  caption?: ReactNode;
  /** One fact the figure does not say, beside a neutral dot: "The highest 30 days yet". Counted by code, never typed in. */
  finding?: { text: string };
  /** The chart, at `fill` height: a Trend chart, or a Column chart when the points are periods. */
  children?: ReactNode;
};

export type FeaturedMetricProps = FeaturedFigure & {
  /** A second figure of equal standing. The two are halves of the one lit surface, the first figure first; never two cards. */
  peer?: FeaturedFigure;
  /** How the pill names the pointed point when a point is not a day: "Week of 14 Sept". By default the date. */
  pointLabel?: (date: string) => string;
  /** A band at the foot of the lit surface: a `dl` of a few supporting figures, a label over each, and one link. */
  foot?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Two figures: one column until the card itself is 42rem wide (the `@2xl` step: 588px, a rem being the root's 14px),
 * then two, with the hairline between them turning from horizontal to vertical. Side by side, the halves share one set
 * of rows (kicker, figure, change, caption, finding, chart), so the two figures and the two changes stand on the same
 * lines whatever one half's kicker or caption runs to, and each chart takes what its half has left. A container query
 * and a subgrid decide it, so the server draws the layout the browser keeps. Literal strings, so Tailwind finds them.
 */
const FIGURES = 'grid min-h-0 flex-1 grid-cols-1 divide-y divide-line @2xl:grid-cols-2 @2xl:grid-rows-[auto_auto_auto_auto_auto_minmax(0,1fr)] @2xl:divide-x @2xl:divide-y-0';
const HALF = '@2xl:grid @2xl:grid-cols-[minmax(0,1fr)] @2xl:grid-rows-subgrid @2xl:row-span-6';

/**
 * The foot: a band divided from what is above it by a hairline, as a Card's footer is. Its look is set once, here: a
 * `dl` in it is the supporting figures, each label an eyebrow over its value, and what follows the list (the one link)
 * goes to the far end. The labels keep the band's own `ink-2`: the surface is washed with the accent, where `ink-3`
 * does not hold its contrast.
 */
const FOOT = [
  'flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t border-line px-(--card-pad) py-4 text-sm text-ink-2',
  '[&_dl]:flex [&_dl]:min-w-0 [&_dl]:flex-wrap [&_dl]:gap-x-8 [&_dl]:gap-y-3',
  '[&_dt]:font-mono [&_dt]:text-2xs [&_dt]:leading-[1.2] [&_dt]:tracking-(--tracking-caps) [&_dt]:uppercase',
  '[&_dd]:mt-1.5 [&_dd]:text-md [&_dd]:leading-none [&_dd]:font-medium [&_dd]:text-ink [&_dd]:tabular-nums',
].join(' ');

/**
 * One figure with everything that is its own. As a half it keeps the same parts; from the card's 42rem its figure and
 * its change take a row each, and the figure is set a size down until the card is 64rem wide (896px), so nine
 * characters of number fit half a card as they fit a whole one.
 */
function Figure({
  kicker,
  value,
  missing = 'Not recorded',
  points,
  format,
  delta,
  intent = 'up',
  compare = 'vs previous period',
  caption,
  finding,
  children,
  pointLabel = formatDate,
  actions,
  half,
  tight,
}: FeaturedFigure & { pointLabel?: (date: string) => string; actions?: ReactNode; half?: boolean; tight?: boolean }) {
  const { index, dates } = useMeridianIndex();
  // The page's cursor is this figure's only when the figure has a value for each of the page's dates: the rule a chart
  // joins the Meridian by. A figure with any other number of points keeps its period and its change.
  const point = index !== null && points && points.length === dates.length ? { value: points[index], date: dates[index] } : null;
  const shown = point ? point.value : value;
  // One parser, shared with the Metric tile: it never fails to match, so no formatter a product passes can
  // crash the figure — and the symbol may be any currency's, not a list of three.
  const parts = shown === null ? null : splitFigure(fitFigure(format(shown), shown));
  // The words after the change are the caller's and a point's name may be long: a pill grows a line rather than cutting one.
  const pill = 'inline-flex min-h-7 max-w-full items-center rounded-full px-3 py-1 text-xs';
  return (
    <div data-figure className={cn('flex min-w-0 flex-col px-(--card-pad)', half ? HALF : 'min-h-0 flex-1')}>
      <div className={cn('flex items-start gap-4', tight ? 'pt-3' : 'pt-(--card-pad)', half && '@2xl:row-start-1')}>
        <p className="t-kicker min-w-0 flex-1 !text-accent-ink">{kicker}</p>
        {actions ? <div className="-mt-1.5 flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
      <div className={cn('flex flex-wrap items-end gap-x-5 gap-y-2 pt-4', half && '@2xl:contents')}>
        {/* With no number the words stand in the figure's line, a size down: the line keeps the figure's height, so the
            card is the same size for a period with a number and one without. */}
        <p data-value className={cn('t-hero t-num', half && '@2xl:row-start-2 @2xl:pt-4 @2xl:text-page @5xl:text-hero')}>
          {parts ? (
            <>
              {parts.pre ? <span className="unit pre">{parts.pre}</span> : null}
              {parts.int}
              {parts.frac ? <span className="frac">{parts.frac}</span> : null}
              {parts.unit ? <span className="unit">{parts.unit}</span> : null}
            </>
          ) : (
            <span data-missing className="text-2xl font-semibold tracking-[-0.02em] text-ink-2">{missing}</span>
          )}
        </p>
        {/* A figure that can read a point keeps the pill's row whether or not one is pointed at, so pointing changes what
            the figure says and never where anything below it is. With no change pill to stand in for, the row is a line of
            its own: an empty place beside the figure could fit where the named point does not, and wrap when it arrives. */}
        {point || delta !== undefined || points ? (
          <div className={cn('pb-2.5', delta === undefined && 'w-full', half && '@2xl:row-start-3 @2xl:pt-3 @2xl:pb-0')}>
            {point ? (
              <span data-point className={cn(pill, 't-num bg-surface-inverse font-medium text-ink-inverse')}>{pointLabel(point.date)}</span>
            ) : delta !== undefined ? (
              <span data-change className={cn(pill, 'gap-1.5 border border-line-strong bg-surface/60 text-ink-2 backdrop-blur-md')}>
                <Delta value={delta ?? null} intent={intent} /> {compare}
              </span>
            ) : (
              <span aria-hidden className={cn(pill, 'invisible')}>{'\u00a0'}</span>
            )}
          </div>
        ) : null}
      </div>
      {caption ? <p className={cn('t-small pt-3 text-ink-2', half && '@2xl:row-start-4')}>{caption}</p> : null}
      {finding ? (
        <p data-finding className={cn('t-small flex items-baseline gap-2 pt-2 text-ink-2', half && '@2xl:row-start-5')}>
          {/* A fact, not a warning: the dot is the neutral one. It stands on the first line's baseline, so a finding that wraps keeps its dot beside its first words. */}
          <StatusDot tone="neutral" />
          <span className="min-w-0 text-pretty">{finding.text}</span>
        </p>
      ) : null}
      {children ? (
        <div className={cn('-mx-2 flex min-h-0 flex-1 flex-col pt-4 pb-3', half && '@2xl:row-start-6')}>{children}</div>
      ) : (
        <div className={cn('h-(--card-pad)', half && '@2xl:row-start-6')} />
      )}
    </div>
  );
}

/**
 * The page's protagonist: the one number a dashboard leads with, at hero size, in the one card that carries the
 * accent's light. Its chart sits inside it. A page has at most one; every other figure is a Metric tile.
 * When the Meridian points at a point, the figure reads that point and the pill names it.
 *
 * Two measures of equal standing that are never added together are still one card: `peer` is the second figure, and
 * the two are halves of the one lit surface, divided by a hairline, each with its own kicker, figure, change, caption,
 * finding and chart. The card is a container, so it takes its cell's width; it never sizes itself from what it holds.
 */
export function FeaturedMetric({ peer, pointLabel, foot, actions, className, ...figure }: FeaturedMetricProps) {
  return (
    <section
      className={cn(
        '@container edge-lit relative isolate flex min-w-0 flex-col rounded-xl border border-line bg-surface shadow-halo',
        'before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:bg-(image:--glow-feature)',
        className,
      )}
    >
      {peer ? (
        <>
          {/* The actions are the card's, not a figure's, so with two figures they head the card on a row of their own. Its
              height is a small control's whether or not the control has arrived, so one that renders late moves nothing. */}
          {actions ? <div className="flex min-h-7 items-center justify-end gap-1.5 px-(--card-pad) pt-[calc(var(--card-pad)-6px)]">{actions}</div> : null}
          <div data-figures className={FIGURES}>
            <Figure {...figure} pointLabel={pointLabel} half tight={Boolean(actions)} />
            <Figure {...peer} pointLabel={pointLabel} half tight={Boolean(actions)} />
          </div>
        </>
      ) : (
        <Figure {...figure} pointLabel={pointLabel} actions={actions} />
      )}
      {foot ? <div data-foot className={FOOT}>{foot}</div> : null}
    </section>
  );
}
