'use client';

import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Panel } from '@/console/panel';

/**
 * One form in a settings card: a title, the fields, the gateway's refusal when there is one, and a single primary
 * action. `onSubmit` may be async; a rejected promise is said in a toast rather than left unhandled.
 */
export function FormPanel({
  ariaLabel, heading, onSubmit, children, busy = false, saveLabel = 'Save', canSave = true, error,
}: {
  /** The form's accessible name: say which record, "Add a member". */
  ariaLabel: string;
  heading: ReactNode;
  onSubmit: () => void | Promise<void>;
  /** The fields, stacked, or in a `FieldGrid` for two columns. */
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
    <Panel title={heading}>
      <form aria-label={ariaLabel} onSubmit={submit} className="flex flex-col gap-4">
        {children}
        {error ? <p role="alert" className="t-small text-critical-ink">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" busy={busy} disabled={!canSave}>{saveLabel}</Button>
        </div>
      </form>
    </Panel>
  );
}

/** Two fields side by side from a phone's width up, one under the other below it. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
