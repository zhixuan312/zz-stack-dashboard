import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
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
 * Distinct from `BarList`, and the distinction is the point: a bar list
 * *ranks* independent magnitudes, a composition bar shows *share of one total*.
 * Using a ranked list for a mix (tier split, outcome mix) makes the reader do
 * the division themselves.
 *
 * Slices under 2% still render at 2% so a small-but-present category is visible;
 * the legend carries the true figure.
 */
export function CompositionBar({
  slices,
  format = (v) => v.toLocaleString(),
  className,
  emptyLabel = 'No data in this period',
}: {
  slices: CompositionSlice[];
  /** How to render each slice's value in the legend. */
  format?: (value: number) => string;
  className?: string;
  emptyLabel?: string;
}) {
  const present = slices.filter((s) => s.value > 0);
  const total = present.reduce((n, s) => n + s.value, 0);

  if (total === 0) {
    return <p className={cn('py-6 text-center text-sm text-ink-faint', className)}>{emptyLabel}</p>;
  }

  const withTint = present.map((s, i) => ({ ...s, tint: s.tint ?? cycleTint(i) }));

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
        {withTint.map((s) => {
          const share = s.value / total;
          return (
            <span
              key={s.key}
              title={`${s.key} — ${format(s.value)} (${(share * 100).toFixed(1)}%)`}
              style={{ width: `${Math.max(2, share * 100)}%`, background: TINT_VAR[s.tint], boxShadow: CHART_EDGE }}
            />
          );
        })}
      </div>

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
    </div>
  );
}
