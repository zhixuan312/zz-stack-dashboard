import { cn } from '@/lib/cn';
import { formatDateTime, formatRelative } from '@/lib/format-date';

/**
 * When this data is from.
 *
 * A dashboard that does not say how old its numbers are cannot be trusted, and
 * the reader has no way to tell a stalled pipeline from a quiet Tuesday — both
 * render as a flat line. It matters more, not less, when a screen mixes
 * refresh rates: a real-time error count beside an hourly cost rollup beside a
 * nightly aggregate, all undated, is three different claims about "now"
 * presented as one.
 *
 * `staleAfterMs` is the contract: past it, the stamp turns amber and says so.
 * Set it to a little over the real refresh interval, so "stale" means the
 * pipeline actually missed a beat rather than that a tick is in flight. Omit it
 * only when the data genuinely has no refresh cadence.
 *
 * The absolute time is in the `title`, because "4 min ago" is the right default
 * for scanning and the wrong thing to paste into an incident report.
 */
export function Freshness({
  at,
  staleAfterMs,
  label = 'Updated',
  now = new Date(),
  className,
}: {
  /** When the underlying data was last refreshed. `null` = never. */
  at: Date | string | null;
  /** Past this age the stamp reads as stale. */
  staleAfterMs?: number;
  label?: string;
  /**
   * Injectable clock. Pass one for a fixed-clock page (a seeded demo, a test, a
   * replayed window). It also removes a hydration hazard: a relative timestamp
   * derived from `new Date()` is evaluated on the server and again on the
   * client, and at a rollover boundary the two render different text.
   */
  now?: Date;
  className?: string;
}) {
  if (at === null) {
    return (
      <span className={cn('flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.04em] text-ink-faint', className)}>
        <span aria-hidden className="size-1.5 rounded-full bg-[var(--line-strong)]" />
        {label} never
      </span>
    );
  }

  const date = at instanceof Date ? at : new Date(at);
  const ageMs = now.getTime() - date.getTime();
  const stale = staleAfterMs !== undefined && ageMs > staleAfterMs;

  return (
    <span
      title={formatDateTime(date)}
      className={cn(
        'flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.04em]',
        stale ? 'text-[var(--amber-deep)]' : 'text-ink-faint',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          stale ? 'bg-[var(--amber)]' : 'bg-[var(--sage)]',
        )}
      />
      {label} {formatRelative(date, now)}
      {stale ? ' · stale' : ''}
    </span>
  );
}
