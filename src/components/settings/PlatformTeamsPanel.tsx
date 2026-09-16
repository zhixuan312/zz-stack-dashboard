'use client';

import { useState } from 'react';
import { Panel } from '@/components/Panel';
import { FormPanel } from '@/components/patterns/form-panel';
import { InlineDestructive } from '@/components/settings/inline-destructive';
import { Button, Field, FieldGrid, Input } from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * Create or archive a team (← Task I-15, AC-5) — the browser counterpart of `create_team`
 * / `archive_team` (admin.ts), reached through `/api/console/settings/platform/teams`.
 * Superadmin-only, unlike `TeamAdminPanel` (which manages ONE team's roster and flows for
 * whoever administers it): creating and retiring the team itself is a platform decision,
 * never a team admin's.
 */
export function PlatformTeamsPanel() {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [archiveSlug, setArchiveSlug] = useState('');

  const createMutation = useConsoleMutation<{ ok: true; result: string }, { slug: string; name: string }>(
    '/settings/platform/teams',
  );
  // `confirm` is the same slug this form already holds, not a second typed field — the
  // inline Cancel/Archive swap below IS the confirmation (NFR-4).
  const archiveMutation = useConsoleMutation<{ ok: true; result: string }, string>(
    (team) => ({ path: '/settings/platform/teams', method: 'DELETE', body: { team, confirm: team } }),
  );

  async function create() {
    setCreateError(null);
    try {
      const result = await createMutation.mutateAsync({ slug: slug.trim(), name: name.trim() });
      setSlug('');
      setName('');
      showToast({ type: 'success', message: result.result });
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Could not create team — try again.');
    }
  }

  async function archive() {
    try {
      const result = await archiveMutation.mutateAsync(archiveSlug.trim());
      setArchiveSlug('');
      showToast({ type: 'success', message: result.result });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not archive team — try again.' });
    }
  }

  return (
    <>
      <FormPanel
        ariaLabel="Create a team"
        heading="Create a team"
        onSubmit={create}
        busy={createMutation.isPending}
        canSave={slug.trim().length > 0 && name.trim().length > 0}
        saveLabel="Create"
        error={createError}
      >
        <FieldGrid>
          <Field label="Slug" hint="lowercase letters, digits, - or _ — the stable identity used everywhere">
            {(p) => <Input {...p} value={slug} onChange={(e) => setSlug(e.target.value)} />}
          </Field>
          <Field label="Name">
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
        </FieldGrid>
      </FormPanel>

      <Panel title="Archive a team" aside="reversible — create_team on the same slug restores it">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Team slug" className="flex-1">
            {(p) => <Input {...p} value={archiveSlug} onChange={(e) => setArchiveSlug(e.target.value)} />}
          </Field>
          {archiveSlug.trim() ? (
            <InlineDestructive
              label="Archive"
              question={`Archive ${archiveSlug.trim()}? Members lose it from their access.`}
              confirmLabel="Archive"
              pending={archiveMutation.isPending}
              onConfirm={() => void archive()}
            />
          ) : (
            <Button type="button" size="sm" variant="ghost" disabled>Archive</Button>
          )}
        </div>
      </Panel>
    </>
  );
}
