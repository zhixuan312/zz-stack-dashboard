'use client';

import { Tooltip as T } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A short explanation under the pointer or on keyboard focus. Never holds an action, never the only place a fact lives.
 * `toggle` is for a trigger whose only job is the explanation (an info button): a press or a tap opens and closes it,
 * so it works on touch, where there is no hover.
 */
export function Tooltip({
  content,
  side = 'top',
  toggle = false,
  children,
  className,
}: {
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  toggle?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <T.Root open={open} onOpenChange={setOpen}>
      <T.Trigger
        asChild
        // Radix closes a tooltip on press; an info trigger opens on press instead. preventDefault skips Radix's close.
        onClick={toggle ? (e) => { e.preventDefault(); setOpen((o) => !o); } : undefined}
        onPointerDown={toggle ? (e) => e.preventDefault() : undefined}
      >
        {children}
      </T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn('float-in z-(--layer-tooltip) max-w-64 rounded-sm bg-surface-inverse px-2 py-1.5 text-xs leading-snug text-ink-inverse shadow-overlay', className)}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
