'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Tint } from '@/lib/tints';
import { TINT_VAR, CHART_EDGE, cycleTint } from '@/lib/tints';

interface CompositionSlice {
  key: string;
  label?: ReactNode;
  value: number;
  tint?: Tint;
}

/**
 * A single stacked bar — one quantity split into parts that sum to a whole.
 *
 * Distinct from `BarList`: a bar list ranks independent magnitudes, a composition bar shows
 * share of one total.
 *
 * Slices under 2% still render at 2% so a small-but-present category is visible; the legend
 * carries the true figure.
 */
export function CompositionBar({
  slices,
  format = (v) => v.toLocaleString(),
  className,
  emptyLabel = 'No data in this period',
  legend = 'list',
}: {
  slices: CompositionSlice[];
  /** How to render each slice's value in the legend. */
  format?: (value: number) => string;
  className?: string;
  emptyLabel?: string;
  /**
   * `list` is the full legend — swatch, label, figure, share — for a bar that is the subject of
   * its panel. `none` is for a bar whose parts are named where it is read: a metric tile, whose
   * slices name themselves on hover and focus.
   *
   * DELIBERATE: a tile has no inline legend. A row of names under the bar wrapped at some
   * widths and not others, leaving one tile in a row of four a line taller than its neighbours,
   * and it repeated what hovering a slice already says. A tile's bar is read by hover.
   */
  legend?: 'list' | 'none';
}) {
  const present = slices.filter((s) => s.value > 0);
  const total = present.reduce((n, s) => n + s.value, 0);

  if (total === 0) {
    // A tile keeps its silhouette when empty: an empty track the same height as a full bar,
    // not a paragraph that makes the empty tile the tallest in its row. A panel has room to say
    // it in words.
    return legend === 'none' ? (
      <div role="img" aria-label={emptyLabel} title={emptyLabel} className={cn('h-3 rounded-full bg-surface-2', className)} />
    ) : (
      <p className={cn('py-6 text-center text-sm text-ink-faint', className)}>{emptyLabel}</p>
    );
  }

  const withTint = present.map((s, i) => ({ ...s, tint: s.tint ?? cycleTint(i) }));

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Focus and context, not a native `title`: a browser tooltip waits most of a second,
          is unstyled, and never appears for a keyboard. Hovering the bar fades every slice
          but the one under the cursor, so a 2%-wide sliver is readable as itself, and the
          figure arrives in the themed tooltip. The slices are focusable so the readout does
          not need a mouse. */}
      <div className="group flex h-3 overflow-hidden rounded-full bg-surface-2">
        {withTint.map((s) => {
          const share = s.value / total;
          return (
            <Tooltip key={s.key}>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={`${s.label ?? s.key} — ${format(s.value)} (${(share * 100).toFixed(1)}%)`}
                  className="cursor-default transition-opacity duration-150 outline-none group-hover:opacity-40 hover:opacity-100! focus-visible:opacity-100! focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
                  style={{ width: `${Math.max(2, share * 100)}%`, background: TINT_VAR[s.tint], boxShadow: CHART_EDGE }}
                />
              </TooltipTrigger>
              <TooltipContent>
                {s.label ?? s.key} — {format(s.value)} ({(share * 100).toFixed(1)}%)
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {legend === 'list' ? (
      <ul className="flex flex-col gap-1.5">
        {withTint.map((s) => {
          const share = s.value / total;
          return (
            <li key={s.key} className="flex items-baseline gap-2 text-sm">
              <span
                aria-hidden
                className="size-2.5 shrink-0 translate-y-[1px] rounded-[var(--r-sm)]"
                style={{ background: TINT_VAR[s.tint], boxShadow: CHART_EDGE }}
              />
              <span className="min-w-0 flex-1 truncate text-ink">{s.label ?? s.key}</span>
              <span className="tabular-nums text-ink-soft">{format(s.value)}</span>
              <span className="w-12 text-right tabular-nums text-xs text-ink-faint">
                {(share * 100).toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
      ) : null}
    </div>
  );
}
