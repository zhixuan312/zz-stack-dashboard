'use client';

import { ToggleGroup } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../lib/cn';

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
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  // The thumb is read only in a ResizeObserver callback, which the browser runs after layout. A read in the commit, in an
  // effect or in a frame callback runs before that layout is clean, so it forced a whole-page layout inside the tap's
  // task. A fresh observer on every change delivers a first observation of each option after the next layout; that one
  // carries the measurement, and later resizes (a font arriving, a density switch, a label changing) re-measure.
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const el = track.current?.querySelector<HTMLElement>('[data-state="on"]');
      if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
    });
    track.current?.querySelectorAll('button').forEach((b) => ro.observe(b));
    return () => ro.disconnect();
  }, [value, options.length]);
  return (
    <ToggleGroup.Root
      ref={track}
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as V)}
      aria-label={label}
      className={cn(
        'scroll-fade-x relative inline-flex w-fit min-w-0 max-w-full items-center overflow-x-auto rounded-md bg-surface-sunk p-0.5 ring-1 ring-line ring-inset [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {thumb ? (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-sm bg-surface shadow-control ring-1 ring-line transition-[transform,width] duration-(--dur-enter) ease-out"
          style={{ transform: `translateX(${thumb.x - 2}px)`, width: thumb.w, left: 2 }}
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
