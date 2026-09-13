'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound, UserPlus } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { FormPanel } from '@/components/patterns/form-panel';
import { InlineDestructive } from '@/components/settings/inline-destructive';
import {
  Badge, Button, EmptyState, Field, FieldGrid, Input, Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, Time,
} from '@/components/ui';
import { showToast } from '@/components/ui/toast';
import { ApiError, useConsole, type PlatformPersonRow } from '@/lib/api';
import { useConsoleMutation } from '@/lib/mutate';

/**
 * Every principal on the platform (← Task I-15, AC-5) — a superadmin's roster, add a
 * person, and deactivate one. The browser counterpart of `list_people` / `add_person` /
 * `deactivate_person` (admin.ts), reached through `/api/console/settings/platform/people`
 * rather than `/admin/mcp` directly, the same relationship `TeamMembersPanel` has to
 * `add_member` / `remove_member`.
 *
 * ENROLMENT IS HOW A PERSON GETS A DOOR AT ALL. Adding a principal does not let anyone in:
 * the console's only door is a passkey, and a passkey attaches to an account through a
 * one-time link a superadmin mints here. That is the point of the design rather than an extra
 * step — an authenticator asserts possession of a key, never an identity, so a registration
 * that could name its own account would be open self-registration. The link is shown once,
 * for the same reason a freshly issued token is.
 *
 * DEACTIVATION'S OWN BLIND SPOT, SAID HERE. `deactivate_person`'s own comment (admin.ts)
 * is what the confirm question and the success toast both repeat: deactivating stops
 * sign-in and does NOTHING about any building-block key stored under that address — those
 * stay live at the block's own service until someone runs `admin_delete_credential` for it.
 * Hiding that here would let a superadmin believe deactivating someone finished the job.
 */
/** The link, shown once, the same shape as a freshly issued token.
 *
 * Only the token's hash is stored, so this is the only moment it exists in a readable form —
 * a person who closes this without copying it asks for another, which is a click and not a
 * problem. Modelled on `IssuedTokenBanner` deliberately: two secrets that behave the same way
 * should look the same way, so nobody has to learn twice that "shown once" is literal. */
function IssuedEnrolmentBanner({ email, url, onDismiss }: { email: string; url: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast({ type: 'error', message: 'Could not copy — select and copy the link by hand.' });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--r)] border border-[var(--amber)] bg-[var(--amber-tint)] p-4">
      <p className="text-sm font-medium text-[var(--amber-text)]">
        Enrolment link for {email} — shown once, send it now
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-[var(--r-sm)] bg-surface px-3 py-2 font-mono text-xs">
          {url}
        </code>
        <Button type="button" size="sm" variant="secondary" leftIcon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="text-xs text-[var(--amber-text)]">
        Usable once, and good for seven days. They should open it on the device whose passkey
        they want to use — the part after the <code>#</code> is the whole secret, so send the
        link whole.
      </p>
      <Button type="button" size="sm" variant="ghost" className="self-start" onClick={onDismiss}>
        I&rsquo;ve sent it
      </Button>
    </div>
  );
}

export function PlatformPeoplePanel() {
  const list = useConsole<PlatformPersonRow[]>('/settings/platform/people');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; url: string } | null>(null);

  const addMutation = useConsoleMutation<{ ok: true; result: string }, { email: string; display_name: string }>(
    '/settings/platform/people',
  );
  // `confirm` is the email this row already shows, not something the person types — the
  // inline Cancel/Deactivate swap below IS the confirmation (NFR-4).
  const deactivateMutation = useConsoleMutation<{ ok: true; result: string }, string>(
    (target) => ({ path: '/settings/platform/people', method: 'DELETE', body: { email: target, confirm: target } }),
  );

  const enrolMutation = useConsoleMutation<{ ok: true; url: string; result: string }, string>(
    (target) => ({ path: '/settings/platform/enrolments', method: 'POST', body: { email: target } }),
  );

  async function enrol(target: string) {
    try {
      const result = await enrolMutation.mutateAsync(target);
      setIssued({ email: target, url: result.url });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not issue a link — try again.' });
    }
  }

  async function add() {
    setError(null);
    try {
      const result = await addMutation.mutateAsync({ email: email.trim(), display_name: displayName.trim() });
      setEmail('');
      setDisplayName('');
      showToast({ type: 'success', message: result.result });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add person — try again.');
    }
  }

  async function deactivate(target: string) {
    try {
      const result = await deactivateMutation.mutateAsync(target);
      // The full sentence from `deactivate_person`'s own comment (admin.ts) — what this
      // does NOT do matters as much as what it does, so it goes in the toast rather than a
      // generic "deactivated".
      showToast({ type: 'success', message: result.result });
    } catch (err) {
      showToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not deactivate — try again.' });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {issued ? (
        <IssuedEnrolmentBanner email={issued.email} url={issued.url} onDismiss={() => setIssued(null)} />
      ) : null}

      <Panel title="People" aside={list.data ? `${list.data.length} principals` : undefined} padded={false}>
        <Query query={list}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState
                  illustration={{ src: '/assets/brand/state-welcome.png', width: 78, height: 96 }}
                  icon={<UserPlus className="size-5" strokeWidth={2} />}
                  title="No principals yet"
                  description="Add the first person below."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Passkey</TableHead>
                    <TableHead className="text-right">Deactivate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.email}>
                      <TableCell>
                        <span className="font-mono text-xs font-medium text-ink">{p.email}</span>
                        {p.display_name ? <span className="block text-xs text-ink-faint">{p.display_name}</span> : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.role === 'superadmin' ? 'accent' : 'neutral'} dot size="sm">{p.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'active' ? 'sage' : 'neutral'} dot size="sm">{p.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[30ch] text-xs">
                        {p.teams.length
                          ? p.teams.map((t) => `${t.team} (${t.role})`).join(', ')
                          : <span className="text-ink-faint">none</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs"><Time value={p.created_at} /></TableCell>
                      <TableCell className="text-right">
                        {p.status === 'active' ? (
                          <Button
                            type="button" size="sm" variant="ghost" leftIcon={<KeyRound />}
                            disabled={enrolMutation.isPending}
                            onClick={() => void enrol(p.email)}
                          >
                            Enrolment link
                          </Button>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.status === 'active' ? (
                          <InlineDestructive
                            label="Deactivate"
                            question={`Deactivate ${p.email}? Their block keys stay live elsewhere.`}
                            confirmLabel="Deactivate"
                            pending={deactivateMutation.isPending}
                            onConfirm={() => void deactivate(p.email)}
                          />
                        ) : (
                          <span className="text-xs text-ink-faint">deactivated</span>
                        )}
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
        ariaLabel="Add a person"
        heading="Add a person"
        onSubmit={add}
        busy={addMutation.isPending}
        canSave={email.trim().length > 0}
        saveLabel="Add"
        error={error}
      >
        <FieldGrid>
          <Field label="Email">
            {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Display name" hint="optional">
            {(p) => <Input {...p} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
          </Field>
        </FieldGrid>
      </FormPanel>
    </div>
  );
}
