'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { FormPanel } from '@/components/patterns/form-panel';
import { InlineDestructive } from '@/components/settings/inline-destructive';
import {
  Badge, EmptyState, Field, FieldGrid, Input, Select, SelectContent, SelectItem, SelectTrigger,
  SelectValue, PageControl, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, usePaged,
} from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { ApiError, useConsole, type TeamMemberRow } from '@/lib/api';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * A team admin's roster for ONE team — add, remove, and change role. The browser
 * counterpart of `add_member` / `remove_member` (admin.ts), reached through
 * `/api/console/settings/team/members` (Task I-14) rather than `/admin/mcp` directly,
 * the same relationship `CredentialsPanel` has to `set_my_credential`.
 *
 * `team` is chosen by the parent (`TeamAdminPanel`) — this component trusts it is
 * one the caller administers, because the gateway route re-checks `teamAuthority`
 * regardless of what this page assumes. Hiding the controls is courtesy; the refusal
 * is the gateway's.
 */
export function TeamMembersPanel({ team }: { team: string }) {
  const list = useConsole<TeamMemberRow[]>(`/settings/team/members?team=${encodeURIComponent(team)}`);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [error, setError] = useState<string | null>(null);

  // ADD and CHANGE-ROLE are the same call — `addMember`'s own `on conflict ... do update
  // set role` (admin.ts) is why — so this form's submit and the role Select below share
  // one mutation rather than two that could drift on what they send.
  const upsertMutation = useConsoleMutation<{ ok: true; result: string }, { email: string; role: 'member' | 'admin' }>(
    (v) => ({ path: '/settings/team/members', method: 'POST', body: { team, email: v.email, role: v.role } }),
  );
  const removeMutation = useConsoleMutation<{ ok: true; result: string }, string>(
    // `confirm` is the team slug this panel already knows, not something the person
    // types — the inline Cancel/Confirm swap below IS the confirmation (NFR-4); it does
    // not ask them to retype the team's name on top of it.
    (memberEmail) => ({ path: '/settings/team/members', method: 'DELETE', body: { team, email: memberEmail, confirm: team } }),
  );

  async function add() {
    setError(null);
    try {
      await upsertMutation.mutateAsync({ email: email.trim(), role });
      setEmail('');
      setRole('member');
      showToast({ type: 'success', message: `Added ${email.trim()} to ${team}.` });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add member — try again.');
    }
  }

  async function changeRole(memberEmail: string, next: 'member' | 'admin') {
    try {
      await upsertMutation.mutateAsync({ email: memberEmail, role: next });
      showToast({ type: 'success', message: `${memberEmail} is now ${next} of ${team}.` });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not change role — try again.' });
    }
  }

  async function remove(memberEmail: string) {
    try {
      await removeMutation.mutateAsync(memberEmail);
      showToast({ type: 'success', message: `Removed ${memberEmail} from ${team}.` });
    } catch (err) {
      // `remove_member`'s own "nothing was removed" refusal (a mistyped address) surfaces
      // here rather than reading as success — see settings.ts's own comment on that route.
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not remove member — try again.' });
    }
  }

  return (
    <>
      <Panel title="Members" aside={`${team} — add, remove, or change role`} padded={false}>
        <Query query={list}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState
                  illustration={{ src: '/assets/brand/state-welcome.png', width: 78, height: 96 }}
                  icon={<Users className="size-5" strokeWidth={2} />}
                  title="Nobody on this team yet"
                  description="Add the first member below."
                />
              </div>
            ) : (
              <MembersTable
                rows={rows}
                team={team}
                pending={removeMutation.isPending}
                onRole={(email, next) => void changeRole(email, next)}
                onRemove={(email) => void remove(email)}
              />
            )
          }
        </Query>
      </Panel>

      <FormPanel
        ariaLabel={`Add a member to ${team}`}
        heading="Add a member"
        onSubmit={add}
        busy={upsertMutation.isPending}
        canSave={email.trim().length > 0}
        saveLabel="Add"
        error={error}
      >
        <FieldGrid>
          <Field label="Email">
            {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Role">
            {(p) => (
              <Select value={role} onValueChange={(v) => setRole(v as 'member' | 'admin')}>
                <SelectTrigger id={p.id} aria-describedby={p['aria-describedby']}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>
        </FieldGrid>
      </FormPanel>
    </>
  );
}

/** ITS OWN COMPONENT so it can hold the page state — the rows come from a `Query` render prop.
 *  `team` is the reset key: switching team lands on the first page of the new roster. */
function MembersTable({ rows, team, pending, onRole, onRemove }: {
  rows: TeamMemberRow[];
  team: string;
  pending: boolean;
  onRole: (email: string, next: 'member' | 'admin') => void;
  onRemove: (email: string) => void;
}) {
  const { page, controls } = usePaged(rows, team);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Remove</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((m) => (
            <TableRow key={m.email}>
              <TableCell className="break-all text-xs">{m.email}</TableCell>
              <TableCell>
                <Select value={m.role} onValueChange={(v) => onRole(m.email, v as 'member' | 'admin')}>
                  <SelectTrigger className="h-8 w-[110px] text-xs" aria-label={`${m.email}'s role`}>
                    <SelectValue>
                      <Badge variant={m.role === 'admin' ? 'accent' : 'neutral'} size="sm">{m.role}</Badge>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">member</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right">
                <InlineDestructive
                  label="Remove"
                  question={`Remove ${m.email} from ${team}?`}
                  confirmLabel="Remove"
                  pending={pending}
                  onConfirm={() => onRemove(m.email)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
