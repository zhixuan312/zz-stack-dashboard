'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AXIS_FORMATTERS, FORMATTERS, formatCount, type NumberFormat } from '@/lib/format';
import { TINT_VAR, cycleTint, type Tint } from '@/lib/tints';

/**
 * One point on the time axis. `date` is the bucket key (any string — it is used
 * verbatim as the React key and, sliced past the first five characters, as the
 * axis label, so `YYYY-MM-DD` reads as `MM-DD`). Every other key is a series
 * value looked up by `TrendSeries.key`.
 */
interface TrendPoint {
  date: string;
  /**
   * What the axis shows for this point, when `date.slice(5)` is not it.
   *
   * The slice is right for `YYYY-MM-DD` and wrong for everything else, which was fine
   * while every series here was daily. An HOUR bucket arrives as a UTC instant and has
   * to be rendered in the reader's own zone, and only the caller knows that — so the
   * caller passes the finished string rather than this component growing a date library.
   */
  label?: string;
  [seriesKey: string]: string | number | undefined;
}

interface TrendSeries {
  /** The key to read off each `TrendPoint`. */
  key: string;
  /** Legend and tooltip label. */
  label: string;
  /**
   * How the series draws:
   *   `area` — solid line with a gradient fill under it. The headline series.
   *   `line` — dashed line, no fill. A comparison against the area series.
   *   `bar`  — faint bars on their OWN scale, in a band across the bottom 30%.
   *            Use it for a volume/count series whose units differ from the
   *            value axis; it deliberately does not share the axis, because a
   *            count and a rate on one scale flattens whichever is smaller.
   */
  shape: 'area' | 'line' | 'bar';
  /** Palette token. Defaults to the categorical cycle by series index. */
  tint?: Tint;
  /**
   * Names the formatter for the tooltip, the sr-only table, and — for the first
   * non-bar series — the y-axis ticks. Defaults to `count`.
   *
   * A NAME, not a function: this component is `'use client'`, and a server
   * component cannot hand a function across the RSC boundary. See
   * `NumberFormat` in `@/lib/format`.
   */
  format?: NumberFormat;
}

/** Rounded axis maximum + step so gridlines land on clean numbers. */
export function niceScale(rawMax: number, targetTicks = 4): { max: number; step: number } {
  if (rawMax <= 0) return { max: 1, step: 1 };
  const rawStep = rawMax / targetTicks;
  const exp = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, exp);
  const norm = rawStep / base;
  const step = norm < 1.5 ? base : norm < 3 ? 2 * base : norm < 7 ? 5 * base : 10 * base;
  return { max: Math.ceil(rawMax / step) * step, step };
}

function num(p: TrendPoint, key: string): number {
  const v = p[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function TooltipRow({ tint, label, value }: { tint: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-ink-soft">
      <span style={{ color: tint }}>{label}</span>
      <b className="tabular-nums text-ink">{value}</b>
    </div>
  );
}

/**
 * Time-series chart — any mix of area, dashed-line and volume-bar series.
 *
 * Hand-drawn SVG with no chart library, so it inherits the app's palette
 * through CSS variables rather than carrying a second theme. That is the point:
 * a charting library ships its own colour scale and its own type ramp, and the
 * dashboard then has two design systems that drift apart.
 *
 * The `<svg>` is `aria-hidden` and the same numbers are emitted below as an
 * `sr-only` table — the tooltip is mouse-only, so the table is the only way the
 * data is reachable otherwise. Mandatory, not optional: if you fork this chart,
 * the table forks with it.
 */
export function TrendChart({
  points,
  series,
  height = 220,
  emptyLabel = 'The trend appears here once there are at least two buckets of data in this period.',
}: {
  points: TrendPoint[];
  series: TrendSeries[];
  height?: number;
  emptyLabel?: string;
}) {
  const gradId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(240, e.contentRect.width));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  // Resolve palette + formatter once, so the SVG, the tooltip, the legend and
  // the sr-only table cannot disagree about what colour or unit a series is.
  const resolved = series.map((s, i) => ({
    ...s,
    color: TINT_VAR[s.tint ?? cycleTint(i)],
    fmt: FORMATTERS[s.format ?? 'count'],
    axisFmt: AXIS_FORMATTERS[s.format ?? 'count'],
  }));
  const valueSeries = resolved.filter((s) => s.shape !== 'bar');
  const barSeries = resolved.filter((s) => s.shape === 'bar');

  if (points.length < 2 || resolved.length === 0) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center rounded-[var(--r-md)] border border-dashed border-line px-4 text-center text-sm text-ink-faint"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const padL = 52;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, height - padT - padB);

  const rawMax = Math.max(0, ...valueSeries.flatMap((s) => points.map((p) => num(p, s.key))));
  const { max: maxValue, step } = niceScale(rawMax);
  // Bars get their own maximum — see `shape: 'bar'` above.
  const maxBar = Math.max(1, ...barSeries.flatMap((s) => points.map((p) => num(p, s.key))));

  const x = (i: number) => padL + (i / (points.length - 1)) * innerW;
  const y = (v: number) => padT + innerH - (v / maxValue) * innerH;

  const path = (key: string) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(num(p, key)).toFixed(1)}`).join(' ');

  const bandH = innerH * 0.3;
  const barW = Math.max(1, (innerW / points.length / Math.max(1, barSeries.length)) * 0.55);

  const ticks: number[] = [];
  for (let v = 0; v <= maxValue + 1e-9; v += step) ticks.push(v);

  // The y-axis carries the first non-bar series' unit; a second unit on the
  // same axis would be a lie, which is why bars are banded instead.
  const axisFmt = valueSeries[0]?.axisFmt ?? formatCount;
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(x(i) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  }

  const hp = hover === null ? null : points[hover]!;
  const areaKey = resolved.find((s) => s.shape === 'area')?.key;

  return (
    <div className="relative" ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={resolved.find((s) => s.shape === 'area')?.color ?? 'var(--accent)'}
              stopOpacity="0.22"
            />
            <stop
              offset="100%"
              stopColor={resolved.find((s) => s.shape === 'area')?.color ?? 'var(--accent)'}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {ticks.map((v, i) => (
          <g key={v}>
            <line
              x1={padL}
              x2={w - padR}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--line)"
              strokeDasharray={i === 0 ? undefined : '2,3'}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={padL - 8}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-ink-faint"
              style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums' }}
            >
              {axisFmt(v)}
            </text>
          </g>
        ))}

        {barSeries.map((s, si) =>
          points.map((p, i) => {
            const h = (num(p, s.key) / maxBar) * bandH;
            // Offset each bar series inside the slot so two of them sit side by
            // side rather than one hiding the other.
            const offset = (si - (barSeries.length - 1) / 2) * barW;
            return (
              <rect
                key={`${s.key}-${p.date}`}
                data-role="volume-bar"
                x={x(i) - barW / 2 + offset}
                y={padT + innerH - h}
                width={barW}
                height={h}
                fill={s.color}
                opacity={hover === i ? 0.38 : 0.2}
              />
            );
          }),
        )}

        {areaKey ? (
          <path
            d={`${path(areaKey)} L ${x(points.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`}
            fill={`url(#${gradId})`}
          />
        ) : null}

        {valueSeries.map((s) => (
          <path
            key={s.key}
            d={path(s.key)}
            data-role={`${s.shape}-line`}
            data-series={s.key}
            fill="none"
            stroke={s.color}
            strokeWidth={s.shape === 'area' ? 2 : 1.5}
            strokeDasharray={s.shape === 'area' ? undefined : '4,3'}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`t-${p.date}`}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-ink-faint"
              style={{ fontSize: 10 }}
            >
              {p.label ?? p.date.slice(5)}
            </text>
          ) : null,
        )}

        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={padT}
            y2={padT + innerH}
            stroke="var(--line-strong)"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      {hp ? (
        <div
          className="pointer-events-none absolute top-2 rounded-[var(--r)] border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]"
          style={{ left: Math.min(w - 170, Math.max(0, x(hover!) + 10)), minWidth: 150 }}
        >
          <div className="mb-1 font-mono text-[0.625rem] uppercase tracking-[0.06em] text-ink-faint">
            {hp.date}
          </div>
          {resolved.map((s) => (
            <TooltipRow key={s.key} tint={s.color} label={s.label} value={s.fmt(num(hp, s.key))} />
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-ink-soft">
        {resolved.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            {s.shape === 'bar' ? (
              <i
                className="inline-block h-2.5 w-2 rounded-[var(--r-sm)]"
                style={{ background: s.color, opacity: 0.3 }}
              />
            ) : (
              <i className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
            )}
            {s.label}
          </span>
        ))}
      </div>

      {/* The accessible twin of the chart, wrapped in an `sr-only` DIV rather
          than carrying the class itself. `sr-only` works by pinning height to
          1px, and a <table> treats height as a MINIMUM — so the class left a
          2001px table in the layout, silently inflating the card's content to
          2314px inside a 332px box. A div honours the height and clips. */}
      <div className="sr-only">
        <table>
          <caption>{resolved.map((s) => s.label).join(', ')} over time</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              {resolved.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <th scope="row">{p.date}</th>
                {resolved.map((s) => (
                  <td key={s.key}>{s.fmt(num(p, s.key))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
