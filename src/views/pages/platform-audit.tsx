'use client';

import { RotateCw } from 'lucide-react';
import { useShareView } from '@/components/base/use-share-view';
import { ActivityFeed } from '@/components/patterns/activity-feed';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { aligned } from '@/console/columns';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { useDataClock } from '@/lib/api';
import type { Audit, AuditRow } from '@/lib/fleet-shapes';
import { formatDate, formatDateTime } from '@/lib/format-date';
import { pendingContext } from '@/views/context';
import {
  AUDIT_DEFAULTS, PAGE_SIZE, TAB_LABEL, auditContext, auditPath, auditTrouble, beforeDays, channelOf, countWords, dayWords, feedEvent,
  filtersOfPath, kindsOf, narrowed, notRecordedWords, originOf, resultOf, tabOf, teamsOf, type AuditFilter, type AuditFilters, type AuditRead,
} from '@/views/platform-audit-context';
import { OWNER_LABEL } from '@/views/activity-context';
import { useServed, useServedAddress } from '@/views/use-served';

/** The protagonist's title: the card the page's first Ask sits on. COUPLED: the README's `Protagonist:`. */
const FEED_TITLE = 'Administration';

/**
 * The page's read: the one the console's server made for this address, so the first paint carries it and the browser
 * asks for nothing more, then the browser's own once a Retry asks for it. A tab, a filter or another page moves the
 * address, and the console's server reads it again; the browser waits for that answer rather than asking beside it.
 */
function useAudit(served: AuditRead, filters: AuditFilters) {
  const path = auditPath(filters);
  const mine = served.path === path ? served : null;
  const { q, error, retry, busy } = useServed<Audit>(path, mine !== null, mine === null);
  const data = q.data ?? (mine?.state === 'ok' ? mine.data : undefined);
  const failed = failureOf({ error });
  const trouble = data ? null : failed ?? (mine && mine.state !== 'ok' ? auditTrouble(mine) : null);
  return { data, trouble, retry, busy, updatedAt: q.data ? new Date(q.dataUpdatedAt) : data ? data.meta.asOf : null };
}

const dash = <span className="text-ink-3">—</span>;
const OWNER_TONE = { theirs: 'critical', ours: 'warning', guardrail: 'neutral', other: 'neutral' } as const;

/** A refusal is the row worth finding, so it alone carries colour, as Activity's log draws it. */
function Result({ r }: { r: AuditRow }) {
  if (r.ok === false) return <Badge tone={OWNER_TONE[r.refusalOwner ?? 'other']} dot title={resultOf(r)}>{OWNER_LABEL[r.refusalOwner ?? 'other']}</Badge>;
  return r.ok === true ? <Badge tone="neutral">OK</Badge> : dash;
}

/** The events in the gateway's order, newest first: the browser sorts, filters and pages none of them. */
const COLUMNS: Column<AuditRow>[] = aligned([
  { key: 'when', header: 'When', width: 'w-40', mobile: 'fact', cell: (r) => <time dateTime={r.at} title={formatDateTime(r.at)}>{formatDateTime(r.at)}</time>, mobileCell: (r) => formatDate(r.at) },
  { key: 'kind', header: 'Kind', mobile: 'title', title: (r) => r.kind, cell: (r) => <span className="block truncate font-mono text-xs text-ink" title={r.kind}>{r.kind}</span>, mobileCell: (r) => r.kind },
  { key: 'team', header: 'Team', hideBelow: 'md', cell: (r) => (r.team ? <span className="block truncate" title={r.team}>{r.team}</span> : <span className="text-ink-3">No team</span>) },
  {
    key: 'actor', header: 'Actor', hideBelow: 'md', mobile: 'fact', title: (r) => r.actor ?? 'Not recorded',
    cell: (r) => (r.actor ? <span className="block truncate" title={r.actor}>{r.actor}</span> : <span className="text-ink-3">Not recorded</span>),
    mobileCell: (r) => r.actor ?? 'Actor not recorded',
  },
  { key: 'subject', header: 'Subject', grow: true, hideBelow: 'lg', cell: (r) => (r.subject ? <span className="block truncate font-mono text-xs" title={r.subject}>{r.subject}</span> : dash) },
  { key: 'result', header: 'Result', mobile: 'status', title: resultOf, cell: (r) => <Result r={r} />, mobileCell: (r) => <Result r={r} /> },
  { key: 'origin', header: 'Origin', hideBelow: 'xl', cell: (r) => (r.origin === 'platform' ? <Badge tone="neutral">{originOf(r)}</Badge> : <span className="text-ink-2">{originOf(r)}</span>) },
  { key: 'channel', header: 'Channel', hideBelow: 'xl', cell: (r) => (r.inConsole ? channelOf(r) : <span className="text-ink-3">{channelOf(r)}</span>) },
]);

/**
 * The superadmin's Audit, in two tabs. Administration is every recorded act that changed who may do what or closed a
 * report, platform maintenance included, each the gateway's own sentence on ZZ Meridian's Activity feed, with the acts
 * Audit cannot show named under it. Everything is every recorded event but page views, as metadata in a table, the
 * latest 500 the filters reach, newest first, filtered by kind, team and a day the events came before. The tab, the
 * filters and the page are in the address, and each is read on the console's server.
 */
export function PlatformAuditView({ served }: { served: AuditRead }) {
  const [filters, set] = useServedAddress(AUDIT_DEFAULTS, served, filtersOfPath);
  const tab = tabOf(filters);
  const { data, trouble, retry, busy, updatedAt } = useAudit(served, filters);
  const now = useDataClock();
  useShareView(data
    ? auditContext(data, { filters, updatedAt, now })
    : pendingContext({ view: 'audit', title: 'Audit', address: '/platform/audit', scope: 'the platform\'s recorded administration' }, trouble));
  // A tab is a view of its own: moving to one starts it afresh, its filters cleared and its first page.
  const choose = (v: string) => set({ ...AUDIT_DEFAULTS, filter: v as AuditFilter });

  return (
    <Tabs value={tab} onValueChange={choose} activationMode="manual">
      <TabList aria-label="Audit views">
        <Tab value="administration">{TAB_LABEL.administration}</Tab>
        <Tab value="all">{TAB_LABEL.all}</Tab>
      </TabList>
      <TabPanel value="administration">
        <Feed data={tab === 'administration' ? data : undefined} trouble={tab === 'administration' ? trouble : null} retry={retry} busy={busy} page={filters.page} onPage={(page) => set({ page })} />
      </TabPanel>
      <TabPanel value="all">
        <Events data={tab === 'all' ? data : undefined} trouble={tab === 'all' ? trouble : null} retry={retry} filters={filters} set={set} />
      </TabPanel>
    </Tabs>
  );
}

/** The feed while its read is on its way: a mark and a line for each act of a page. */
const FeedSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-4">
    {Array.from({ length: PAGE_SIZE }, (_, i) => (
      <div key={i} className="flex items-center gap-3"><Skeleton className="size-6 shrink-0 rounded-full" /><Skeleton className="h-3 flex-1" /><Skeleton className="h-3 w-12 shrink-0" /></div>
    ))}
  </div>
);

/**
 * Administration: one sentence an act, newest first, ten a page, each as the gateway said it, its actor first (`Someone
 * not recorded` when nobody was), marked as the platform's own only when it is maintenance. The clock its times are told
 * against is the read's own cutoff, so the server and the browser say the same words.
 */
function Feed({ data, trouble, retry, busy, page, onPage }: { data?: Audit; trouble: string | null; retry: () => void; busy: boolean; page: string; onPage: (page: string) => void }) {
  const unrecorded = data ? notRecordedWords(data) : null;
  const ask = <AskAbout question="Who changed who may do what most recently, and which of these acts were platform maintenance?" />;
  return (
    <Panel
      data-protagonist={FEED_TITLE}
      data-feed={data ? 'read' : undefined}
      title={FEED_TITLE}
      description={data ? `Acts that changed who may do what, or closed a report, newest first: ${countWords(data, 'act')}` : 'Acts that changed who may do what, or closed a report, newest first'}
      actions={ask}
    >
      {data ? (
        data.rows.length ? (
          <>
            <ActivityFeed events={data.rows.map(feedEvent)} now={new Date(data.meta.asOf)} />
            {data.total > PAGE_SIZE ? (
              <Pagination className="mt-5 border-t border-line pt-4" page={Math.max(1, Number(page) || 1)} pageSize={PAGE_SIZE} total={data.total} noun="acts" onPageChange={(p) => onPage(String(p))} />
            ) : null}
          </>
        ) : <EmptyState kind="first-run" title="No act of administration recorded yet" className="py-10">An act lands here when somebody adds a person, changes a team, issues or revokes a token, or closes a report.</EmptyState>
      ) : trouble ? (
        <EmptyState kind="error" title="The acts of administration did not load" action={<Button size="sm" icon={<RotateCw />} busy={busy} onClick={retry}>Retry</Button>} className="py-10">{trouble}</EmptyState>
      ) : <FeedSkeleton />}
      {unrecorded ? <p className="t-caption mt-5 border-t border-line pt-4" data-not-recorded="">{unrecorded}</p> : null}
    </Panel>
  );
}

/**
 * Everything: every recorded event but page views, as metadata, the latest 500 the filters reach. The filters are applied
 * before the 500, so a kind, a team or an earlier day reaches events older than the latest 500.
 */
function Events({ data, trouble, retry, filters, set }: {
  data?: Audit; trouble: string | null; retry: () => void; filters: AuditFilters; set: (patch: Partial<AuditFilters>) => void;
}) {
  const rows = data?.rows ?? [];
  const narrow = narrowed(filters);
  const clear = () => set({ kind: 'all', team: 'all', before: 'all', page: '1' });
  const option = (v: string) => ({ value: v, label: v });
  const days = data ? beforeDays(data.meta, filters.before) : filters.before !== 'all' ? [filters.before] : [];
  // `…` is coming and `—` is not: a read that failed never reads as one still on its way.
  const result = data ? countWords(data, 'event') : trouble ? '—' : '…';
  return (
    <div data-events={data ? 'read' : undefined} className="contents">
      <DataTable
        caption="Events, newest first"
        noun="events"
        rows={rows}
        columns={COLUMNS}
        rowKey={(r) => r.id}
        manual
        total={data?.total ?? 0}
        pageSize={PAGE_SIZE}
        pageSizes={[PAGE_SIZE]}
        loading={!data && !trouble}
        error={trouble ?? undefined}
        onRetry={retry}
        state={{ sort: '', dir: 'desc', page: filters.page }}
        onStateChange={(p) => { if (p.page) set({ page: p.page }); }}
        filtered={narrow}
        onClearFilters={clear}
        empty={{ title: 'Nothing recorded yet', body: 'An event lands here when an agent calls a tool, a person signs in, or somebody administers the platform.' }}
        toolbar={
          <FilterBar
            filters={[
              { key: 'kind', label: 'Kind', value: filters.kind, onChange: (v) => set({ kind: v, page: '1' }), options: [{ value: 'all', label: 'All' }, ...kindsOf(rows, filters.kind).map(option)] },
              { key: 'team', label: 'Team', value: filters.team, onChange: (v) => set({ team: v, page: '1' }), options: [{ value: 'all', label: 'All' }, ...teamsOf(rows, filters.team).map(option)] },
              { key: 'before', label: 'Before', value: filters.before, onChange: (v) => set({ before: v, page: '1' }), options: [{ value: 'all', label: 'Any time' }, ...days.map((d) => ({ value: d, label: dayWords(d) }))] },
            ]}
            result={result}
            ask={<AskAbout question={narrow ? 'What do the events these filters keep have in common, and which were refused?' : 'Which kinds of event were recorded most recently, and which teams were they in?'} />}
            onClear={clear}
          />
        }
      />
      <p className="t-caption mt-3">The latest 500 events the filters reach, newest first, page views left out. A filter is applied before the 500, so a kind, a team or an earlier day reaches older events.</p>
    </div>
  );
}

/** The masthead's as-of line: the cutoff of the read the page draws, nothing while there is none. */
export function AuditAsOf({ served }: { served: AuditRead }) {
  const [filters] = useServedAddress(AUDIT_DEFAULTS, served, filtersOfPath);
  const { data } = useAudit(served, filters);
  return data ? <span className="t-small text-ink-3">As of {formatDateTime(data.meta.asOf)}</span> : null;
}
