'use client';

import { FormSection } from '@/components/patterns/form-section';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { useAccess } from '@/console/settings/access-read';
import { InlineDestructive } from '@/console/settings/inline-destructive';
import { Since } from '@/console/settings/since';
import { ApiError } from '@/lib/api';
import type { AccessBrowser, Revoked } from '@/lib/destination-shapes';
import { formatDate } from '@/lib/format-date';
import { useConsoleMutation } from '@/lib/mutate';
import { browserOf } from '@/views/access-context';

/**
 * The browsers the caller is signed in on, from the Access read, the one asking first and marked: each by the kind of
 * browser and system it said it was, when it signed in, when it was last seen and when its sign-in ends. Sign out ends
 * another one's session. The one asking has none here: ending it would leave this page standing on a session that no
 * longer exists, and Sign out in the menu ends it and clears its cookie. A browser is never named by its session's id.
 */
export function BrowsersPanel() {
  const { access } = useAccess();
  const signOut = useConsoleMutation<Revoked, string>((id) => ({ path: `/settings/me/browsers/${encodeURIComponent(id)}`, method: 'DELETE' }));

  async function signOutOf(b: AccessBrowser) {
    try {
      await signOut.mutateAsync(b.id);
      toast({ tone: 'positive', title: `Signed out ${browserOf(b)}` });
    } catch (err) {
      toast({ tone: 'critical', title: err instanceof ApiError ? err.message : `${browserOf(b)} was not signed out; try again.` });
    }
  }

  return (
    <FormSection
      as="div"
      flush
      title="Signed-in browsers"
      description="Where you are signed in to this console now. Sign out of one you do not recognise; your passkey signs you in again."
    >
      {access.browsers.length === 0 ? (
        <div className="px-(--card-pad) py-8">
          <EmptyState title="No browser signed in">This page was opened with a token, not a browser sign-in, so no browser is signed in as you.</EmptyState>
        </div>
      ) : (
        <Table caption="The browsers you are signed in on, this one first">
          <TableHead>
            <TableRow>
              <TableHeader grow>Browser</TableHeader>
              <TableHeader hideBelow="md">Signed in</TableHeader>
              <TableHeader hideBelow="sm">Last seen</TableHeader>
              <TableHeader hideBelow="md">Ends</TableHeader>
              <TableHeader><span className="sr-only">Sign out</span></TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {access.browsers.map((b) => (
              <TableRow key={b.id} data-browser={b.current ? 'current' : 'other'}>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink" title={b.userAgent ?? undefined}>{browserOf(b)}</span>
                    {b.current ? <Badge tone="neutral" dot>This browser</Badge> : null}
                  </span>
                  <span className="t-caption block @min-[672px]:hidden">Signed in {formatDate(b.issuedAt)}</span>
                </TableCell>
                <TableCell hideBelow="md" className="whitespace-nowrap text-xs">{formatDate(b.issuedAt)}</TableCell>
                <TableCell hideBelow="sm" className="whitespace-nowrap text-xs"><Since at={b.lastSeenAt} asOf={access.meta.asOf} never="Not since" /></TableCell>
                <TableCell hideBelow="md" className="whitespace-nowrap text-xs">{formatDate(b.expiresAt)}</TableCell>
                <TableCell align="right">
                  {b.current ? null : (
                    <InlineDestructive label="Sign out" question={`Sign out ${browserOf(b)}?`} confirmLabel="Sign out" pending={signOut.isPending} onConfirm={() => void signOutOf(b)} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </FormSection>
  );
}
