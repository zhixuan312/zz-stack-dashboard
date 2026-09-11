import { cn } from '@/lib/cn';

/**
 * A timestamp, in the platform's display timezone.
 *
 * THE API SENDS AN INSTANT, this decides how it reads. Every time used to be formatted by the
 * database, in UTC, and shipped as a bare `2026-09-05 04:43` with nothing saying which zone —
 * so a reader in Singapore read 04:43 when it was 12:43 for them. Eight hours wrong, on every
 * page, invisible from the screen.
 *
 * ONE ZONE FOR EVERYONE, and it is deliberate rather than a shortcut. Rendering in each
 * browser's own zone is the usual answer and it is the wrong one here: this console is read
 * by one team, beside a chat history and a database that both speak in one clock, and two
 * people comparing screens must see the same number. The zone is named on screen for the same
 * reason — an unlabelled time is what caused this.
 *
 * NOT HARD-CODED IN THE COMPONENT. `NEXT_PUBLIC_ZZ_TZ` sets it, so a deployment somewhere
 * else changes one variable rather than editing every page.
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
  // A value that is not a date is shown as it arrived. Silently printing "Invalid Date" tells
  // the reader nothing about what went wrong, and swallowing it tells them less.
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
