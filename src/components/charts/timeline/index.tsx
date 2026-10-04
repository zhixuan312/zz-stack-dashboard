import Link from 'next/link';
import { Fragment } from 'react';
import { cn } from '@/lib/cn';

/** One piece of work from a start day to an end day (both inclusive, ISO dates), in a group such as a workstream. */
export type TimelineItem = {
  id: string;
  label: string;
  group?: string;
  start: string;
  end: string;
  /** What the bar means: the accent for work in focus, a status for a judgement, neutral for the rest. */
  tone?: 'accent' | 'neutral' | 'positive' | 'warning' | 'critical';
  href?: string;
};

const DAY = 86_400_000;
const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const TONE = { accent: 'bg-accent', neutral: 'bg-chart-neutral-strong', positive: 'bg-positive', warning: 'bg-warning', critical: 'bg-critical' } as const;

/**
 * Work over months: one bar per item from its start to its end, grouped by workstream, on month hairlines with a
 * line for today. The label column never scrolls; the plot is in percent, so it fits any width without scrolling
 * sideways. An optional heat row shades each month by a value (load, spend, incidents).
 */
export function Timeline({
  items,
  from,
  to,
  today,
  heat,
  heatLabel = 'Load',
  label,
  className,
}: {
  items: TimelineItem[];
  /** The first and last day shown (ISO dates); default to the earliest start and the latest end. */
  from?: string;
  to?: string;
  /** Today's date (ISO), from the data's clock: the line that says where the plan stands. */
  today?: string;
  /** One value per month, keyed "YYYY-MM", for the heat row above the bars. */
  heat?: Record<string, number>;
  heatLabel?: string;
  label: string;
  className?: string;
}) {
  const lo = day(from ?? items.reduce((m, it) => (it.start < m ? it.start : m), items[0]?.start ?? '2026-01-01'));
  const hi = day(to ?? items.reduce((m, it) => (it.end > m ? it.end : m), items[0]?.end ?? '2026-12-31')) + DAY;
  const pct = (t: number) => `${Math.max(0, Math.min(100, ((t - lo) / (hi - lo)) * 100))}%`;

  // Month starts inside the span, for hairlines, labels and the heat row.
  const months: { key: string; t: number; next: number; label: string }[] = [];
  for (let d = new Date(lo); d.getTime() < hi; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    const m = d.getUTCMonth();
    months.push({ key: `${d.getUTCFullYear()}-${String(m + 1).padStart(2, '0')}`, t: Math.max(start, lo), next: Math.min(next, hi), label: m === 0 || months.length === 0 ? `${MONTH.format(d)} \u2019${String(d.getUTCFullYear()).slice(2)}` : MONTH.format(d) });
  }
  const groups = [...new Set(items.map((it) => it.group ?? ''))];
  const heatMax = heat ? Math.max(1, ...Object.values(heat)) : 1;
  const now = today ? day(today) : null;

  const Guides = () => (
    <>
      {months.slice(1).map((m) => <span key={m.key} aria-hidden className="absolute inset-y-0 w-px bg-chart-grid" style={{ left: pct(m.t) }} />)}
      {now !== null && now >= lo && now < hi ? <span aria-hidden className="absolute inset-y-0 z-10 w-px bg-accent" style={{ left: pct(now) }} /> : null}
    </>
  );

  return (
    <figure aria-label={label} className={cn('@container w-full min-w-0', className)}>
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] text-sm @lg:grid-cols-[11rem_minmax(0,1fr)]">
        {/* Month scale, and Today above its line */}
        <span aria-hidden />
        <div aria-hidden className="relative h-11 text-2xs text-ink-3">
          {months.map((m) => (
            <span key={m.key} className="absolute bottom-1 truncate pl-1.5" style={{ left: pct(m.t), width: pct(lo + (m.next - m.t)) }}>{m.label}</span>
          ))}
          {now !== null && now >= lo && now < hi ? <span className="absolute top-0 z-10 -translate-x-1/2 rounded-xs bg-accent px-1 text-on-accent" style={{ left: pct(now) }}>Today</span> : null}
        </div>

        {heat ? (
          <>
            <span aria-hidden className="t-caption self-center truncate pr-3">{heatLabel}</span>
            <div aria-hidden className="relative flex h-4 gap-px overflow-hidden rounded-xs">
              {months.map((m) => (
                <span key={m.key} className="h-full bg-accent" style={{ width: pct(lo + (m.next - m.t)), opacity: 0.12 + 0.88 * ((heat[m.key] ?? 0) / heatMax) }} title={`${m.label}: ${heat[m.key] ?? 0}`} />
              ))}
            </div>
          </>
        ) : null}

        {groups.map((g) => (
          <Fragment key={g || 'all'}>
            {g ? (
              <>
                <span aria-hidden className="t-eyebrow col-span-2 pt-4 pb-1.5">{g}</span>
              </>
            ) : null}
            {items.filter((it) => (it.group ?? '') === g).map((it) => {
              const a = day(it.start), b = day(it.end) + DAY;
              const bar = <span className={cn('absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full', TONE[it.tone ?? 'neutral'])} style={{ left: pct(a), width: `calc(${pct(lo + (Math.min(b, hi) - Math.max(a, lo)))} - 2px)`, minWidth: 6 }} />;
              return (
                <Fragment key={it.id}>
                  {/* The label is the item's one link: visible, focusable, and read with the table's dates. */}
                  {it.href ? (
                    <Link href={it.href} title={it.label} className="row-link self-center truncate py-2 pr-3 text-ink-2">{it.label}</Link>
                  ) : (
                    <span aria-hidden className="self-center truncate py-2 pr-3 text-ink-2" title={it.label}>{it.label}</span>
                  )}
                  <div aria-hidden className="relative h-9 border-b border-line" title={`${it.label}: ${LONG.format(a)} to ${LONG.format(b - DAY)}`}>
                    <Guides />
                    {bar}
                  </div>
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Item</th><th>Group</th><th>Start</th><th>End</th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.label}</td>
              <td>{it.group ?? ''}</td>
              <td>{LONG.format(day(it.start))}</td>
              <td>{LONG.format(day(it.end))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
