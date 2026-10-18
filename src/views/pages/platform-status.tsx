'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { HeartPulse, RotateCw, Undo2, Users } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { ColumnChart } from '@/components/charts/column-chart';
import { Meridian } from '@/components/charts/meridian';
import { Sparkline } from '@/components/charts/sparkline';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { FeaturedMetric, type FeaturedFigure } from '@/components/patterns/featured-metric';
import { MetricTile } from '@/components/patterns/metric-tile';
import { TilesSkeleton } from '@/components/patterns/page-loading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Delta } from '@/components/ui/delta';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot } from '@/components/ui/status-dot';
import { Panel } from '@/console/panel';
import { formatDay } from '@/lib/format-date';
import type { PlatformStatus } from '@/lib/platform-shapes';
import {
  NO_TEAM, UNRECORDED, askOf, asOfLine, doorRow, footOf, needsFoot, ownOf, pairOf, platformStatusContext, runningOf, scoreOf,
  troubleOf, valueIn, type Dated, type DoorRow, type Half, type ScoreRow, type StatusRead,
} from '@/views/platform-status-context';

/**
 * The platform's Status, read on the console's server and handed here whole: what needs attention, then the paired
 * figures, the reader's own team's share, the scoreboard, each door's days and what is running. A part the read could
 * not work out draws its own unavailable state and the rest stands; a read that failed or took longer than its bound is
 * the template's error state with Retry, which asks the server again.
 */
export function PlatformStatusView({ read }: { read: StatusRead }) {
  useShareView(platformStatusContext(read));
  if (read.state !== 'ok') return <StatusTrouble state={read.state} />;
  const s = read.status;
  return (
    <Stack>
      <NeedsPanel needs={s.needs} />
      <Paired status={s} />
      <OwnTeam status={s} />
      <Scoreboard status={s} />
      <Doors doors={s.doors} />
      <RunningPanel status={s} />
    </Stack>
  );
}

/** The masthead's as-of line, the read's own cutoff: nothing when there is no read to date. */
export function PlatformStatusAsOf({ read }: { read: StatusRead }) {
  if (read.state !== 'ok') return null;
  return <span className="t-small text-ink-3">{asOfLine(read.status.meta)}</span>;
}

/** Status on its way, in the shape of the page: what needs attention, the paired figures, the team's tiles and a table. */
export function StatusSkeleton() {
  return (
    <>
      <Skeleton className="h-56 rounded-lg" />
      <Skeleton className="h-96 rounded-xl" />
      <TilesSkeleton count={3} />
      <Skeleton className="h-72 rounded-lg" />
    </>
  );
}

/** A part the read could not work out, said in its own card, so the parts beside it stand. */
function Unavailable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title}>
      <EmptyState layout="inline" title={`${title}: unavailable`}>{children}</EmptyState>
    </Panel>
  );
}

function NeedsPanel({ needs }: { needs: PlatformStatus['needs'] }) {
  if (needs.state === 'unavailable') {
    return (
      <Panel title={needs.headline} description="What needs attention">
        <EmptyState layout="inline" title="The checks did not answer">Nothing here says whether anything needs attention: the checks behind this list could not be read.</EmptyState>
      </Panel>
    );
  }
  return (
    <Panel title={needs.headline} description="What needs attention" flush>
      {needs.rows.length ? (
        <ul aria-label="What needs attention" className="divide-y divide-line">
          {needs.rows.map((r, i) => (
            <li key={`${r.kind}-${i}`} className="flex items-start gap-3 px-(--card-pad) py-3.5">
              <StatusDot tone={r.tone} className="mt-[0.45em]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{r.href ? <Link href={r.href} className="hover:underline">{r.title}</Link> : r.title}</p>
                <p className="t-small mt-0.5 text-ink-2">{r.detail}</p>
              </div>
              {r.oldestAt ? <span className="t-small t-num shrink-0 text-ink-3">Since {formatDay(r.oldestAt)}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState layout="inline" title={needs.headline}>{needs.state === 'complete' ? 'Every check answered and found nothing open.' : 'The checks that answered found nothing open.'}</EmptyState>
      )}
      <p data-needs-foot className="t-small border-t border-line px-(--card-pad) py-3 text-ink-2">{needsFoot(needs)}</p>
    </Panel>
  );
}

/** What the paired figures read where a half has no number: the dash Status writes for a figure it does not have. */
const NO_FIGURE = '—';

/**
 * One half of the Featured metric, its weeks a Column chart: a week with no data keeps its place and is drawn as none.
 * A half with no figure hands the card no number, so nothing is drawn or pointed at as 0: the card sets the page's dash
 * in the figure's place, and the caption says why.
 */
function figureOf(h: Half): FeaturedFigure {
  return {
    kicker: <>{h.label} · by week</>,
    value: h.value,
    missing: NO_FIGURE,
    format: (n) => valueIn(h.kind, n),
    caption: h.caption,
    finding: h.finding ? { text: h.finding } : undefined,
    children: h.columns.length ? (
      <ColumnChart height="fill" label={`${h.label} by week`} columns={h.columns} dates={h.dates} running={h.running} format={(n) => valueIn(h.kind, n)} />
    ) : undefined,
  };
}

function Paired({ status }: { status: PlatformStatus }) {
  const [malformed, followup] = pairOf(status);
  return (
    <Meridian dates={malformed.dates}>
      <FeaturedMetric
        {...figureOf(malformed)}
        peer={figureOf(followup)}
        pointLabel={(d) => `Week of ${formatDay(d)}`}
        actions={<AskAbout question={askOf(status)} />}
        foot={<dl>{footOf(status).map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>}
      />
    </Meridian>
  );
}

const OWN_ICONS = [<HeartPulse key="m" />, <Undo2 key="f" />, <Users key="s" />];

function OwnTeam({ status }: { status: PlatformStatus }) {
  const own = ownOf(status);
  if (own.state === 'none') return <Card className="p-(--card-pad)"><p className="t-small text-ink-2">{NO_TEAM}</p></Card>;
  if (own.state === 'unavailable') return <Unavailable title="Your team's own counts">They could not be read ({own.reason}). The platform&apos;s figures above stand.</Unavailable>;
  return (
    <div className="flex flex-col gap-3">
      <Row split="tiles">
        {own.tiles.map((t, i) => (
          <MetricTile key={t.label} label={t.label} hint={t.hint} icon={OWN_ICONS[i]} value={t.value} format={(n) => valueIn(t.kind, n)} note={t.note} points={t.points} />
        ))}
      </Row>
      <p data-own-bugs className="t-small px-1 text-ink-2">{own.bugs}</p>
    </div>
  );
}

/** A figure over the week it is for. */
const DatedCell = ({ d }: { d: Dated | null }) => (d ? <span className="flex flex-col"><span>{d.value}</span>{d.week ? <span className="text-xs text-ink-3">{d.week}</span> : null}</span> : null);

function ChangeCell({ row }: { row: ScoreRow }) {
  const { value, format } = row.change;
  if (value === null) return <span className="text-xs text-ink-3">Not comparable</span>;
  if (value === 0) return <span className="text-xs text-ink-2">Unchanged</span>;
  return <Delta value={value} format={format} intent={row.intent} />;
}

const shapeOf = (r: ScoreRow) => (r.points.filter((p) => p !== null).length > 1
  ? <Sparkline values={r.points} color="neutral" height={28} className="w-28" />
  : <span className="text-xs text-ink-3">Not enough weeks</span>);

/** A dated figure in words, for a title: `low 41, week of 6 Oct`. */
const datedSaid = (label: string, d: Dated | null) => (d ? `${label} ${d.value}${d.week ? `, ${d.week}` : ''}` : `${label} none`);

const MEASURE: Column<ScoreRow> = { key: 'measure', header: 'Measure', cell: (r) => r.label, title: (r) => `${r.label}: ${r.hint}`, grow: true, mobile: 'title' };
const SHARED: Column<ScoreRow>[] = [
  { key: 'last', header: 'Last week', cell: (r) => <DatedCell d={r.last} />, align: 'right', mobile: 'fact' },
  { key: 'change', header: 'Change', cell: (r) => <ChangeCell row={r} />, align: 'right', mobile: 'status' },
  { key: 'shape', header: 'By week', cell: shapeOf, hideBelow: 'md' },
];
const DIRECTIONAL_COLUMNS: Column<ScoreRow>[] = [
  MEASURE,
  { key: 'first', header: 'First week', cell: (r) => <DatedCell d={r.first} />, align: 'right', hideBelow: 'lg' },
  { key: 'best', header: 'Best week', cell: (r) => <DatedCell d={r.best} />, align: 'right', mobile: 'fact' },
  ...SHARED,
];
/** Under 896px the low gives way, and the high's title names both. */
const ACTIVITY_COLUMNS: Column<ScoreRow>[] = [
  MEASURE,
  { key: 'first', header: 'First week', cell: (r) => <DatedCell d={r.first} />, align: 'right', hideBelow: 'lg' },
  { key: 'high', header: 'High', cell: (r) => <DatedCell d={r.high} />, title: (r) => `${datedSaid('High', r.high)}; ${datedSaid('low', r.low)}`, align: 'right', mobile: 'fact' },
  { key: 'low', header: 'Low', cell: (r) => <DatedCell d={r.low} />, align: 'right', hideBelow: 'lg' },
  ...SHARED,
];

function Scoreboard({ status }: { status: PlatformStatus }) {
  const score = scoreOf(status);
  return (
    <>
      <DataTable
        title="The scoreboard"
        description={score.caption}
        caption="Five measures with a direction, each against the week before"
        noun="measures"
        rows={score.directional}
        columns={DIRECTIONAL_COLUMNS}
        rowKey={(r) => r.key}
        pageSize={10}
        pageSizes={[10]}
      />
      <DataTable
        title="Activity"
        description="Three measures of how much happened. They move, and are never counted better or worse."
        caption="Three activity measures, each against the week before"
        noun="measures"
        rows={score.activity}
        columns={ACTIVITY_COLUMNS}
        rowKey={(r) => r.key}
        pageSize={10}
        pageSizes={[10]}
      />
    </>
  );
}

/** Under 896px the days with calls give way, and the fault days' title says what they are out of. */
const DOOR_COLUMNS: Column<DoorRow>[] = [
  { key: 'door', header: 'Door', cell: (r) => <span className="font-mono text-xs">{r.door}</span>, title: (r) => `The ${r.door} door`, mobile: 'title' },
  { key: 'rate', header: 'Daily tool failures', cell: (r) => (r.rates.length > 1 ? <Sparkline values={r.rates} color="neutral" height={28} className="w-28" /> : <span className="text-xs text-ink-3">Not enough days</span>), hideBelow: 'md' },
  { key: 'days', header: 'Days with calls', cell: (r) => r.daysWithCalls, numeric: true, hideBelow: 'lg', mobile: 'fact', mobileCell: (r) => `${r.daysWithCalls} days with calls` },
  { key: 'faults', header: 'Fault days', cell: (r) => r.faultDays, title: (r) => `${r.faultDays} fault days of ${r.daysWithCalls} days with calls`, numeric: true, mobile: 'fact', mobileCell: (r) => `${r.faultDays} fault days` },
  { key: 'last', header: 'Last fault day', cell: (r) => r.lastFaultDay, mobile: 'fact', mobileCell: (r) => `Last fault day: ${r.lastFaultDay}` },
  { key: 'run', header: 'Run', cell: (r) => r.run, grow: true, truncate: true },
  { key: 'today', header: 'Today', cell: (r) => r.today ?? '', muted: true, hideBelow: 'lg' },
];

function Doors({ doors }: { doors: PlatformStatus['doors'] }) {
  if (doors.state === 'unavailable') return <Unavailable title="The doors">Each door&apos;s days could not be read ({doors.reason}).</Unavailable>;
  return (
    <DataTable
      title="The doors"
      description="Each door's real-work calls by whole day. A fault day has tool failures at 1% of its calls or more; today is shown apart, so far."
      caption="Each door's fault days and its run of days under 1% tool failures"
      noun="doors"
      rows={doors.data.map(doorRow)}
      columns={DOOR_COLUMNS}
      rowKey={(r) => r.door}
      pageSize={10}
      pageSizes={[10]}
      empty={{ title: 'No door has recorded a call', body: 'A door\'s days appear here once real work calls it.' }}
    />
  );
}

function RunningPanel({ status }: { status: PlatformStatus }) {
  const running = runningOf(status);
  if (running.state === 'unavailable') return <Unavailable title="What is running">It could not be read ({running.reason}).</Unavailable>;
  return (
    <Panel title="What is running" description="The gateway's own version and what the release record says of it">
      {running.state === 'unrecorded'
        ? <EmptyState layout="inline" title="Unrecorded">{UNRECORDED}</EmptyState>
        : <KeyValue columns={2} items={running.items.map((i) => ({ label: i.label, value: i.value }))} />}
    </Panel>
  );
}

function StatusTrouble({ state }: { state: Exclude<StatusRead['state'], 'ok'> }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const { title, detail } = troubleOf(state);
  return (
    <Card>
      <EmptyState
        kind="error"
        title={title}
        className="py-16"
        action={<Button variant="primary" icon={<RotateCw />} busy={retrying} onClick={() => startRetry(() => router.refresh())}>Retry</Button>}
      >
        {detail}
      </EmptyState>
    </Card>
  );
}
