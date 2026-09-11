'use client';

import { useState } from 'react';
import { FormPanel } from '@/components/patterns/form-panel';
import { Field, FieldGrid, Input } from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { useConsoleMutation } from '@/lib/mutate';
import { ApiError } from '@/lib/api';

/**
 * A superadmin sets ANOTHER principal's password (← Task I-10's route, Task I-15's UI for
 * it) — the browser counterpart of `POST /api/console/settings/platform/password`.
 * `passwordSetAuthority` (settings.ts) is the whole authorisation story there; unlike
 * `PasswordPanel` above, this form has an email field on purpose, because naming someone
 * else is the whole point of it.
 */
export function PlatformPasswordPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useConsoleMutation<{ ok: true }, { email: string; password: string }>('/settings/platform/password');

  async function save() {
    setError(null);
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    try {
      await mutation.mutateAsync({ email: email.trim(), password });
      setPassword('');
      setConfirm('');
      showToast({ type: 'success', message: `Password set for ${email.trim()}.` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set password — try again.');
    }
  }

  return (
    <FormPanel
      ariaLabel="Set another principal's password"
      heading="Set someone's password"
      onSubmit={save}
      busy={mutation.isPending}
      canSave={email.trim().length > 0 && password.length > 0 && confirm.length > 0}
      saveLabel="Set password"
      error={error}
    >
      <FieldGrid>
        <Field label="Email" required>
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
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
