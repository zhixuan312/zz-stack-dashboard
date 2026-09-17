'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { TINT_VAR, CHART_EDGE, type Tint } from '@/lib/tints';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface BarRow {
  key: string;
  label?: ReactNode;
  value: number;
  /** Right-hand display value; defaults to `value.toLocaleString()`. */
  display?: ReactNode;
  /** Secondary caption under the label. */
  caption?: ReactNode;
  tint?: Tint;
}

/**
 * A ranked horizontal bar list — the workhorse for "by model", "by route",
 * "by person", "by tool".
 *
 * Bars are scaled against `total` when one is given — the bar and the percentage beside
 * it are then the same number, so a row that is 50% of the whole is half a bar. It scaled
 * against the largest row while the label read share-of-total, which drew 50% as a full
 * bar. With no total, the largest row is the scale. A hairline floor keeps a non-zero
 * row visible. A row whose value is genuinely zero renders a bare
 * track: a measured zero looks different from a small number, which is the
 * point.
 */
export function BarList({
  rows,
  limit,
  total,
  moreLabel = 'others',
  formatTotal,
  className,
  emptyLabel = 'No data in this period',
}: {
  rows: BarRow[];
  /**
   * Show at most this many rows, then one summary line for the rest.
   *
   * A ranked list with a long tail buries its own signal — spend by model runs
   * to 27 entries here, a dozen of them under a dollar, and the panel ends up
   * three times the height of the one beside it. The remainder is summed rather
   * than dropped, because a cap nobody states reads as "this is everything".
   */
  limit?: number;
  /** Noun for the summary line: "+12 others". */
  moreLabel?: string;
  /**
   * The whole these rows are parts of, which turns every value into a share as well.
   *
   * REQUIRED TO BE PASSED, never inferred from the rows, because the rows are not always
   * the whole. `busiestTools` is the top eight tools of however many a skill called, and a
   * percentage computed from those eight would read as "38% of this skill's calls" while
   * actually meaning "38% of its eight busiest" — a number that changes when the limit
   * changes and is wrong either way. A caller that knows the denominator passes it; one
   * that does not gets no percentages, which is the honest outcome.
   *
   * `limit` does not affect it: the rows past the cap are still part of the whole, and the
   * remainder line carries its own share so the column sums to 100%.
   */
  total?: number;
  /** How to render the remainder's total; defaults to the row `display` style. */
  formatTotal?: (value: number) => string;
  className?: string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className={cn('py-6 text-center text-sm text-ink-faint', className)}>{emptyLabel}</p>;
  }
  const scale = total ?? Math.max(...rows.map((r) => r.value), 0);
  const shown = limit ? rows.slice(0, limit) : rows;
  const rest = limit ? rows.slice(limit) : [];
  const restTotal = rest.reduce((n, r) => n + r.value, 0);

  return (
    <ul className={cn('flex flex-col gap-2.5', className)}>
      {shown.map((r) => {
        const pct = scale > 0 && r.value > 0 ? Math.max(1.5, (r.value / scale) * 100) : 0;
        const bar = (
          <span className="block h-1.5 cursor-default overflow-hidden rounded-[var(--r-sm)] bg-surface-2">
            <span
              className="block h-full rounded-[var(--r-sm)]"
              style={{
                width: `${pct}%`,
                // The theme's accent, on every row: the length does the ranking and the
                // colour says this is the house's chart. A row's own `tint` wins where
                // the colour carries a category.
                background: r.tint ? TINT_VAR[r.tint] : 'var(--accent)',
                // The pastels cannot separate from the cream ground by luminance.
                // Without this edge a bar genuinely disappears. See CHART_EDGE.
                boxShadow: CHART_EDGE,
              }}
            />
          </span>
        );
        return (
          /* ONE NUMBER PER ROW. The count ends the label line; the share is on the bar, on
             hover or focus. Two numbers side by side — `2 50%` — gave the eye nothing to say
             which was which, and the bar's length already draws the share. */
          <li key={r.key} className="flex flex-col gap-1">
            <span className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink" title={typeof r.label === 'string' ? r.label : r.key}>
                {r.label ?? r.key}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">{r.display ?? r.value.toLocaleString()}</span>
            </span>
            {total ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} aria-label={`${share(r.value, total)} of ${total.toLocaleString()}`} className="outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
                    {bar}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{share(r.value, total)} of {total.toLocaleString()}</TooltipContent>
              </Tooltip>
            ) : bar}
            {r.caption ? (
              <span className="text-xs text-ink-faint">{r.caption}</span>
            ) : null}
          </li>
        );
      })}

      {rest.length > 0 ? (
        <li className="flex items-baseline justify-between gap-3 border-t border-line pt-2 text-xs text-ink-faint">
          <span>
            +{rest.length} {moreLabel}
          </span>
          <span className="flex items-baseline justify-end gap-2 tabular-nums">
            {formatTotal ? formatTotal(restTotal) : restTotal.toLocaleString()}
          </span>
        </li>
      ) : null}
    </ul>
  );
}

/**
 * One row's share of the whole, as a reader would say it out loud.
 *
 * `< 1%` IS A BAND, not a rounding. A row that exists at all is not 0% of anything, and
 * rounding 0.4% down prints the one number the bar beside it visibly contradicts. Whole
 * percents otherwise: a decimal place here is precision nobody asked a ranked list for.
 */
function share(value: number, total: number): string {
  if (total <= 0) return '';
  const pct = (value / total) * 100;
  if (pct === 0) return '0%';
  return pct < 1 ? '< 1%' : `${Math.round(pct)}%`;
}
