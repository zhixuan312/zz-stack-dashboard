'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, KeyRound, LogIn, UserRound, UserX } from 'lucide-react';
import { useShareView } from '@/components/base/use-share-view';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, useQueryState, useSearchDraft, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Records } from '@/components/templates/records';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { aligned } from '@/console/columns';
import { failureOf } from '@/console/query';
import { InlineDestructive } from '@/console/settings/inline-destructive';
import { ApiError, useDataClock } from '@/lib/api';
import type { People, PersonRow } from '@/lib/fleet-shapes';
import { plural } from '@/lib/format';
import { formatDateTime, formatRelative } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { useConsoleMutation } from '@/lib/mutate';
import { useServed } from '@/views/use-served';
import { pendingContext } from '@/views/context';
import { NO_SIGN_IN, TILES, peopleContext, peopleTrouble, signInsValue, type PeopleRead } from '@/views/people-context';
import { PEOPLE_DEFAULTS, PERSON_STATES, narrowed, peoplePath, type PeopleFilters } from '@/views/people-filter';

type Done = { ok: true; result: string };
const reasonOf = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/** A person's name, or their address when they have none: the page names a person as Settings did. */
const shownName = (p: PersonRow) => p.name || p.email;

/** When a person last signed in, against the read's own cutoff, or that the record holds none: never a guessed date. */
function LastSignIn({ at, asOf }: { at: string | null; asOf: string }) {
  if (!at) return <span className="text-ink-3">{NO_SIGN_IN}</span>;
  return <time dateTime={at} title={formatDateTime(at)}>{formatRelative(at, new Date(asOf))}</time>;
}

const roleBadge = (p: PersonRow) => (p.role === 'superadmin' ? <Badge tone="accent">Superadmin</Badge> : <Badge tone="neutral">Member</Badge>);
const stateBadge = (p: PersonRow) => (p.state === 'active' ? <Badge tone="positive" dot>Active</Badge> : <Badge tone="warning" dot>Deactivated</Badge>);
const passkeys = (n: number) => (n ? `${formatCount(n)} ${plural(n, 'passkey')}` : 'No passkey');

/**
 * The link, shown once. Only its hash is stored, so this is the one moment it can be read: a person who closes this
 * without copying it asks for another. Drawn in a dialog, which is portalled outside the page's scroll region, and
 * marked `data-assistant="omit"` besides, so the page text an Ask sends never carries it (bug ee35a0d7).
 */
function IssuedLink({ issued, onDismiss }: { issued: { email: string; url: string } | null; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ tone: 'critical', title: 'Could not copy; select the link and copy it by hand.' });
    }
  }
  return (
    <Dialog open={issued !== null} onOpenChange={(open) => { if (!open) onDismiss(); }}>
      {issued ? (
        <DialogContent
          title={`Enrolment link for ${issued.email}`}
          description="Shown once. Send it now."
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          footer={<Button type="button" onClick={onDismiss}>I&apos;ve sent it</Button>}
        >
          <div data-assistant="omit" className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 rounded-sm bg-surface px-3 py-2 font-mono text-xs [overflow-wrap:anywhere]">{issued.url}</code>
              <Button type="button" size="sm" variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="t-small text-warning-ink">
              Usable once, and good for seven days. They open it on the device whose passkey they want to use; the part
              after the # is the whole secret, so send the link whole.
            </p>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/**
 * A person's two acts, in their row: an enrolment link, shown once, and Deactivate behind its confirmation. The
 * console's existing platform routes, as Settings called them; a refusal is said beside the buttons, in the row it was
 * pressed in, and the gateway's sentence is the toast, because what deactivating does not undo matters.
 */
function Acts({ p }: { p: PersonRow }) {
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; url: string } | null>(null);
  const enrol = useConsoleMutation<Done & { url: string }, string>((email) => ({ path: '/settings/platform/enrolments', method: 'POST', body: { email } }));
  // `confirm` is the address the row already shows: the inline Cancel and Deactivate swap is the confirmation.
  const deactivate = useConsoleMutation<Done, string>((email) => ({ path: '/settings/platform/people', method: 'DELETE', body: { email, confirm: email } }));

  async function link() {
    setError(null);
    try {
      const done = await enrol.mutateAsync(p.email);
      setIssued({ email: p.email, url: done.url });
    } catch (err) {
      setError(reasonOf(err, 'No link was issued; try again.'));
    }
  }
  async function confirm() {
    setError(null);
    try {
      const done = await deactivate.mutateAsync(p.email);
      toast({ tone: 'positive', title: done.result });
    } catch (err) {
      setError(reasonOf(err, 'Not deactivated; try again.'));
    }
  }
  if (p.state !== 'active') return null;
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      {error ? <span role="alert" className="t-small text-critical-ink">{error}</span> : null}
      <Button type="button" size="sm" variant="ghost" icon={<KeyRound />} busy={enrol.isPending} onClick={() => void link()}>Enrolment link</Button>
      <InlineDestructive label="Deactivate" question={`Deactivate ${shownName(p)}? Their live tokens are revoked.`} confirmLabel="Deactivate" pending={deactivate.isPending} onConfirm={() => void confirm()} />
      <IssuedLink issued={issued} onDismiss={() => setIssued(null)} />
    </span>
  );
}

/** The table's columns, in the gateway's order: by the day a person was added, filtered and paged where it is read. */
const columnsAt = (asOf: string): Column<PersonRow>[] => aligned([
  {
    key: 'person', header: 'Person', grow: true, mobile: 'title', title: (p) => (p.name ? `${p.name}, ${p.email}` : p.email),
    cell: (p) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium text-ink" title={shownName(p)}>{shownName(p)}</span>
        {p.name ? <span className="t-caption block truncate" title={p.email}>{p.email}</span> : null}
      </span>
    ),
    mobileCell: (p) => <span className="inline-flex min-w-0 items-center gap-2"><span className="truncate" title={shownName(p)}>{shownName(p)}</span>{p.role === 'superadmin' ? roleBadge(p) : null}</span>,
  },
  { key: 'role', header: 'Role', hideBelow: 'md', cell: roleBadge },
  {
    key: 'teams', header: 'Teams', hideBelow: 'lg',
    cell: (p) => (p.teams.length ? <span className="whitespace-normal [overflow-wrap:anywhere]">{p.teams.join(', ')}</span> : <span className="text-ink-3">None</span>),
  },
  { key: 'passkeys', header: 'Passkey', numeric: true, mobile: 'fact', cell: (p) => (p.passkeys ? formatCount(p.passkeys) : <span className="text-ink-3">None</span>), mobileCell: (p) => passkeys(p.passkeys) },
  { key: 'signIn', header: 'Last sign-in', numeric: true, mobile: 'fact', cell: (p) => <LastSignIn at={p.lastSignIn} asOf={asOf} />, mobileCell: (p) => (p.lastSignIn ? <>Signed in <LastSignIn at={p.lastSignIn} asOf={asOf} /></> : NO_SIGN_IN) },
  { key: 'state', header: 'State', mobile: 'fact', cell: stateBadge, mobileCell: (p) => (p.state === 'active' ? 'Active' : 'Deactivated') },
  // The row's acts keep their place on a phone, at the end of the card's first line.
  { key: 'acts', header: <span className="sr-only">Actions</span>, mobile: 'status', cell: (p) => <Acts p={p} /> },
]);

const STATE_OPTIONS = [{ value: 'all', label: 'All' }, ...PERSON_STATES.map((s) => ({ value: s, label: s === 'active' ? 'Active' : 'Deactivated' }))];

/**
 * The page's read: the one the console's server made for this address, so the first paint carries the rows and the
 * browser asks for nothing more, then the browser's own once a change, a write or a Retry asks for it. A failure is
 * stated only when there is nothing to draw: the browser's, or the server's while the browser has not read.
 */
function usePeople(served: PeopleRead | null, filters: PeopleFilters) {
  const path = peoplePath(filters);
  const mine = served?.path === path ? served : null;
  const { q, follow } = useServed<People>(path, mine !== null, mine === null && served !== null);
  const data = q.data ?? (mine?.state === 'ok' ? mine.data : undefined);
  const failed = failureOf(q);
  const trouble = data ? null : failed ?? (mine && mine.state !== 'ok' && !q.isFetching ? peopleTrouble(mine) : null);
  const retry = () => (q.data !== undefined || q.error ? void q.refetch() : follow());
  return { data, trouble, retry, updatedAt: q.data ? new Date(q.dataUpdatedAt) : data ? data.meta.asOf : null };
}

/**
 * Everybody the platform knows, drawn from the release's Records template: four tiles over everybody, then the people,
 * ten to a page, filtered and paged by the gateway, each with their two acts. The first page the address names is read
 * on the console's server and handed here; every other read, and the people collection's live updates, are the browser's.
 */
export function PlatformPeopleView({ served }: { served: PeopleRead }) {
  useLive(['people']);
  const [f, set] = useQueryState(PEOPLE_DEFAULTS);
  const [draft, setDraft] = useSearchDraft(f.q, (q) => set({ q, page: '1' }));
  const filters = useMemo(() => ({ q: f.q, state: f.state, page: f.page }), [f.q, f.state, f.page]);
  const { data, trouble, retry, updatedAt } = usePeople(served, filters);
  const now = useDataClock();
  const asOf = data?.meta.asOf;
  const columns = useMemo(() => columnsAt(asOf ?? ''), [asOf]);
  useShareView(data
    ? peopleContext(data, { filters, updatedAt, now })
    : pendingContext({ view: 'people', title: 'People', address: '/platform/people', scope: 'everybody the platform knows' }, trouble));
  const narrow = narrowed(filters);
  const clear = () => set({ q: '', state: 'all', page: '1' });
  // `…` is coming and `—` is not: a read that failed never reads as one still on its way.
  const mark = trouble ? '—' : '…';
  const tiles = data?.tiles;

  return (
    <Records
      summary={
        <>
          <MetricTile label={TILES.people.label} hint={TILES.people.definition} icon={<UserRound />} value={tiles ? tiles.people : mark} />
          <MetricTile label={TILES.withPasskey.label} hint={TILES.withPasskey.definition} icon={<KeyRound />} value={tiles ? tiles.withPasskey : mark} />
          <MetricTile label={TILES.neverSignedIn.label} hint={TILES.neverSignedIn.definition} icon={<UserX />} value={tiles ? tiles.neverSignedIn : mark} />
          <MetricTile label={TILES.signInsLastWeek.label} hint={TILES.signInsLastWeek.definition} icon={<LogIn />} value={tiles ? signInsValue(tiles.signInsLastWeek) : mark} />
        </>
      }
    >
      <div data-protagonist="People" className="contents">
        <DataTable
          caption="People"
          noun="people"
          rows={data?.people ?? []}
          columns={columns}
          rowKey={(p) => p.email}
          manual
          total={data?.total ?? 0}
          pageSize={10}
          pageSizes={[10]}
          loading={!data && !trouble}
          error={trouble ?? undefined}
          onRetry={retry}
          state={{ sort: '', dir: 'desc', page: f.page }}
          onStateChange={(p) => { if (p.page) set({ page: p.page }); }}
          filtered={narrow}
          onClearFilters={clear}
          empty={{ title: 'Nobody yet', body: 'Add the first person with Add a person, above.' }}
          toolbar={
            <FilterBar
              search={{ value: draft, onChange: setDraft, placeholder: 'Search people' }}
              filters={[{ key: 'state', label: 'State', value: f.state, onChange: (v) => set({ state: v, page: '1' }), options: STATE_OPTIONS }]}
              result={data ? `${formatCount(data.total)} ${plural(data.total, 'person', 'people')}` : mark}
              ask={<AskAbout question={narrow ? 'Who are the people in this list, and what state is each in?' : 'Who has never signed in, and how many people signed in last week?'} />}
              onClear={clear}
            />
          }
        />
      </div>
    </Records>
  );
}

/** The masthead's as-of line: the cutoff of the read the table draws, nothing while there is none. */
export function PeopleAsOf({ served }: { served: PeopleRead }) {
  const [f] = useQueryState(PEOPLE_DEFAULTS);
  const { data } = usePeople(served, { q: f.q, state: f.state, page: f.page });
  return data ? <span className="t-small text-ink-3">As of {formatDateTime(data.meta.asOf)}</span> : null;
}

/**
 * Add a person, the masthead's one action: the console's existing platform route, as Settings called it. Adding a
 * person lets nobody in: the console's only door is a passkey, which attaches through an enrolment link issued in the
 * person's row. The gateway's refusal is said under the fields, and the dialog stays open with what was typed.
 */
export function AddPerson() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = useConsoleMutation<Done, { email: string; display_name: string }>('/settings/platform/people');
  const ready = email.trim().length > 0;

  async function submit() {
    setError(null);
    try {
      const done = await add.mutateAsync({ email: email.trim(), display_name: name.trim() });
      setOpen(false);
      setEmail('');
      setName('');
      toast({ tone: 'positive', title: done.result });
    } catch (err) {
      setError(reasonOf(err, 'The person was not added; try again.'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null); }}>
      <Button variant="primary" aria-haspopup="dialog" onClick={() => setOpen(true)}>Add a person</Button>
      <DialogContent
        size="sm"
        title="Add a person"
        description="Adding a person lets nobody in yet: issue them an enrolment link from their row, and they register a passkey with it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" busy={add.isPending} disabled={!ready} onClick={() => void submit()}>Add person</Button>
          </>
        }
      >
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (ready) void submit(); }}>
          <Field label="Email">
            {(p) => <Input {...p} type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Display name" optional>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          {error ? <p role="alert" className="t-small text-critical-ink">{error}</p> : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
