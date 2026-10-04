import { cn } from '@/lib/cn';

/**
 * A change against the previous period. The arrow carries the direction; the colour carries the judgement, which is
 * not the same thing: for latency or errors, down is good. `intent` says which way is good.
 */
export function Delta({
  value,
  format = (n) => `${Math.abs(n * 100).toFixed(1)}%`,
  intent = 'up',
  className,
}: {
  /** The change as a fraction (0.12 is +12%), or null when there is nothing to compare with. */
  value: number | null;
  format?: (n: number) => string;
  /** Which direction is good. `neutral` paints both directions in ink. */
  intent?: 'up' | 'down' | 'neutral';
  className?: string;
}) {
  if (value === null || !Number.isFinite(value)) return <span className={cn('text-xs text-ink-3', className)}>—</span>;
  const flat = Math.abs(value) < 0.0005;
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
      {flat ? '0%' : format(value)}
    </span>
  );
}
