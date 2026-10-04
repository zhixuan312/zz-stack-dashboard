'use client';

import type { FormEvent, ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';

/**
 * A titled group of settings that saves on its own. Its title and one sentence sit on the left, the fields in a card on
 * the right (stacked on narrow widths). With `onSave`, editing shows a save bar that stays in view until the change is
 * saved or discarded; without it, every control applies at once and the section says so. `tone="critical"` is the
 * danger zone.
 */
export function FormSection({
  title,
  description,
  children,
  dirty = false,
  saving = false,
  error,
  readOnly,
  onSave,
  onDiscard,
  saveLabel = 'Save changes',
  tone = 'default',
  footnote,
  className,
}: {
  title: ReactNode;
  /** What these settings change, for whom, in one or two sentences. */
  description?: ReactNode;
  children: ReactNode;
  /** The values differ from what is saved: show the save bar. */
  dirty?: boolean;
  saving?: boolean;
  /** Why the last save failed, and what to do. Shown above the fields. */
  error?: ReactNode;
  /** The reader may see but not change these: say who can, instead of disabling silently. */
  readOnly?: ReactNode;
  onSave?: () => void | Promise<void>;
  onDiscard?: () => void;
  saveLabel?: string;
  tone?: 'default' | 'critical';
  /** A quiet line under the fields: "Changes apply at once". */
  footnote?: ReactNode;
  className?: string;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dirty && !saving) void onSave?.();
  };
  return (
    <section className={cn('@container', className)}>
      <form onSubmit={submit} className="grid gap-x-10 gap-y-5 @3xl:grid-cols-[15rem_minmax(0,64rem)]">
        <header className="min-w-0 @3xl:pt-1">
          <h2 className={cn('t-card', tone === 'critical' && 'text-critical-ink')}>{title}</h2>
          {description ? <p className="t-small mt-2 text-pretty text-ink-2">{description}</p> : null}
        </header>
        <div className="min-w-0">
          <div className={cn('relative rounded-lg border bg-surface shadow-card', tone === 'critical' ? 'border-critical/30' : 'border-line')}>
            <fieldset disabled={Boolean(readOnly) || saving} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-(--card-pad)">
              {error ? <Banner tone="critical" title="Not saved">{error}</Banner> : null}
              {readOnly ? (
                <p className="flex items-center gap-2 rounded-md bg-surface-sunk px-3 py-2 text-xs text-ink-2"><Lock className="size-3.5 shrink-0 text-ink-3" />{readOnly}</p>
              ) : null}
              {children}
            </fieldset>
            {onSave ? (
              <div
                aria-hidden={!dirty}
                className={cn(
                  'sticky bottom-4 z-10 grid transition-[grid-template-rows,opacity] duration-(--dur-enter) ease-out',
                  dirty ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0',
                )}
              >
                <div className="overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 rounded-b-lg border-t border-line bg-surface-raised/90 px-(--card-pad) py-3 backdrop-blur-md">
                    <p className="flex items-center gap-2 text-sm text-ink-2"><span aria-hidden className="size-1.5 rounded-full bg-accent" />Unsaved changes</p>
                    <div className="ml-auto flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving} tabIndex={dirty ? 0 : -1}>Discard</Button>
                      <Button type="submit" variant="primary" size="sm" busy={saving} tabIndex={dirty ? 0 : -1}>{saveLabel}</Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {footnote ? <p className="t-caption mt-2.5">{footnote}</p> : null}
        </div>
      </form>
    </section>
  );
}

/** A row inside a section for a control that is not a text field: label and description on the left, the control on the right. */
export function SettingRow({ label, description, children, className }: { label: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-t border-line pt-5 first:border-0 first:pt-0', className)}>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="t-caption mt-1 text-pretty">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
