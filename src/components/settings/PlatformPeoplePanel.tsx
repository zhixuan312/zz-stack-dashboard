'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound, UserPlus } from 'lucide-react';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { FormPanel } from '@/components/patterns/form-panel';
import { InlineDestructive } from '@/components/settings/inline-destructive';
import {
  Badge, Button, EmptyState, Field, FieldGrid, Input, PageControl, Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, Time, usePaged,
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
        <code className="min-w-0 flex-1 break-all rounded-[var(--r-sm)] bg-surface px-3 py-2 font-mono text-xs">
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
    <>
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
              <PeopleTable
                rows={rows}
                enrolling={enrolMutation.isPending}
                deactivating={deactivateMutation.isPending}
                onEnrol={(email) => void enrol(email)}
                onDeactivate={(email) => void deactivate(email)}
              />
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
    </>
  );
}

/** ITS OWN COMPONENT so it can hold the page state — the rows come from a `Query` render prop.
 *
 * FOUR COLUMNS, sized to the reading column Settings sits in: who (with their name and teams
 * beneath), what they are (role over status), when, and what can be done. Seven columns side
 * by side did not fit that width without scrolling. */
function PeopleTable({ rows, enrolling, deactivating, onEnrol, onDeactivate }: {
  rows: PlatformPersonRow[];
  enrolling: boolean;
  deactivating: boolean;
  onEnrol: (email: string) => void;
  onDeactivate: (email: string) => void;
}) {
  const { page, controls } = usePaged(rows);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Role</TableHead>
            <TableHead hideBelow="md">Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((p) => (
            <TableRow key={p.email}>
              <TableCell>
                <span className="break-all font-mono text-xs font-medium text-ink">{p.email}</span>
                {p.display_name ? <span className="block text-xs text-ink-faint">{p.display_name}</span> : null}
                <span className="block break-words text-xs text-ink-soft">
                  {p.teams.length
                    ? p.teams.map((t) => `${t.team} (${t.role})`).join(', ')
                    : <span className="text-ink-faint">no team</span>}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex flex-col items-start gap-1">
                  <Badge variant={p.role === 'superadmin' ? 'accent' : 'neutral'} dot size="sm">{p.role}</Badge>
                  <Badge variant={p.status === 'active' ? 'sage' : 'neutral'} dot size="sm">{p.status}</Badge>
                </span>
              </TableCell>
              <TableCell hideBelow="md" className="whitespace-nowrap font-mono text-xs"><Time value={p.created_at} /></TableCell>
              <TableCell>
                {p.status === 'active' ? (
                  <span className="flex flex-wrap items-center justify-end gap-1">
                    <Button
                      type="button" size="sm" variant="ghost" leftIcon={<KeyRound />}
                      disabled={enrolling}
                      onClick={() => onEnrol(p.email)}
                    >
                      Enrolment link
                    </Button>
                    <InlineDestructive
                      label="Deactivate"
                      question={`Deactivate ${p.email}? Their block keys stay live elsewhere.`}
                      confirmLabel="Deactivate"
                      pending={deactivating}
                      onConfirm={() => onDeactivate(p.email)}
                    />
                  </span>
                ) : (
                  <span className="text-xs text-ink-faint">deactivated</span>
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
