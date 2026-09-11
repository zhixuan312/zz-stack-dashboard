import { cn } from '@/lib/cn';
import { formatCount } from '@/lib/format';
import { DISPLAY_TIMEZONE } from '@/lib/format-date';

interface HeatCell {
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  /** 0–23, in the display timezone. */
  hour: number;
  /** How much happened in this weekday × hour bucket. */
  value: number;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * When work actually happens — weekday × hour of day.
 *
 * Worth its own chart rather than another bar list because the question it
 * answers is two-dimensional: a daily total cannot tell you whether Tuesday is
 * busy all day or spikes for one hour, and an hourly total cannot tell you
 * whether that hour is a weekday habit or a weekend catch-up.
 *
 * Intensity is **linear** against the busiest cell. A square-root ramp was tried
 * first, on the usual reasoning that run counts are skewed — but measured on
 * this corpus the spread is min 1 / median 63 / max 264, and the square root of
 * that puts the median at 49% and the peak at 100%. Every cell came out the
 * same mid-tone and the chart looked broken rather than flat. Linear puts the
 * median at 24% and the busy hours actually stand out.
 *
 * Bucket your data in `DISPLAY_TIMEZONE` (`@/lib/format-date`) — the footer
 * names that zone, so bucketing in UTC while labelling it as local shifts every
 * cell by the offset and the chart lies quietly.
 */
export function ActivityHeatmap({
  cells,
  unitLabel = 'events',
  className,
}: {
  cells: HeatCell[];
  /** Plural noun for the footer and cell tooltips — 'runs', 'orders', 'signups'. */
  unitLabel?: string;
  className?: string;
}) {
  const byKey = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.value]));
  const max = Math.max(0, ...cells.map((c) => c.value));
  const total = cells.reduce((n, c) => n + c.value, 0);

  if (total === 0) {
    return (
      <p className={cn('py-6 text-center text-sm text-ink-faint', className)}>
        No activity in this period
      </p>
    );
  }

  const intensity = (value: number): number => (max > 0 ? value / max : 0);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Hour ruler — every third hour, so the labels never collide. */}
          <div className="mb-1 grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] items-end gap-[2px]">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center font-mono text-[10px] text-ink-faint">
                {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
              </span>
            ))}
          </div>

          {DAYS.map((day, d) => (
            <div
              key={day}
              className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] items-center gap-[2px] py-[1px]"
            >
              <span className="pr-2 text-right font-mono text-[10px] text-ink-faint">{day}</span>
              {Array.from({ length: 24 }, (_, h) => {
                const value = byKey.get(`${d}:${h}`) ?? 0;
                const t = intensity(value);
                return (
                  <span
                    key={h}
                    title={`${day} ${String(h).padStart(2, '0')}:00 — ${formatCount(value)} ${unitLabel}`}
                    className="aspect-square rounded-[var(--r-sm)]"
                    style={{
                      // A single accent hue at varying strength, not a rainbow:
                      // the value is one ordered quantity, so it gets one ramp.
                      background:
                        value === 0
                          ? 'var(--surface-2)'
                          : `color-mix(in oklab, var(--accent) ${Math.round(t * 100)}%, var(--surface-2))`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-ink-faint">
        <span>
          {formatCount(total)} {unitLabel} · busiest hour {formatCount(max)} · times are{' '}
          {DISPLAY_TIMEZONE}
        </span>
        <span className="flex items-center gap-1.5">
          less
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span
              key={t}
              className="size-2.5 rounded-[var(--r-sm)]"
              style={{
                background:
                  t === 0
                    ? 'var(--surface-2)'
                    : `color-mix(in oklab, var(--accent) ${Math.round(t * 100)}%, var(--surface-2))`,
              }}
            />
          ))}
          more
        </span>
      </div>
    </div>
  );
}
