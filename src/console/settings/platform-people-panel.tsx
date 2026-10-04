'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { CardBody } from '@/components/ui/card';
import { SettingsCard, SettingsSection } from '@/console/settings/section';
import { Query } from '@/console/query';
import { InlineForm } from '@/console/inline-form';
import { InlineDestructive } from '@/console/settings/inline-destructive';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { When } from '@/console/when';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePaged } from '@/components/ui/pagination';
import { PageControl } from '@/console/paged';
import { toast } from '@/components/ui/toast';
import { ApiError, useConsole } from '@/lib/api';
import { type PlatformPersonRow } from '@/lib/api-shapes';
import { useConsoleMutation } from '@/lib/mutate';

/** The link, shown once, the same shape as a freshly issued token.
 *
 * Only the token's hash is stored, so this is the only moment it exists in a readable form; a
 * person who closes this without copying it asks for another. Modelled on `IssuedTokenBanner`, so
 * two secrets that behave the same way look the same way. */
function IssuedEnrolmentBanner({ email, url, onDismiss }: { email: string; url: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ tone: 'critical', title: 'Could not copy — select and copy the link by hand.' });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-warning bg-warning-tint p-4">
      <p className="text-sm font-medium text-warning-ink">
        Enrolment link for {email} — shown once, send it now
      </p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-sm bg-surface px-3 py-2 font-mono text-xs">
          {url}
        </code>
        <Button type="button" size="sm" variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="text-xs text-warning-ink">
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

/**
 * Every principal on the platform — a superadmin's roster, add a person, and
 * deactivate one. The browser counterpart of `person_list` / `person_add` / `person_deactivate`
 * (admin.ts), reached through `/api/console/settings/platform/people` rather than `/manage/mcp`
 * directly, the same relationship `TeamMembersPanel` has to `member_add` / `member_remove`.
 *
 * Enrolment is how a person gets a door at all. Adding a principal does not let anyone in: the
 * console's only door is a passkey, and a passkey attaches to an account through a one-time link a
 * superadmin mints here. An authenticator asserts possession of a key, never an identity, so a
 * registration that could name its own account would be open self-registration. The link is shown
 * once, for the same reason a freshly issued token is.
 *
 * The success toast is the gateway's own sentence: deactivating revokes every live token, and
 * adding the person back later brings none of them back.
 */
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
  // inline Cancel/Deactivate swap below is the confirmation.
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
      toast({ tone: 'critical', title: err instanceof ApiError ? err.message : 'Could not issue a link — try again.' });
    }
  }

  async function add() {
    setError(null);
    try {
      const result = await addMutation.mutateAsync({ email: email.trim(), display_name: displayName.trim() });
      setEmail('');
      setDisplayName('');
      toast({ tone: 'positive', title: result.result });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add person — try again.');
    }
  }

  async function deactivate(target: string) {
    try {
      const result = await deactivateMutation.mutateAsync(target);
      // The gateway's full sentence: what this does not undo matters as much as what it does, so
      // it goes in the toast rather than a generic "deactivated".
      toast({ tone: 'positive', title: result.result });
    } catch (err) {
      toast({ tone: 'critical', title: err instanceof ApiError ? err.message : 'Could not deactivate — try again.' });
    }
  }

  return (
    <SettingsSection
      title="People"
      description={`Everyone on this deployment${list.data ? `, ${list.data.length} in all` : ''}. Every change here is logged with who made it, from this console.`}
    >
      {issued ? (
        <IssuedEnrolmentBanner email={issued.email} url={issued.url} onDismiss={() => setIssued(null)} />
      ) : null}

      <SettingsCard>
        <CardBody flush>
          <Query query={list}>
            {(rows) =>
              rows.length === 0 ? (
                <div className="px-5 py-8">
                  <EmptyState title="Nobody yet">Add the first person below.</EmptyState>
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
          <InlineForm ariaLabel="Add a person" onSubmit={add} busy={addMutation.isPending} canSave={email.trim().length > 0} saveLabel="Add person" error={error}>
            <Field label="Email">
              {(p) => <Input {...p} type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            <Field label="Display name" optional>
              {(p) => <Input {...p} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
            </Field>
          </InlineForm>
        </CardBody>
      </SettingsCard>
    </SettingsSection>
  );
}

/** Its own component so it can hold the page state — the rows come from a `Query` render prop.
 *
 * Four columns: who (with their name and teams
 * beneath), what they are (role over status), when, and what can be done. */
function PeopleTable({ rows, enrolling, deactivating, onEnrol, onDeactivate }: {
  rows: PlatformPersonRow[];
  enrolling: boolean;
  deactivating: boolean;
  onEnrol: (email: string) => void;
  onDeactivate: (email: string) => void;
}) {
  const { rows: page, ...pager } = usePaged(rows);
  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Person</TableHeader>
            <TableHeader hideBelow="md">Role</TableHeader>
            <TableHeader hideBelow="md">Created</TableHeader>
            <TableHeader>Actions</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {page.map((p) => (
            <TableRow key={p.email}>
              <TableCell>
                <span className="break-all font-mono text-xs font-medium text-ink">{p.email}</span>
                {p.display_name ? <span className="block text-xs text-ink-3">{p.display_name}</span> : null}
                <span className="block break-words text-xs text-ink-2">
                  {p.teams.length
                    ? p.teams.map((t) => `${t.team} (${t.role})`).join(', ')
                    : <span className="text-ink-3">no team</span>}
                </span>
                {/* On a phone the Role column is dropped to fit, and the role travels with the
                    person instead. */}
                <span className="mt-1 flex gap-1 md:hidden">
                  <Badge tone={p.role === 'superadmin' ? 'accent' : 'neutral'} dot>{p.role}</Badge>
                </span>
              </TableCell>
              <TableCell hideBelow="md">
                <span className="inline-flex flex-col items-start gap-1">
                  <Badge tone={p.role === 'superadmin' ? 'accent' : 'neutral'} dot>{p.role}</Badge>
                  <Badge tone={p.status === 'active' ? 'positive' : 'neutral'} dot>{p.status}</Badge>
                </span>
              </TableCell>
              <TableCell hideBelow="md" className="whitespace-nowrap font-mono text-xs"><When at={p.created_at} /></TableCell>
              <TableCell>
                {p.status === 'active' ? (
                  <span className="inline-flex flex-wrap items-center justify-end gap-1">
                    <Button
                      type="button" size="sm" variant="ghost" icon={<KeyRound />}
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
                  <span className="text-xs text-ink-3">deactivated</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...pager} />
    </>
  );
}
