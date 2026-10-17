'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { AskAbout } from '@/components/patterns/ask-about';
import { FormSection } from '@/components/patterns/form-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { usePaged } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { InlineForm } from '@/console/inline-form';
import { PageControl } from '@/console/paged';
import { useAccess } from '@/console/settings/access-read';
import { InlineDestructive } from '@/console/settings/inline-destructive';
import { Since } from '@/console/settings/since';
import { ApiError } from '@/lib/api';
import type { IssuedToken } from '@/lib/api-shapes';
import type { AccessToken } from '@/lib/destination-shapes';
import { formatDate } from '@/lib/format-date';
import { consoleMutate, useConsoleMutation } from '@/lib/mutate';
import { DIRECT, applicationOf, stateOf } from '@/views/access-context';

/** The protagonist's title: the section the page's Ask sits on. COUPLED: the README's `Protagonist:`. */
const TOKENS_TITLE = 'Tokens';

/**
 * A just-issued token, shown exactly once. DELIBERATE: `TokensPanel` holds it in a plain `useState`, never
 * `useConsoleMutation`, whose cache keeps `data` for as long as `gcTime`: a plaintext token must not be retrievable a
 * second time from anywhere. Dismissing sets it back to `null` in the parent, so the value is dropped rather than hidden.
 *
 * In a dialog, never in the page: the assistant sends the text of the page's scroll region with every message, and the
 * dialog is portalled outside it, so the value never enters the assistant's context (bug ee35a0d7). The value is marked
 * `data-assistant="omit"` besides, so even a dialog drawn inside the region is never read. It closes only when the
 * person says so, never on a stray click or Escape.
 */
function IssuedTokenDialog({ issued, onDismiss }: { issued: IssuedToken | null; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ tone: 'critical', title: 'Could not copy: select the token and copy it by hand.' });
    }
  }

  return (
    <Dialog open={issued !== null} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      {issued ? (
        <DialogContent
          title={`Your token${issued.label ? `, ${issued.label}` : ''}`}
          description="Shown once. Store it now."
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          footer={<Button type="button" variant="primary" onClick={onDismiss}>I&apos;ve stored it</Button>}
        >
          <div className="flex flex-col gap-3">
            <div data-assistant="omit" className="flex items-center gap-2">
              <code className="min-w-0 flex-1 rounded-sm bg-surface-sunk px-3 py-2 font-mono text-xs [overflow-wrap:anywhere]">{issued.token}</code>
              <Button type="button" size="sm" variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="t-small text-warning-ink">
              It will not be shown again, here or anywhere else. If it leaks, revoke it and issue a new one.
            </p>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/**
 * The caller's own platform tokens, from the Access read: label, the application each was minted through, when it was
 * issued and last used, and its state, with Revoke on a live one; issuing one is the section's last line. The browser
 * counterpart of `pat_list`, `pat_issue` and `pat_revoke` on the /manage door. A refused issue keeps the label typed and
 * says the gateway's sentence; a refused revoke says it and changes nothing.
 */
export function TokensPanel() {
  const { access } = useAccess();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const revoke = useConsoleMutation<{ ok: true; revoked: string }, string>((id) => ({ path: `/settings/me/tokens/${encodeURIComponent(id)}`, method: 'DELETE' }));

  async function issue() {
    setError(null);
    setIssuing(true);
    try {
      const result = await consoleMutate<IssuedToken>('/settings/me/tokens', { label: label.trim() || undefined });
      setIssued(result);
      setLabel('');
      // `useConsoleMutation` invalidates on its own; this write skips that hook on purpose (see `IssuedTokenDialog`), so
      // the page's read is told to come again by hand.
      await queryClient.invalidateQueries({ queryKey: ['console'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The token was not issued; try again.');
    } finally {
      setIssuing(false);
    }
  }

  async function revokeOne(t: AccessToken) {
    try {
      await revoke.mutateAsync(t.id);
      toast({ tone: 'positive', title: `Revoked ${t.label}` });
    } catch (err) {
      toast({ tone: 'critical', title: err instanceof ApiError ? err.message : 'The token was not revoked; try again.' });
    }
  }

  return (
    <div data-protagonist={TOKENS_TITLE} className="contents">
      <FormSection
        as="div"
        flush
        title={TOKENS_TITLE}
        description="For Claude Code or any MCP client, acting as you. A new token is shown once, when it is issued."
        actions={<AskAbout question="Which of my tokens are live, which application is each for, and which have never been used?" />}
      >
        <IssuedTokenDialog issued={issued} onDismiss={() => setIssued(null)} />
        {access.issued.length === 0 ? (
          <div className="px-(--card-pad) py-8">
            <EmptyState title="No token issued yet">Issue one below to connect a client to this platform as yourself.</EmptyState>
          </div>
        ) : (
          <TokensTable rows={access.issued} pending={revoke.isPending} onRevoke={(t) => void revokeOne(t)} />
        )}
        <InlineForm ariaLabel="Issue a new token" onSubmit={issue} busy={issuing} saveLabel="Issue token" error={error}>
          <Field label="New token" optional>
            {(p) => <Input {...p} placeholder="What it is for, e.g. laptop, Claude Code" value={label} onChange={(e) => setLabel(e.target.value)} />}
          </Field>
        </InlineForm>
      </FormSection>
    </div>
  );
}

/** Its own component so it can hold the page of rows it shows. */
function TokensTable({ rows, pending, onRevoke }: { rows: AccessToken[]; pending: boolean; onRevoke: (t: AccessToken) => void }) {
  const { access } = useAccess();
  const { rows: page, ...pager } = usePaged(rows);
  return (
    <>
      <Table caption="Your tokens, newest first">
        <TableHead>
          <TableRow>
            <TableHeader grow>Label</TableHeader>
            <TableHeader hideBelow="md">Application</TableHeader>
            <TableHeader hideBelow="md">Issued</TableHeader>
            <TableHeader hideBelow="sm">Last used</TableHeader>
            <TableHeader>State</TableHeader>
            <TableHeader><span className="sr-only">Revoke</span></TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {page.map((t) => {
            const app = applicationOf(access, t);
            return (
              <TableRow key={t.id} data-token={t.id}>
                <TableCell>
                  <span className="block text-sm font-medium text-ink [overflow-wrap:anywhere]">{t.label || <span className="text-ink-3">No label</span>}</span>
                  {/* What the hidden columns say, under the label, where a phone has no room for them. */}
                  <span className="t-caption block @min-[672px]:hidden [overflow-wrap:anywhere]">{app}, issued {formatDate(t.createdAt)}</span>
                </TableCell>
                <TableCell hideBelow="md" className={app === DIRECT ? 'text-xs text-ink-3' : 'text-xs [overflow-wrap:anywhere]'}>{app}</TableCell>
                <TableCell hideBelow="md" className="whitespace-nowrap text-xs">{formatDate(t.createdAt)}</TableCell>
                <TableCell hideBelow="sm" className="whitespace-nowrap text-xs"><Since at={t.lastUsedAt} asOf={access.meta.asOf} /></TableCell>
                <TableCell>{stateOf(t) === 'live' ? <Badge tone="positive" dot>Live</Badge> : <Badge tone="neutral" dot>Revoked</Badge>}</TableCell>
                <TableCell align="right">
                  {stateOf(t) === 'live' ? (
                    <InlineDestructive label="Revoke" question={`Revoke ${t.label || 'this token'}?`} confirmLabel="Revoke" pending={pending} onConfirm={() => onRevoke(t)} />
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <PageControl {...pager} />
    </>
  );
}
