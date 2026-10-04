'use client';

import { Dialog as D } from 'radix-ui';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A panel that slides in from the right edge for work that needs the page beside it: a record's details, a set of
 * filters, an edit form. 440px on wide screens; under 640px it rises from the bottom, full width. It is modal: focus
 * stays inside until it closes, and closing returns focus to the trigger.
 */
export const Sheet = D.Root;
export const SheetTrigger = D.Trigger;
export const SheetClose = D.Close;

/** The panel's frame and bands, exported so a preview draws exactly what the sheet draws. */
export const SHEET_PANEL = 'flex flex-col bg-surface-raised shadow-overlay';
export const SHEET_HEAD = 'flex items-start gap-4 border-b border-line px-6 pt-5 pb-4';
export const SHEET_BODY = 'min-h-0 flex-1 overflow-y-auto px-6 py-5';
export const SHEET_FOOT = 'flex flex-col-reverse gap-2 border-t border-line bg-surface-sunk/60 px-6 py-3.5 sm:flex-row sm:justify-end';

/* Enter: from the right (starting style + transform transition) on wide screens, from the bottom on phones. Leave: a fade. */
const MOTION = [
  'transition-transform duration-(--dur-enter) ease-out starting:translate-x-full max-sm:starting:translate-x-0',
  'max-sm:data-[state=open]:[animation:m-sheet-up_var(--dur-enter)_var(--ease-out)]',
  'data-[state=closed]:[animation:m-fade_160ms_var(--ease-out)_reverse_forwards]',
].join(' ');

export function SheetContent({
  title,
  description,
  footer,
  className,
  children,
  ...rest
}: Omit<ComponentProps<typeof D.Content>, 'title'> & { title: ReactNode; description?: ReactNode; footer?: ReactNode }) {
  return (
    <D.Portal>
      <D.Overlay className="scrim-in fixed inset-0 z-(--layer-overlay) bg-scrim" />
      <D.Content
        className={cn(
          'fixed z-(--layer-overlay)',
          'inset-y-0 right-0 w-110 max-w-[calc(100vw-48px)] border-l border-line',
          'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[88dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-t-xl max-sm:border-l-0 max-sm:pb-[env(safe-area-inset-bottom)]',
          SHEET_PANEL,
          MOTION,
          className,
        )}
        {...rest}
      >
        <div className={SHEET_HEAD}>
          <div className="min-w-0 flex-1">
            <D.Title className="t-section">{title}</D.Title>
            {description ? <D.Description className="t-small mt-1 text-ink-2">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close aria-label="Close" className="press -mt-0.5 -mr-2 grid size-8 shrink-0 place-items-center rounded-md text-ink-3 hover:bg-fill-hover hover:text-ink">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className={SHEET_BODY}>{children}</div>
        {footer ? <div className={SHEET_FOOT}>{footer}</div> : null}
      </D.Content>
    </D.Portal>
  );
}
