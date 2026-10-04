import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format-date';
import { StatusDot } from '@/components/ui/status-dot';

/**
 * "Updated 4 min ago": when the data last arrived. A stalled pipeline and a quiet day both draw a flat line; only
 * this stamp tells them apart. Past `staleAfterMs` it turns to warning and says so. Pass the time the data arrived,
 * never now(), and pass `now` on a page with a fixed clock.
 */
export function Freshness({
  updatedAt,
  now = new Date(),
  staleAfterMs = 15 * 60_000,
  run = false,
  className,
}: {
  updatedAt: Date | null;
  now?: Date;
  staleAfterMs?: number;
  /** A batch result (a nightly or ad hoc run): "Run 12 Mar 2026", a quiet dot, never stale on its own. */
  run?: boolean;
  className?: string;
}) {
  if (run && updatedAt) {
    return (
      <span title={formatDateTime(updatedAt)} className={cn('inline-flex max-w-full min-w-0 items-center gap-2 text-xs whitespace-nowrap text-ink-3', className)}>
        <StatusDot tone="neutral" />
        <span className="min-w-0 truncate">Run {formatDate(updatedAt)}</span>
      </span>
    );
  }
  if (!updatedAt) return <span className={cn('t-caption inline-flex items-center gap-1.5', className)}><StatusDot tone="neutral" />Never updated</span>;
  const stale = now.getTime() - updatedAt.getTime() > staleAfterMs;
  return (
    <span title={formatDateTime(updatedAt)} className={cn('inline-flex max-w-full min-w-0 items-center gap-2 text-xs whitespace-nowrap', stale ? 'text-warning-ink' : 'text-ink-3', className)}>
      <StatusDot tone={stale ? 'warning' : 'positive'} live={!stale} />
      {/* Squeezed, the words end in an ellipsis; the dot stays. */}
      <span className="min-w-0 truncate">{stale ? 'Stale · ' : 'Updated '}{formatRelative(updatedAt, now)}</span>
    </span>
  );
}
