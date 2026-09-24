'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/cn';

/**
 * Popover — a panel a person opens, as against a tooltip that happens to them.
 *
 * The length of the text decides which. A tooltip is a label: a few words, on hover, gone
 * when the pointer leaves. Anything a person has to read belongs here, because a tooltip
 * cannot be selected, scrolled or kept open beside the thing it explains — and the browser's
 * native `title` truncates silently.
 *
 * Click to open, stays open, Escape or a click outside closes it. Radix supplies the portal
 * (no clipping inside a card), collision-aware placement, focus handling and the dismiss
 * behaviour, as it does for `tooltip.tsx`.
 *
 *   <Popover>
 *     <PopoverTrigger asChild><button …/></PopoverTrigger>
 *     <PopoverContent>…</PopoverContent>
 *   </Popover>
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  sideOffset = 8,
  align = 'end',
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        // `min(34rem, …)` is about 70 characters at this size, the same measure `layout.ts`
        // sets for `reading` one scale up. The viewport clamp keeps it off the edges of a
        // phone, where 34rem is wider than the screen.
        className={cn(
          'ds-pop z-50 w-[min(34rem,calc(100vw-2rem))] rounded-[var(--r-lg)] border border-line',
          'bg-surface p-4 text-[13px] leading-[1.6] text-ink-soft shadow-[var(--shadow-pop)]',
          // DELIBERATE: no height cap and no scroll of its own, though this is a portalled
          // layer. One-scroller is about how many things a reader can be scrolling, not
          // which element owns the overflow. Content too long to stand gets shortened or
          // gets a page, never a second scrollbar.
          className,
        )}
        {...props}
      >
        {children}
        <PopoverPrimitive.Arrow className="fill-[var(--surface)]" />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}
