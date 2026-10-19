'use client';

import { useMemo } from 'react';
import { Database, PackageCheck, Rocket, Tag } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { ColumnChart } from '@/components/charts/column-chart';
import { Meridian } from '@/components/charts/meridian';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { ChartSkeleton } from '@/components/patterns/page-loading';
import { EmptyState } from '@/components/ui/empty-state';
import { aligned } from '@/console/columns';
import { Panel } from '@/console/panel';
import { failureOf } from '@/console/query';
import { useDataClock } from '@/lib/api';
import { cn } from '@/lib/cn';
import { AXIS_FORMATTERS, plural } from '@/lib/format';
import { formatDate, formatDateTime, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { ReleaseRow, Releases } from '@/lib/platform-shapes';
import { pendingContext } from '@/views/context';
import {
  OBSERVED, RELEASES_DEFAULTS, TILES, clientActionOf, failuresIn, filtersOfPath, observedOf, observedText, overlapText, p95In, rateIn, releasePath,
  releasesContext, releasesPath, releasesTrouble, weekRate, weeksRunning, type ReleasesFilters, type ReleasesRead, type Week,
} from '@/views/platform-releases-context';
import { useServed, useServedAddress } from '@/views/use-served';

type Side = ReleaseRow['before'];
const RATE = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * The page's read: the one the console's server made for this address, so the first paint carries the rows and the
 * browser asks for nothing more, then the browser's own once another page of rows or a Retry asks for it. A failure is
 * stated only when there is nothing to draw: the browser's, or the server's until the browser's read answers.
 */
function useReleases(served: ReleasesRead, filters: ReleasesFilters) {
  const path = releasesPath(filters);
  const mine = served.path === path ? served : null;
  const { q, error, retry, busy } = useServed<Releases>(path, mine !== null, mine === null);
  const data = q.data ?? (mine?.state === 'ok' ? mine.data : undefined);
  const failed = failureOf({ error });
  const trouble = data ? null : failed ?? (mine && mine.state !== 'ok' ? releasesTrouble(mine) : null);
  return { data, trouble, retry, busy, updatedAt: q.data ? new Date(q.dataUpdatedAt) : data ? data.meta.asOf : null };
}

/**
 * One side of a release in a cell: its figure, and `partial` beside it when the record saw only part of the window. A
 * figure holds its line; a word in its place (`Not observed`, `No calls`) wraps, so the column never runs past its card.
 */
function SideLine({ label, value, side, asOf }: { label: string; value: string; side: Side; asOf: string }) {
  return (
    <span data-side className={cn('block', /\d/.test(value) && 'whitespace-nowrap')} title={`${label}, ${OBSERVED[observedOf(side)]}: ${observedText(side, asOf)}`}>
      <span className="text-ink-3">{label} </span>{value}{observedOf(side) === 'partial' ? <span className="text-ink-3"> · partial</span> : null}
    </span>
  );
}

const sides = (r: ReleaseRow, asOf: string, of: (s: Side) => string) => (
  <span className="inline-flex flex-col">
    <SideLine label="Before" value={of(r.before)} side={r.before} asOf={asOf} />
    <SideLine label="After" value={of(r.after)} side={r.after} asOf={asOf} />
  </span>
);

/** Both sides as a sentence: `4.2 before; 3.3 after (partial)`, `Not observed before; 15.8 after (partial)`. */
const phoneSides = (r: ReleaseRow, of: (s: Side) => string) =>
  `${of(r.before)} before; ${of(r.after)} after${observedOf(r.after) === 'partial' ? ' (partial)' : ''}`;

/** What only a phone card shows under the version, each line free to wrap: what changed, what clients do, then the figure. */
const PHONE_LINE = 'hidden t-small font-regular whitespace-normal text-ink-2 @max-[640px]:block';

/**
 * The table's columns, in the gateway's order: newest first, paged where it is read. The version and the date hold
 * their line; the summary takes the slack, cut to the width there is and whole in its title, with the releases inside
 * its windows under it. A phone card is the version and its date, then the summary, the client action and the
 * malformed calls either side, each a line that may wrap.
 */
const columnsAt = (asOf: string): Column<ReleaseRow>[] => aligned([
  {
    key: 'version', header: 'Version', mobile: 'title', title: (r) => [r.version, r.consoleVersion ? `console ${r.consoleVersion}` : '', overlapText(r) ?? ''].filter(Boolean).join(', '),
    cell: (r) => (
      <span className="block min-w-0">
        <span className="block font-mono text-sm font-medium whitespace-nowrap text-ink">{r.version}</span>
        {r.consoleVersion ? <span className="t-caption block whitespace-nowrap">console {r.consoleVersion}</span> : null}
        <span className={PHONE_LINE}>{r.summary}</span>
        <span className={PHONE_LINE}>Clients: {clientActionOf(r)}</span>
        <span className={PHONE_LINE}>Malformed per 1,000: {phoneSides(r, rateIn)}</span>
      </span>
    ),
  },
  { key: 'released', header: 'Tagged', numeric: true, mobile: 'status', cell: (r) => <time dateTime={r.releasedAt} title={`Tagged ${formatDateTime(r.releasedAt)}`}>{formatDate(r.releasedAt)}</time> },
  {
    key: 'summary', header: 'Summary', grow: true, truncate: true, align: 'left', hideBelow: 'md', title: (r) => [r.summary, overlapText(r)].filter(Boolean).join('. '),
    cell: (r) => (
      <span className="block min-w-0">
        <span className="block truncate" title={r.summary}>{r.summary}</span>
        {overlapText(r) ? <span className="t-caption block truncate" title={overlapText(r) ?? undefined}>{overlapText(r)}</span> : null}
      </span>
    ),
  },
  // The summary takes every pixel of slack, so a width here is no floor: the cell's own minimum keeps an action whole.
  { key: 'action', header: 'Client action', align: 'left', hideBelow: 'lg', cell: (r) => <span className="block min-w-44 whitespace-normal">{clientActionOf(r)}</span> },
  { key: 'malformed', header: 'Malformed per 1,000', cell: (r) => sides(r, asOf, rateIn) },
  { key: 'failures', header: 'Tool failures', hideBelow: 'xl', cell: (r) => sides(r, asOf, failuresIn) },
  { key: 'p95', header: 'p95', hideBelow: 'xl', cell: (r) => sides(r, asOf, p95In) },
]);

/**
 * Every recorded release: four tiles, releases and malformed calls per 1,000 by week as two Column charts on one cursor,
 * then the releases, ten to a page, newest first, each with what was observed in the 72 hours either side of it. The
 * first page the address names is read on the console's server and handed here; every other page is the browser's.
 */
export function PlatformReleasesView({ served }: { served: ReleasesRead }) {
  const [filters, set] = useServedAddress(RELEASES_DEFAULTS, served, filtersOfPath);
  const { data, trouble, retry, busy, updatedAt } = useReleases(served, filters);
  const now = useDataClock();
  const asOf = data?.meta.asOf ?? '';
  const columns = useMemo(() => columnsAt(asOf), [asOf]);
  useShareView(data
    ? releasesContext(data, { filters, updatedAt, now })
    : pendingContext({ view: 'releases', title: 'Releases', address: '/platform/releases', scope: 'every recorded release' }, trouble));
  // `…` is coming and `—` is not: a read that failed never reads as one still on its way.
  const mark = trouble ? '—' : '…';
  const tiles = data?.tiles;
  const part = data?.rows;
  const rows = part?.state === 'ok' ? part.data.rows : [];
  const tableError = trouble ?? (part?.state === 'unavailable' ? `The releases could not be listed: ${part.reason}. The tiles and the weeks stand.` : undefined);

  return (
    <Stack>
      <Row split="tiles">
        <MetricTile label={TILES.releases.label} hint={TILES.releases.definition} icon={<Tag />} value={tiles ? tiles.releases : mark} format={releasesIn} />
        <MetricTile label={TILES.lastWeek.label} hint={TILES.lastWeek.definition} icon={<Rocket />} value={tiles ? tiles.lastWeek : mark} format={releasesIn} />
        <MetricTile
          label={TILES.latest.label} hint={TILES.latest.definition} icon={<PackageCheck />}
          value={tiles ? (tiles.latest?.version ?? 'None recorded') : mark}
          note={tiles?.latest ? `Tagged ${formatDateTime(tiles.latest.releasedAt)}` : undefined}
        />
        <MetricTile
          label={TILES.migrations.label} hint={TILES.migrations.definition} icon={<Database />}
          value={tiles ? tiles.migrations.applied : mark}
          note={tiles ? (tiles.migrations.lastAt ? `Last ${formatDateTime(tiles.migrations.lastAt)}` : 'None recorded') : undefined}
        />
      </Row>
      {data ? <Weeks weeks={data.weeks} /> : trouble ? null : <Row split="1/2"><ChartSkeleton height="h-72" /><ChartSkeleton height="h-72" /></Row>}
      <div data-protagonist="Releases" className="contents">
        <DataTable
          title="Releases"
          description="Newest first. Each side is the 72 hours before or after the tag, as observed; partial when the record saw only part of it."
          actions={<AskAbout question="What was observed in the 72 hours either side of each release on this page, and which windows are partial or shared with another release?" />}
          caption="Releases with what was observed either side of each"
          noun="releases"
          rows={rows}
          columns={columns}
          rowKey={(r) => r.version}
          rowHref={(r) => releasePath(r.version)}
          manual
          total={part?.state === 'ok' ? part.data.total : 0}
          pageSize={10}
          pageSizes={[10]}
          loading={!data && !trouble}
          error={tableError}
          onRetry={retry}
          retrying={busy}
          state={{ sort: '', dir: 'desc', page: filters.page }}
          onStateChange={(p) => { if (p.page) set({ page: p.page }); }}
          empty={{ title: 'No release recorded yet', body: 'A release is recorded when its tag is made.' }}
        />
      </div>
    </Stack>
  );
}

/** A count of releases with its unit, as a tile sets it: `2 releases`. */
const releasesIn = (n: number) => `${formatCount(n)} ${plural(n, 'release')}`;

/** The weeks, two Column charts on one Meridian: pointing at a week in one points the other at it. */
function Weeks({ weeks }: { weeks: Week[] }) {
  const dates = useMemo(() => weeks.map((w) => w.window.from), [weeks]);
  const isRunning = weeksRunning(weeks);
  const last = weeks.filter((w) => w.window.complete).at(-1)?.window.from;
  const none = <EmptyState kind="first-run" title="No week recorded yet" className="py-10">A week is drawn once the platform&apos;s record reaches it.</EmptyState>;
  return (
    <Meridian dates={dates}>
      <Row split="1/2">
        <Panel title="Releases by week" description="Releases recorded, a Monday week each; the last week is still running.">
          {weeks.length ? (
            <ColumnChart
              label="Releases by week"
              columns={weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), value: w.releases }))}
              dates={dates} running={isRunning} highlight={last} format={formatCount} axisFormat={AXIS_FORMATTERS.count} height={200}
            />
          ) : none}
        </Panel>
        <Panel title="Malformed calls per 1,000 by week" description="Real-work tool calls refused for their shape, in every 1,000, a Monday week each.">
          {weeks.length ? (
            <ColumnChart
              label="Malformed calls per 1,000 by week"
              columns={weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), value: weekRate(w) }))}
              dates={dates} running={isRunning} highlight={last} format={(n) => RATE.format(n)} axisFormat={AXIS_FORMATTERS.count} height={200}
            />
          ) : none}
        </Panel>
      </Row>
    </Meridian>
  );
}

/** The masthead's as-of line: the cutoff of the read the page draws, nothing while there is none. */
export function ReleasesAsOf({ served }: { served: ReleasesRead }) {
  const [filters] = useServedAddress(RELEASES_DEFAULTS, served, filtersOfPath);
  const { data } = useReleases(served, filters);
  return data ? <span className="t-small text-ink-3">As of {formatDateTime(data.meta.asOf)}</span> : null;
}
