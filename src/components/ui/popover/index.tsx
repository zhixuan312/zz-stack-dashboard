'use client';

import { Popover as P } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * A small panel anchored to its trigger: a filter's options, a date range, a field's explanation with a link. It
 * holds content and controls; a list of actions is a Menu, and a short explanation with no controls is a Tooltip.
 */
export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

/** The surface, exported so a preview draws exactly what the popover draws. */
export const POPOVER_CONTENT = 'z-(--layer-popover) w-72 max-w-[calc(100vw-16px)] rounded-lg bg-surface-raised p-4 text-sm text-ink shadow-overlay';

export function PopoverContent({ className, align = 'start', sideOffset = 8, ...rest }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={sideOffset} collisionPadding={8} className={cn('float-in', POPOVER_CONTENT, className)} {...rest} />
    </P.Portal>
  );
}
