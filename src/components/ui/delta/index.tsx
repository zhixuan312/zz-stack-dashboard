import { cn } from '../../../lib/cn';

/**
 * How a change reads: `percent` is the change as a share of the earlier value (0.12 reads 12.0%); `points` is a change in
 * a value that is itself a share, in percentage points (0.134 reads 13.4 pts), so a share that went from 33.0% to 46.4%
 * never reads as having risen 40.6%. A name, so a server page can pass it to a client tile (#74).
 */
export type DeltaFormat = 'percent' | 'points';
export const DELTA_FORMATS: Record<DeltaFormat, (n: number) => string> = {
  percent: (n) => `${Math.abs(n * 100).toFixed(1)}%`,
  points: (n) => `${Math.abs(n * 100).toFixed(1)} pts`,
};

/**
 * A change against the previous period. The arrow carries the direction; the colour carries the judgement, which is
 * not the same thing: for latency or errors, down is good. `intent` says which way is good.
 */
export function Delta({
  value,
  format,
  intent = 'up',
  className,
}: {
  /** The change as a fraction (0.12 is +12%, or +12 points under `points`), or null when there is nothing to compare with. */
  value: number | null;
  /** How the change reads, a name or a function of its magnitude; `percent` by default. No change reads it too ("0.0 pts"). */
  format?: DeltaFormat | ((n: number) => string);
  /** Which direction is good. `neutral` paints both directions in ink. */
  intent?: 'up' | 'down' | 'neutral';
  className?: string;
}) {
  if (value === null || !Number.isFinite(value)) return <span className={cn('text-xs text-ink-3', className)}>—</span>;
  const flat = Math.abs(value) < 0.0005;
  const read = typeof format === 'function' ? format : DELTA_FORMATS[format ?? 'percent'];
  const up = value > 0;
  const good = intent === 'neutral' || flat ? null : (up && intent === 'up') || (!up && intent === 'down');
  return (
    <span
      className={cn(
        't-num inline-flex items-center gap-0.5 text-xs font-medium whitespace-nowrap',
        good === null ? 'text-ink-2' : good ? 'text-positive-ink' : 'text-critical-ink',
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 10 10" className={cn('size-2.5', flat ? 'hidden' : up ? '' : 'rotate-180')}>
        <path d="M5 1.5 8.5 7h-7z" fill="currentColor" />
      </svg>
      <span className="sr-only">{flat ? 'unchanged' : up ? 'up' : 'down'} </span>
      {/* No change is read as the format reads a change, so a points tile says "0.0 pts", never a literal 0%. */}
      {flat ? (format ? read(0) : '0%') : read(value)}
    </span>
  );
}
