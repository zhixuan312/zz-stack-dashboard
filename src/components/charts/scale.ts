/** Small, dependency-free scale helpers shared by the charts. */

/**
 * A "nice" upper bound and 3 to 5 ticks from 0 to it. `whole` keeps every tick a whole number, for a scale of counts:
 * a top of 1 is ticked 0 and 1, never with a level at 0.5 that no count stands at (#72).
 */
export function niceTicks(max: number, count = 4, whole = false): number[] {
  if (max <= 0) return [0, 1];
  return ticksBetween(0, max, count, whole);
}

/**
 * "Nice" levels from `floor` up to at least `max`: the same steps, counted from `floor` rather than from zero. For a
 * quantity that lives in a narrow band — uptime, a success rate, a cache hit rate — where a zero-based axis would make
 * the one thing the chart is about the smallest mark on it. Both ends land on a step, so the lowest level is the floor
 * the plot is drawn to and `ticks[0]` may be read as it. A floor under zero is a step under zero, so a signed series
 * (a net change, a net flow) is drawn on levels either side of it, zero among them. Returns `[0, 1]` like `niceTicks`
 * when there is nothing to show.
 */
export function ticksBetween(floor: number, max: number, count = 4, whole = false): number[] {
  if (max <= 0 && floor >= 0) return [0, 1];
  const raw = (max - floor) / count;
  if (!(raw > 0)) return niceTicks(max, count, whole);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  // A whole scale steps by a whole number: at least 1, and 2.5 becomes 5 as the next nice step (2.5 × 10 stays 25).
  const step = !whole || Number.isInteger(nice) ? nice : nice < 1 ? 1 : [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= nice && Number.isInteger(s)) ?? Math.ceil(nice);
  // How many steps a level is from zero, rounded before it is floored or ceilinged: in binary, 0.7 / 0.1 is 6.999…,
  // and a floor of 70% on a 10% step would otherwise come out as 60% — a whole step of the plot spent on nothing.
  const steps = (n: number) => Math.round(n / step * 1e6) / 1e6;
  // The rounding is for a level a hair off its step; an end it rounds past the data is a step short: a count scale over
  // values smaller than a millionth of its step drew every level at the floor (top - low = 0), or a fall under the plot.
  const under = Math.floor(steps(floor)) * step;
  const low = under - floor > step * 1e-9 ? under - step : under;
  const ceil = Math.ceil(steps(max)) * step;
  const top = Math.max(max - ceil > step * 1e-9 ? ceil + step : ceil, low + step);
  // Each level is rounded to a digit under its step, never to a fixed number of places: a ratio near 1.001061 steps
  // in millionths, and six places would round two of its levels to one (#78).
  const places = Math.max(0, 1 - Math.floor(Math.log10(step)));
  return Array.from({ length: Math.round((top - low) / step) + 1 }, (_, i) => Number((low + i * step).toFixed(places)) || 0);
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

/**
 * Levels that end exactly at `min` and `max`, for a scale whose domain the caller holds so charts compare row by row.
 * The step is a nice one (1, 2, 2.5 or 5 times a power of ten) that divides the span into 2 to 8 intervals with `min` on
 * a multiple of it; of those, the interval count nearest `count` wins, the smaller step on a tie. With no such step the
 * levels are the bounds, and zero between them when the span crosses it. A span that is not a range is `ticksBetween`'s.
 */
export function heldTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) return ticksBetween(min, max, count);
  const span = max - min;
  const top = Math.floor(Math.log10(span));
  let best = 0, bestN = 0;
  for (let k = top - 2; k <= top; k++) {
    for (const m of [1, 2, 2.5, 5]) {
      const step = m * 10 ** k;
      const n = Math.round(span / step), onSpan = Math.abs(span / step - n) < 1e-6;
      const lead = min / step, onStep = Math.abs(lead - Math.round(lead)) < 1e-6;
      if (!onSpan || !onStep || n < 2 || n > 8) continue;
      const gap = Math.abs(n - count), bestGap = Math.abs(bestN - count);
      if (!best || gap < bestGap || (gap === bestGap && step < best)) { best = step; bestN = n; }
    }
  }
  const round = (v: number) => Number(v.toFixed(12)) || 0;
  if (!best) return min < 0 && max > 0 ? [min, 0, max] : [min, max];
  return Array.from({ length: bestN + 1 }, (_, i) => round(min + i * best));
}

/** A straight-segment path through points: the same signature as `monotonePath`, for a line that is not smoothed. */
export function linearPath(pts: [number, number][], from = 0, to = pts.length - 1): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[from][0]},${pts[from][1]}`;
  for (let i = from + 1; i <= to; i++) d += `L${pts[i][0]},${pts[i][1]}`;
  return d;
}

/** A step path (step after): each value is held level to the next point's x, then moves straight to that point's y. */
export function stepPath(pts: [number, number][], from = 0, to = pts.length - 1): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[from][0]},${pts[from][1]}`;
  for (let i = from + 1; i <= to; i++) d += `H${pts[i][0]}V${pts[i][1]}`;
  return d;
}

/** How a line is drawn through its points: smoothed, straight, or held level between them. */
export type Curve = 'monotone' | 'linear' | 'step';

/** The categorical palette's slots: `--series-1` to `--series-6`. A seventh named nothing, and its part drew transparent. */
export type SeriesSlot = 1 | 2 | 3 | 4 | 5 | 6;
export const SERIES_SLOTS = 6;
export const SERIES_VAR = (slot: SeriesSlot | 'accent' | 'neutral') =>
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
