'use client';

import { DropdownMenu as M } from 'radix-ui';
import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A list of actions or choices that opens from a trigger. Items run on click or Enter; a choice shows a check. */
export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuGroup = M.Group;
export const MenuRadioGroup = M.RadioGroup;

/** The menu surface and its rows, exported so a preview or a static mock draws exactly what the menu draws. */
export const MENU_CONTENT = 'z-(--layer-popover) min-w-52 rounded-lg bg-surface-raised p-1 shadow-overlay';
export const MENU_ITEM =
  'relative flex h-8 cursor-default items-center gap-2.5 rounded-sm px-2 text-sm text-ink outline-none select-none data-highlighted:bg-fill-hover data-disabled:text-ink-disabled [&_svg]:size-4 [&_svg]:text-ink-3 pointer-coarse:h-11';

export function MenuContent({ className, align = 'start', sideOffset = 6, ...rest }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn('float-in', MENU_CONTENT, className)}
        {...rest}
      />
    </M.Portal>
  );
}

const item = MENU_ITEM;

export function MenuItem({ className, shortcut, tone, children, ...rest }: ComponentProps<typeof M.Item> & { shortcut?: ReactNode; tone?: 'critical' }) {
  return (
    <M.Item className={cn(item, tone === 'critical' && 'text-critical-ink [&_svg]:text-critical-ink', className)} {...rest}>
      {children}
      {shortcut ? <span className="ml-auto pl-4 text-xs text-ink-3">{shortcut}</span> : null}
    </M.Item>
  );
}

export function MenuRadioItem({ className, children, ...rest }: ComponentProps<typeof M.RadioItem>) {
  return (
    <M.RadioItem className={cn(item, 'pr-8', className)} {...rest}>
      {children}
      <M.ItemIndicator className="absolute right-2">
        <Check className="size-4 !text-accent" strokeWidth={2.25} />
      </M.ItemIndicator>
    </M.RadioItem>
  );
}

export function MenuLabel({ className, ...rest }: ComponentProps<typeof M.Label>) {
  return <M.Label className={cn('t-eyebrow px-2 pt-2 pb-1.5', className)} {...rest} />;
}

export function MenuSeparator({ className }: { className?: string }) {
  return <M.Separator className={cn('-mx-1 my-1 h-px bg-line', className)} />;
}
