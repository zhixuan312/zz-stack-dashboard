'use client';

import { useState } from 'react';
import { FormPanel } from '@/components/patterns/form-panel';
import { Field, FieldGrid, Input } from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { useConsoleMutation } from '@/lib/mutate';
import { ApiError } from '@/lib/api';

/**
 * Set your own fallback password (← Task I-10's route, this console's first
 * caller of it). There is nothing to READ here — the gateway has no
 * `GET /settings/me/password` and never will, because a stored verifier says
 * nothing safe to show back — so this is always the open form, never a
 * disclosure over a summary of a value that does not exist.
 */
export function PasswordPanel() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useConsoleMutation<{ ok: true }, { password: string }>('/settings/me/password');

  async function save() {
    setError(null);
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    try {
      await mutation.mutateAsync({ password });
      setPassword('');
      setConfirm('');
      showToast({ type: 'success', message: 'Password updated.' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set password — try again.');
    }
  }

  return (
    <FormPanel
      ariaLabel="Set your password"
      heading="Password"
      onSubmit={save}
      busy={mutation.isPending}
      canSave={password.length > 0 && confirm.length > 0}
      saveLabel="Set password"
      error={error}
    >
      <FieldGrid>
        <Field label="New password" required>
          {(p) => (
            <Input {...p} type="password" autoComplete="new-password" value={password}
                   onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <Field label="Confirm password" required>
          {(p) => (
            <Input {...p} type="password" autoComplete="new-password" value={confirm}
                   onChange={(e) => setConfirm(e.target.value)} />
          )}
        </Field>
      </FieldGrid>
    </FormPanel>
  );
}
