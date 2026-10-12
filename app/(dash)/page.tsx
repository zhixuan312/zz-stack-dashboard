'use client';

import Link from 'next/link';
import { BookOpen, Gauge, Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Row } from '@/components/base/shell';
import { BarList } from '@/components/charts/bar-list';
import { CompositionBar } from '@/components/charts/composition-bar';
import { Meridian, useMeridianIndex } from '@/components/charts/meridian';
import { TrendChart } from '@/components/charts/trend-chart';
import { AskAbout } from '@/components/patterns/ask-about';
import { FeaturedMetric } from '@/components/patterns/featured-metric';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { ConsolePage, useArrival } from '@/console/page';
import { Panel } from '@/console/panel';
import { usePeriod } from '@/console/period';
import { Query, failureOf } from '@/console/query';
import { WaitingPanel } from '@/console/waiting';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import { plural } from '@/lib/format';
import type { Overview, OverviewMetrics } from '@/lib/api-shapes';
import { formatCompact, formatPercent } from '@/lib/format';
import { formatCount, formatKb } from '@/lib/format-units';
import { PERIOD_LABEL } from '@/lib/period';
import { useLive } from '@/lib/live';
import { addressOf, pendingContext, whose } from '@/views/context';
import { overviewContext } from '@/views/overview-context';
import { OVERVIEW_METRICS, bucketLabel, change } from '@/views/overview-metrics';

/**
 * The landing page: the fleet's census, or one team's, by console mode.
 *
 * The protagonist is the tool-call trend: every other figure on the page is a part of it or a consequence of it.
 * Beside it, three tiles answer the questions that do not overlap with it: is work advancing, is what we write down
 * worth reading, is the system straining.
 *
 * The period is sent straight to the gateway, which applies the cutoff in SQL; the page never filters rows it already
 * has, because only the totals travel.
 */

function Tiles({ m }: { m: OverviewMetrics }) {
  const shelf = m.knowledge.fromWork + m.knowledge.imported;
  const p = m.progressing;
  return (
    <div className="grid min-w-0 gap-(--stack-gap) md:grid-cols-3 lg:flex lg:flex-col">
      <MetricTile
        label={OVERVIEW_METRICS.progressing.label}
        icon={<Layers />}
        hint={OVERVIEW_METRICS.progressing.hint}
        value={p.value === null ? '—' : p.value / 100}
        format={(n) => formatPercent(n, 0)}
        note={!p.active ? 'No open initiative to measure' : p.waiting ? `${p.waiting} waiting on a person${p.waitingOldestDays !== null ? `, oldest ${Math.round(p.waitingOldestDays)} d` : ''}` : `${p.scoreable} of ${p.active} open initiatives measured`}
      />
      <MetricTile
        label={OVERVIEW_METRICS.knowledge(m.knowledge.importThresholdPerHour).label}
        icon={<BookOpen />}
        hint={OVERVIEW_METRICS.knowledge(m.knowledge.importThresholdPerHour).hint}
        value={m.knowledge.value === null ? '—' : m.knowledge.value / 100}
        format={(n) => formatPercent(n, 0)}
        delta={m.knowledge.value === null ? undefined : change(m.knowledge.value, m.knowledge.prev)}
        note={!shelf ? 'Nothing on the shelf yet' : m.knowledge.prev === null ? `${formatCount(m.knowledge.fromWork)} of ${formatCount(shelf)} nodes` : undefined}
      />
      <MetricTile
        label={OVERVIEW_METRICS.context(m.context.contextWindowKb).label}
        icon={<Gauge />}
        hint={OVERVIEW_METRICS.context(m.context.contextWindowKb).hint}
        value={m.context.value ?? '—'}
        format={formatKb}
        intent="down"
        delta={m.context.value === null ? undefined : change(m.context.value, m.context.prev)}
        note={m.context.prev === null ? (m.context.p90 === null ? 'No run measured yet' : `Top 10% at ${formatKb(m.context.p90)} or more`) : undefined}
      />
    </div>
  );
}

function Refusals({ r, rate, doors, period }: { r: Overview['refusals']; rate: number | null; doors: { door: string; n: number }[]; period: string }) {
  const [axis, setAxis] = useState<'tool' | 'message'>('tool');
  const items = axis === 'tool'
    ? r.byTool.map((x) => ({ key: x.tool, label: <span className="font-mono text-xs">{x.tool}</span>, value: x.n }))
    : r.byMessage.map((x) => ({ key: x.message, label: x.message, meta: x.tools > 1 ? `${x.tools} tools` : x.tool, value: x.n }));
  return (
    <Panel
      title="Refusals"
      description={r.total ? `${formatCount(r.total)} calls refused${rate === null ? '' : `, ${formatPercent(rate / 100)} of all calls`}` : 'Nothing refused a call in this period'}
      actions={r.total ? (
        <>
          <AskAbout iconBelowSm question={`Which refusals over ${period} matter most, and what would stop them?`} />
          <Segmented label="Group refusals by" value={axis} onChange={setAxis} options={[{ value: 'tool', label: 'Tool' }, { value: 'message', label: 'Message' }]} />
        </>
      ) : undefined}
    >
      {r.total ? (
        <div className="flex flex-col gap-6">
          {/* Which door refused: core, eval or manage, read off the tool name. It says where to go first. */}
          {doors.length > 1 ? <CompositionBar label="Refused calls by door" format={formatCount} parts={doors.map((d) => ({ label: d.door, value: d.n }))} /> : null}
          <BarList label={`Refused calls by ${axis}`} limit={5} total={r.total} items={items} format={formatCount} />
        </div>
      ) : <EmptyState layout="inline" title="Nothing refused">Every call in this period got an answer.</EmptyState>}
    </Panel>
  );
}

/** How long the pointer has to rest on a bucket before the page takes it as what the person is pointing at. */
const POINT_SETTLE_MS = 150;

/**
 * Tells the page which bucket the Meridian points at, once the pointer rests there. A sweep across the chart moves the
 * pointer through every bucket, and re-rendering the page for each would cost every tile a render per pixel; what the
 * assistant needs is where the person stopped.
 */
function Pointed({ onChange }: { onChange: (index: number | null) => void }) {
  const { index } = useMeridianIndex();
  useEffect(() => {
    const t = setTimeout(() => onChange(index), POINT_SETTLE_MS);
    return () => clearTimeout(t);
  }, [index, onChange]);
  return null;
}

/** Ask on the featured card: about the bucket the Meridian points at, or about the period. */
function AskOverview({ span, grain, timezone }: { span: string; grain: Overview['grain']; timezone: string }) {
  const { index, dates } = useMeridianIndex();
  const at = index !== null ? dates[index] : null;
  return <AskAbout iconBelowSm question={at ? `Why do tool calls on ${bucketLabel(at, grain, timezone)} look the way they do?` : `What stands out in tool calls over ${span}, and why?`} />;
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-(--stack-gap)">
      <Row split="2/3">
        <Skeleton className="h-96 rounded-xl" />
        <div className="flex flex-col gap-(--stack-gap)">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      </Row>
      <Row split="1/2"><Skeleton className="h-72 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></Row>
    </div>
  );
}

export default function OverviewPage() {
  useLive(['overview']);
  const { period } = usePeriod();
  const { mode } = useConsoleMode();
  const q = useConsole<Overview>(period === 'all' ? '/overview' : `/overview?period=${period}`);
  const arrival = useArrival(q);
  const span = period === 'all' ? 'all time' : `the ${PERIOD_LABEL[period].toLowerCase()}`;
  // The bucket the chart's pointer is on, reported up from inside the Meridian: it is part of what the page shows.
  const [pointed, setPointed] = useState<number | null>(null);
  const context = q.data
    ? overviewContext(q.data, { period, mode, index: pointed, ...arrival })
    : pendingContext({ view: 'overview', title: 'Overview', address: addressOf('/', { period }, { period: 'all' }), scope: `${PERIOD_LABEL[period].toLowerCase()}, ${whose(mode)}` }, failureOf(q));

  return (
    <ConsolePage
      title="Overview"
      description={mode === 'platform' ? 'Everything the platform records, across every team.' : 'Everything the platform records for your team.'}
      updatedAt={freshnessOf(q)}
      context={context}
    >
      <Query query={q} what="The overview" skeleton={<OverviewSkeleton />}>
        {(d) => {
          const dates = d.toolTrend.map((b) => b.bucket);
          const totals = d.toolTrend.map((b) => b.inside + b.outside + b.refused);
          const calls = totals.reduce((a, b) => a + b, 0);
          const events = d.eventKinds.reduce((a, k) => a + k.n, 0);
          const stages = d.metrics.progressing.stages;
          const busiest = d.toolTrend.reduce((m, b, i) => (totals[i] > totals[m] ? i : m), 0);
          return (
            <Meridian dates={dates}>
              <Pointed onChange={setPointed} />
              <Row split="2/3">
                <FeaturedMetric
                  kicker={<>Tool calls · {PERIOD_LABEL[period]}</>}
                  actions={calls ? <AskOverview span={span} grain={d.grain} timezone={d.timezone} /> : undefined}
                  value={calls}
                  daily={totals}
                  format={formatCompact}
                  caption={calls
                    ? <>One point per {d.grain}. The busiest {d.grain === 'week' ? 'was the week of' : 'was'} {bucketLabel(dates[busiest], d.grain, d.timezone)}, with {formatCount(totals[busiest])} calls.</>
                    : undefined}
                >
                  {calls ? <TrendChart
                    height="fill"
                    label={`Tool calls per ${d.grain}`}
                    dates={dates}
                    tick={(b) => bucketLabel(b, d.grain, d.timezone)}
                    stacked
                    series={[
                      { key: 'attributed', label: 'In a run', values: d.toolTrend.map((b) => b.inside) },
                      { key: 'outside', label: 'Outside a run', values: d.toolTrend.map((b) => b.outside) },
                      { key: 'refused', label: 'Refused', values: d.toolTrend.map((b) => b.refused) },
                    ]}
                  /> : (
                    period === 'all' ? (
                      <EmptyState title="No tool call yet" action={<Button asChild variant="primary"><Link href="/settings">Set up a client</Link></Button>}>
                        Calls arrive when a client connected to the platform runs a skill. Settings has the setup for yours.
                      </EmptyState>
                    ) : (
                      <EmptyState kind="filtered" title={`No tool call in the ${PERIOD_LABEL[period].toLowerCase()}`}>A longer period, or All, shows what came before.</EmptyState>
                    )
                  )}
                </FeaturedMetric>
                <Tiles m={d.metrics} />
              </Row>
              <Row split="2/3">
                <WaitingPanel />
                <Panel title="Open work by stage" description={d.metrics.progressing.active ? `${formatCount(d.metrics.progressing.active)} open ${plural(d.metrics.progressing.active, 'initiative')}` : 'Where each open initiative is in its flow'}>
                  {d.metrics.progressing.active ? (
                    <CompositionBar
                      label="Open initiatives by stage"
                      parts={[
                        { label: 'Not started', value: stages.noflow + stages.notstarted, color: 'neutral' },
                        { label: 'Drafting', value: stages.drafting, color: 'warning' },
                        { label: 'Agreed', value: stages.agreed, color: 'accent' },
                        { label: 'Settled', value: stages.gated + stages.closed, color: 'positive' },
                      ]}
                    />
                  ) : <EmptyState layout="inline" title="No open initiative">One starts with initiative_open.</EmptyState>}
                </Panel>
              </Row>
              <Row split="1/2">
                {/* The gateway's rate, over the same refused calls the panel counts: computing one from the chart's buckets
                    would let two numbers for one fact disagree. */}
                <Refusals r={d.refusals} rate={d.metrics.refusals.value} doors={d.metrics.refusals.byDoor} period={span} />
                <Panel title="Event kinds" description={events ? `${formatCount(events)} ${plural(events, 'event')}${d.counts.unattributedEvents ? `, ${formatCount(d.counts.unattributedEvents)} belonging to no team` : ''}` : 'Nothing recorded in this period'}>
                  {events ? <BarList label="Events by kind" limit={5} total={events} format={formatCount} items={d.eventKinds.map((k) => ({ key: k.kind, label: <span className="font-mono text-xs">{k.kind}</span>, value: k.n }))} /> : <EmptyState layout="inline" title="No event yet">Every tool call, document write and approval is recorded here as it happens.</EmptyState>}
                </Panel>
              </Row>
            </Meridian>
          );
        }}
      </Query>
    </ConsolePage>
  );
}
