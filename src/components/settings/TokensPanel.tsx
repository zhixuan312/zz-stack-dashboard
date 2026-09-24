'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { FormPanel } from '@/components/patterns/form-panel';
import { InlineDestructive } from '@/components/settings/inline-destructive';
import {
  Badge, Button, EmptyState, Field, Input, PageControl, Table, TableBody, TableCell, TableHead, TableHeader,
  TableRow, Time, usePaged,
} from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { ApiError, useConsole } from '@/lib/api';
import { type IssuedToken, type MyAccessToken } from '@/lib/api-shapes';
import { consoleMutate, useConsoleMutation } from '@/lib/mutate';

/**
 * A just-issued token, shown exactly once. DELIBERATE: `TokensPanel` holds it
 * in a plain `useState`, never `useConsoleMutation` — that hook's cache holds
 * `data` for as long as `gcTime`, and a plaintext token must not be retrievable
 * a second time from anywhere. Dismissing, or navigating away, sets `issued`
 * back to `null` in the parent, so the value is dropped rather than hidden.
 */
function IssuedTokenBanner({ issued, onDismiss }: { issued: IssuedToken; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ type: 'error', message: 'Could not copy — select and copy the token by hand.' });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--r)] border border-[var(--amber)] bg-[var(--amber-tint)] p-4">
      <p className="text-sm font-medium text-[var(--amber-text)]">
        Your token{issued.label ? ` (${issued.label})` : ''} — shown once, store it now
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-[var(--r-sm)] bg-surface px-3 py-2 font-mono text-xs">
          {issued.token}
        </code>
        <Button type="button" size="sm" variant="secondary" leftIcon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="text-xs text-[var(--amber-text)]">
        It will not be shown again — not on this page, not by asking again. If it leaks, revoke it below and issue a new one.
      </p>
      <Button type="button" size="sm" variant="ghost" className="self-start" onClick={onDismiss}>
        I&rsquo;ve stored it
      </Button>
    </div>
  );
}

/**
 * Your own personal access tokens — the browser counterpart of
 * `pat_list` / `pat_issue` / `pat_revoke`
 * (admin.ts). See `IssuedTokenBanner` above for why issuing one bypasses
 * `useConsoleMutation`'s cache entirely.
 */
export function TokensPanel() {
  const list = useConsole<MyAccessToken[]>('/settings/me/tokens');
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedToken | null>(null);
  const revokeMutation = useConsoleMutation<{ ok: true; revoked: string }, string>(
    (id) => ({ path: `/settings/me/tokens/${encodeURIComponent(id)}`, method: 'DELETE' }),
  );

  async function issue() {
    setError(null);
    setIssuing(true);
    try {
      const result = await consoleMutate<IssuedToken>('/settings/me/tokens', { label: label.trim() || undefined });
      setIssued(result);
      setLabel('');
      // `useConsoleMutation` does this invalidation itself on success; this call
      // skips that hook on purpose (see `IssuedTokenBanner`), so the tokens list
      // has to be told to refetch by hand.
      await queryClient.invalidateQueries({ queryKey: ['console'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not issue a token — try again.');
    } finally {
      setIssuing(false);
    }
  }

  async function revoke(id: string) {
    try {
      await revokeMutation.mutateAsync(id);
      showToast({ type: 'success', message: 'Token revoked.' });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not revoke token — try again.' });
    }
  }

  return (
    <>
      {issued ? <IssuedTokenBanner issued={issued} onDismiss={() => setIssued(null)} /> : null}

      <Panel title="Access tokens" aside="for Claude Code or any MCP client" padded={false}>
        <Query query={list}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState
                  illustration={{ src: '/assets/brand/state-welcome.png', width: 78, height: 96 }}
                  icon={<KeyRound className="size-5" strokeWidth={2} />}
                  title="No tokens issued yet"
                  description="Issue one below to connect a client to this platform as yourself."
                />
              </div>
            ) : (
              <TokensTable rows={rows} pending={revokeMutation.isPending} onRevoke={(id) => void revoke(id)} />
            )
          }
        </Query>
      </Panel>

      <FormPanel
        ariaLabel="Issue a new access token"
        heading="Issue a new token"
        onSubmit={issue}
        busy={issuing}
        saveLabel="Issue token"
        error={error}
      >
        <Field label="Label" hint="What it is for, e.g. 'laptop — Claude Code'. Optional.">
          {(p) => <Input {...p} value={label} onChange={(e) => setLabel(e.target.value)} />}
        </Field>
      </FormPanel>
    </>
  );
}

/** Its own component so it can hold the page state — the rows come from a `Query` render prop. */
function TokensTable({ rows, pending, onRevoke }: {
  rows: MyAccessToken[]; pending: boolean; onRevoke: (id: string) => void;
}) {
  const { page, controls } = usePaged(rows);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead hideBelow="md">Last used</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Revoke</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="break-words text-xs">{t.label || <span className="text-ink-faint">—</span>}</TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs"><Time value={t.created_at} /></TableCell>
              <TableCell hideBelow="md" className="whitespace-nowrap font-mono text-xs">
                {t.last_used_at ? <Time value={t.last_used_at} /> : <span className="text-ink-faint">never</span>}
              </TableCell>
              <TableCell>
                {t.revoked_at ? (
                  <Badge variant="rose" dot size="sm">revoked</Badge>
                ) : (
                  <Badge variant="sage" dot size="sm">active</Badge>
                )}
              </TableCell>
              <TableCell>
                {t.revoked_at ? null : (
                  <InlineDestructive
                    label="Revoke"
                    question="Revoke this token?"
                    confirmLabel="Revoke"
                    pending={pending}
                    onConfirm={() => onRevoke(t.id)}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
