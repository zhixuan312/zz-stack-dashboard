import { cn } from '@/lib/cn';
import type { Tint } from '@/lib/tints';
import { TINT_VAR, CHART_EDGE } from '@/lib/tints';

interface Dot {
  key: string;
  /** Where the dot sits on the metric's own scale. */
  value: number;
  label: string;
}

/**
 * Every observation as its own dot on one axis, with the median marked.
 *
 * THE MARK MATCHES THE n. A line is a claim about a trend and a handful of observations
 * cannot support one — drawing one anyway is the chart equivalent of a median of two. Where
 * there are too few points for a series but a distribution worth seeing, each observation
 * gets a dot and the reader sees the shape directly.
 *
 * It exists because a median hides a tail. The tile this was built for reads "43 KB" while
 * a tenth of its runs sit past a megabyte — two orders of magnitude to the right of the
 * number on the tile, and invisible in it.
 *
 * `reference` draws a line the dots can be judged against. Use it only where an honest
 * reference exists, and name it: the one caller marks roughly one context window, and says
 * on the tile that it is a rule of thumb rather than a measurement.
 */
export function DotStrip({
  dots,
  format,
  tint = 'amber',
  reference,
  className,
  emptyLabel = 'No runs in this period',
}: {
  dots: Dot[];
  format: (value: number) => string;
  tint?: Tint;
  reference?: { value: number; label: string };
  className?: string;
  emptyLabel?: string;
}) {
  if (dots.length === 0) {
    return <p className={cn('py-3 text-xs text-ink-faint', className)}>{emptyLabel}</p>;
  }

  const max = Math.max(...dots.map((d) => d.value), reference?.value ?? 0) || 1;

  /* A LOG AXIS, BECAUSE THE DISTRIBUTION THIS EXISTS FOR SPANS ORDERS OF MAGNITUDE.
   *
   * The docblock above says it: a tenth of these runs sit two orders of magnitude right of the
   * median. On a LINEAR axis that puts the other nine tenths inside the first two percent —
   * every one of them colliding, stacking upward, and the tile growing a row per run. Measured
   * on production: 113 runs, median 1 KB, max 800 KB, and the strip rendered roughly 800 pixels
   * tall as one vertical column of dots at x=0. Every card in the row stretched to match it,
   * because they share a grid row.
   *
   * `log1p` rather than `log`, because a run that pulled nothing is a real observation and
   * `log(0)` is -Infinity. It also keeps the low end honest: 0 maps to 0.
   */
  const pos = (v: number): number => (Math.log1p(Math.max(0, v)) / Math.log1p(max)) * 100;
  const sorted = [...dots].sort((a, b) => a.value - b.value);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid].value : (sorted[mid - 1].value + sorted[mid].value) / 2;

  // Dots share a row until they collide, then stack upward — so a cluster reads as a
  // cluster instead of as one dot hiding nine others.
  /* STACKING IS BOUNDED. Even on a log axis a genuine cluster can be deeper than a tile should
   * be, and the height of a chart must not be a function of how many rows the data has — a
   * strip that grows with n is one that eventually decides the page layout. Past the cap the
   * dots share a row and overlap, which reads as density and is the honest answer for a
   * cluster too tight to separate. */
  const MAX_ROWS = 6;
  const placed: { x: number; y: number }[] = [];
  const laid = sorted.map((d) => {
    const x = pos(d.value);
    let y = 0;
    while (y < MAX_ROWS - 1 && placed.some((p) => Math.abs(p.x - x) < 2.4 && p.y === y)) y += 1;
    placed.push({ x, y });
    return { ...d, x, y };
  });
  const rows = Math.max(...laid.map((d) => d.y)) + 1;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="relative w-full" style={{ height: `${10 + rows * 7}px` }}>
        <span aria-hidden className="absolute inset-x-0 bottom-1.5 h-px bg-line" />
        <span
          aria-hidden
          title={`median ${format(median)}`}
          className="absolute bottom-0 h-4 w-px bg-ink-faint/60"
          style={{ left: `${pos(median)}%` }}
        />
        {reference ? (
          <span
            aria-hidden
            title={`${reference.label} — ${format(reference.value)}`}
            className="absolute inset-y-0 w-px bg-[var(--rose)]"
            style={{ left: `${pos(reference.value)}%` }}
          />
        ) : null}
        {laid.map((d) => (
          <span
            key={d.key}
            title={`${d.label} — ${format(d.value)}`}
            className="absolute size-[7px] -translate-x-1/2 rounded-full"
            style={{
              left: `${d.x}%`,
              bottom: `${3 + d.y * 7}px`,
              background: TINT_VAR[tint],
              boxShadow: CHART_EDGE,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[0.625rem] tabular-nums text-ink-faint">
        <span>median {format(median)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
