'use client';

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '../../../lib/cn';
import { AXIS_FORMATTERS, FORMATTERS, type NumberFormat } from '../../../lib/format';
import { formatDate } from '../../../lib/format-date';
import { useMeridian } from '../meridian/index';
import { Readout } from '../readout';
import { monotonePath, linearPath, stepPath, heldTicks, ticksBetween, type Curve, SERIES_VAR, stackPart, type SeriesSlot } from '../scale';
import { useSettled } from '../use-settled';
import { useSize } from '../use-size';
import { trendTotals } from '../../../logic/derivations';

export type TrendSeries = {
  key: string;
  label: string;
  values: (number | null)[];
  /** A categorical slot (1 to 6), the accent, or the neutral comparison colour. */
  color?: SeriesSlot | 'accent' | 'neutral';
  /** `area` is the series the chart is about (at most one); `line` a peer; `dashed` a target or the previous period. */
  kind?: 'area' | 'line' | 'dashed';
};

/**
 * Where the scale ends: from a `floor`, or held to a `domain`, never both. `floor` is the lowest level the axis shows,
 * snapped down to a "nice" step: for a quantity that lives in a narrow band, such as uptime, where an axis from zero
 * makes the one thing the chart is about the smallest mark on it. A hint, not a crop: the floor is held at or under the
 * lowest value drawn, so the scale widens to the data and never hides it, and every value is placed inside the plot. For
 * `line` and `dashed` series only — an `area` and every stack are read by their height, which a floor would change the
 * meaning of. Defaults to 0, an axis from zero. `domain` holds the plot to a stated range, so charts read side by side
 * share their levels: while every value drawn is inside it the plot ends at it, from zero for an area or a stack; a value
 * outside it widens the scale to nice levels, and the chart says so above the plot and in its table.
 */
type TrendScale = { floor?: number; domain?: undefined } | { domain: [number, number]; floor?: undefined };

/**
 * The baseline's label, in pixels: the width a character is given (the text is `text-2xs` in tabular figures and its
 * width is not known before it is drawn, so this errs wide), how far its ink rises over its text baseline and drops
 * under it, and the air kept between that ink and anything drawn.
 */
const CHAR = 7, RISE = 9, DROP = 3, AIR = 4;
/** Beside the dashed line: the label's text 6px over it, or its ink 5px under it. */
const OVER = 6, UNDER = RISE + 5;

/** A series as the plot draws it: where each point stands, and whether it fills what is under its line. */
type Drawn = { ys: (number | null)[]; filled: boolean };

/**
 * Where the baseline's label stands: at an end of the dashed line, beside it, and never where a series is drawn. Its
 * first place is the right end, over the line. When a series comes within its box there, the candidates are, at each
 * end, the nearest clear place over the dashed line (lifted clear of the highest point under the label) and the
 * nearest under it (set clear of the lowest), and the one nearest the dashed line wins; of two as near, the right end
 * before the left, and over before under. A series that fills what is under it, an area or a band of a stack, leaves
 * no place under its line. The label keeps inside `plot`. When no place is clear there is no label: the dashed line
 * stands alone, and the table's caption still names it.
 */
function placeLabel(text: string, line: number, plot: { left: number; right: number; top: number; bottom: number }, xs: number[], drawn: Drawn[]) {
  const wide = text.length * CHAR, last = xs.length - 1;
  let best: { x: number; y: number; anchor: 'end' | 'start'; far: number } | null = null;
  if (wide > plot.right - plot.left) return best;
  for (const anchor of ['end', 'start'] as const) {
    const from = anchor === 'end' ? plot.right - wide : plot.left, to = from + wide;
    // The points under the label: those inside its span and one more on each side, because a curve that never
    // overshoots its data stays between neighbouring points.
    const under = xs.map((_, i) => i).filter((i) => xs[Math.min(last, i + 1)] >= from - AIR && xs[Math.max(0, i - 1)] <= to + AIR);
    // Where the label's text baseline may not be: on the dashed line, and wherever its ink would come within the air of a series.
    const shut: [number, number][] = [[line - OVER, line + UNDER]];
    for (const s of drawn) {
      const ys = under.map((i) => s.ys[i]).filter((y): y is number => y !== null);
      if (ys.length) shut.push([Math.min(...ys) - DROP - AIR, s.filled ? Infinity : Math.max(...ys) + RISE + AIR]);
    }
    /** The nearest place to `y`, going up or down, that is in none of them. */
    const clear = (y: number, up: boolean) => {
      for (let hit = shut.find(([a, b]) => y > a && y < b); hit; hit = shut.find(([a, b]) => y > a && y < b)) y = up ? hit[0] : hit[1];
      return y;
    };
    const over = clear(line - OVER, true), below = clear(line + UNDER, false);
    for (const [y, far, fits] of [[over, line - OVER - over, over - RISE >= plot.top], [below, below - line - UNDER, below + DROP <= plot.bottom]] as const) {
      if (fits && (!best || far < best.far)) best = { x: anchor === 'end' ? plot.right : plot.left, y, anchor, far };
    }
  }
  return best;
}

/**
 * What every page says about the one mark only this chart draws: the short dashed stretch into a period that is not
 * over. It could be written on the plot, and it was not: a chart that labels its own last point crowds the data it is
 * there to show, and the readout already says "so far" for the day under the cursor. The words belong to the caption
 * above, as the two cards that already state a running period do, and every page that passes `running` says these.
 */
export const SO_FAR = 'Today so far, dashed.';

/** The path function each curve names. */
const PATHS: Record<Curve, typeof monotonePath> = { monotone: monotonePath, linear: linearPath, step: stepPath };

/** `stepPath` traced backward, as a stacked part's lower edge is: upright first, then level, so it is the same line. */
const rise: typeof stepPath = (pts, from = 0, to = pts.length - 1) => {
  let d = `M${pts[from][0]},${pts[from][1]}`;
  for (let i = from + 1; i <= to; i++) d += `V${pts[i][1]}H${pts[i][0]}`;
  return d;
};

/**
 * A time series: one shared axis, at most one area, any number of lines. Never two y-scales: two measures of a
 * different size are two charts on one Meridian. Point, or move with the arrow keys, to read a day; every chart on
 * the page follows.
 *
 * `stacked` is the other form: the series are the parts of one whole (calls split into attributed, unattributed and
 * refused), drawn as bands one on another, so the top edge is the total. The readout names each part and the total.
 *
 * `running` says the last point is a period still in progress, a day or a month not over yet. It is not a fact like
 * the points before it, so nothing solid reaches it: the line into it is dashed, nothing is filled under that stretch,
 * and its readout and its row of the table say "so far".
 */
export function TrendChart({
  dates,
  series,
  format = 'count',
  axisFormat,
  height = 248,
  label,
  legend,
  tick,
  tickAt,
  stacked = false,
  whole = false,
  baseline,
  band,
  floor,
  domain,
  marks,
  spans,
  running = false,
  curve = 'monotone',
  points = false,
  'data-preview-index': previewIndex,
  className,
}: {
  dates: string[];
  series: TrendSeries[];
  /**
   * How a value reads, in the readout and in the table, and on the axis unless `axisFormat` says otherwise. A name
   * (`'cost'`, `'percent'`) is what a server component passes, since a function cannot cross into a client one; a
   * function is for a figure no name says exactly, from a client component: a price to four decimals, a ratio to six,
   * an amount in its own currency (#78).
   */
  format?: NumberFormat | ((n: number) => string);
  /** How a tick reads, when `format` is a function: an axis formatter, true at every tick. Without one the axis reads
   * as `format` does, which is right only while `format` is exact: one that rounds prints a tick it does not stand at. */
  axisFormat?: (n: number) => string;
  /** Pixels, or `fill` to take the height its card gives it (never under 220px). */
  height?: number | 'fill';
  /** What the chart shows, for screen readers: "Requests per day". */
  label: string;
  /** The legend above the plot. On by default when there are two or more series; a single series is named by its card. */
  legend?: boolean;
  /** How a point's instant reads, on the axis and in the readout, when the points are not days: "14:00", "Week of 3 Mar". */
  tick?: (date: string) => string;
  /** Which dates carry an x-axis label: quarter hours on an hour of minutes, month starts on a year of days. By default
   *  labels count back from the last date, as many as fit. The width rule still thins the chosen ones so they never
   *  collide, and the first and last are always labelled. The readout and the table are unaffected: every date reads
   *  there (#135). */
  tickAt?: (date: string, index: number) => boolean;
  /** The series are parts of one whole: bands stacked in order, the first at the bottom, each in its categorical slot. */
  stacked?: boolean;
  /** The values are counts, a stack of counts too: every level is a whole number, so a top of 10 draws none at 2.5 or 7.5 (#73). */
  whole?: boolean;
  /** What is usual, drawn as a quiet dashed line across the plot with its label at the end: `{ value: 296, label: 'Median 296ms' }`. */
  baseline?: { value: number; label: string };
  /**
   * The band the page is judged against: the region from the floor up to `value`, filled with the track's own wash and
   * labelled at its top edge, so the line is seen leaving it. `{ value: 350, label: 'p95 under 350 ms' }`. Distinct from
   * `baseline`, which is a line: a median is a level, a band is everything under one.
   */
  band?: { value: number; label: string };
  /**
   * Days the page names, marked on the first series with a dot, so a reader finds them rather than hunting for them
   * among 360 points: the days a band's membership left out. Dates it does not draw are skipped.
   */
  marks?: { dates: readonly string[]; tone: 'warning' | 'neutral'; label: string };
  /**
   * Periods a fact names, drawn as a full-height wash behind the series from the first date to the last that is in
   * `dates`: when p95 stayed over its ceiling, when an incident ran. `from` and `to` are dates of `dates`, either end
   * optional when the period was still open at an edge of the plot. It is not a second band: a band is a level, a span is
   * a period (#124).
   */
  spans?: { from: string; to: string; label: string }[];
  /** The last point is a period still in progress: the line into it is dashed and its readout says "so far". */
  running?: boolean;
  /**
   * How a line, an area and the running stretch are drawn between points: `monotone` (the default) a smooth curve that never
   * overshoots, `linear` straight segments, `step` a level held until the next reading. Straight is right for a few readings,
   * where a smooth curve would invent the shape between them; a step for a balance that changes at events. The parts of a
   * `stacked` chart and the total's running stretch take it too.
   */
  curve?: Curve;
  /** A dot on each measured value of every line and area, for a few readings; none while they would stand under 6px apart. */
  points?: boolean;
  /** A static readout in the Atlas; real charts take their day from the Meridian. */
  'data-preview-index'?: number;
  className?: string;
} & TrendScale) {
  const [box, size] = useSize<HTMLDivElement>();
  // The legend wraps on a narrow card; the plot starts under however many lines it took.
  const [legendBox, legendSize] = useSize<HTMLUListElement>();
  const [widenedBox, widenedSize] = useSize<HTMLParagraphElement>();
  const width = size.width;
  const fill = height === 'fill';
  const [local, setLocal] = useState(false);
  const { index, setIndex } = useMeridian(dates);
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const h = fill ? Math.max(220, size.height) : height;

  const named = typeof format === 'string';
  const fmt = useMemo(() => (typeof format === 'string' ? FORMATTERS[format] : (n: number | null) => (n === null ? '—' : format(n))), [format]);
  const axis = axisFormat ?? (named ? AXIS_FORMATTERS[format] : format);
  // Stacked, each band sits on the sum of the ones below it: a band's top is every band up to it added up a day at a
  // time, and its bottom is the same sum without it. The per-day total is the logic layer's figure, not the plot's.
  const bases = useMemo(() => {
    if (!stacked) return null;
    const bands = series.map((s) => dates.map((_, i) => s.values[i] ?? null));
    return series.map((_, k) => ({
      lower: k === 0 ? dates.map(() => 0) : trendTotals(bands.slice(0, k)),
      upper: trendTotals(bands.slice(0, k + 1)),
    }));
  }, [stacked, series, dates]);
  const totals = useMemo(() => (bases ? bases[bases.length - 1]?.upper ?? [] : null), [bases]);
  // The days the stack was measured on, in runs: a day no part has a value for breaks every band there, as a missing day
  // breaks a line, rather than dipping the whole stack to zero. Within a run a part with no value stands on the parts below.
  const stackRuns = useMemo(() => {
    const runs: number[][] = [[]];
    totals?.forEach((t, i) => (t === null ? runs[runs.length - 1].length && runs.push([]) : runs[runs.length - 1].push(i)));
    return runs.filter((r) => r.length > 0);
  }, [totals]);
  // Stacked parts are one whole, so they share one hue, each by its place in the stack. A series given its own colour keeps it.
  const colorOf = (s: TrendSeries, k: number) => (stacked && !s.color ? stackPart(k, series.length) : SERIES_VAR(s.color ?? (s.kind === 'dashed' ? 'neutral' : 'accent')));
  const values = (totals ?? series.flatMap((s) => s.values)).filter((v): v is number => v !== null);
  // A floor is a hint and never a crop: it is held at or under the lowest value drawn, or a day that fell further than
  // the floor would be drawn below the plot's own axis. So the scale widens to the data and never hides it. Without a
  // floor the axis holds zero, and a value under zero, a net change or a net flow, takes the axis down with it (#80).
  const from = Math.min(floor ?? 0, ...values);
  // The top is the data's, never a fixed 1: a ratio that peaks at 0.004 is drawn to its own top, not lost along the
  // floor of a scale to 1. A scale with nothing above its floor falls back to the unit one.
  const max = Math.max(floor === undefined ? 0 : -Infinity, baseline?.value ?? -Infinity, band?.value ?? -Infinity, ...values);
  // The levels, and the floor the plot is drawn to: `ticks[0]` is 0 unless the chart was given a floor, and the two ends
  // of the scale are what every point, area, band and level line is measured against.
  const count = h < 200 ? 3 : 4;
  // A held scale ends at its domain, from zero for an area or a stack, while every value drawn is inside it; one outside
  // it widens the scale to the nice levels that take it, and the chart says so, since the levels are no longer the held ones.
  const held = domain && domain[1] > domain[0] ? domain : null;
  const end = held ? (stacked || series.some((s) => s.kind === 'area') ? Math.min(held[0], 0) : held[0]) : 0;
  const all = held ? [...values, baseline?.value ?? end, band?.value ?? end] : [];
  const lo = Math.min(end, ...all), hi = Math.max(held?.[1] ?? 0, ...all);
  const inside = held && lo >= end && hi <= held[1];
  const ticks = inside
    ? heldTicks(end, held[1], count).filter((t, i, a) => !whole || Number.isInteger(t) || !i || i === a.length - 1)
    : held ? ticksBetween(lo, hi, count, whole) : ticksBetween(from, max, count, whole);
  const low = ticks[0];
  const top = ticks[ticks.length - 1];
  const widened = held && !inside ? `Scale widened from ${fmt(end)}\u2013${fmt(held[1])} to ${fmt(low)}\u2013${fmt(top)}` : '';
  // The words take a line of their own over the legend and the plot, or two on a phone card; unmeasured, one line.
  const lift = widened ? (widenedSize.height ? widenedSize.height + 1 : 18) : 0;
  const left = Math.max(...ticks.map((t) => axis(t).length)) * 6.4 + 12;
  // Each span as the stretch of dates it covers, drawn from its first date to its last. A date the plot does not hold is
  // skipped, so a period that began before the window is drawn from the window's first day, and one still open at the end
  // reaches the last. The ends are inclusive, which is what a person reads: "09:25–09:31" covers both minutes.
  const washes = (spans ?? []).flatMap((span) => {
    const from = dates.indexOf(span.from), to = dates.indexOf(span.to);
    if (from < 0 && to < 0) return [];
    const start = from < 0 ? 0 : Math.min(from, to < 0 ? dates.length - 1 : to);
    const end = to < 0 ? dates.length - 1 : Math.max(from < 0 ? 0 : from, to);
    return [{ ...span, start, end }];
  });
  // The legend names the series; the key under it names the marks, which would otherwise be a dot, a dash and a stem a
  // reader has to guess at. Either one alone is enough to draw the row, and the plot keeps its room for it (#129).
  const marksKey = Boolean(marks || running || washes.length);
  const showLegend = legend ?? (series.length > 1 || marksKey);
  const pad = { t: (showLegend ? Math.max(34, legendSize.height + 16) : 14) + lift, r: 4, b: 26, l: left };
  const W = Math.max(0, width - pad.l - pad.r), H = h - pad.t - pad.b;
  const n = dates.length;
  // The point still running, if there is one: everything solid stops at the point before it.
  const soFar = running ? n - 1 : -1;
  // The table follows the line a frame later when the dates change (`useSettled`).
  const settled = useSettled(dates.join('\n'));
  // Moving the cursor re-renders the chart, and no row of its table changes with it, so the rows are built once per data.
  const caption = `${label}${band ? `. ${band.label}` : ''}${marks ? `. Marked: ${marks.label}` : ''}${washes.length ? `. ${washes.map((w) => `${w.label} (${w.from}–${w.to})`).join('. ')}` : ''}${baseline ? `. ${baseline.label}` : ''}${running ? `. ${SO_FAR}` : ''}${widened ? `. ${widened}` : ''}`;
  const table = useMemo(
    () => (settled ? <table className="sr-only">
      <caption>{caption}</caption>
      <thead><tr><th scope="col">Date</th>{series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}{totals ? <th scope="col">Total</th> : null}</tr></thead>
      <tbody>{dates.map((d, i) => <tr key={d}><th scope="row">{tick ? tick(d) : formatDate(d)}{i === soFar ? ', so far' : null}</th>{series.map((s) => <td key={s.key}>{fmt(s.values[i])}</td>)}{totals ? <td>{fmt(totals[i])}</td> : null}</tr>)}</tbody>
    </table> : null),
    [settled, caption, series, totals, dates, soFar, fmt, tick],
  );
  const x = (i: number) => pad.l + (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => pad.t + H - ((v - low) / (top - low)) * H;

  const bands = useMemo(
    () =>
      bases?.map(({ lower, upper }, k) => {
        // Each edge takes the curve's path; a lower edge is traced backward, so a step rises before it holds level.
        const path = PATHS[curve], back = curve === 'step' ? rise : path;
        let line = '', area = '', tail = '';
        for (const run of stackRuns) {
          const top = run.map((i) => [x(i), y(upper[i] ?? lower[i] ?? 0)] as [number, number]);
          const bottom = run.map((i) => [x(i), y(lower[i] ?? 0)] as [number, number]).reverse();
          // Running, the bands end at the last complete point. Only the total goes on, and only when some part was measured there.
          const cut = running && run.length > 1 && run[run.length - 1] === n - 1 ? 1 : 0;
          const edge = path(top, 0, top.length - 1 - cut);
          line += edge;
          area += `${edge}${back(bottom, cut).replace(/^M/, 'L')}Z`;
          if (cut && k === series.length - 1) tail = path(top, top.length - 2);
        }
        return { s: series[k], k, line, tail, area };
      }) ?? [],
    // The geometry the paths are drawn on is scalar, so it is listed rather than left out: a page whose dates grew with the
    // same values array would otherwise keep paths drawn to the old spacing. `x` and `y` are the only pieces left, and
    // they are these numbers put together.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bases, stackRuns, curve, width, h, top, running, n, pad.l, pad.t, W, H, low],
  );

  const paths = useMemo(
    () =>
      series.map((s) => {
        const path = PATHS[curve];
        // A missing day breaks the line: each run of measured days is its own segment, never bridged.
        const runs: [number, number][][] = [[]];
        s.values.forEach((v, i) => (v === null ? runs[runs.length - 1].length && runs.push([]) : runs[runs.length - 1].push([x(i), y(v)])));
        const segs = runs.filter((r) => r.length > 0);
        // Running, the last run is solid as far as the point before the running one, and its last stretch is the tail. There
        // is a tail only when both of its ends were measured; a reference is a whole period and never has one.
        const last = segs[segs.length - 1];
        const open = running && s.kind !== 'dashed' && typeof s.values[n - 1] === 'number' && last.length > 1;
        const end = (r: [number, number][]) => r.length - (open && r === last ? 2 : 1);
        const line = segs.map((r) => path(r, 0, end(r))).join('');
        // An area is filled down to zero, which is the floor of the plot unless the axis goes under it: a signed area
        // is filled to its zero line from either side, never down to the lowest level.
        const base = y(Math.min(Math.max(0, low), top));
        const area = segs.map((r) => `${path(r, 0, end(r))}L${r[end(r)][0]},${base}L${r[0][0]},${base}Z`).join('');
        return { s, line, area, tail: open ? path(last, last.length - 2) : '' };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, curve, width, h, low, top, running, n, pad.l, pad.t, W, H],
  );

  // What the plot draws, as the label placer needs it: every line, and the top of every band of a stack. Memoised on the
  // geometry, not rebuilt on every cursor move: pointing at the chart re-renders it, and this walks every point of every
  // series and then places each reference label against all of them.
  const drawn = useMemo(
    () => (bases ? bases.map(({ upper }) => ({ ys: upper.map((v) => (v === null ? null : y(v))), filled: true })) : series.map((s) => ({ ys: s.values.map((v) => (v === null ? null : y(v))), filled: s.kind === 'area' }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bases, series, width, h, low, top, pad.l, pad.t, W, H],
  );
  // The reference levels, in the order their labels are placed: the band's top edge first, then what is usual. Both are
  // placed against everything the plot draws. They may stand in the 14px the chart keeps clear over its top gridline,
  // and never under the axis.
  const refs = useMemo(
    () => [
      ...(band ? [{ value: band.value, label: band.label, edge: true }] : []),
      ...(baseline ? [{ value: baseline.value, label: baseline.label, edge: false }] : []),
    ].map((r) => ({ ...r, at: placeLabel(r.label, y(r.value), { left: pad.l, right: pad.l + W, top: pad.t - 14, bottom: pad.t + H }, dates.map((_, i) => x(i)), drawn) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [band, baseline, drawn, dates, width, h, low, top, pad.l, pad.t, W, H],
  );

  // How many labels the plot holds, and so which of them it draws: every nth from the last, so the spacing is even.
  const slots = Math.max(2, Math.floor(W / 92));
  const labelEvery = Math.max(1, Math.ceil(n / slots));
  // A caller may name the dates that carry a label — quarter hours, month starts — where counting back from the last one
  // lands on 09:04 and 09:11. The chosen dates are then thinned to the same number of slots, counted back from the last,
  // so they never collide; the first chosen one and the last are always labelled, since they anchor the range (#135).
  const xLabels = (() => {
    if (!tickAt) return dates.map((d, i) => ({ d, i })).filter(({ i }) => (n - 1 - i) % labelEvery === 0);
    const chosen = dates.map((d, i) => ({ d, i })).filter(({ d, i }) => tickAt(d, i));
    const every = Math.max(1, Math.ceil(chosen.length / slots));
    return chosen.filter((_, k) => chosen.length - 1 - k === 0 || k === 0 || (chosen.length - 1 - k) % every === 0);
  })();

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - pad.l) / Math.max(1, W)) * (n - 1));
    setIndex(Math.min(n - 1, Math.max(0, i)));
    setLocal(true);
  };
  const keys = (e: KeyboardEvent) => {
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(k)) return;
    e.preventDefault();
    if (k === 'Escape') return setIndex(null);
    const cur = index ?? n - 1;
    setIndex(k === 'Home' ? 0 : k === 'End' ? n - 1 : Math.min(n - 1, Math.max(0, cur + (k === 'ArrowLeft' ? -1 : 1))));
    setLocal(true);
  };

  const selected = previewIndex ?? index;
  const active = selected !== null && Number.isInteger(selected) && selected >= 0 && selected < n ? selected : null;
  // On the pixel grid, so the 1px cursor line stays crisp while it glides.
  const cx = active !== null ? Math.round(x(active)) + 0.5 : 0;
  const day = active === null ? '' : tick ? tick(dates[active]) : formatDate(dates[active]);
  /** The day pointed at, in words, for a screen reader: the readout is drawn for the eye and hidden from it. */
  // A point inside a span says which (#124): the wash is a shape, and the pointer and the keys must name the period it
  // stands in as they name a marked day.
  const spanAt = (i: number | null) => (i === null ? [] : washes.filter((w) => i >= w.start && i <= w.end).map((w) => w.label));
  const reading = active === null ? null : `${day}${active === soFar ? ', so far' : ''}${marks?.dates.includes(dates[active]) ? `, ${marks.label}` : ''}${spanAt(active).map((l) => `, ${l}`).join('')}: ${series.map((s) => `${s.label} ${fmt(s.values[active])}`).join(', ')}${totals ? `, Total ${fmt(totals[active])}` : ''}`;

  return (
    <div ref={box} className={cn('relative w-full select-none', fill && 'min-h-55 flex-1', className)} style={fill ? undefined : { height }}>
      {width > 0 ? (
        <svg
          width={width}
          height={h}
          className="absolute inset-0 block touch-pan-y overflow-visible rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          role="img"
          aria-label={`${label}. Use the arrow keys to read one day.`}
          tabIndex={0}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => { setIndex(null); setLocal(false); }}
          onKeyDown={keys}
          onBlur={() => setIndex(null)}
        >
          <defs>
            {stacked ? (
              // The stack fades toward the baseline, as the single-series area does: lit at the total, quiet at zero.
              <linearGradient id={`${gid}-fade`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="white" stopOpacity={1} />
                <stop offset="1" stopColor="white" style={{ stopOpacity: 'var(--chart-stack-fade)' }} />
              </linearGradient>
            ) : null}
            {stacked ? (
              <mask id={`${gid}-stack`} maskContentUnits="userSpaceOnUse">
                <rect x={0} y={pad.t} width={width} height={H} fill={`url(#${gid}-fade)`} />
              </mask>
            ) : null}
            {paths.filter((p) => p.s.kind === 'area').map((p) => (
              <linearGradient key={p.s.key} id={`${gid}-${p.s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={SERIES_VAR(p.s.color ?? 'accent')} style={{ stopOpacity: 'var(--chart-area-a)' }} />
                <stop offset="1" stopColor={SERIES_VAR(p.s.color ?? 'accent')} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {/* A span: the period a fact names, as a full-height wash behind everything the plot draws, so "when" reads as
              a stretch of the axis and not as a value. It is quiet, and the caption, the readout and the key name it. */}
          {washes.map((w) => (
            <rect
              key={`${w.label}:${w.start}`}
              data-span={w.label}
              x={x(w.start)}
              y={pad.t}
              width={Math.max(1, x(w.end) - x(w.start))}
              height={H}
              fill="var(--fill-track)"
              fillOpacity={0.55}
              className="reveal-x"
            >
              <title>{w.label}</title>
            </rect>
          ))}
          {band ? (
            // The band: a wash of the track's own colour up to its ceiling, under the gridlines, so what the page is
            // judged against is the ground the line stands on rather than a line the reader has to be told about.
            <rect
              data-band
              x={pad.l}
              y={y(band.value)}
              width={W}
              height={pad.t + H - y(band.value)}
              fill="var(--fill-track)"
              className="reveal-x"
            />
          ) : null}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + W} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} shapeRendering="crispEdges" />
              <text x={pad.l - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-2xs tabular-nums">{axis(t)}</text>
            </g>
          ))}
          {refs.map((r) => (
            // A reference level: the band's top edge as the axis is drawn, what is usual as a dashed hairline under the
            // data. The label stands where no series is drawn; the halo of the card lifts it off a gridline behind it.
            <g key={r.label} className="fade-in" pointerEvents="none">
              <line
                x1={pad.l}
                x2={pad.l + W}
                y1={y(r.value)}
                y2={y(r.value)}
                stroke={r.edge ? 'var(--chart-axis)' : 'var(--ink-3)'}
                strokeOpacity={r.edge ? 1 : 0.6}
                strokeDasharray={r.edge ? undefined : '3 4'}
                shapeRendering="crispEdges"
              />
              {/* `ink-2`, not `ink-3` like the axis ticks: this label stands over the band's own fill as often as over the
                  card, and ink-3 on `fill-track` measures 4.43:1 in light — the one pair the contrast gate did not carry,
                  because nothing drew text on a track before the band was drawn. The halo lifts it off a gridline; it
                  does not raise the ratio the gate reads. */}
              {r.at ? <text x={r.at.x} y={r.at.y} textAnchor={r.at.anchor} stroke="var(--surface)" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke" className="fill-ink-2 text-2xs tabular-nums">{r.label}</text> : null}
            </g>
          ))}
          {xLabels.map(({ d, i }) => (
            <text key={d} data-x-label x={x(i)} y={h - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-ink-3 text-2xs">
              {tick ? tick(d) : formatDate(d).replace(/,? \d{4}$/, '')}
            </text>
          ))}
          <g mask={stacked ? `url(#${gid}-stack)` : undefined}>
          {bands.map(({ s, k, area, line }) => (
            <g key={`${s.key}-${dates[0]}-${n}`} className="reveal-x">
              <path d={area} fill={colorOf(s, k)} />
              {/* A hairline of the card between bands, so neighbouring parts never run together. */}
              <path d={line} fill="none" stroke="var(--surface)" strokeWidth={1} strokeLinejoin="round" />
            </g>
          ))}
          </g>
          {bands.length ? (
            // The total is the line the chart is about: the accent stroke and its glow, as on the single-series area.
            <g key={`total-${dates[0]}-${n}`}>
              <path d={bands[bands.length - 1].line} fill="none" stroke="var(--accent)" strokeWidth={5} strokeLinecap="round" pathLength={1} className="draw" style={{ opacity: 'var(--chart-glow-a)', filter: 'blur(calc(var(--chart-glow-blur) * 1px))', transform: 'translateY(2px)' }} />
              <path d={bands[bands.length - 1].line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="draw" />
              {bands[bands.length - 1].tail ? <Running d={bands[bands.length - 1].tail} stroke="var(--accent)" /> : null}
            </g>
          ) : null}
          {(stacked ? [] : paths).map(({ s, area, line, tail }) => (
            // Keyed by the span it shows: a new period redraws the line from the left instead of snapping to new data.
            <g key={`${s.key}-${dates[0]}-${n}`}>
              {s.kind === 'area' ? <path d={area} fill={`url(#${gid}-${s.key})`} className="reveal-x" /> : null}
              {s.kind === 'area' ? <path d={line} fill="none" stroke={SERIES_VAR(s.color ?? 'accent')} strokeWidth={5} strokeLinecap="round" pathLength={1} className="draw" style={{ opacity: 'var(--chart-glow-a)', filter: 'blur(calc(var(--chart-glow-blur) * 1px))', transform: 'translateY(2px)' }} /> : null}
              <path
                d={line}
                fill="none"
                pathLength={1}
                stroke={SERIES_VAR(s.color ?? (s.kind === 'dashed' ? 'neutral' : 'accent'))}
                strokeWidth={s.kind === 'dashed' ? 1.5 : 2}
                strokeDasharray={s.kind === 'dashed' ? '0.006 0.006' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={s.kind === 'dashed' ? 'fade-in' : 'draw'}
              />
              {tail ? <Running d={tail} stroke={SERIES_VAR(s.color ?? 'accent')} /> : null}
              {/* A dot on each reading while the dots stand apart; a reference and a stack are read by their line, and a running
                  point is still in progress, so nothing solid reaches it. */}
              {points && s.kind !== 'dashed' && (n < 2 || W / (n - 1) >= 6)
                ? s.values.map((v, i) => (v === null || (running && i === n - 1) ? null : <circle key={i} data-point cx={x(i)} cy={y(v)} r={3} fill={SERIES_VAR(s.color ?? 'accent')} stroke="var(--surface)" strokeWidth={2} className="fade-in" />))
                : null}
            </g>
          ))}
          {marks && series[0] ? (
            // The days the page names: found rather than hunted for. A day's point may stand inside a band's region — a
            // day that left the band on something this chart does not draw — so each mark is a stem down to the axis as
            // well as a dot on the point, and the dot is ringed in the card's colour as the cursor's dots are.
            <g className="fade-in" pointerEvents="none">
              {marks.dates.map((d) => {
                const i = dates.indexOf(d);
                const v = i < 0 ? null : series[0].values[i];
                if (v === null) return null;
                const tone = marks.tone === 'warning' ? 'var(--warning)' : 'var(--ink-2)';
                return (
                  <g key={d} data-mark>
                    <line x1={x(i)} x2={x(i)} y1={y(v)} y2={pad.t + H} stroke={tone} strokeOpacity={0.45} />
                    <circle cx={x(i)} cy={y(v)} r={3} fill={tone} stroke="var(--surface)" strokeWidth={2} />
                  </g>
                );
              })}
            </g>
          ) : null}
          {active !== null ? (
            // The cursor glides from day to day (transform, so it eases) rather than jumping.
            <g pointerEvents="none" className="transition-transform duration-(--dur-hover) ease-out" style={{ transform: `translateX(${cx}px)` }}>
              <line x1={0} x2={0} y1={pad.t - 6} y2={pad.t + H} stroke="var(--ink-3)" strokeOpacity={0.55} />
              {series.map((s, k) => {
                const v = bases ? bases[k].upper[active] : s.values[active];
                // The bands stop short of a running point, so there only the total, which has a line to sit on, keeps its dot.
                const total = stacked && active === soFar;
                return v === null || (total && k < series.length - 1) ? null : (
                  <circle key={s.key} cx={0} cy={0} r={4} className="transition-transform duration-(--dur-hover) ease-out" style={{ transform: `translateY(${y(v)}px)` }} fill={total ? 'var(--accent)' : colorOf(s, k)} stroke="var(--surface)" strokeWidth={2} />
                );
              })}
            </g>
          ) : null}
        </svg>
      ) : null}
      {widened ? <p ref={widenedBox} data-widened className="absolute top-0 right-0 text-2xs text-ink-3" style={{ left: pad.l }}>{widened}</p> : null}
      {showLegend ? (
        <ul ref={legendBox} aria-hidden className="absolute right-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" style={{ left: pad.l, top: lift }}>
          {series.map((s, k) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <svg width="14" height="4" className="shrink-0 overflow-visible">
                {/* Stacked, a part can be the accent at 36% toward the surface — as a 4px line on a light card that is a whisper,
                    and a swatch is the one mark whose whole job is to be seen. The hairline behind it does that without
                    flattening the tone ordering, which is the rest of what the legend is telling: measured, the palest of four
                    parts in light sits at 0.83 alpha, in dark at 0.69. */}
                {stacked ? <line x1="1" x2="13" y1="2" y2="2" stroke="var(--ink-3)" strokeWidth={6} strokeLinecap="round" /> : null}
                <line x1="1" x2="13" y1="2" y2="2" stroke={colorOf(s, k)} strokeWidth={stacked ? 4 : 2} strokeLinecap="round" strokeDasharray={s.kind === 'dashed' ? '2 3' : undefined} />
              </svg>
              {s.label}
            </li>
          ))}
          {/* A marked day's dot-and-stem, and the running stretch's dash, say what they mean in words here: the caption says
              them too, but a screen reader reads that and the pointer only finds a title. */}
          {marks ? <li data-key-mark className="flex items-center gap-1.5"><svg width="8" height="10" className="shrink-0 overflow-visible"><line x1="4" x2="4" y1="1" y2="9" stroke={marks.tone === 'warning' ? 'var(--warning)' : 'var(--ink-2)'} strokeOpacity={0.45} /><circle cx="4" cy="1" r="2.5" fill={marks.tone === 'warning' ? 'var(--warning)' : 'var(--ink-2)'} stroke="var(--surface)" strokeWidth="1.5" /></svg>{marks.label}</li> : null}
          {running ? <li data-key-running className="flex items-center gap-1.5"><svg width="14" height="4" className="shrink-0 overflow-visible"><line x1="1" x2="13" y1="2" y2="2" stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 4" strokeLinecap="round" /></svg>{SO_FAR}</li> : null}
          {/* A span is a wash, and a wash with no word is a shape a reader guesses at: each names itself here, as a mark does.
              Two spans of the same name are one legend entry. */}
          {[...new Set(washes.map((w) => w.label))].map((w) => <li key={w} data-key-span className="flex items-center gap-1.5"><svg width="10" height="10" className="shrink-0 overflow-visible"><rect x="1" y="1" width="8" height="8" rx="1" fill="var(--fill-track)" fillOpacity={0.55} stroke="var(--ink-3)" strokeOpacity={0.35} /></svg>{w}</li>)}
        </ul>
      ) : null}
      {active !== null && width > 0 ? (
        <Readout at={cx} after={cx <= width / 2} top={pad.t - 4} visible={local || previewIndex !== undefined}>
          {/* A marked day says what it is marked for where every other reading of the day is (#94): the dot and its stem
              are a shape, the group they stand in takes no pointer, and the table's caption is read by a screen reader and
              not by the person pointing at the chart. */}
          <p className="t-eyebrow mb-1.5 break-words">{day}{active === soFar ? ' · so far' : null}{marks?.dates.includes(dates[active]) ? ` · ${marks.label}` : null}{spanAt(active).map((l) => ` · ${l}`).join('')}</p>
          {/* Stacked, the readout lists the bands top to bottom, as they sit on the chart, then the total. */}
          {(stacked ? series.map((s, k) => ({ s, k })).reverse() : series.map((s, k) => ({ s, k }))).map(({ s, k }) => (
            <p key={s.key} className="flex flex-wrap items-start gap-x-2 text-xs leading-6">
              <span className={cn('mt-3 w-2.5 shrink-0 rounded-full', stacked ? 'h-1' : 'h-0.5')} style={{ background: colorOf(s, k) }} />
              <span className="min-w-0 flex-1 break-words text-ink-2">{s.label}</span>
              <span className="t-num ml-auto min-w-0 break-words font-medium text-ink">{fmt(s.values[active])}</span>
            </p>
          ))}
          {totals ? (
            <p className="mt-1 flex items-center gap-2 border-t border-line pt-1 text-xs leading-6">
              <span className="text-ink-2">Total</span>
              <span className="t-num ml-auto pl-4 font-semibold text-ink">{fmt(totals[active])}</span>
            </p>
          ) : null}
        </Readout>
      ) : null}
      <p className="sr-only" aria-live="polite">{reading}</p>
      {table}
    </div>
  );
}

/** The stretch into a point still running: the line's own colour, thinner and dashed, and it fades in as a reference does. */
function Running({ d, stroke }: { d: string; stroke: string }) {
  // The stretch is the chart's own mark and its meaning is not in its shape: the words are `SO_FAR`'s, which the caption
  // says too. A page that passes `running` says them above the chart; the pointer says them here (issue #94).
  return <path data-running d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray="3 4" strokeLinecap="round" className="fade-in"><title>{SO_FAR}</title></path>;
}
