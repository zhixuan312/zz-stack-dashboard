'use client';

import { useState } from 'react';
import { SettingsCard, SettingsSection } from '@/console/settings/section';
import { InlineForm } from '@/console/inline-form';
import { InlineDestructive } from '@/console/settings/inline-destructive';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * Create or archive a team — the browser counterpart of `team_create` / `team_archive`
 * (admin/teams.ts), reached through `/api/console/settings/platform/teams`. Superadmin-only,
 * unlike `TeamAdminPanel`, which manages one team's roster for whoever administers it: creating and retiring the team itself is a platform decision,
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
  // DELIBERATE: `confirm` is the same slug this form already holds, not a second typed
  // field. The inline Cancel/Archive swap below is the confirmation.
  const archiveMutation = useConsoleMutation<{ ok: true; result: string }, string>(
    (team) => ({ path: '/settings/platform/teams', method: 'DELETE', body: { team, confirm: team } }),
  );

  async function create() {
    setCreateError(null);
    try {
      const result = await createMutation.mutateAsync({ slug: slug.trim(), name: name.trim() });
      setSlug('');
      setName('');
      toast({ tone: 'positive', title: result.result });
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Could not create team — try again.');
    }
  }

  async function archive() {
    try {
      const result = await archiveMutation.mutateAsync(archiveSlug.trim());
      setArchiveSlug('');
      toast({ tone: 'positive', title: result.result });
    } catch (err) {
      toast({ tone: 'critical', title: err instanceof ApiError ? err.message : 'Could not archive team — try again.' });
    }
  }

  return (
    <SettingsSection
      title="Platform teams"
      description="Create a team, or archive one. A slug is lowercase letters, digits, - or _, and never changes. Archiving is undone by creating the same slug again."
    >
      <SettingsCard>
        <InlineForm
          ariaLabel="Create a team"
          onSubmit={create}
          busy={createMutation.isPending}
          canSave={slug.trim().length > 0 && name.trim().length > 0}
          saveLabel="Create team"
          error={createError}
        >
          <Field label="New team slug">
            {(p) => <Input {...p} placeholder="e.g. search-quality" value={slug} onChange={(e) => setSlug(e.target.value)} />}
          </Field>
          <Field label="Name">
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
        </InlineForm>

        <div className="flex flex-wrap items-end gap-3 border-t border-line px-(--card-pad) py-4">
          <Field label="Archive a team" className="min-w-0 flex-1 basis-72">
            {(p) => <Input {...p} placeholder="team slug" value={archiveSlug} onChange={(e) => setArchiveSlug(e.target.value)} />}
          </Field>
          {archiveSlug.trim() ? (
            <InlineDestructive
              size="md"
              trigger="secondary"
              label="Archive"
              question={`Archive ${archiveSlug.trim()}? Members lose it from their access.`}
              confirmLabel="Archive"
              pending={archiveMutation.isPending}
              onConfirm={() => void archive()}
            />
          ) : (
            <Button type="button" variant="secondary" disabled>Archive</Button>
          )}
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
