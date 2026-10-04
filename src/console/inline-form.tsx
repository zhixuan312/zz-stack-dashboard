'use client';

import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

/**
 * A form that adds one row to the table above it, on the card's last line: the fields side by side, the one action at
 * the end of their row, and the gateway's refusal under them when there is one. `onSubmit` may be async; a rejected
 * promise is said in a toast rather than left unhandled. Fields here carry no hint, so the action lines up with the
 * inputs; what a field wants goes in its placeholder or the section's description.
 */
export function InlineForm({
  ariaLabel, onSubmit, children, busy = false, saveLabel = 'Save', canSave = true, error,
}: {
  /** The form's accessible name: say which record, "Add a member". */
  ariaLabel: string;
  onSubmit: () => void | Promise<void>;
  children: ReactNode;
  busy?: boolean;
  saveLabel?: string;
  canSave?: boolean;
  error?: string | null;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void Promise.resolve(onSubmit()).catch((err: unknown) => {
      toast({ tone: 'critical', title: 'Not saved', description: err instanceof Error ? err.message : 'Something went wrong; try again.' });
    });
  };
  return (
    <form aria-label={ariaLabel} onSubmit={submit} className="flex flex-col gap-3 border-t border-line px-(--card-pad) py-4 first:border-t-0">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-0 flex-1 basis-72 grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3">{children}</div>
        <Button type="submit" variant="primary" busy={busy} disabled={!canSave}>{saveLabel}</Button>
      </div>
      {error ? <p role="alert" className="t-small text-critical-ink">{error}</p> : null}
    </form>
  );
}
