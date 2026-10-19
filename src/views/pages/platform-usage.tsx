'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useTransition, type ReactNode } from 'react';
import { Activity, Ban, RotateCw, Timer, Users } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { BarList } from '@/components/charts/bar-list';
import { ColumnChart, type ColumnPart } from '@/components/charts/column-chart';
import { CompositionBar } from '@/components/charts/composition-bar';
import { Heatmap } from '@/components/charts/heatmap';
import { Meridian, useMeridianIndex } from '@/components/charts/meridian';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Delta } from '@/components/ui/delta';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { aligned } from '@/console/columns';
import { Panel } from '@/console/panel';
import type { Usage } from '@/lib/fleet-shapes';
import { formatDay, formatShortDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import type { Figure } from '@/lib/platform-shapes';
import {
  NOT_RECORDED, REFUSAL_PARTS, TILES, TILE_KEYS, askOf, asOfLine, changeOf, figureText, followupLine, lastWhole,
  perApprovalText, pointsOf, teamParts, usageContext, usageTrouble, valueIn, weekOf, type TileKey, type UsageRead,
} from '@/views/platform-usage-context';

/** The protagonist's title: the card the page's Ask sits on. COUPLED: the README's `Protagonist:`. */
const CALLS_TITLE = 'Calls by week';

type Ok<P> = P extends { state: 'ok'; data: infer D } ? D : never;
type CallsWeek = Ok<Usage['callsByWeek']>['weeks'][number];
type ToolRow = Ok<Usage['tools']>['rows'][number];

/**
 * How real work called the platform, read on the console's server and handed here whole: the four tiles, the calls by
 * week (by team for a superadmin), the platform's own traffic and every refusal by population, the refusals put right,
 * each tool's median call, the weekday by hour, the tools called most, calls per approval and the model calls. A part
 * the gateway could not work out draws its own state and the rest stands; a read that failed or took longer than its
 * bound is the error state with Retry, which asks the server again.
 */
export function PlatformUsageView({ read }: { read: UsageRead }) {
  useShareView(usageContext(read));
  if (read.state !== 'ok') return <UsageTrouble read={read} />;
  const u = read.usage;
  return (
    <Stack>
      <Weeks usage={u} />
      <Row split="1/2">
        <Traffic part={u.traffic} />
        <Refusals part={u.refusals} />
      </Row>
      <Tools part={u.tools} />
      <Row split="1/2">
        <Rhythm part={u.rhythm} coverageFrom={u.meta.coverageFrom} />
        <MostUsed part={u.mostUsed} />
      </Row>
      <Row split="1/2">
        <PerApproval part={u.perApproval} />
        <ModelCalls part={u.modelCalls} />
      </Row>
    </Stack>
  );
}

/** The masthead's as-of line, the read's own cutoff: nothing when there is no read to date. */
export function UsageAsOf({ read }: { read: UsageRead }) {
  if (read.state !== 'ok') return null;
  return <span className="t-small text-ink-3">{asOfLine(read.usage)}</span>;
}

/**
 * Usage on its way, in the shape of the page. COUPLED: `app/(dash)/platform/usage/loading.tsx`, the same blocks before
 * the gate has answered.
 */
export function UsageSkeleton() {
  return (
    <>
      <TilesSkeleton count={4} />
      <ChartSkeleton height="h-56" />
      <ChartSkeleton height="h-56" />
      <Row split="1/2"><ChartSkeleton height="h-20" /><ChartSkeleton height="h-20" /></Row>
      <TableSkeleton rows={4} filters={false} />
    </>
  );
}

/** A part the read could not work out, said in its own card, so the parts beside it stand. */
function Unavailable({ title, reason, actions }: { title: string; reason: string; actions?: ReactNode }) {
  return (
    <Panel title={title} actions={actions}>
      <EmptyState layout="inline" title={`${title}: unavailable`}>It could not be read ({reason}). The rest of the page stands.</EmptyState>
    </Panel>
  );
}

/** A tile's value: its number, or the word for why there is none, never a zero. */
const tileValue = (f: Figure): number | string => (f.value === null ? (f.why === 'unavailable' ? 'Unavailable' : 'No data') : f.value);
const ICONS: Record<TileKey, ReactNode> = { calls: <Activity />, refusedShare: <Ban />, p95Ms: <Timer />, sessions: <Users /> };

/** The tiles, the calls by week and the refusals put right, on one cursor: pointing at a week reads it everywhere. */
function Weeks({ usage }: { usage: Usage }) {
  const weeks = usage.callsByWeek.state === 'ok' ? usage.callsByWeek.data.weeks : [];
  const dates = useMemo(() => weeks.map((w) => w.window.from), [weeks]);
  return (
    <Meridian dates={dates}>
      <Tiles part={usage.tiles} />
      <div data-protagonist={CALLS_TITLE} className="contents">
        <Calls usage={usage} />
      </div>
      <Followup part={usage.followup} />
    </Meridian>
  );
}

function Tiles({ part }: { part: Usage['tiles'] }) {
  if (part.state !== 'ok') return <Unavailable title="Last week" reason={part.reason} />;
  return (
    <Row split="tiles" data-figures="read">
      {TILE_KEYS.map((k) => {
        const t = part.data[k];
        const { kind } = TILES[k];
        const points = t.weeks.map((w) => w.figure.value);
        const compare = `vs the ${weekOf(t.previous.window)}`;
        const share = kind === 'share' ? pointsOf(t) : null;
        return (
          <MetricTile
            key={k} label={TILES[k].label} hint={TILES[k].definition} icon={ICONS[k]}
            value={tileValue(t.last.figure)} format={(n) => valueIn(kind, n)}
            {...(share === null ? { delta: kind === 'share' ? null : changeOf(t), compare } : { delta: share / 100, deltaFormat: 'points' as const, compare })}
            intent="neutral" points={points.length > 1 ? points : undefined}
          />
        );
      })}
    </Row>
  );
}

/** Ask on the calls by week: about the week the cursor points at, or about the weeks when it points at none. */
function AskWeek({ split }: { split: boolean }) {
  const { index, dates } = useMeridianIndex();
  return <AskAbout question={askOf(index !== null ? dates[index] ?? null : null, split)} />;
}

/** A week's calls by team: each part by its label, and nothing where the whole week has no figure. */
const partsOf = (w: CallsWeek, labels: string[]) =>
  labels.map((l) => (w.calls.value === null ? null : w.parts?.find((p) => p.label === l)?.calls ?? 0));

function Calls({ usage }: { usage: Usage }) {
  const labels = teamParts(usage);
  const split = labels.length > 0;
  const ask = <AskWeek split={split} />;
  if (usage.callsByWeek.state !== 'ok') return <Unavailable title={CALLS_TITLE} reason={usage.callsByWeek.reason} actions={ask} />;
  const weeks = usage.callsByWeek.data.weeks;
  const at = lastWhole(weeks);
  const last = at >= 0 ? weeks[at] : null;
  const shared = {
    label: split ? 'Real-work calls by week, by team' : 'Real-work calls by week',
    dates: weeks.map((w) => w.window.from),
    running: weeks.length > 0 && !weeks.at(-1)!.window.complete,
    highlight: last?.window.from,
    format: formatCount,
    height: 220,
  };
  // Teams are identities, so each takes a categorical slot in order; Other takes none and stays neutral.
  const parts: ColumnPart[] = labels.map((l, i) => (l === 'Other' ? { key: l, label: l } : { key: l, label: l, color: i + 1 }));
  return (
    <Panel
      title={CALLS_TITLE}
      description={`${last ? `${figureText('count', last.calls)} real-work calls in the ${weekOf(last.window)}` : 'No whole week yet'}${split ? '; by team, the top three and Other' : ''}`}
      actions={ask}
    >
      {!weeks.length ? <EmptyState title="No weeks yet" className="py-8">The first week is drawn once real work has called a tool.</EmptyState>
        : split ? (
          <ColumnChart whole {...shared} parts={parts} columns={weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), values: partsOf(w, labels) }))} />
        ) : (
          <ColumnChart whole {...shared} columns={weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), value: w.calls.value }))} />
        )}
    </Panel>
  );
}

/** The refusals put right by week, and beside them the week pointed at, or the last whole one, in four figures. */
function Followup({ part }: { part: Usage['followup'] }) {
  const title = 'Refusals put right';
  const { index } = useMeridianIndex();
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const weeks = part.data.weeks;
  const at = index !== null && weeks[index] ? index : lastWhole(weeks);
  const shown = at >= 0 ? weeks[at] : null;
  return (
    <Panel title={title} description="Of the refusals that could be followed, the share followed within 120 seconds by an answered call of the same tool in the same session">
      {weeks.length ? (
        <div className="flex flex-col gap-4">
          <ColumnChart
            label="Refusals put right by week, as a share of those that could be followed"
            columns={weeks.map((w) => ({ key: w.window.from, label: formatShortDate(w.window.from), value: w.putRight.figure.value }))}
            dates={weeks.map((w) => w.window.from)}
            running={!weeks.at(-1)!.window.complete}
            highlight={shown?.window.from}
            format={(n) => valueIn('share', n)}
            height={160}
          />
          {shown ? (
            <div data-followup>
              <p className="t-caption mb-1">The {weekOf(shown.window)}{shown.window.complete ? '' : ', so far'}</p>
              {/* Each value wraps whole: a figure and the count it is of are one value, never cut at the card's edge. */}
              <KeyValue columns={2} items={followupLine(shown).map((l) => ({ label: l.label, value: l.value, wrap: true }))} />
            </div>
          ) : null}
        </div>
      ) : <EmptyState title="No weeks yet" className="py-8">A week is drawn once a refusal has been followed.</EmptyState>}
    </Panel>
  );
}

function Traffic({ part }: { part: Usage['traffic'] }) {
  const title = 'The platform\'s own traffic';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const { work, maintenance, window } = part.data;
  return (
    <Panel title={title} description={`All calls in the ${weekOf(window)}: real work beside the platform's own maintenance, which every other figure leaves out`}>
      {work + maintenance
        ? <CompositionBar label="All calls by population" format={formatCount} parts={[{ label: 'Real work', value: work, color: 'accent' }, { label: 'Maintenance', value: maintenance, color: 'neutral' }]} />
        : <EmptyState layout="inline" title="No calls that week">Nothing called a tool in the {weekOf(window)}.</EmptyState>}
    </Panel>
  );
}

function Refusals({ part }: { part: Usage['refusals'] }) {
  const title = 'All refusals by population';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const r = part.data;
  const total = REFUSAL_PARTS.reduce((n, p) => n + r[p.key], 0);
  return (
    <Panel title={title} description={`Every refusal in the ${weekOf(r.window)}, real work's under its four owners, and the platform's own maintenance apart`}>
      {total
        ? <CompositionBar label="All refusals by population" format={formatCount} parts={REFUSAL_PARTS.map((p) => ({ label: p.label, value: r[p.key], color: p.color }))} />
        : <EmptyState layout="inline" title="Nothing refused that week">No call was refused in the {weekOf(r.window)}.</EmptyState>}
    </Panel>
  );
}

/** A tool's median in one week, over the week and the calls it is over, each line whole; the week as a cell writes a day,
 *  as the axes above it do. */
const MedianCell = ({ side }: { side: ToolRow['first'] }) => (
  <span className="inline-flex flex-col whitespace-nowrap">
    <span>{figureText('ms', side.medianMs)}</span>
    <span className="text-xs text-ink-3">{formatShortDate(side.window.from)} · {formatCount(side.calls)} calls</span>
  </span>
);

/** The change from the first week to the last, set down as a movement and never as better or worse. */
function ChangeCell({ row }: { row: ToolRow }) {
  const [a, b] = [row.first.medianMs, row.last.medianMs];
  if (a.value === null || b.value === null || a.value === 0 || a.why || b.why) return <span className="whitespace-nowrap text-xs text-ink-3">Not comparable</span>;
  return <Delta value={(b.value - a.value) / a.value} intent="neutral" />;
}

const TOOL_COLUMNS: Column<ToolRow>[] = aligned([
  { key: 'tool', header: 'Tool', grow: true, mobile: 'title', cell: (r) => <span className="font-mono text-xs whitespace-nowrap" title={r.tool}>{r.tool}</span> },
  { key: 'first', header: 'First week', mobile: 'fact', cell: (r) => <MedianCell side={r.first} />, mobileCell: (r) => `First ${figureText('ms', r.first.medianMs)}` },
  { key: 'last', header: 'Last week', mobile: 'fact', cell: (r) => <MedianCell side={r.last} />, mobileCell: (r) => `Last ${figureText('ms', r.last.medianMs)}` },
  { key: 'change', header: 'Change', mobile: 'status', cell: (r) => <ChangeCell row={r} /> },
]);

/** How many of the registered tools called the gateway names, when it names fewer than were called: the ten called most. */
const toolsShown = (shown: number, total: number) => (total > shown ? `; ${formatCount(shown)} of ${formatCount(total)} tools called, the most called first` : '');

function Tools({ part }: { part: Usage['tools'] }) {
  const title = 'Each tool\'s median call';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const { rows, total } = part.data;
  return (
    <DataTable
      title={title}
      description={`Each registered tool's median call in its first comparable week against the last whole week; under 30 calls a median is too few to compare${toolsShown(rows.length, total)}`}
      caption="Each tool's median call, first week against last"
      noun="tools"
      rows={rows}
      columns={TOOL_COLUMNS}
      rowKey={(r) => r.tool}
      pageSize={10}
      pageSizes={[10]}
      empty={{ title: 'No tool has a median yet', body: 'A tool appears here once real work has called it in a whole week.' }}
    />
  );
}

const WEEK_MS = 7 * 86_400_000;

/**
 * The calls by weekday and hour from where the record begins. A Heatmap draws no gap, so the weeks are named from the
 * later of their own start and the record's, and the grid is drawn only once a whole week of it was observed: before
 * that, a weekday nobody saw would be a row of 0 cells.
 */
function Rhythm({ part, coverageFrom }: { part: Usage['rhythm']; coverageFrom: string | null }) {
  const title = 'Weekday by hour';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const { timezone, window, values } = part.data;
  const fromMs = Math.max(...[window.from, window.observedFrom, coverageFrom].flatMap((t) => (t ? [Date.parse(t)] : [])));
  const begins = fromMs > Date.parse(window.from);
  const seen = coverageFrom !== null && Date.parse(window.to) - fromMs >= WEEK_MS;
  const [start, end] = [formatDay(new Date(fromMs)), formatDay(new Date(Date.parse(window.to) - 1))];
  return (
    <Panel title={title} description={`Real-work calls by weekday and hour in ${timezone}, ${begins ? `from ${start}, when the record begins, to ${end}` : `the weeks of ${start} to ${end}`}`}>
      {seen ? (
        <Heatmap label="Real-work calls by weekday and hour" values={values} timezone={timezone} unit="calls" scale="quantile" />
      ) : <EmptyState layout="inline" title="Not a whole week observed yet" className="py-6">Every hour of the week is drawn once the record holds a whole week of calls.</EmptyState>}
    </Panel>
  );
}

/** The one name every call to a tool no door registers is counted under, which the gateway never counts as a tool. */
const UNREGISTERED = 'Unregistered tools';

function MostUsed({ part }: { part: Usage['mostUsed'] }) {
  const title = 'Tools called most';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const { rows, total } = part.data;
  return (
    <Panel title={title} description={`Real-work calls by tool in the last whole week; a tool no door registers is counted under one name${toolsShown(rows.filter((t) => t.tool !== UNREGISTERED).length, total)}`}>
      {rows.length
        ? <BarList label="Tools called most" limit={8} items={rows.map((t) => ({ key: t.tool, label: <span title={t.tool} className="font-mono text-xs">{t.tool}</span>, value: t.calls }))} />
        : <EmptyState layout="inline" title="No tool was called">Nothing called a tool in the last whole week.</EmptyState>}
    </Panel>
  );
}

function PerApproval({ part }: { part: Usage['perApproval'] }) {
  const title = 'Calls per recorded approval';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const { last, previous } = part.data;
  return (
    <Panel title={title} description="Real-work calls in a week over the approvals zz-core recorded that week">
      <KeyValue items={[last, previous].map((p) => ({ label: `Week of ${formatDay(p.window.from)}`, value: perApprovalText(p) }))} />
    </Panel>
  );
}

function ModelCalls({ part }: { part: Usage['modelCalls'] }) {
  const title = 'The platform\'s model calls';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const { last, previous, byPurpose } = part.data;
  return (
    <Panel title={title} description={`The platform's own calls to a model, in the ${weekOf(last.window)}`}>
      <KeyValue items={[
        { label: 'Calls', value: `${formatCount(last.calls)}, ${formatCount(last.failed)} failed` },
        { label: 'The week before', value: `${formatCount(previous.calls)}, ${formatCount(previous.failed)} failed` },
        { label: 'Tokens', value: `${formatCount(last.inputTokens)} in, ${formatCount(last.outputTokens)} out` },
        { label: 'By purpose', value: byPurpose.map((p) => `${p.purpose} ${formatCount(p.calls)}`).join(', ') || 'None', wrap: true },
        { label: 'Cost', value: <span data-cost className="text-ink-3">{NOT_RECORDED}</span>, title: NOT_RECORDED },
      ]} />
    </Panel>
  );
}

function UsageTrouble({ read }: { read: Exclude<UsageRead, { state: 'ok' }> }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const { title, detail } = usageTrouble(read);
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
