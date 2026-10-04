'use client';

import { ToggleGroup } from 'radix-ui';
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

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
  useLayoutEffect(() => {
    const measure = () => {
      const el = track.current?.querySelector<HTMLElement>('[data-state="on"]');
      if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    // Re-measure when the options change size: a font arriving, a density switch, a label changing.
    const ro = new ResizeObserver(measure);
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
      className={cn('relative inline-flex shrink-0 items-center rounded-md bg-surface-sunk p-0.5 ring-1 ring-line ring-inset', className)}
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
            'hit relative z-10 inline-flex items-center justify-center gap-1.5 rounded-sm px-2.5 font-medium whitespace-nowrap text-ink-2 transition-colors duration-(--dur-hover)',
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
