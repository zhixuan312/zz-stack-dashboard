'use client';

import { useMemo } from 'react';
import { Bug, Hourglass, Inbox, Timer } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { BarList } from '@/components/charts/bar-list';
import { ColumnChart } from '@/components/charts/column-chart';
import { CompositionBar } from '@/components/charts/composition-bar';
import { Meridian } from '@/components/charts/meridian';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { FilterBar } from '@/components/patterns/filter-bar';
import { MetricTile } from '@/components/patterns/metric-tile';
import { ChartSkeleton } from '@/components/patterns/page-loading';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { aligned } from '@/console/columns';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { AXIS_FORMATTERS, plural } from '@/lib/format';
import { formatDate, formatDateTime, formatDay, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { Bugs, PublicBugRow } from '@/lib/platform-shapes';
import { pendingContext } from '@/views/context';
import {
  BUGS_DEFAULTS, BUG_IMPACTS, BUG_STATUSES, IMPACT, STATUS, TILES, bugPath, bugsContext, bugsPath, bugsTrouble, cohortsRunning, filtersOfPath, formatHours,
  impactOf, isAdminRow, lastWhole, narrowed, rateIn, statusOf, surfacesOf, valueOf, waited, type BugsFilters, type BugsRead, type Cohort,
} from '@/views/platform-bugs-context';
import { useServed, useServedAddress } from '@/views/use-served';

/**
 * The page's read: the one the console's server made for this address, so the first paint carries the queue and the
 * browser asks for nothing more, then the browser's own once a Retry asks for it. A filter or another page of rows moves
 * the address, and the console's server reads it again; the browser waits for that answer rather than asking beside it.
 * A failure is stated only when there is nothing to draw.
 */
function useBugs(served: BugsRead, filters: BugsFilters) {
  const path = bugsPath(filters);
  const mine = served.path === path ? served : null;
  const { q, error, retry, busy } = useServed<Bugs>(path, mine !== null, mine === null);
  const data = q.data ?? (mine?.state === 'ok' ? mine.data : undefined);
  const failed = failureOf({ error });
  const trouble = data ? null : failed ?? (mine && mine.state !== 'ok' ? bugsTrouble(mine) : null);
  return { data, trouble, retry, busy };
}

const impactTone = (i: string) => (i === 'blocks_work' ? 'critical' : i === 'wrong_result' ? 'warning' : 'neutral');

/** A row's title: the reporter's own and the team for the superadmin; for a member, the spec's public title, which names
 *  the surface alone, beside the row's own impact, filed date and status. */
function Title({ r }: { r: PublicBugRow }) {
  const own = isAdminRow(r) ? r.internalTitle : r.title;
  return (
    <span className="block min-w-0">
      <span className="block whitespace-normal font-medium text-ink [overflow-wrap:anywhere]">{own}</span>
      {isAdminRow(r) ? <span className="t-caption block truncate" title={r.team ?? 'No team'}>{r.team ?? 'No team'}</span> : null}
    </span>
  );
}

/** What a row's report is and where it was filed, as its title says it: the surface gives way under 896px. */
const reportSaid = (r: PublicBugRow) => `${isAdminRow(r) ? r.internalTitle : r.title}, on ${r.surface ?? 'no surface named'}`;

/** The queue's columns, in the gateway's order: newest filed first, filtered and paged where it is read. */
const COLUMNS: Column<PublicBugRow>[] = aligned([
  { key: 'report', header: 'Report', grow: true, mobile: 'title', title: reportSaid, cell: (r) => <Title r={r} />, mobileCell: (r) => (isAdminRow(r) ? r.internalTitle : r.title) },
  { key: 'impact', header: 'Impact', align: 'left', mobile: 'fact', cell: (r) => <Badge tone={impactTone(r.impact)}>{impactOf(r.impact)}</Badge>, mobileCell: (r) => impactOf(r.impact) },
  { key: 'surface', header: 'Surface', align: 'left', hideBelow: 'lg', cell: (r) => (r.surface ? <span className="block truncate font-mono text-xs" title={r.surface}>{r.surface}</span> : <span className="text-ink-3">None named</span>) },
  { key: 'filed', header: 'Filed', numeric: true, mobile: 'fact', cell: (r) => <time dateTime={r.filedAt} title={formatDateTime(r.filedAt)}>{formatDate(r.filedAt)}</time>, mobileCell: (r) => `Filed ${formatDate(r.filedAt)}` },
  { key: 'version', header: 'Version', align: 'left', hideBelow: 'lg', cell: (r) => (r.platformVersion ? <span className="font-mono text-xs">{r.platformVersion}</span> : <span className="text-ink-3">Not recorded</span>) },
  {
    key: 'status', header: 'Status', align: 'left', mobile: 'fact', title: (r) => (r.resolvedAt ? `${statusOf(r.status)}, ${formatDateTime(r.resolvedAt)}` : statusOf(r.status)),
    cell: (r) => (
      <span className="block whitespace-nowrap">
        {statusOf(r.status)}
        {r.resolvedAt ? <span className="t-caption block">{formatDate(r.resolvedAt)}</span> : null}
      </span>
    ),
    mobileCell: (r) => statusOf(r.status),
  },
]);

/** Open is the accent, fixed the positive, and the two closed without a fix are the neutral pair. */
const COLOR = { open: 'accent', fixed: 'positive', not_a_bug: 'neutral', duplicate: 'neutral-ink' } as const;

const STATE_OPTIONS = [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }];
const IMPACT_OPTIONS = [{ value: 'all', label: 'All' }, ...BUG_IMPACTS.map((i) => ({ value: i, label: IMPACT[i] }))];

/**
 * Every real bug report: four tiles, then the queue, the page's protagonist, ten to a page, newest first, filtered by
 * state, impact and surface, then reports filed and resolved by the week filed on one cursor, the outcomes, the impacts
 * and the median hours to resolve by the week filed. Every figure is over every report; the filters narrow the queue alone. Only the
 * superadmin's rows open a report's page.
 */
export function PlatformBugsView({ served }: { served: BugsRead }) {
  const [filters, set] = useServedAddress(BUGS_DEFAULTS, served, filtersOfPath);
  const { data, trouble, retry, busy } = useBugs(served, filters);
  useShareView(data
    ? bugsContext(data, { filters })
    : pendingContext({ view: 'bugs', title: 'Bugs', address: '/platform/bugs', scope: 'every real bug report' }, trouble));
  // `…` is coming and `—` is not: a read that failed never reads as one still on its way.
  const mark = trouble ? '—' : '…';
  const counts = data?.counts.state === 'ok' ? data.counts.data : null;
  const queue = data?.queue;
  const rows = queue?.state === 'ok' ? queue.data.rows : [];
  const admin = data?.meta.scope === 'platform-admin';
  const narrow = narrowed(filters);
  const clear = () => set({ state: 'all', impact: 'all', surface: 'all', page: '1' });
  const surfaces = [{ value: 'all', label: 'All' }, ...surfacesOf(rows, filters.surface).map((s) => ({ value: s, label: s }))];
  const tableError = trouble ?? (queue?.state === 'unavailable' ? `The queue could not be listed: ${queue.reason}. The figures stand.` : undefined);

  return (
    <Stack>
      <Tiles data={data} mark={mark} />
      <div data-protagonist="Queue" className="contents">
        <DataTable
          caption="Bug reports, newest filed first"
          noun="reports"
          rows={rows}
          columns={COLUMNS}
          rowKey={(r) => r.id}
          rowHref={admin ? (r) => bugPath(r.id) : undefined}
          manual
          total={queue?.state === 'ok' ? queue.data.total : 0}
          pageSize={10}
          pageSizes={[10]}
          loading={!data && !trouble}
          error={tableError}
          onRetry={retry}
          retrying={busy}
          state={{ sort: '', dir: 'desc', page: filters.page }}
          onStateChange={(p) => { if (p.page) set({ page: p.page }); }}
          filtered={narrow}
          onClearFilters={clear}
          empty={{ title: 'No bug report yet', body: 'A report is filed with bug_report, from any client.' }}
          toolbar={
            <FilterBar
              filters={[
                { key: 'state', label: 'State', value: filters.state, onChange: (v) => set({ state: v, page: '1' }), options: STATE_OPTIONS },
                { key: 'impact', label: 'Impact', value: filters.impact, onChange: (v) => set({ impact: v, page: '1' }), options: IMPACT_OPTIONS },
                { key: 'surface', label: 'Surface', value: filters.surface, onChange: (v) => set({ surface: v, page: '1' }), options: surfaces },
              ]}
              result={queue?.state === 'ok' ? `${formatCount(queue.data.total)} ${plural(queue.data.total, 'report')}` : mark}
              ask={<AskAbout question={narrow ? 'What do the reports in this queue have in common, and which have waited longest?' : 'What is open in the queue, what blocks work, and how long have the open reports waited?'} />}
              onClear={clear}
            />
          }
        />
      </div>
      {data ? <Weeks data={data} /> : trouble ? null : <Row split="1/2"><ChartSkeleton height="h-72" /><ChartSkeleton height="h-72" /></Row>}
      {data ? (
        <Row split="1/3">
          <Panel title="Outcomes" description="Every report by where it stands: still open, or how it was closed.">
            {counts ? (
              <CompositionBar label="Outcomes" format={formatCount} parts={BUG_STATUSES.map((s) => ({ label: STATUS[s], value: counts.byStatus[s], color: COLOR[s] }))} />
            ) : <EmptyState kind="error" layout="inline" title="The outcomes could not be counted">{data.counts.state === 'unavailable' ? data.counts.reason : null}</EmptyState>}
            {counts ? (
              <div className="mt-6">
                <BarList label="By impact" format={formatCount} total={counts.open + counts.resolved} items={BUG_IMPACTS.map((i) => ({ key: i, label: IMPACT[i], value: counts.byImpact[i] }))} />
              </div>
            ) : null}
          </Panel>
          <Median data={data} />
        </Row>
      ) : null}
    </Stack>
  );
}

/** The four tiles: open, the oldest open, reports per 1,000 calls in the last whole week, and the median hours to resolve. */
function Tiles({ data, mark }: { data: Bugs | undefined; mark: string }) {
  const counts = data?.counts.state === 'ok' ? data.counts.data : null;
  const asOf = data?.meta.asOf ?? '';
  const week = data ? lastWhole(data.cohorts, asOf) : null;
  const median = data ? valueOf(data.medianResolveHours) : null;
  return (
    <Row split="tiles">
      <MetricTile label={TILES.open.label} hint={TILES.open.definition} icon={<Inbox />} value={counts ? counts.open : data ? 'Unavailable' : mark} emphasis={(counts?.open ?? 0) > 0} />
      <MetricTile
        label={TILES.oldest.label} hint={TILES.oldest.definition} icon={<Hourglass />}
        value={data ? (data.oldestOpenAt ? waited(data.oldestOpenAt, asOf) : 'None open') : mark}
        note={data?.oldestOpenAt ? `Filed ${formatDateTime(data.oldestOpenAt)}` : undefined}
      />
      <MetricTile
        label={TILES.rate.label} hint={TILES.rate.definition} icon={<Bug />}
        value={data ? (week ? rateIn(week.filedPer1000) : 'No whole week') : mark}
        note={week ? `Week of ${formatDay(week.week)}` : undefined}
      />
      <MetricTile
        label={TILES.median.label} hint={TILES.median.definition} icon={<Timer />}
        value={data ? (median === null ? 'None resolved' : formatHours(median)) : mark}
        note={counts ? `Over ${formatCount(counts.resolved)} resolved; ${formatCount(counts.open)} still open` : undefined}
      />
    </Row>
  );
}

const weekColumns = (cohorts: Cohort[], of: (c: Cohort) => number | null) => cohorts.map((c) => ({ key: c.week, label: formatShortDate(c.week), value: of(c) }));

/** Filed and resolved by the week filed, two Column charts on one Meridian: pointing at a week in one points the other at it. */
function Weeks({ data }: { data: Bugs }) {
  const { cohorts } = data;
  const dates = useMemo(() => cohorts.map((c) => c.week), [cohorts]);
  const running = cohortsRunning(cohorts, data.meta.asOf);
  const last = lastWhole(cohorts, data.meta.asOf)?.week;
  const none = <EmptyState kind="first-run" title="No week recorded yet" className="py-10">A week is drawn once the platform&apos;s record reaches it.</EmptyState>;
  return (
    <Meridian dates={dates}>
      <Row split="1/2">
        <Panel title="Filed by week" description="Real reports filed, a Monday week each; the last week is still running.">
          {cohorts.length ? (
            <ColumnChart whole label="Filed by week" columns={weekColumns(cohorts, (c) => valueOf(c.filed))} dates={dates} running={running} highlight={last} format={formatCount} axisFormat={AXIS_FORMATTERS.count} height={200} />
          ) : none}
        </Panel>
        <Panel title="Resolved by week filed" description="Of each week's reports, those resolved since, whenever each was resolved.">
          {cohorts.length ? (
            <ColumnChart whole label="Resolved by week filed" columns={weekColumns(cohorts, (c) => valueOf(c.resolved))} dates={dates} running={running} highlight={last} format={formatCount} axisFormat={AXIS_FORMATTERS.count} height={200} />
          ) : none}
        </Panel>
      </Row>
    </Meridian>
  );
}

/**
 * The median hours to resolve by the week filed, over whole weeks: a week none of whose reports is resolved has no
 * column, never a zero. The running week is left out until it ends: its median is only the reports resolved within days
 * of filing, so it would read faster than the week will.
 */
function Median({ data }: { data: Bugs }) {
  const cohorts = useMemo(() => (cohortsRunning(data.cohorts, data.meta.asOf) ? data.cohorts.slice(0, -1) : data.cohorts), [data]);
  const dates = useMemo(() => cohorts.map((c) => c.week), [cohorts]);
  return (
    <Panel title="Median hours to resolve by week filed" description="Over each whole week's resolved reports; an open report is in no median, and the running week is drawn once it ends.">
      {cohorts.some((c) => valueOf(c.medianResolveHours) !== null) ? (
        <ColumnChart
          label="Median hours to resolve by week filed"
          columns={weekColumns(cohorts, (c) => valueOf(c.medianResolveHours))}
          dates={dates} format={formatHours} axisFormat={AXIS_FORMATTERS.count} height={200}
        />
      ) : <EmptyState kind="first-run" title="No report resolved yet" className="py-10">A week&apos;s median is drawn once one of its reports is resolved.</EmptyState>}
    </Panel>
  );
}

/** The masthead's as-of line: the cutoff of the read the page draws, nothing while there is none. */
export function BugsAsOf({ served }: { served: BugsRead }) {
  const [filters] = useServedAddress(BUGS_DEFAULTS, served, filtersOfPath);
  const { data } = useBugs(served, filters);
  return data ? <span className="t-small text-ink-3">As of {formatDateTime(data.meta.asOf)}</span> : null;
}
