'use client';

import { useState } from 'react';
import { Blocks } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { FormPanel } from '@/components/patterns/form-panel';
import { InlineDestructive } from '@/components/settings/inline-destructive';
import {
  Badge, EmptyState, Field, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time,
} from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { ApiError, useConsole, type MyBlockConnection } from '@/lib/api';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * Your own block connections — the browser counterpart of `connect_block`
 * (server.ts) and the two functions this task added to block-oauth.ts
 * (`myBlockConnectionsFor`, `disconnectBlock`) because neither existed as an
 * MCP tool to reuse. `has_refresh_token` is what the marker's own comment
 * (block-oauth.ts) says it is for: telling a person whether a connection
 * renews itself or will need re-consent — never the token.
 *
 * CONNECTING LEAVES THIS PAGE. The gateway hands back a URL to the block's
 * own consent screen — opening it here, rather than following it inline,
 * keeps this tab's session alive so the list below still refetches (via the
 * mutation's own cache invalidation) once the person comes back.
 */
export function BlocksPanel() {
  const list = useConsole<MyBlockConnection[]>('/settings/me/blocks');
  const [block, setBlock] = useState('');
  const [error, setError] = useState<string | null>(null);
  const connectMutation = useConsoleMutation<{ url: string }, string>(
    (b) => ({ path: `/settings/me/blocks/${encodeURIComponent(b)}/connect`, method: 'POST' }),
  );
  const disconnectMutation = useConsoleMutation<{ ok: true; disconnected: boolean }, string>(
    (b) => ({ path: `/settings/me/blocks/${encodeURIComponent(b)}`, method: 'DELETE' }),
  );

  async function connect() {
    setError(null);
    try {
      const result = await connectMutation.mutateAsync(block.trim());
      window.open(result.url, '_blank', 'noopener,noreferrer');
      setBlock('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start authorization — try again.');
    }
  }

  async function disconnect(b: string) {
    try {
      // 200 either way — `disconnected: false` means "you were not connected",
      // not a failure — so the toast reads the flag rather than assuming the
      // HTTP status alone means the row it was showing is now gone.
      const result = await disconnectMutation.mutateAsync(b);
      showToast({
        type: result.disconnected ? 'success' : 'error',
        message: result.disconnected ? `Disconnected ${b}.` : `You were not connected to ${b}.`,
      });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not disconnect — try again.' });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Block connections" aside="signed in as yourself, per block" padded={false}>
        <Query query={list}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState
                  icon={<Blocks className="size-5" strokeWidth={2} />}
                  title="Not connected to any block"
                  description="Your calls to a block that supports it go through a team grant until you connect yourself below."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Block</TableHead>
                    <TableHead>Granted scope</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Renews itself</TableHead>
                    <TableHead className="text-right">Disconnect</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.block}>
                      <TableCell><Badge variant="neutral">{c.block}</Badge></TableCell>
                      <TableCell className="max-w-[36ch] truncate font-mono text-[11px] text-ink-faint" title={c.scope}>
                        {c.scope}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {c.expires_at ? <Time value={c.expires_at} /> : <span className="text-ink-faint">—</span>}
                      </TableCell>
                      <TableCell>
                        {c.has_refresh_token ? <Badge variant="sage" dot size="sm">yes</Badge> : <Badge variant="amber" dot size="sm">no</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <InlineDestructive
                          label="Disconnect"
                          question={`Disconnect ${c.block}?`}
                          confirmLabel="Disconnect"
                          pending={disconnectMutation.isPending}
                          onConfirm={() => void disconnect(c.block)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </Query>
      </Panel>

      <FormPanel
        ariaLabel="Connect a block"
        heading="Connect a block"
        onSubmit={connect}
        busy={connectMutation.isPending}
        canSave={block.trim().length > 0}
        saveLabel="Connect"
        error={error}
      >
        <Field label="Block" hint="The block's name as PLATFORMS registers it. Opens that block's own sign-in in a new tab.">
          {(p) => <Input {...p} value={block} onChange={(e) => setBlock(e.target.value)} />}
        </Field>
      </FormPanel>
    </div>
  );
}
