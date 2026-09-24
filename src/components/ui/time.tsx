import { cn } from '@/lib/cn';

/**
 * A timestamp, in the platform's display timezone. The API sends an instant; this decides how
 * it reads.
 *
 * DELIBERATE: one zone for everyone, not each browser's own. This console is read by one team
 * beside a chat history and a database that both speak in one clock, so two people comparing
 * screens must see the same number. The zone is named on screen for the same reason.
 *
 * `NEXT_PUBLIC_ZZ_TZ` sets it, so a deployment elsewhere changes one variable.
 */
const ZONE = process.env.NEXT_PUBLIC_ZZ_TZ || 'Asia/Singapore';
const LABEL = process.env.NEXT_PUBLIC_ZZ_TZ_LABEL || 'SGT';

const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/** The zone every time on this console is shown in. Rendered beside a column of them once,
 *  rather than repeated on every row. */
export const TZ_LABEL = LABEL;

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  // A value that is not a date is shown as it arrived, rather than as "Invalid Date".
  if (Number.isNaN(d.getTime())) return iso;
  return FMT.format(d).replace(',', '');
}

export function Time({ value, className }: { value: string | null | undefined; className?: string }) {
  const text = formatTime(value);
  return (
    <span className={cn('whitespace-nowrap font-mono text-xs tabular-nums', className)}
          title={value ? `${value} (UTC)` : undefined}>
      {text}
    </span>
  );
}
