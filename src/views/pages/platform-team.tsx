'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, ListTree, RotateCw, Signature, Users } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { Busy, TilesSkeleton } from '@/components/patterns/page-loading';
import { useShareView } from '@/components/base/use-share-view';
import { ColumnChart } from '@/components/charts/column-chart';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { KeyValue } from '@/components/ui/key-value';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { aligned } from '@/console/columns';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { InlineDestructive } from '@/console/settings/inline-destructive';
import type { Revised } from '@/data/gateway';
import { ApiError, useDataClock } from '@/lib/api';
import type { TeamDetail } from '@/lib/fleet-shapes';
import { plural } from '@/lib/format';
import { formatDate, formatDateTime, formatDay, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { useConsoleMutation } from '@/lib/mutate';
import { useServed } from '@/views/use-served';
import { pendingContext } from '@/views/context';
import { TEAM_TILES, callsUnavailable, teamContext, teamTrouble, type TeamRead } from '@/views/team-context';

type Member = TeamDetail['members'][number];
type Done = { ok: true; result: string };
const reasonOf = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/**
 * The page's read: the one the console's server made, so the first paint carries the team and the browser asks for
 * nothing more, then the browser's own once a write, a change anywhere to teams or a Retry asks for it. A slug no team
 * has is the read answering, not failing.
 */
function useTeam(slug: string, served: TeamRead) {
  const { q, follow } = useServed<TeamDetail>(`/teams/${slug}`, true);
  const data = q.data ?? (served.state === 'ok' ? served.data : undefined);
  const failed = failureOf(q);
  // With no team to draw there is always a reason: the browser's answer when it has one, the server's until then.
  const trouble: Exclude<TeamRead, { state: 'ok' }> | null = data ? null
    : q.error?.status === 404 ? { state: 'missing' }
      : failed ? { state: 'failed', reason: failed }
        : served.state === 'ok' || q.isFetching ? null : served;
  const retry = () => (q.data !== undefined || q.error ? void q.refetch() : follow());
  return { data, trouble, retry, updatedAt: q.data ? new Date(q.dataUpdatedAt) : data ? data.meta.asOf : null };
}

/**
 * One team, for the superadmin: its four tiles, its real-work calls by week, the team itself with Archive, and its
 * members with add and remove. Read on the console's server and handed here; the team's later reads, after a write or a
 * change anywhere to the teams collection, are the browser's. Every write is the console's existing settings route,
 * and its refusal is said beside the control that made it.
 */
export function PlatformTeamView({ slug, served }: { slug: string; served: Revised<TeamRead> }) {
  useLive(['teams'], served.revisions);
  const { data, trouble, retry, updatedAt } = useTeam(slug, served);
  const now = useDataClock();
  useShareView(data
    ? teamContext(slug, { team: data, updatedAt, now })
    : pendingContext({ view: 'team', title: `Team ${slug}`, address: `/platform/teams/${slug}`, scope: 'one team' }, trouble ? teamTrouble(slug, trouble).detail : null));

  if (!data) return trouble ? <TeamTrouble slug={slug} trouble={trouble} onRetry={retry} /> : <Busy name="team"><TilesSkeleton count={4} /></Busy>;
  const { tiles } = data;
  const admins = data.members.filter((m) => m.role === 'admin').length;
  return (
    <>
      <Row split="tiles">
        <MetricTile label={TEAM_TILES.people.label} hint={TEAM_TILES.people.definition} icon={<Users />} value={tiles.people} note={`${admins} ${plural(admins, 'admin')}`} />
        <MetricTile label={TEAM_TILES.openWork.label} hint={TEAM_TILES.openWork.definition} icon={<ListTree />} value={tiles.openWork} />
        <MetricTile label={TEAM_TILES.waiting.label} hint={TEAM_TILES.waiting.definition} icon={<Signature />} value={tiles.waiting} emphasis={tiles.waiting > 0} />
        <MetricTile label={TEAM_TILES.lessons.label} hint={TEAM_TILES.lessons.definition} icon={<BookOpen />} value={tiles.lessons} />
      </Row>
      <Row split="2/3">
        <div data-protagonist="Calls by week" className="flex min-w-0 flex-col [&>*]:flex-1">
          <CallsByWeek slug={slug} team={data} />
        </div>
        <ThisTeam team={data} />
      </Row>
      <Members slug={slug} team={data} />
    </>
  );
}

function TeamTrouble({ slug, trouble, onRetry }: { slug: string; trouble: Exclude<TeamRead, { state: 'ok' }>; onRetry: () => void }) {
  const { title, detail } = teamTrouble(slug, trouble);
  return (
    <Card>
      {trouble.state === 'missing' ? (
        <EmptyState kind="filtered" title={title} className="py-16" action={<Button size="sm" asChild><Link href="/platform/teams">All teams</Link></Button>}>{detail}</EmptyState>
      ) : (
        <EmptyState kind="error" title={title} className="py-16" action={<Button variant="primary" icon={<RotateCw />} onClick={onRetry}>Retry</Button>}>{detail}</EmptyState>
      )}
    </Card>
  );
}

/** The team's real-work calls, a column a Monday week, the running week drawn unfinished. */
function CallsByWeek({ slug, team }: { slug: string; team: TeamDetail }) {
  const weeks = team.calls;
  const running = weeks.length > 0 && !weeks.at(-1)!.window.complete;
  const last = weeks.filter((w) => w.window.complete).at(-1);
  const question = last
    ? `How did ${slug}'s real-work calls move week by week, up to the week of ${formatDay(last.window.from)}?`
    : `Why does ${slug} have no complete week of real-work calls yet?`;
  let body;
  if (callsUnavailable(team)) body = <EmptyState kind="error" title="The calls by week could not be read" className="py-10">The team, its tiles and its members are read; its calls are not.</EmptyState>;
  else if (!weeks.length) body = <EmptyState kind="first-run" title="No week recorded yet" className="py-10">A week is drawn once the platform&apos;s record of calls reaches it.</EmptyState>;
  else {
    body = (
      <ColumnChart
        label={`${slug}'s real-work calls by week`}
        columns={weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), value: w.figure.why === null ? w.figure.value : null }))}
        running={running}
        highlight={last?.window.from}
        format={formatCount}
        height={200}
      />
    );
  }
  return (
    <Panel title="Calls by week" description="Real-work tool calls, a Monday week each; the last week is still running." actions={<AskAbout question={question} />}>
      {body}
    </Panel>
  );
}

/** The team itself, and Archive, which the console's existing platform route makes. An archived team offers none. */
function ThisTeam({ team }: { team: TeamDetail }) {
  const [error, setError] = useState<string | null>(null);
  const archive = useConsoleMutation<Done, string>((slug) => ({ path: '/settings/platform/teams', method: 'DELETE', body: { team: slug, confirm: slug } }));
  async function confirm(slug: string) {
    setError(null);
    try {
      toast({ tone: 'positive', title: (await archive.mutateAsync(slug)).result });
    } catch (err) {
      setError(reasonOf(err, 'The team was not archived; try again.'));
    }
  }
  const t = team.team;
  return (
    <Panel title="This team" description={`As of ${formatDateTime(team.meta.asOf)}`}>
      <KeyValue items={[
        { label: 'Name', value: t.name },
        { label: 'Status', value: <Badge tone={t.status === 'active' ? 'neutral' : 'warning'} dot>{t.status === 'active' ? 'Active' : 'Archived'}</Badge> },
        { label: 'Created', value: formatDate(t.created) },
      ]} />
      {t.status === 'active' ? (
        <div className="mt-4 flex flex-col items-start gap-2">
          <InlineDestructive size="md" trigger="secondary" label="Archive" question={`Archive ${t.slug}? Its members lose it from their access.`} confirmLabel="Archive" pending={archive.isPending} onConfirm={() => void confirm(t.slug)} />
          {error ? <p role="alert" className="t-small text-critical-ink">{error}</p> : null}
        </div>
      ) : <p className="t-small mt-4 text-ink-3">Archived teams stay readable. Creating the same slug again restores it.</p>}
    </Panel>
  );
}

/** Remove, in a member's row: the refusal is said beside the button, in the row it was pressed in. */
function Remove({ slug, m }: { slug: string; m: Member }) {
  const [error, setError] = useState<string | null>(null);
  const remove = useConsoleMutation<Done, string>((email) => ({ path: '/settings/team/members', method: 'DELETE', body: { team: slug, email, confirm: slug } }));
  async function confirm() {
    setError(null);
    try {
      await remove.mutateAsync(m.email);
      toast({ tone: 'positive', title: `Removed ${m.email} from ${slug}.` });
    } catch (err) {
      setError(reasonOf(err, 'Not removed; try again.'));
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {error ? <span role="alert" className="t-small text-critical-ink">{error}</span> : null}
      <InlineDestructive label="Remove" question={`Remove ${m.email} from ${slug}?`} confirmLabel="Remove" pending={remove.isPending} onConfirm={() => void confirm()} />
    </span>
  );
}

const ROLES = [{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }];

/** Add a member, above the members: the email and the role, and the gateway's refusal under them. */
function AddMember({ slug }: { slug: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState<string | null>(null);
  const add = useConsoleMutation<Done, { email: string; role: string }>((v) => ({ path: '/settings/team/members', method: 'POST', body: { team: slug, email: v.email, role: v.role } }));
  async function submit() {
    setError(null);
    try {
      await add.mutateAsync({ email: email.trim(), role });
      toast({ tone: 'positive', title: `Added ${email.trim()} to ${slug}.` });
      setEmail('');
      setRole('member');
    } catch (err) {
      setError(reasonOf(err, 'Not added; try again.'));
    }
  }
  return (
    <form aria-label={`Add a member to ${slug}`} className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (email.trim()) void submit(); }}>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Email" className="min-w-0 flex-1 basis-56">
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Role" className="w-36">
          {(p) => <Select id={p.id} aria-describedby={p['aria-describedby']} value={role} onValueChange={setRole} options={ROLES} />}
        </Field>
        <Button type="submit" variant="primary" busy={add.isPending} disabled={!email.trim()}>Add member</Button>
      </div>
      {error ? <p role="alert" className="t-small text-critical-ink">{error}</p> : null}
    </form>
  );
}

function Members({ slug, team }: { slug: string; team: TeamDetail }) {
  const columns: Column<Member>[] = aligned([
    {
      key: 'person', header: 'Person', grow: true, mobile: 'title', title: (m) => (m.name ? `${m.name}, ${m.email}` : m.email),
      cell: (m) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink" title={m.name || m.email}>{m.name || m.email}</span>
          {m.name ? <span className="t-caption block truncate" title={m.email}>{m.email}</span> : null}
        </span>
      ),
      mobileCell: (m) => m.name || m.email,
    },
    { key: 'role', header: 'Role', mobile: 'fact', cell: (m) => <Badge tone={m.role === 'admin' ? 'accent' : 'neutral'}>{m.role === 'admin' ? 'Admin' : 'Member'}</Badge> },
    { key: 'joined', header: 'Joined', numeric: true, mobile: 'fact', cell: (m) => formatDate(m.joined), mobileCell: (m) => `Joined ${formatDate(m.joined)}` },
    // The row's one action keeps its place on a phone, at the end of the card's first line.
    { key: 'remove', header: <span className="sr-only">Remove</span>, mobile: 'status', cell: (m) => <Remove slug={slug} m={m} /> },
  ]);
  const { members } = team;
  return (
    <DataTable
      caption={`${slug}'s members`}
      noun="members"
      title="Members"
      description={`${formatCount(members.length)} ${plural(members.length, 'person', 'people')}, admins first`}
      rows={members}
      columns={columns}
      rowKey={(m) => m.email}
      pageSize={10}
      pageSizes={[10]}
      empty={{ title: 'Nobody is in this team', body: 'Add the first member above.' }}
      toolbar={<AddMember slug={slug} />}
    />
  );
}
