import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { TINT_VAR, CHART_EDGE, type Tint } from '@/lib/tints';

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
 * Bars are scaled against the largest row, with a hairline floor so a non-zero
 * row is never invisible. A row whose value is genuinely zero renders a bare
 * track: a measured zero looks different from a small number, which is the
 * point.
 */
export function BarList({
  rows,
  max,
  limit,
  moreLabel = 'others',
  formatTotal,
  highlight,
  className,
  emptyLabel = 'No data in this period',
}: {
  rows: BarRow[];
  /** Override the scale maximum; defaults to the largest row. */
  max?: number;
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
   * Which row carries the finding. That row gets the accent; every other row is
   * drawn in the neutral population tone.
   *
   * Six accent-coloured bars is a wall of colour that ranks nothing — the length
   * of the bar already encodes the ranking, so colouring them all spends the
   * one signal the palette has and buys no information. Pass the key of the row
   * worth pointing at, or omit it and the whole list stays neutral, which is
   * the honest default when no single row is the point.
   *
   * A row's own explicit `tint` still wins, for the case where the colour is
   * carrying a category rather than emphasis.
   */
  highlight?: string;
  /** How to render the remainder's total; defaults to the row `display` style. */
  formatTotal?: (value: number) => string;
  className?: string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className={cn('py-6 text-center text-sm text-ink-faint', className)}>{emptyLabel}</p>;
  }
  const scale = max ?? Math.max(...rows.map((r) => r.value), 0);
  const shown = limit ? rows.slice(0, limit) : rows;
  const rest = limit ? rows.slice(limit) : [];
  const restTotal = rest.reduce((n, r) => n + r.value, 0);

  return (
    <ul className={cn('flex flex-col gap-2.5', className)}>
      {shown.map((r) => {
        const pct = scale > 0 && r.value > 0 ? Math.max(1.5, (r.value / scale) * 100) : 0;
        return (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
            <span className="min-w-0 truncate text-sm text-ink" title={typeof r.label === 'string' ? r.label : r.key}>
              {r.label ?? r.key}
            </span>
            <span className="tabular-nums text-sm text-ink-soft">
              {r.display ?? r.value.toLocaleString()}
            </span>
            <span className="col-span-2 block h-1.5 overflow-hidden rounded-[var(--r-sm)] bg-surface-2">
              <span
                className="block h-full rounded-[var(--r-sm)]"
                style={{
                  width: `${pct}%`,
                  background: r.tint
                    ? TINT_VAR[r.tint]
                    : highlight === r.key
                      ? 'var(--accent)'
                      : 'var(--line-strong)',
                  // The pastels cannot separate from the cream ground by luminance.
                  // Without this edge a bar genuinely disappears. See CHART_EDGE.
                  boxShadow: CHART_EDGE,
                }}
              />
            </span>
            {r.caption ? (
              <span className="col-span-2 -mt-0.5 text-xs text-ink-faint">{r.caption}</span>
            ) : null}
          </li>
        );
      })}

      {rest.length > 0 ? (
        <li className="flex items-baseline justify-between gap-3 border-t border-line pt-2 text-xs text-ink-faint">
          <span>
            +{rest.length} {moreLabel}
          </span>
          <span className="tabular-nums">
            {formatTotal ? formatTotal(restTotal) : restTotal.toLocaleString()}
          </span>
        </li>
      ) : null}
    </ul>
  );
}
