/** Small, dependency-free scale helpers shared by the charts. */

/** A "nice" upper bound and 3 to 5 ticks from 0 to it. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  return ticksBetween(0, max, count);
}

/**
 * "Nice" levels from `floor` up to at least `max`: the same steps, counted from `floor` rather than from zero. For a
 * quantity that lives in a narrow band — uptime, a success rate, a cache hit rate — where a zero-based axis would make
 * the one thing the chart is about the smallest mark on it. Both ends land on a step, so the lowest level is the floor
 * the plot is drawn to and `ticks[0]` may be read as it. Returns `[0, 1]` like `niceTicks` when there is nothing to show.
 */
export function ticksBetween(floor: number, max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = (max - floor) / count;
  if (!(raw > 0)) return niceTicks(max, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  // How many steps a level is from zero, rounded before it is floored or ceilinged: in binary, 0.7 / 0.1 is 6.999…,
  // and a floor of 70% on a 10% step would otherwise come out as 60% — a whole step of the plot spent on nothing.
  const steps = (n: number) => Math.round(n / step * 1e6) / 1e6;
  const top = Math.ceil(steps(max)) * step;
  const low = floor > 0 ? Math.floor(steps(floor)) * step : 0;
  return Array.from({ length: Math.round((top - low) / step) + 1 }, (_, i) => Math.round((low + i * step) * 1e6) / 1e6);
}

/**
 * A smooth path through points (monotone cubic), so a line never overshoots its data. `from` and `to` draw only that
 * stretch of the same curve, so two strokes that share it meet without a corner.
 */
export function monotonePath(pts: [number, number][], from = 0, to = pts.length - 1): string {
  const n = pts.length;
  if (n < 2) return n ? `M${pts[0][0]},${pts[0][1]}` : '';
  const dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  let d = `M${pts[from][0]},${pts[from][1]}`;
  for (let i = from; i < to; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

export const SERIES_VAR = (slot: number | 'accent' | 'neutral') =>
  slot === 'accent' ? 'var(--accent)' : slot === 'neutral' ? 'var(--chart-neutral-strong)' : `var(--series-${slot})`;

/**
 * The colour of one part of a one-hue stack, by its place: `place` counts from 0 at the bottom of a stack of `parts`.
 * The parts are one whole, so they share the accent, mixed into the surface: deepest at the bottom and paler with each
 * part above. How deep and how pale is the theme's (chart-stack-hi, -lo): dark needs a wider span for the parts to read
 * apart. The contrast gate holds the deepest part, the one a stack stands on, to 3:1 against the surface.
 */
export const stackPart = (place: number, parts: number) => {
  const t = (place / Math.max(1, parts - 1)).toFixed(3);
  return `color-mix(in oklab, var(--accent) calc((var(--chart-stack-hi) - (var(--chart-stack-hi) - var(--chart-stack-lo)) * ${t}) * 100%), var(--surface))`;
};
