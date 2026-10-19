'use client';

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '../../../lib/cn';
import { AXIS_FORMATTERS, FORMATTERS, type NumberFormat } from '../../../lib/format';
import { formatDate } from '../../../lib/format-date';
import { useMeridian } from '../meridian/index';
import { Readout } from '../readout';
import { monotonePath, ticksBetween, SERIES_VAR, stackPart } from '../scale';
import { useSize } from '../use-size';

export type TrendSeries = {
  key: string;
  label: string;
  values: (number | null)[];
  /** A categorical slot (1 to 6), the accent, or the neutral comparison colour. */
  color?: number | 'accent' | 'neutral';
  /** `area` is the series the chart is about (at most one); `line` a peer; `dashed` a target or the previous period. */
  kind?: 'area' | 'line' | 'dashed';
};

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
  height = 248,
  label,
  legend,
  tick,
  stacked = false,
  whole = false,
  baseline,
  band,
  floor,
  marks,
  running = false,
  'data-preview-index': previewIndex,
  className,
}: {
  dates: string[];
  series: TrendSeries[];
  format?: NumberFormat;
  /** Pixels, or `fill` to take the height its card gives it (never under 220px). */
  height?: number | 'fill';
  /** What the chart shows, for screen readers: "Requests per day". */
  label: string;
  /** The legend above the plot. On by default when there are two or more series; a single series is named by its card. */
  legend?: boolean;
  /** How a point's instant reads, on the axis and in the readout, when the points are not days: "14:00", "Week of 3 Mar". */
  tick?: (date: string) => string;
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
   * The lowest level the axis shows, snapped down to a "nice" step: for a quantity that lives in a narrow band, such
   * as uptime, where an axis from zero makes the one thing the chart is about the smallest mark on it. A hint, not a
   * crop: the floor is held at or under the lowest value drawn, so the scale widens to the data and never hides it, and
   * every value is placed inside the plot. For `line` and `dashed` series only — an `area` and every stack are read by
   * their height, which a floor would change the meaning of. Defaults to 0, an axis from zero.
   */
  floor?: number;
  /**
   * Days the page names, marked on the first series with a dot, so a reader finds them rather than hunting for them
   * among 360 points: the days a band's membership left out. Dates it does not draw are skipped.
   */
  marks?: { dates: readonly string[]; tone: 'warning' | 'neutral'; label: string };
  /** The last point is a period still in progress: the line into it is dashed and its readout says "so far". */
  running?: boolean;
  /** A static readout in the Atlas; real charts take their day from the Meridian. */
  'data-preview-index'?: number;
  className?: string;
}) {
  const [box, size] = useSize<HTMLDivElement>();
  // The legend wraps on a narrow card; the plot starts under however many lines it took.
  const [legendBox, legendSize] = useSize<HTMLUListElement>();
  const width = size.width;
  const fill = height === 'fill';
  const [local, setLocal] = useState(false);
  const { index, setIndex } = useMeridian(dates);
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const h = fill ? Math.max(220, size.height) : height;

  const fmt = FORMATTERS[format];
  const axis = AXIS_FORMATTERS[format];
  // Stacked, each band sits on the sum of the ones below it; a missing value is no contribution that day.
  const bases = useMemo(() => {
    if (!stacked) return null;
    const acc = dates.map(() => 0);
    return series.map((s) => {
      const lower = [...acc];
      s.values.forEach((v, i) => (acc[i] += v ?? 0));
      return { lower, upper: [...acc] };
    });
  }, [stacked, series, dates]);
  const totals = bases ? bases[bases.length - 1]?.upper ?? [] : null;
  // Stacked parts are one whole, so they share one hue, each by its place in the stack. A series given its own colour keeps it.
  const colorOf = (s: TrendSeries, k: number) => (stacked && !s.color ? stackPart(k, series.length) : SERIES_VAR(s.color ?? (s.kind === 'dashed' ? 'neutral' : 'accent')));
  const values = totals ?? series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const max = Math.max(1, baseline?.value ?? 0, band?.value ?? 0, ...values);
  // A floor is a hint and never a crop: it is held at or under the lowest value drawn, or a day that fell further than
  // the floor would be drawn below the plot's own axis. So the scale widens to the data and never hides it.
  const from = floor === undefined ? 0 : Math.min(floor, ...values);
  // The levels, and the floor the plot is drawn to: `ticks[0]` is 0 unless the chart was given a floor, and the two ends
  // of the scale are what every point, area, band and level line is measured against.
  const ticks = ticksBetween(from, max, h < 200 ? 3 : 4, whole);
  const low = ticks[0];
  const top = ticks[ticks.length - 1];
  const left = Math.max(...ticks.map((t) => axis(t).length)) * 6.4 + 12;
  const showLegend = legend ?? series.length > 1;
  const pad = { t: showLegend ? Math.max(34, legendSize.height + 16) : 14, r: 4, b: 26, l: left };
  const W = Math.max(0, width - pad.l - pad.r), H = h - pad.t - pad.b;
  const n = dates.length;
  // The point still running, if there is one: everything solid stops at the point before it.
  const soFar = running ? n - 1 : -1;
  const x = (i: number) => pad.l + (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => pad.t + H - ((v - low) / (top - low)) * H;

  const bands = useMemo(
    () =>
      bases?.map(({ lower, upper }, k) => {
        const top = upper.map((v, i) => [x(i), y(v)] as [number, number]);
        const bottom = lower.map((v, i) => [x(i), y(v)] as [number, number]).reverse();
        // Running, the bands end at the last complete point. Only the total goes on, and only when some part was measured there.
        const cut = running && n > 1 ? 1 : 0;
        const line = monotonePath(top, 0, n - 1 - cut);
        const tail = cut && k === series.length - 1 && series.some((p) => typeof p.values[n - 1] === 'number') ? monotonePath(top, n - 2) : '';
        return { s: series[k], k, line, tail, area: `${line}${monotonePath(bottom, cut).replace(/^M/, 'L')}Z` };
      }) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bases, width, h, top, running],
  );

  const paths = useMemo(
    () =>
      series.map((s) => {
        // A missing day breaks the line: each run of measured days is its own segment, never bridged.
        const runs: [number, number][][] = [[]];
        s.values.forEach((v, i) => (v === null ? runs[runs.length - 1].length && runs.push([]) : runs[runs.length - 1].push([x(i), y(v)])));
        const segs = runs.filter((r) => r.length > 0);
        // Running, the last run is solid as far as the point before the running one, and its last stretch is the tail. There
        // is a tail only when both of its ends were measured; a reference is a whole period and never has one.
        const last = segs[segs.length - 1];
        const open = running && s.kind !== 'dashed' && typeof s.values[n - 1] === 'number' && last.length > 1;
        const end = (r: [number, number][]) => r.length - (open && r === last ? 2 : 1);
        const line = segs.map((r) => monotonePath(r, 0, end(r))).join('');
        const area = segs.map((r) => `${monotonePath(r, 0, end(r))}L${r[end(r)][0]},${pad.t + H}L${r[0][0]},${pad.t + H}Z`).join('');
        return { s, line, area, tail: open ? monotonePath(last, last.length - 2) : '' };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, width, h, top, running],
  );

  // What the plot draws, as the label placer needs it: every line, and the top of every band of a stack.
  const drawn = bases ? bases.map(({ upper }) => ({ ys: upper.map(y), filled: true })) : series.map((s) => ({ ys: s.values.map((v) => (v === null ? null : y(v))), filled: s.kind === 'area' }));
  // The reference levels, in the order their labels are placed: the band's top edge first, then what is usual. Both are
  // placed against everything the plot draws. They may stand in the 14px the chart keeps clear over its top gridline,
  // and never under the axis.
  const refs = [
    ...(band ? [{ value: band.value, label: band.label, edge: true }] : []),
    ...(baseline ? [{ value: baseline.value, label: baseline.label, edge: false }] : []),
  ].map((r) => ({ ...r, at: placeLabel(r.label, y(r.value), { left: pad.l, right: pad.l + W, top: pad.t - 14, bottom: pad.t + H }, dates.map((_, i) => x(i)), drawn) }));

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(W / 92))));
  const xLabels = dates.map((d, i) => ({ d, i })).filter(({ i }) => (n - 1 - i) % labelEvery === 0);

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
            <text key={d} x={x(i)} y={h - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-ink-3 text-2xs">
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
      {showLegend ? (
        <ul ref={legendBox} aria-hidden className="absolute top-0 right-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" style={{ left: pad.l }}>
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
        </ul>
      ) : null}
      {active !== null && width > 0 ? (
        <Readout at={cx} after={cx <= width / 2} top={pad.t - 4} visible={local || previewIndex !== undefined}>
          <p className="t-eyebrow mb-1.5 break-words">{tick ? tick(dates[active]) : formatDate(dates[active])}{active === soFar ? ' · so far' : null}</p>
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
      <table className="sr-only">
        <caption>{label}{band ? `. ${band.label}` : ''}{marks ? `. Marked: ${marks.label}` : ''}{baseline ? `. ${baseline.label}` : ''}{running ? `. ${SO_FAR}` : ''}</caption>
        <thead><tr><th>Date</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}{totals ? <th>Total</th> : null}</tr></thead>
        <tbody>{dates.map((d, i) => <tr key={d}><td>{d}{i === soFar ? ', so far' : null}</td>{series.map((s) => <td key={s.key}>{fmt(s.values[i])}</td>)}{totals ? <td>{fmt(totals[i])}</td> : null}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** The stretch into a point still running: the line's own colour, thinner and dashed, and it fades in as a reference does. */
function Running({ d, stroke }: { d: string; stroke: string }) {
  return <path data-running d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray="3 4" strokeLinecap="round" className="fade-in" />;
}
