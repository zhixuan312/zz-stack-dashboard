import { cn } from '@/lib/cn';

export type BarItem = { key: string; label: React.ReactNode; value: number; meta?: React.ReactNode; href?: string };

/**
 * A ranked list with a bar for each row: "by endpoint", "by customer". The bars are the neutral population and one
 * row, the one the card is about, takes the accent. Past `limit` rows, the rest fold into one "Others" row.
 */
export function BarList({
  items,
  format = (n) => n.toLocaleString('en-US'),
  highlight,
  limit = 6,
  total,
  label,
  className,
}: {
  items: BarItem[];
  format?: (n: number) => string;
  /** The key of the one row worth pointing at. Omit it and every bar is neutral. */
  highlight?: string;
  limit?: number;
  /** The whole the rows are a share of: each bar's length is its value over this, and its share shows on hover. Left
   * out, bars are drawn against the largest row. */
  total?: number;
  label: string;
  className?: string;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  // One row past the limit is shown as itself: "1 other" hides a name to save no space.
  const cut = sorted.length === limit + 1 ? limit + 1 : limit;
  const shown = sorted.slice(0, cut);
  const rest = sorted.slice(cut);
  if (rest.length) shown.push({ key: '__others', label: `${rest.length} others`, value: rest.reduce((a, b) => a + b.value, 0) });
  const max = Math.max(1, total ?? 0, ...shown.map((i) => i.value));
  return (
    <ul aria-label={label} className={cn('flex flex-col gap-3.5', className)}>
      {shown.map((it, n) => {
        const hot = it.key === highlight;
        return (
          <li key={it.key} className="group/bar" title={total ? `${((it.value / Math.max(1, total)) * 100).toFixed(1)}% of ${format(total)}` : undefined}>
            <div className="mb-1.5 flex items-baseline gap-3 text-sm">
              <span className={cn('min-w-0 flex-1 truncate', hot ? 'font-medium text-ink' : 'text-ink-2', it.key === '__others' && 'text-ink-3')}>{it.label}</span>
              {it.meta ? <span className="t-caption hidden sm:inline">{it.meta}</span> : null}
              <span className="t-num font-medium text-ink">{format(it.value)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-fill-track">
              <div
                className={cn('grow-x h-full rounded-full transition-colors duration-(--dur-hover)', hot ? 'bg-accent' : 'bg-chart-neutral group-hover/bar:bg-chart-neutral-strong')}
                style={{ width: `${(it.value / max) * 100}%`, ['--i' as string]: n }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
