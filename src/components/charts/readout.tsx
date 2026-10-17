'use client';

import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { useSize } from './use-size';

/**
 * A chart's readout panel, beside the point it reads: after it or before it, and never outside the chart. It measures
 * itself, because a fixed side-switch cannot keep long labels inside a narrow chart. Under 640px it pins to the leading
 * edge, so it stays still while a finger moves between points.
 */
export function Readout({ at, after, top = 0, visible = true, children }: {
  /** Where the point is, in pixels from the chart's leading edge. */
  at: number;
  /** Stand after the point, or before it. */
  after: boolean;
  top?: number;
  /** A chart that only follows another chart's cursor keeps its readout hidden. */
  visible?: boolean;
  children: ReactNode;
}) {
  const [box, size] = useSize<HTMLDivElement>();
  const preferred = after
    ? 'calc(var(--readout-cursor) + var(--space-3))'
    : 'calc(var(--readout-cursor) - var(--readout-width) - var(--space-3))';
  return (
    <div
      ref={box}
      data-readout
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-10 w-max max-w-full min-w-0 rounded-md bg-surface-raised px-3 py-2 shadow-overlay max-sm:!left-0',
        visible ? 'opacity-100' : 'opacity-0',
        'transition-opacity duration-(--dur-hover)',
      )}
      style={{
        top,
        minWidth: 'min(100%, calc(var(--space-1) * 36))',
        '--readout-cursor': `${at}px`,
        // ResizeObserver gives the content box; the readout also has space-3 on each side.
        '--readout-width': `calc(${size.width}px + var(--space-3) * 2)`,
        left: size.width ? `clamp(0px, ${preferred}, calc(100% - var(--readout-width)))` : 0,
      } as CSSProperties}
    >
      {children}
    </div>
  );
}
