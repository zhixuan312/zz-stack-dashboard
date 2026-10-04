'use client';

import { useId } from 'react';
import { useMeridianIndex } from '@/components/charts/meridian';
import { monotonePath, SERIES_VAR } from '@/components/charts/scale';
import { useSize } from '@/components/charts/use-size';

/**
 * A trend without axes, beside the figure it qualifies. It shows shape, never values, so it carries no labels; when
 * the page's Meridian points at a day, a hairline marks that day.
 */
export function Sparkline({ values, color = 'accent', height = 36, className }: { values: number[]; color?: number | 'accent' | 'neutral'; height?: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [ref, { width: W }] = useSize<HTMLDivElement>();
  const { index } = useMeridianIndex();
  // The lowest point floats a quarter of the height above the floor, so a trough never runs along a card's edge or
  // into its rounded corner; the area still fills to the floor.
  const H = height, pad = 3, floor = Math.max(pad, Math.round(H * 0.25));
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * W, pad + (1 - (v - min) / span) * (H - pad - floor)] as [number, number]);
  const line = W ? monotonePath(pts) : '';
  const c = SERIES_VAR(color);
  const at = index !== null && index < pts.length ? pts[index] : null;
  return (
    <div ref={ref} aria-hidden className={className} style={{ height }}>
      {W ? (
        <svg width={W} height={H} className="block overflow-visible">
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={c} style={{ stopOpacity: 'calc(var(--chart-area-a) * 0.7)' }} />
              <stop offset="1" stopColor={c} stopOpacity="0" />
            </linearGradient>
          </defs>
          <g key={values.length}>
          <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${id})`} className="reveal-x" />
          <path d={line} fill="none" stroke={c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="draw" />
          </g>
          {at ? (
            <g className="transition-transform duration-(--dur-hover) ease-out" style={{ transform: `translateX(${Math.round(at[0]) + 0.5}px)` }}>
              <line x1={0} x2={0} y1={0} y2={H} stroke="var(--ink-3)" strokeOpacity={0.45} />
              <circle cx={0} cy={0} r={3} className="transition-transform duration-(--dur-hover) ease-out" style={{ transform: `translateY(${at[1]}px)` }} fill={c} stroke="var(--surface)" strokeWidth={1.5} />
            </g>
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}
