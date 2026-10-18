'use client';

import { FormSection } from '@/components/patterns/form-section';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccess } from '@/console/settings/access-read';
import { Since } from '@/console/settings/since';
import { formatDate } from '@/lib/format-date';
import { passkeyOf, transportsOf } from '@/views/access-context';

/**
 * The passkeys the caller signs in with, from the Access read, newest first: each by its label, how it is reached and
 * its dates; never its credential. A passkey is added from an enrolment link and none is removed here, so the section
 * lists and changes nothing.
 */
export function PasskeysPanel() {
  const { access } = useAccess();
  return (
    <FormSection
      as="div"
      flush
      title="Passkeys"
      description="What signs you in to this console. Another is added from an enrolment link."
    >
      {access.authenticators.length === 0 ? (
        <div className="px-(--card-pad) py-8">
          <EmptyState title="No passkey recorded">This session signed in some other way. An enrolment link registers one.</EmptyState>
        </div>
      ) : (
        <Table caption="Your passkeys, newest first">
          <TableHead>
            <TableRow>
              <TableHeader grow>Passkey</TableHeader>
              <TableHeader hideBelow="md">Reached by</TableHeader>
              <TableHeader hideBelow="sm">Added</TableHeader>
              <TableHeader>Last used</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {access.authenticators.map((k) => (
              <TableRow key={`${k.createdAt}:${k.label ?? ''}`}>
                <TableCell>
                  <span className={k.label ? 'text-sm font-medium text-ink [overflow-wrap:anywhere]' : 'text-sm text-ink-3'}>{passkeyOf(k.label)}</span>
                  <span className="t-caption block @min-[672px]:hidden">{transportsOf(k.transports)}</span>
                </TableCell>
                <TableCell hideBelow="md" className="text-xs">{transportsOf(k.transports)}</TableCell>
                <TableCell hideBelow="sm" className="whitespace-nowrap text-xs">{formatDate(k.createdAt)}</TableCell>
                <TableCell className="whitespace-nowrap text-xs"><Since at={k.lastUsedAt} asOf={access.meta.asOf} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </FormSection>
  );
}
