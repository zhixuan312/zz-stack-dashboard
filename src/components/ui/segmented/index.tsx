'use client';

import { ToggleGroup } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../lib/cn';

/** The track\'s own padding, in px (`p-0.5`): the thumb is inset by it at each end. */
const PAD = 2;

export type SegmentedOption<V extends string> = { value: V; label: React.ReactNode; title?: string };

/**
 * Two to five short options in one track that switch what a view shows. A lifted thumb slides to the current
 * option; the change is instant, so it never asks for confirmation.
 */
export function Segmented<V extends string>({
  value,
  onChange,
  options,
  size = 'md',
  label,
  className,
}: {
  value: V;
  onChange: (v: V) => void;
  options: SegmentedOption<V>[];
  size?: 'sm' | 'md';
  /** The accessible name of the group. */
  label: string;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  // Where each option sits, as the browser reported it when the observer delivered. The observer is the measurement and
  // it lives as long as the option set, never one per change: a fresh observer re-observes every button, and delivering
  // the first observation of an element the page has just laid out means laying the whole page out again inside the
  // tap's own task — measured at 26 ms of a 55 ms frame on the period tap, and it was the frame that dropped. A change
  // of what the options are, or their order, is what starts a fresh observation, since that is when a position moves.
  const [spots, setSpots] = useState<{ left: number; width: number }[]>([]);
  const order = options.map((o) => o.value).join('\u0000');
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const buttons = [...el.querySelectorAll<HTMLElement>('button')];
    // The geometry is read here, in the callback, and never in the state updater: the updater runs during a render,
    // where a read would force the whole page's layout in the tap's task (the read this component was fixed for once).
    const ro = new ResizeObserver((entries) => {
      const found = new Map<number, { left: number; width: number }>();
      for (const e of entries) {
        const i = buttons.indexOf(e.target as HTMLElement);
        if (i < 0) continue;
        const b = e.target as HTMLElement;
        found.set(i, { left: b.offsetLeft, width: b.offsetWidth });
      }
      if (!found.size) return;
      setSpots((was) => {
        const next = buttons.map((_, i) => found.get(i) ?? was[i] ?? null);
        if (next.length === was.length && next.every((s, i) => s && was[i] && s.left === was[i].left && s.width === was[i].width)) return was;
        return next as { left: number; width: number }[];
      });
    });
    for (const b of buttons) ro.observe(b);
    return () => ro.disconnect();
  }, [order]);
  // The thumb is drawn from those spots and the option that is on, at render: changing the option asks no element for
  // its geometry, and the spots are measured again only when the options move or a button changes size.
  const at = options.findIndex((o) => o.value === value);
  const spot = at >= 0 ? spots[at] : undefined;
  return (
    <ToggleGroup.Root
      ref={track}
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as V)}
      aria-label={label}
      className={cn(
        // The thumb's own inset is this padding: `PAD` below says the same 2px, so a change to one must change both.
        'scroll-fade-x relative inline-flex w-fit min-w-0 max-w-full items-center overflow-x-auto rounded-md bg-surface-sunk p-0.5 ring-1 ring-line ring-inset [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {spot ? (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-sm bg-surface shadow-control ring-1 ring-line transition-[transform,width] duration-(--dur-enter) ease-out"
          style={{ transform: `translateX(${spot.left - PAD}px)`, width: spot.width, left: PAD }}
        />
      ) : null}
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.title}
          className={cn(
            'hit relative z-10 inline-flex items-center justify-center gap-1.5 rounded-sm px-2.5 font-medium whitespace-nowrap pointer-coarse:min-w-[44px] text-ink-2 transition-colors duration-(--dur-hover)',
            'hover:text-ink data-[state=on]:text-ink focus-visible:outline-offset-0',
            size === 'sm' ? 'h-[calc(var(--control-sm)-4px)] text-xs' : 'h-[calc(var(--control-md)-4px)] text-sm',
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
