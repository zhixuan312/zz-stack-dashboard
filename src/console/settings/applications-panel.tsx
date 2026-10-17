'use client';

import { FormSection } from '@/components/patterns/form-section';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { useAccess } from '@/console/settings/access-read';
import { InlineDestructive } from '@/console/settings/inline-destructive';
import { Since } from '@/console/settings/since';
import { ApiError } from '@/lib/api';
import type { AccessApplication, Revoked } from '@/lib/destination-shapes';
import { plural } from '@/lib/format';
import { formatDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { useConsoleMutation } from '@/lib/mutate';
import { stateOf } from '@/views/access-context';

/**
 * The applications the caller authorised, from the Access read: each by its registered name, how many tokens were minted
 * for the caller through it and how many of those are live, when the first was issued and when one was last used.
 * Revoke ends every live token of the caller's from that application, and nobody else's: the registration itself is
 * shared by everybody who connected through it, and stays. An application with no live token of the caller's left has
 * nothing to revoke, so it offers nothing.
 */
export function ApplicationsPanel() {
  const { access } = useAccess();
  const revoke = useConsoleMutation<Revoked, string>((client) => ({ path: `/settings/me/applications/${encodeURIComponent(client)}`, method: 'DELETE' }));
  const liveOf = (a: AccessApplication) => access.issued.filter((t) => t.application === a.client && stateOf(t) === 'live').length;

  async function revokeOne(a: AccessApplication) {
    try {
      const { revoked } = await revoke.mutateAsync(a.client);
      toast({ tone: 'positive', title: revoked ? `Revoked ${formatCount(revoked)} ${plural(revoked, 'token')} for ${a.name}` : `No live token of yours for ${a.name} was left to revoke` });
    } catch (err) {
      toast({ tone: 'critical', title: err instanceof ApiError ? err.message : `${a.name} was not revoked; try again.` });
    }
  }

  return (
    <FormSection
      as="div"
      flush
      title="Connected applications"
      description="The applications you signed in to this platform from. Revoking one ends your tokens for it, until you authorise it again."
    >
      {access.applications.length === 0 ? (
        <div className="px-(--card-pad) py-8">
          <EmptyState title="No application connected">An application is listed here once you authorise it to act as you, from Claude Code, ChatGPT or another MCP client.</EmptyState>
        </div>
      ) : (
        <Table caption="The applications you authorised, the newest token first">
          <TableHead>
            <TableRow>
              <TableHeader grow>Application</TableHeader>
              <TableHeader align="right">Tokens</TableHeader>
              <TableHeader hideBelow="md">First issued</TableHeader>
              <TableHeader hideBelow="sm">Last used</TableHeader>
              <TableHeader><span className="sr-only">Revoke</span></TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {access.applications.map((a) => {
              const live = liveOf(a);
              return (
                <TableRow key={a.client} data-application={a.client}>
                  <TableCell><span className="text-sm font-medium text-ink [overflow-wrap:anywhere]">{a.name}</span></TableCell>
                  <TableCell numeric>
                    {formatCount(a.issuedCount)}
                    <span className="t-caption block">{live ? `${formatCount(live)} live` : 'None live'}</span>
                  </TableCell>
                  <TableCell hideBelow="md" className="whitespace-nowrap text-xs">{formatDate(a.firstAt)}</TableCell>
                  <TableCell hideBelow="sm" className="whitespace-nowrap text-xs"><Since at={a.lastUsedAt} asOf={access.meta.asOf} /></TableCell>
                  <TableCell align="right">
                    {live ? (
                      <InlineDestructive
                        label="Revoke"
                        question={`End your ${formatCount(live)} live ${plural(live, 'token')} for ${a.name}?`}
                        confirmLabel="Revoke"
                        pending={revoke.isPending}
                        onConfirm={() => void revokeOne(a)}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </FormSection>
  );
}
