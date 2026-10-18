'use client';

import { useMemo, useState } from 'react';
import { BookOpen, ListTree, Signature, Users } from 'lucide-react';
import { useShareView } from '@/components/base/use-share-view';
import { Sparkline } from '@/components/charts/sparkline';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, useSearchDraft, type Column } from '@/components/patterns/data-table';
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
import { ApiError, useDataClock } from '@/lib/api';
import type { TeamRow, Teams } from '@/lib/fleet-shapes';
import { plural } from '@/lib/format';
import { formatDateTime, formatRelative } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { useConsoleMutation } from '@/lib/mutate';
import { useServed, useServedAddress } from '@/views/use-served';
import { pendingContext } from '@/views/context';
import { TILES, sessionPoints, teamsContext, teamsTrouble, weekCount, type TeamsRead } from '@/views/teams-context';
import { TEAMS_DEFAULTS, TEAM_STATUSES, filtersOfPath, narrowed, teamsPath, type TeamsFilters } from '@/views/teams-filter';

/** A team's sessions by week, as a line beside its row: its own past, never set against another team's. */
function Sessions({ t }: { t: TeamRow }) {
  if (t.calls.last.figure.why === 'unavailable') return <span className="text-ink-3">Unavailable</span>;
  const points = sessionPoints(t);
  if (points.filter((v) => v !== null).length < 2) return <span className="text-ink-3">—</span>;
  return (
    <span className="inline-block w-24 align-middle">
      <span className="sr-only">Sessions by week, oldest first: {points.map((v) => (v === null ? 'none read' : v)).join(', ')}</span>
      <Sparkline values={points} height={24} />
    </span>
  );
}

const archived = (t: TeamRow) => (t.status === 'archived' ? <Badge tone="warning" dot>Archived</Badge> : null);

/**
 * When a team last made a real-work call, against the read's own cutoff: the data's clock, the same on the server's
 * first paint as in the browser, never the browser's at render.
 */
function LastActive({ at, asOf }: { at: string | null; asOf: string }) {
  if (!at) return <span className="text-ink-3">Never</span>;
  return <time dateTime={at} title={formatDateTime(at)}>{formatRelative(at, new Date(asOf))}</time>;
}

/**
 * The table's columns, in the gateway's order: latest real-work call first, sorted and paged where it is read. Under
 * 896px the lessons, the sessions and both weeks' calls give way, each on the team's page the row opens.
 */
const columnsAt = (asOf: string): Column<TeamRow>[] => aligned([
  {
    key: 'team', header: 'Team', grow: true, mobile: 'title', title: (t) => (t.name !== t.slug ? `${t.slug}, ${t.name}` : t.slug),
    cell: (t) => (
      <span className="block min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-ink" title={t.slug}>{t.slug}</span>
          {archived(t)}
        </span>
        {t.name !== t.slug ? <span className="t-caption block truncate" title={t.name}>{t.name}</span> : null}
      </span>
    ),
    mobileCell: (t) => <span className="inline-flex items-center gap-2">{t.slug}{archived(t)}</span>,
  },
  { key: 'people', header: 'People', numeric: true, mobile: 'fact', cell: (t) => formatCount(t.people), mobileCell: (t) => `${formatCount(t.people)} ${plural(t.people, 'person', 'people')}` },
  { key: 'openWork', header: 'Open work', numeric: true, mobile: 'fact', cell: (t) => formatCount(t.openWork), mobileCell: (t) => `${formatCount(t.openWork)} open` },
  { key: 'waiting', header: 'Waiting', numeric: true, hideBelow: 'md', cell: (t) => formatCount(t.waiting) },
  { key: 'lessons', header: 'Lessons', numeric: true, hideBelow: 'lg', cell: (t) => formatCount(t.lessons) },
  { key: 'sessions', header: 'Sessions by week', hideBelow: 'lg', width: 'w-32', cell: (t) => <Sessions t={t} /> },
  { key: 'last', header: 'Calls last week', numeric: true, hideBelow: 'lg', cell: (t) => weekCount(t.calls.last) },
  { key: 'previous', header: 'Week before', numeric: true, hideBelow: 'xl', cell: (t) => weekCount(t.calls.previous) },
  { key: 'active', header: 'Last active', numeric: true, mobile: 'fact', cell: (t) => <LastActive at={t.lastActive} asOf={asOf} />, mobileCell: (t) => <>Active <LastActive at={t.lastActive} asOf={asOf} /></> },
]);

const STATUS_OPTIONS = [{ value: 'all', label: 'All' }, ...TEAM_STATUSES.map((s) => ({ value: s, label: s === 'active' ? 'Active' : 'Archived' }))];

/**
 * The page's read: the one the console's server made for this address, so the first paint carries the rows and the
 * browser asks for nothing more, then the browser's own once a change or a Retry asks for it. A failure is stated only
 * when there is nothing to draw: the browser's, or the server's while the browser has not read.
 */
function useTeams(served: TeamsRead | null, filters: TeamsFilters) {
  const path = teamsPath(filters);
  const mine = served?.path === path ? served : null;
  const { q, follow } = useServed<Teams>(path, mine !== null, mine === null && served !== null);
  const data = q.data ?? (mine?.state === 'ok' ? mine.data : undefined);
  const failed = failureOf(q);
  const trouble = data ? null : failed ?? (mine && mine.state !== 'ok' && !q.isFetching ? teamsTrouble(mine) : null);
  const retry = () => (q.data !== undefined || q.error ? void q.refetch() : follow());
  return { data, trouble, retry, updatedAt: q.data ? new Date(q.dataUpdatedAt) : data ? data.meta.asOf : null };
}

/**
 * Every team on the platform, drawn from the release's Records template: four tiles over every team, then the teams,
 * ten to a page, filtered and paged by the gateway. The first page the address names is read on the console's server
 * and handed here; every other read, and the teams collection's live updates, are the browser's.
 */
export function PlatformTeamsView({ served }: { served: TeamsRead }) {
  useLive(['teams']);
  const [filters, set] = useServedAddress(TEAMS_DEFAULTS, served, filtersOfPath);
  const [draft, setDraft] = useSearchDraft(filters.q, (q) => set({ q, page: '1' }));
  const { data, trouble, retry, updatedAt } = useTeams(served, filters);
  const now = useDataClock();
  const asOf = data?.meta.asOf;
  const columns = useMemo(() => columnsAt(asOf ?? ''), [asOf]);
  useShareView(data
    ? teamsContext(data, { filters, updatedAt, now })
    : pendingContext({ view: 'teams', title: 'Teams', address: '/platform/teams', scope: 'every team on the platform' }, trouble));
  const narrow = narrowed(filters);
  const clear = () => set({ q: '', status: 'all', page: '1' });
  // `…` is coming and `—` is not: a read that failed never reads as one still on its way.
  const mark = trouble ? '—' : '…';
  const tiles = data?.tiles;

  return (
    <Records
      summary={
        <>
          <MetricTile label={TILES.teams.label} hint={TILES.teams.definition} icon={<Users />} value={tiles ? tiles.teams : mark} />
          <MetricTile label={TILES.openWork.label} hint={TILES.openWork.definition} icon={<ListTree />} value={tiles ? tiles.openWork : mark} />
          <MetricTile label={TILES.pending.label} hint={TILES.pending.definition} icon={<Signature />} value={tiles ? tiles.pending : mark} emphasis={(tiles?.pending ?? 0) > 0} />
          <MetricTile label={TILES.lessons.label} hint={TILES.lessons.definition} icon={<BookOpen />} value={tiles ? tiles.lessons : mark} />
        </>
      }
    >
      <div data-protagonist="Teams" className="contents">
        <DataTable
          caption="Teams"
          noun="teams"
          rows={data?.teams ?? []}
          columns={columns}
          rowKey={(t) => t.slug}
          rowHref={(t) => `/platform/teams/${t.slug}`}
          manual
          total={data?.total ?? 0}
          pageSize={10}
          pageSizes={[10]}
          loading={!data && !trouble}
          error={trouble ?? undefined}
          onRetry={retry}
          state={{ sort: '', dir: 'desc', page: filters.page }}
          onStateChange={(p) => { if (p.page) set({ page: p.page }); }}
          filtered={narrow}
          onClearFilters={clear}
          empty={{ title: 'No team yet', body: 'Create the first one with Create a team, above.' }}
          toolbar={
            <FilterBar
              search={{ value: draft, onChange: setDraft, placeholder: 'Search teams' }}
              filters={[{ key: 'status', label: 'Status', value: filters.status, onChange: (v) => set({ status: v, page: '1' }), options: STATUS_OPTIONS }]}
              result={data ? `${formatCount(data.total)} ${plural(data.total, 'team')}` : mark}
              ask={<AskAbout question={narrow ? 'What do the teams in this list show about their own last weeks?' : 'How has each team\'s real-work use moved against its own past weeks?'} />}
              onClear={clear}
            />
          }
        />
      </div>
    </Records>
  );
}

/** The masthead's as-of line: the cutoff of the read the table draws, nothing while there is none. */
export function TeamsAsOf({ served }: { served: TeamsRead }) {
  const [filters] = useServedAddress(TEAMS_DEFAULTS, served, filtersOfPath);
  const { data } = useTeams(served, filters);
  return data ? <span className="t-small text-ink-3">As of {formatDateTime(data.meta.asOf)}</span> : null;
}

/**
 * Create a team, the masthead's one action: the console's existing platform route, as Settings called it. The
 * gateway's refusal is said under the fields, beside the control, and the dialog stays open with what was typed.
 */
export function CreateTeam() {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useConsoleMutation<{ ok: true; result: string }, { slug: string; name: string }>('/settings/platform/teams');
  const ready = slug.trim().length > 0 && name.trim().length > 0;

  async function submit() {
    setError(null);
    try {
      const done = await create.mutateAsync({ slug: slug.trim(), name: name.trim() });
      setOpen(false);
      setSlug('');
      setName('');
      toast({ tone: 'positive', title: done.result });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The team was not created; try again.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null); }}>
      <Button variant="primary" aria-haspopup="dialog" onClick={() => setOpen(true)}>Create a team</Button>
      <DialogContent
        size="sm"
        title="Create a team"
        description="A slug is lowercase letters, digits, - or _, and never changes. Creating an archived team's slug again restores it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" busy={create.isPending} disabled={!ready} onClick={() => void submit()}>Create team</Button>
          </>
        }
      >
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (ready) void submit(); }}>
          <Field label="Slug">
            {(p) => <Input {...p} placeholder="e.g. search-quality" value={slug} onChange={(e) => setSlug(e.target.value)} />}
          </Field>
          <Field label="Name">
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          {error ? <p role="alert" className="t-small text-critical-ink">{error}</p> : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
