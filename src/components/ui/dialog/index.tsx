'use client';

import { Dialog as D } from 'radix-ui';
import { X } from 'lucide-react';
import { useRef, type ComponentProps, type ReactNode } from 'react';
import { cn } from '../../../lib/cn';

/**
 * One task at a time, over a dimmed page. Focus moves in on open and returns to the trigger on close; Escape and the
 * scrim close it by default; callers can prevent those dismissal events. On phones it rises from the bottom as a sheet.
 */
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** The panel's frame and its bands, exported so a preview draws exactly what the dialog draws. */
export const DIALOG_PANEL = 'flex max-h-[min(720px,calc(100dvh-32px))] flex-col bg-surface-raised shadow-overlay';
export const DIALOG_HEAD = 'flex items-start gap-4 px-6 pt-5 pb-1';
export const DIALOG_BODY = 'min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-6';
export const DIALOG_FOOT = 'flex flex-col-reverse gap-2 border-t border-line bg-surface-sunk/60 px-6 py-3.5 sm:flex-row sm:justify-end sm:rounded-b-xl';
export const DIALOG_WIDTH = { sm: 'sm:max-w-100', md: 'sm:max-w-130', lg: 'sm:max-w-180', xl: 'sm:max-w-240' } as const;

const FIELD = 'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled), [role="combobox"]:not(:disabled)';

export function DialogContent({
  title,
  description,
  footer,
  size = 'md',
  className,
  children,
  onOpenAutoFocus,
  ...rest
}: Omit<ComponentProps<typeof D.Content>, 'title'> & { title: ReactNode; description?: ReactNode; footer?: ReactNode; size?: keyof typeof DIALOG_WIDTH }) {
  const body = useRef<HTMLDivElement>(null);
  return (
    <D.Portal>
      <D.Overlay className="scrim-in fixed inset-0 z-(--layer-overlay) bg-scrim" />
      <D.Content
        className={cn(
          'dialog-in fixed z-(--layer-overlay) pb-[env(safe-area-inset-bottom)] sm:pb-0',
          DIALOG_PANEL,
          'inset-x-0 bottom-0 rounded-t-xl sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100vw-32px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl',
          DIALOG_WIDTH[size],
          className,
        )}
        // The close button comes first in the panel, so Radix would start there; the task starts at its first field.
        onOpenAutoFocus={(e) => {
          onOpenAutoFocus?.(e);
          const field = e.defaultPrevented ? null : body.current?.querySelector<HTMLElement>(FIELD);
          if (field) { e.preventDefault(); field.focus(); }
        }}
        {...rest}
      >
        <div className={DIALOG_HEAD}>
          <div className="min-w-0 flex-1">
            <D.Title className="t-section">{title}</D.Title>
            {description ? <D.Description className="t-small mt-1.5 text-ink-2">{description}</D.Description> : null}
          </div>
          <D.Close aria-label="Close" className="press -mt-0.5 -mr-2 grid size-8 place-items-center rounded-md text-ink-3 hover:bg-fill-hover hover:text-ink">
            <X className="size-4" />
          </D.Close>
        </div>
        <div ref={body} className={DIALOG_BODY}>{children}</div>
        {footer ? <div className={DIALOG_FOOT}>{footer}</div> : null}
      </D.Content>
    </D.Portal>
  );
}
