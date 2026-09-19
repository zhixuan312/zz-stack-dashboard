'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/cn';

/**
 * Popover — a panel a person OPENS, as against a tooltip that happens to them.
 *
 * THE TWO ARE NOT THE SAME CONTROL AND THE LENGTH OF THE TEXT DECIDES WHICH. A tooltip is
 * a label: a few words, on hover, gone when the pointer leaves. It is the right home for
 * "Copy link" and the wrong home for anything a person has to READ, because reading takes
 * longer than a pointer stays still and a tooltip cannot be selected, scrolled or kept open
 * beside the thing it explains.
 *
 * This exists because the metric tiles' `help` was none of those things. It was handed to
 * the browser's native `title` attribute, which renders an operating-system box: dark, one
 * fixed narrow width, no paragraphs, no control over type, and — the part that made it a
 * defect rather than a preference — SILENTLY TRUNCATED. The Overview tile's explanation is
 * about 1,800 characters and the box cut it mid-word, at "and are shown apa". The text that
 * said what the number excluded was the text nobody could reach.
 *
 * So: click to open, stays open, Escape or a click outside closes it, and the panel is a
 * light surface with reading type rather than a chip of chrome. Radix supplies the portal
 * (no clipping inside a card), collision-aware placement, focus handling and the dismiss
 * behaviour, exactly as it does for `tooltip.tsx`.
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
        // WIDTH IS THE READABILITY. `min(34rem, …)` is about 70 characters at this size —
        // the upper end of a comfortable measure, and the same argument `layout.ts` makes
        // for the `reading` width one scale up. The viewport clamp is what keeps it off
        // the edges of a phone, where 34rem is wider than the screen.
        className={cn(
          'ds-pop z-50 w-[min(34rem,calc(100vw-2rem))] rounded-[var(--r-lg)] border border-line',
          'bg-surface p-4 text-[13px] leading-[1.6] text-ink-soft shadow-[var(--shadow-pop)]',
          // NO SCROLL OF ITS OWN. The first draft capped the height and scrolled, on the
          // reasoning that a portalled layer is not "the page" and so is outside rule 1.
          // `checks/one-scroller.ts` disagreed, and it is right: the rule is about how many
          // things a reader can be scrolling, not about which element owns the overflow, and
          // a panel that scrolls inside a page that scrolls is exactly the confusion it
          // forbids. The help text is paragraphs at a reading width now, which is short
          // enough to stand — and if a future one is not, the answer is to shorten it or
          // give it a page, not to hide it behind a second scrollbar.
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
