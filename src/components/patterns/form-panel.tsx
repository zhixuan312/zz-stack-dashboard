'use client';

import type { FormEvent, ReactNode } from 'react';
import { Card, CardContent, Button, Title, Micro } from '@/components/ui';
import { showToast } from '@/components/ui/toast';

/**
 * FormPanel — the one form shell: a heading, the fields, an error line and a right-aligned
 * submit button, in a Card.
 *
 * DELIBERATE: the footer is owned here. Callers must not hand-roll it.
 *
 *   <FormPanel ariaLabel="Add a member" heading="Add a member" onSubmit={add} busy={busy}>
 *     <FieldGrid>…</FieldGrid>
 *   </FormPanel>
 */
export function FormPanel({
  ariaLabel,
  heading,
  onSubmit,
  children,
  busy = false,
  saveLabel = 'Save',
  canSave = true,
  error,
}: {
  /** Accessible name for the <form> — say which record, e.g. "Add a member". */
  ariaLabel: string;
  heading: ReactNode;
  /** May be async, so a rejected promise is caught here rather than left unhandled. */
  onSubmit: () => void | Promise<void>;
  /** The fields — stacked, or wrapped in a `FieldGrid` for two columns. */
  children: ReactNode;
  busy?: boolean;
  saveLabel?: string;
  canSave?: boolean;
  error?: string | null;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // `onSubmit` is typed `void | Promise<void>`; a rejected promise here would otherwise
    // be unhandled — silently no saved form and no error anywhere.
    void Promise.resolve(onSubmit()).catch((err: unknown) => {
      showToast({ type: 'error', message: err instanceof Error ? err.message : 'Something went wrong — try again.' });
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <Title as="h2" className="!text-base">{heading}</Title>
        <form aria-label={ariaLabel} onSubmit={submit} className="flex flex-col gap-4 border-t border-line pt-4">
          {children}
          {error ? (
            <Micro role="alert" className="block text-[var(--rose-deep)]">
              {error}
            </Micro>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" loading={busy} disabled={!canSave}>
              {busy ? 'Saving…' : saveLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
