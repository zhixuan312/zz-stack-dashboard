'use client';

import { useCallback, useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '../../../lib/cn';
import { FORMATTERS } from '../../../lib/format';
import { Readout } from '../readout';
import { linearPath, niceTicks, SERIES_VAR, stepPath, type SeriesSlot } from '../scale';
import { useSize } from '../use-size';

export type XYPoint = { x: number; y: number | null };
export type XYSeries = { key: string; label: string; points: XYPoint[] };

const PATHS = { linear: linearPath, step: stepPath } as const;
/** Room over and under the plot for the readout and a rising line; the axis labels take their own. */
const PAD = { t: 10, r: 10, b: 24, l: 8 };

/**
 * A line over a numeric x-axis: a measure read against a number with a unit, not against time. A latency distribution —
 * the share of requests served within x ms — is a step line over milliseconds; a quantity available within x basis points
 * of a reference price is a straight line. TrendChart places points by index, for dates, and ColumnChart is categorical;
 * neither lets the x positions be the values themselves.
 *
 * One y-scale serves every series, and both axes are labelled in their units. Pointing at the plot or stepping with the
 * arrow keys reads the nearest point and names its x and every series' y; the same values are in a table beneath, so a
 * reader who cannot see the line still has them. There is no Meridian join: x is not time.
 */
export function XYLineChart({
  series,
  label,
  xLabel,
  yLabel,
  xFormat = FORMATTERS.count,
  format = FORMATTERS.count,
  curve = 'linear',
  references = [],
  domain,
  height = 240,
  className,
}: {
  series: XYSeries[];
  label: string;
  /** What x is, in words: "Latency, ms". */
  xLabel: string;
  /** What y is, in words: "Share of requests". */
  yLabel: string;
  xFormat?: (n: number) => string;
  /** How a y value reads, in the readout and the table. */
  format?: (n: number) => string;
  curve?: 'step' | 'linear';
  /** Vertical levels a series is read against, at an x: a target, a reference price. */
  references?: { x: number; label: string }[];
  /** A stated y-range, as the Trend chart's `domain`: charts read side by side share their levels. A value outside it widens the scale. */
  domain?: [number, number];
  height?: number;
  className?: string;
}) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [box, { width }] = useSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const path = PATHS[curve];
  // The x range is the points' own, never padded: an x-axis of values says where the values are.
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const xLow = Math.min(...xs), xHigh = Math.max(...xs);
  const xSpan = xHigh - xLow || 1;
  const ys = series.flatMap((s) => s.points.map((p) => p.y)).filter((v): v is number => v !== null);
  const held = domain && domain[1] > domain[0] ? domain : null;
  // A line over a numeric x is read by its y position, not by the height of a bar: its scale need not start at zero, and
  // forcing zero in made a stated range of 0.5–0.9 report itself widened to 0–1 for no reason. Without a domain the
  // scale is the values' own, rounded to levels; zero is included only when the data itself crosses it.
  const widened = Boolean(held && (Math.min(...ys) < held![0] || Math.max(...ys) > held![1]));
  const levels = held && !widened ? [held[0], held[1]] : held ? niceTicks(Math.max(held[1], Math.max(...ys)), 4) : niceTicks(Math.max(...ys, 1), 4);
  const yLow = held && !widened ? held[0] : Math.min(...ys, levels[0]);
  const yTop = levels[levels.length - 1];
  const ySpan = yTop - yLow || 1;
  const left = Math.max(...levels.map((t) => format(t).length)) * 6.5 + 12;
  const W = Math.max(0, width - left - PAD.r), H = Math.max(0, height - PAD.t - PAD.b);
  const x = (v: number) => left + ((v - xLow) / xSpan) * W;
  const y = (v: number) => PAD.t + H - ((v - yLow) / ySpan) * H;
  const tickX = [xLow, ...(xHigh > xLow ? [xLow + xSpan / 2] : []), xHigh];
  // One x position is the cursor: the nearest point of the first series, whose x names the reading. Every series is
  // read there, and a series without a point at that x says so rather than interpolating a value nobody measured.
  const anchors = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b), [series]);
  const valueAt = useCallback((i: number) => series.map((s) => ({ s, p: s.points.find((p) => p.x === anchors[i]) })), [series, anchors]);
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    if (!W) return;
    const r = e.currentTarget.getBoundingClientRect();
    const v = xLow + ((e.clientX - r.left - left) / Math.max(1, W)) * xSpan;
    let best = 0;
    for (let i = 1; i < anchors.length; i++) if (Math.abs(anchors[i] - v) < Math.abs(anchors[best] - v)) best = i;
    setActive(best);
  };
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    if (!anchors.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(k)) return;
    e.preventDefault();
    if (k === 'Escape') return setActive(null);
    const cur = active ?? Math.floor((anchors.length - 1) / 2);
    setActive(k === 'Home' ? 0 : k === 'End' ? anchors.length - 1 : Math.min(anchors.length - 1, Math.max(0, cur + (k === 'ArrowLeft' ? -1 : 1))));
  };
  const at = active !== null && active < anchors.length ? active : null;
  const reading = useCallback((i: number) => {
    const here = valueAt(i);
    const parts = here.map(({ s, p }) => `${s.label} ${p && p.y !== null ? format(p.y) : 'No value'}`);
    return `${xLabel} ${xFormat(anchors[i])}: ${parts.join(', ')}`;
  }, [valueAt, anchors, format, xFormat, xLabel]);
  const lines = useMemo(
    () => series.map((s) => {
      const drawn = s.points.map((p) => (p.y === null ? null : [x(p.x), y(p.y)] as [number, number]));
      let d = '';
      for (let i = 0; i < drawn.length; i++) {
        if (drawn[i] === null) continue;
        const run: [number, number][] = [];
        while (i < drawn.length && drawn[i] !== null) run.push(drawn[i++]!);
        d += path(run);
        i -= 1;
      }
      return { s, d };
    }),
    // The geometry is scalar: a page whose points changed but kept the array would otherwise keep its path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, curve, width, height, xLow, xHigh, yLow, yTop, left],
  );

  return (
    <figure ref={box} aria-label={label} className={cn('relative min-w-0 select-none', className)} onPointerLeave={() => setActive(null)}>
      {widened ? <p data-widened className="mb-1 text-2xs text-ink-3">{`Scale widened from ${format(held![0])}–${format(held![1])} to ${format(yLow)}–${format(yTop)}`}</p> : null}
      <div
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use the arrow keys to read one point.`}
        onKeyDown={keys}
        onBlur={() => setActive(null)}
        onPointerMove={pick}
        onPointerDown={pick}
        className="relative rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        style={{ height }}
      >
        {width > 0 ? (
          <svg width={width} height={height} className="block overflow-visible">
            <defs>
              <clipPath id={`${gid}-plot`}>
                <rect x={left} y={PAD.t} width={W} height={H} />
              </clipPath>
            </defs>
            {levels.map((t) => (
              <g key={t} aria-hidden>
                <line x1={left} x2={left + W} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} strokeWidth={1} />
                <text x={left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" className="t-num fill-ink-3 text-2xs">{format(t)}</text>
              </g>
            ))}
            {tickX.map((t, i) => (
              <text key={t} data-x-tick x={x(t)} y={height - 6} textAnchor={i === 0 ? 'start' : i === tickX.length - 1 ? 'end' : 'middle'} className="t-num fill-ink-3 text-2xs">{xFormat(t)}</text>
            ))}
            {references.map((r) => (
              <g key={r.label} aria-hidden>
                <line data-reference x1={x(r.x)} x2={x(r.x)} y1={PAD.t} y2={PAD.t + H} stroke="var(--chart-axis)" strokeDasharray="2 3" />
                <text x={x(r.x)} y={PAD.t + 8} textAnchor={r.x > (xLow + xHigh) / 2 ? 'end' : 'start'} className="fill-ink-3 text-2xs">{r.label}</text>
              </g>
            ))}
            <g clipPath={`url(#${gid}-plot)`}>
              {lines.map(({ s, d }, k) => (
                <path key={s.key} data-series={s.key} d={d} fill="none" stroke={SERIES_VAR(k === 0 ? 'accent' : (Math.min(6, k) as SeriesSlot))} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
              ))}
            </g>
            {at !== null ? (
              <g aria-hidden pointerEvents="none">
                <line x1={x(anchors[at])} x2={x(anchors[at])} y1={PAD.t} y2={PAD.t + H} stroke="var(--ink-3)" strokeOpacity={0.5} />
                {valueAt(at).map(({ s, p }) => (p && p.y !== null ? <circle key={s.key} cx={x(p.x)} cy={y(p.y)} r={3.5} fill="none" stroke="var(--ink)" strokeWidth={2} /> : null))}
              </g>
            ) : null}
          </svg>
        ) : null}
      </div>
      <p className="mt-1 flex items-center justify-between text-2xs text-ink-3">
        <span>{xLabel}</span>
        <span>{yLabel}</span>
      </p>
      {series.length > 1 ? (
        <ul aria-hidden className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          {series.map((s, k) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <svg width="14" height="4" className="shrink-0 overflow-visible"><line x1="1" x2="13" y1="2" y2="2" stroke={SERIES_VAR(k === 0 ? 'accent' : (Math.min(6, k) as SeriesSlot))} strokeWidth={2} strokeLinecap="round" strokeDasharray={curve === 'step' ? undefined : undefined} /></svg>
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      {at !== null ? (
        <Readout at={x(anchors[at])} after={x(anchors[at]) <= width / 2} top={PAD.t} visible>
          <p className="t-eyebrow mb-1 break-words">{xLabel} {xFormat(anchors[at])}</p>
          {valueAt(at).map(({ s, p }) => (
            <p key={s.key} className="flex flex-wrap items-start gap-x-2 text-xs leading-6">
              <span className="mt-0.5 min-w-0 flex-1 break-words text-ink-2">{s.label}</span>
              <span className="t-num ml-auto min-w-0 break-words font-medium text-ink">{p && p.y !== null ? format(p.y) : 'No value'}</span>
            </p>
          ))}
        </Readout>
      ) : null}
      <p className="sr-only" aria-live="polite">{at === null ? '' : reading(at)}</p>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th scope="col">{xLabel}</th>{series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>
          {anchors.map((a, i) => (
            <tr key={a}><th scope="row">{xFormat(a)}</th>{valueAt(i).map(({ s, p }) => <td key={s.key}>{p && p.y !== null ? format(p.y) : 'No value'}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
