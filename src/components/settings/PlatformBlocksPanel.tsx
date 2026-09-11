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
 * Grant or revoke a team's access to a building block (← Task I-15, AC-5) — the browser
 * counterpart of `grant_tool` / `revoke_tool` (admin.ts).
 *
 * ALWAYS SUPERADMIN, NEVER `teamAuthority`. `grant_tool`'s own comment (admin.ts) says
 * block access is a platform decision — `TeamAdminPanel`'s roster and flow controls have no
 * route that reaches `grant_tool` or `revoke_tool`; only this platform-tier panel does.
 */
export function PlatformBlocksPanel() {
  const [grantTeam, setGrantTeam] = useState('');
  const [grantBlock, setGrantBlock] = useState('');
  const [grantError, setGrantError] = useState<string | null>(null);
  const [revokeTeam, setRevokeTeam] = useState('');
  const [revokeBlock, setRevokeBlock] = useState('');

  const grantMutation = useConsoleMutation<{ ok: true; result: string }, { team: string; block: string }>(
    '/settings/platform/blocks',
  );
  // `confirm` is the same block id this form already holds, not a second typed field — the
  // inline Cancel/Revoke swap below IS the confirmation (NFR-4).
  const revokeMutation = useConsoleMutation<{ ok: true; result: string }, { team: string; block: string }>(
    (v) => ({ path: '/settings/platform/blocks', method: 'DELETE', body: { team: v.team, block: v.block, confirm: v.block } }),
  );

  async function grant() {
    setGrantError(null);
    try {
      const result = await grantMutation.mutateAsync({ team: grantTeam.trim(), block: grantBlock.trim() });
      setGrantTeam('');
      setGrantBlock('');
      showToast({ type: 'success', message: result.result });
    } catch (err) {
      setGrantError(err instanceof ApiError ? err.message : 'Could not grant block access — try again.');
    }
  }

  async function revoke() {
    try {
      const result = await revokeMutation.mutateAsync({ team: revokeTeam.trim(), block: revokeBlock.trim() });
      setRevokeTeam('');
      setRevokeBlock('');
      showToast({ type: 'success', message: result.result });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not revoke block access — try again.' });
    }
  }

  const canRevoke = revokeTeam.trim().length > 0 && revokeBlock.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <FormPanel
        ariaLabel="Grant a team block access"
        heading="Grant block access"
        onSubmit={grant}
        busy={grantMutation.isPending}
        canSave={grantTeam.trim().length > 0 && grantBlock.trim().length > 0}
        saveLabel="Grant"
        error={grantError}
      >
        <FieldGrid>
          <Field label="Team">
            {(p) => <Input {...p} value={grantTeam} onChange={(e) => setGrantTeam(e.target.value)} />}
          </Field>
          <Field label="Block" hint="e.g. casebox, bookit, RuleMill">
            {(p) => <Input {...p} value={grantBlock} onChange={(e) => setGrantBlock(e.target.value)} />}
          </Field>
        </FieldGrid>
      </FormPanel>

      <Panel title="Revoke block access" aside="takes effect immediately">
        <div className="flex items-end gap-3">
          <Field label="Team" className="flex-1">
            {(p) => <Input {...p} value={revokeTeam} onChange={(e) => setRevokeTeam(e.target.value)} />}
          </Field>
          <Field label="Block" className="flex-1">
            {(p) => <Input {...p} value={revokeBlock} onChange={(e) => setRevokeBlock(e.target.value)} />}
          </Field>
          {canRevoke ? (
            <InlineDestructive
              label="Revoke"
              question={`Revoke ${revokeBlock.trim()} from ${revokeTeam.trim()}?`}
              confirmLabel="Revoke"
              pending={revokeMutation.isPending}
              onConfirm={() => void revoke()}
            />
          ) : (
            <Button type="button" size="sm" variant="ghost" disabled>Revoke</Button>
          )}
        </div>
      </Panel>
    </div>
  );
}
