'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { FormPanel } from '@/components/patterns/form-panel';
import { InlineDestructive } from '@/components/settings/inline-destructive';
import {
  Badge, EmptyState, Field, FieldGrid, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { ApiError, useConsole, type MyCredentialRow, type RedactedMarker } from '@/lib/api';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * What a credential row's badge says — pure, and the ONLY thing this file
 * reads off a `RedactedMarker` to build that badge. Exported so
 * `tests/settings.test.tsx` can prove the property that matters directly: fed
 * a marker carrying an unexpected extra field (the shape a future gateway
 * defect might produce — an object nobody meant to leak), this still reads
 * only `.present` and `.length` and the returned label never contains
 * anything else on the object. `variant` picks the same 'sage'/'neutral' the
 * rest of this console already uses for "set"/"not set" (see `SetIndicator`,
 * form-panel.tsx).
 */
export function credentialStatus(marker: RedactedMarker): { label: string; variant: 'sage' | 'neutral' } {
  return marker.present
    ? { label: `set · ${marker.length} chars`, variant: 'sage' }
    : { label: 'not set', variant: 'neutral' };
}

/**
 * Your own personal keys for the building-block platforms — the browser
 * counterpart of `my_credentials` / `set_my_credential` / `delete_my_credential`
 * (server.ts). `api_key` on every row is a `RedactedMarker` from the gateway's
 * `redact()`, never a fragment of the value — this page shows only whether one
 * is set and (once) its byte length, exactly what the marker carries and
 * nothing else. There is no fixed list of platform ids to offer as a picker:
 * the gateway takes any string `set_my_credential` would (see `list_platforms`
 * over MCP for the known ones), so "Platform" is a plain text field here too.
 */
export function CredentialsPanel() {
  const list = useConsole<MyCredentialRow[]>('/settings/me/credentials');
  const [platform, setPlatform] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setMutation = useConsoleMutation<{ platform: string; stored: true; replaced: boolean }, { platform: string; api_key: string }>(
    '/settings/me/credentials',
  );
  const deleteMutation = useConsoleMutation<{ ok: true; deleted: boolean }, string>(
    (p) => ({ path: `/settings/me/credentials/${encodeURIComponent(p)}`, method: 'DELETE' }),
  );

  async function store() {
    setError(null);
    try {
      const result = await setMutation.mutateAsync({ platform: platform.trim(), api_key: apiKey.trim() });
      setPlatform('');
      setApiKey('');
      showToast({
        type: 'success',
        message: result.replaced ? `Replaced your ${result.platform} key.` : `Stored your ${result.platform} key.`,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not store credential — try again.');
    }
  }

  async function remove(p: string) {
    try {
      // The route answers 200 either way — `deleted: false` means "you had none
      // stored", not a failure — so the toast reads the flag rather than the
      // HTTP status alone; a generic success message on `false` would tell
      // someone their key was removed when nothing was ever there to remove.
      const result = await deleteMutation.mutateAsync(p);
      showToast({
        type: result.deleted ? 'success' : 'error',
        message: result.deleted ? `Removed your ${p} key.` : `You had no ${p} key stored.`,
      });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not delete credential — try again.' });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Block credentials" aside="never shown, only confirmed" padded={false}>
        <Query query={list}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState
                  illustration={{ src: '/assets/brand/state-welcome.png', width: 78, height: 96 }}
                  icon={<KeyRound className="size-5" strokeWidth={2} />}
                  title="No personal keys stored"
                  description="A block you have not connected cannot be called. Sign in to it as yourself, or store your own key below — there is no shared team key to fall back on."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead className="text-right">Remove</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.platform}>
                      <TableCell className="font-mono text-xs">{row.platform}</TableCell>
                      <TableCell>
                        {/* NEVER the value — `credentialStatus` above reads only
                            `.present`/`.length` off the marker, never anything else
                            it might carry. See RedactedMarker's own doc comment (api.ts). */}
                        {(() => {
                          const status = credentialStatus(row.api_key);
                          return <Badge variant={status.variant} dot size="sm">{status.label}</Badge>;
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <InlineDestructive
                          label="Remove"
                          question={`Remove your ${row.platform} key?`}
                          confirmLabel="Remove"
                          pending={deleteMutation.isPending}
                          onConfirm={() => void remove(row.platform)}
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
        ariaLabel="Store a block credential"
        heading="Store a key"
        onSubmit={store}
        busy={setMutation.isPending}
        canSave={platform.trim().length > 0 && apiKey.trim().length >= 8}
        saveLabel="Store key"
        error={error}
      >
        <FieldGrid>
          <Field label="Platform" hint="The block's name as PLATFORMS registers it">
            {(p) => <Input {...p} value={platform} onChange={(e) => setPlatform(e.target.value)} />}
          </Field>
          <Field label="API key">
            {(p) => <Input {...p} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />}
          </Field>
        </FieldGrid>
      </FormPanel>
    </div>
  );
}
