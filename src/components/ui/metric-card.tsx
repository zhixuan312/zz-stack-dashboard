import { type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

/**
 * MetricCard — one cell of the status row, and usually the dominant object on
 * the page.
 *
 * ── THE TILE LAW ────────────────────────────────────────────────────────
 *   1. The VALUE is the tile. It is set in the display register, tabular, and
 *      is the largest thing on the screen. Everything else annotates it.
 *   2. The label is mono, uppercase, quiet, and above the value — it is a
 *      column header, not a title.
 *   3. The unit lives in the note, never in the value. `412` + "milliseconds,
 *      p95" reads; `412ms p95` in 44px display type does not.
 *   4. **The accent is used ONCE per row.** Set `emphasis` on the single tile
 *      that carries the finding. This used to be a six-way `iconTint` prop, and
 *      every page duly picked a different colour for each of its four tiles —
 *      which is exactly the "everything is important, so nothing is" failure.
 *      One accent, or none.
 *   5. `tone="attention"` is for a metric that needs ACTION, and is orthogonal
 *      to emphasis. It is the status register, not the accent register.
 *
 * The icon is deliberately small, monochrome and in the corner. A big tinted
 * circle beside a number competes with the number, and the number is the point.
 */
const metricVariants = cva(
  'ds-spotlight relative flex flex-col gap-2 rounded-[var(--r-md)] border px-4 py-3.5',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface',
        // A left rail, not a filled block. A fully tinted tile is as loud as
        // the emphasised one, so a row with both has two things shouting and
        // the eye has to choose — which is the failure this whole ladder
        // exists to prevent. The rail plus the amber label is unmistakable at
        // a glance and still lets the accent tile lead.
        attention: 'border-line border-l-[3px] border-l-[var(--amber)] bg-surface',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

/** Which way the number moved, and whether that is good news HERE. */
interface MetricDelta {
  /** Pre-formatted, e.g. `+11.2%` or `−43ms`. */
  value: ReactNode;
  direction: 'up' | 'down' | 'flat';
  /**
   * Whether this movement is good. Domain-specific and NOT derivable from
   * direction: requests up is usually good, error rate up never is. Defaults to
   * `neutral`, which renders in the ink ladder and asserts nothing — the honest
   * default when the caller has not said.
   */
  sentiment?: 'good' | 'bad' | 'neutral';
}

export interface MetricCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof metricVariants> {
  label: ReactNode;
  value: ReactNode;
  /** A small monochrome lucide icon, pinned quietly to the top-right corner. */
  icon?: ReactNode;
  /** The unit and the comparison basis, e.g. "milliseconds, p95". */
  sublabel?: ReactNode;
  /** Movement against the previous period. */
  delta?: MetricDelta;
  /** The one tile in the row that carries the finding. At most one. */
  emphasis?: boolean;
  /** Zero / idle state — dims the value. "0 failures is good news, don't shout it." */
  muted?: boolean;
}

const ARROW = { up: '▲', down: '▼', flat: '—' } as const;

const SENTIMENT = {
  good: 'text-[var(--sage-deep)]',
  bad: 'text-[var(--rose-deep)]',
  neutral: 'text-ink-faint',
} as const;

export function MetricCard({
  label,
  value,
  icon,
  sublabel,
  delta,
  emphasis,
  tone,
  muted,
  className,
  ...rest
}: MetricCardProps) {
  const attention = tone === 'attention';
  return (
    <div className={cn(metricVariants({ tone }), className)} {...rest}>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'text-[0.6875rem] font-medium uppercase tracking-[0.04em]',
            attention ? 'text-[var(--amber-deep)]' : 'text-ink-faint',
          )}
        >
          {label}
        </span>
        {icon ? (
          <span
            aria-hidden
            className={cn(
              'shrink-0 [&_svg]:size-4',
              attention ? 'text-[var(--amber-deep)]' : 'text-ink-faint',
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <span
        className={cn(
          't-stat',
          attention
            ? '!text-[var(--amber-deep)]'
            : muted
              ? '!text-ink-faint'
              : emphasis
                ? '!text-accent-deep'
                : '!text-ink',
        )}
      >
        {value}
      </span>

      {delta || sublabel ? (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {delta ? (
            <span
              className={cn(
                'text-[0.6875rem] font-medium tabular-nums',
                SENTIMENT[delta.sentiment ?? 'neutral'],
              )}
            >
              <span aria-hidden className="mr-0.5 text-[0.625rem]">
                {ARROW[delta.direction]}
              </span>
              {delta.value}
            </span>
          ) : null}
          {sublabel ? <span className="t-micro text-ink-faint">{sublabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * MetricRow — the status-section container. Auto-fits as many `min`-wide cells
 * as the row allows, wrapping down on narrow screens.
 */
export function MetricRow({
  min = '200px',
  className,
  children,
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { min?: string }) {
  return (
    <div
      className={cn('grid gap-3', className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}, 100%), 1fr))`, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
