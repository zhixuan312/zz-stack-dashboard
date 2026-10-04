'use client';

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/lib/cn';
import { AXIS_FORMATTERS, FORMATTERS, type NumberFormat } from '@/lib/format';
import { formatDate } from '@/lib/format-date';
import { useMeridian } from '@/components/charts/meridian';
import { monotonePath, niceTicks, SERIES_VAR } from '@/components/charts/scale';
import { useSize } from '@/components/charts/use-size';

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
 * A time series: one shared axis, at most one area, any number of lines. Never two y-scales: two measures of a
 * different size are two charts on one Meridian. Point, or move with the arrow keys, to read a day; every chart on
 * the page follows.
 *
 * `stacked` is the other form: the series are the parts of one whole (calls split into attributed, unattributed and
 * refused), drawn as bands one on another, so the top edge is the total. The readout names each part and the total.
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
  // Stacked parts are one whole, so they share one hue: the accent, deepest at the bottom and paler toward the surface
  // with each part above. How deep and how pale is the theme's (chart-stack-hi, -lo): dark needs a wider span for the
  // bands to read apart. A series given its own colour keeps it.
  const tone = (k: number) => {
    const t = (k / Math.max(1, series.length - 1)).toFixed(3);
    return `color-mix(in oklab, var(--accent) calc((var(--chart-stack-hi) - (var(--chart-stack-hi) - var(--chart-stack-lo)) * ${t}) * 100%), var(--surface))`;
  };
  const colorOf = (s: TrendSeries, k: number) => (stacked && !s.color ? tone(k) : SERIES_VAR(s.color ?? (s.kind === 'dashed' ? 'neutral' : 'accent')));
  const max = Math.max(1, ...(totals ?? series.flatMap((s) => s.values.filter((v): v is number => v !== null))));
  const ticks = niceTicks(max, h < 200 ? 3 : 4);
  const top = ticks[ticks.length - 1];
  const left = Math.max(...ticks.map((t) => axis(t).length)) * 6.4 + 12;
  const showLegend = legend ?? series.length > 1;
  const pad = { t: showLegend ? Math.max(34, legendSize.height + 16) : 14, r: 4, b: 26, l: left };
  const W = Math.max(0, width - pad.l - pad.r), H = h - pad.t - pad.b;
  const n = dates.length;
  const x = (i: number) => pad.l + (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => pad.t + H - (v / top) * H;

  const bands = useMemo(
    () =>
      bases?.map(({ lower, upper }, k) => {
        const top = upper.map((v, i) => [x(i), y(v)] as [number, number]);
        const bottom = lower.map((v, i) => [x(i), y(v)] as [number, number]).reverse();
        return { s: series[k], k, line: monotonePath(top), area: `${monotonePath(top)}${monotonePath(bottom).replace(/^M/, 'L')}Z` };
      }) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bases, width, h, top],
  );

  const paths = useMemo(
    () =>
      series.map((s) => {
        // A missing day breaks the line: each run of measured days is its own segment, never bridged.
        const runs: [number, number][][] = [[]];
        s.values.forEach((v, i) => (v === null ? runs[runs.length - 1].length && runs.push([]) : runs[runs.length - 1].push([x(i), y(v)])));
        const segs = runs.filter((r) => r.length > 0);
        const line = segs.map((r) => monotonePath(r)).join('');
        const area = segs.map((r) => `${monotonePath(r)}L${r[r.length - 1][0]},${pad.t + H}L${r[0][0]},${pad.t + H}Z`).join('');
        return { s, line, area };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, width, h, top],
  );

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

  const active = index !== null && index < n ? index : null;
  // On the pixel grid, so the 1px cursor line stays crisp while it glides.
  const cx = active !== null ? Math.round(x(active)) + 0.5 : 0;
  const tipLeft = active !== null && cx > pad.l + W * 0.62;

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
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + W} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} shapeRendering="crispEdges" />
              <text x={pad.l - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-2xs tabular-nums">{axis(t)}</text>
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
            </g>
          ) : null}
          {(stacked ? [] : paths).map(({ s, area, line }) => (
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
            </g>
          ))}
          {active !== null ? (
            // The cursor glides from day to day (transform, so it eases) rather than jumping.
            <g pointerEvents="none" className="transition-transform duration-(--dur-hover) ease-out" style={{ transform: `translateX(${cx}px)` }}>
              <line x1={0} x2={0} y1={pad.t - 6} y2={pad.t + H} stroke="var(--ink-3)" strokeOpacity={0.55} />
              {series.map((s, k) => {
                const v = bases ? bases[k].upper[active] : s.values[active];
                return v === null ? null : (
                  <circle key={s.key} cx={0} cy={0} r={4} className="transition-transform duration-(--dur-hover) ease-out" style={{ transform: `translateY(${y(v)}px)` }} fill={colorOf(s, k)} stroke="var(--surface)" strokeWidth={2} />
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
                <line x1="1" x2="13" y1="2" y2="2" stroke={colorOf(s, k)} strokeWidth={stacked ? 4 : 2} strokeLinecap="round" strokeDasharray={s.kind === 'dashed' ? '2 3' : undefined} />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      {active !== null && width > 0 ? (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute z-10 min-w-36 rounded-md bg-surface-raised px-3 py-2 shadow-overlay',
            local ? 'opacity-100' : 'opacity-0',
            'transition-opacity duration-(--dur-hover)',
          )}
          style={{ top: pad.t - 4, left: tipLeft ? undefined : cx + 12, right: tipLeft ? width - cx + 12 : undefined }}
        >
          <p className="t-eyebrow mb-1.5">{tick ? tick(dates[active]) : formatDate(dates[active])}</p>
          {/* Stacked, the readout lists the bands top to bottom, as they sit on the chart, then the total. */}
          {(stacked ? series.map((s, k) => ({ s, k })).reverse() : series.map((s, k) => ({ s, k }))).map(({ s, k }) => (
            <p key={s.key} className="flex items-center gap-2 text-xs leading-6">
              <span className={cn('w-2.5 rounded-full', stacked ? 'h-1' : 'h-0.5')} style={{ background: colorOf(s, k) }} />
              <span className="text-ink-2">{s.label}</span>
              <span className="t-num ml-auto pl-4 font-medium text-ink">{fmt(s.values[active])}</span>
            </p>
          ))}
          {totals ? (
            <p className="mt-1 flex items-center gap-2 border-t border-line pt-1 text-xs leading-6">
              <span className="text-ink-2">Total</span>
              <span className="t-num ml-auto pl-4 font-semibold text-ink">{fmt(totals[active])}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Date</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}{totals ? <th>Total</th> : null}</tr></thead>
        <tbody>{dates.map((d, i) => <tr key={d}><td>{d}</td>{series.map((s) => <td key={s.key}>{fmt(s.values[i])}</td>)}{totals ? <td>{fmt(totals[i])}</td> : null}</tr>)}</tbody>
      </table>
    </div>
  );
}
