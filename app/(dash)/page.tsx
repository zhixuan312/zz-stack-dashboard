'use client';

import { BookOpen, Gauge, Layers } from 'lucide-react';
import { useState } from 'react';
import { Row } from '@/components/base/shell';
import { BarList } from '@/components/charts/bar-list';
import { CompositionBar } from '@/components/charts/composition-bar';
import { Meridian } from '@/components/charts/meridian';
import { TrendChart } from '@/components/charts/trend-chart';
import { FeaturedMetric } from '@/components/patterns/featured-metric';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { ConsolePage } from '@/console/page';
import { Panel } from '@/console/panel';
import { usePeriod } from '@/console/period';
import { Query } from '@/console/query';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import type { Overview, OverviewMetrics } from '@/lib/api-shapes';
import { formatCompact, formatCount, formatKb, formatPercent } from '@/lib/format';
import { PERIOD_LABEL } from '@/lib/period';

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

/** A bucket's label on the deployment's calendar (`timezone` off the payload), never the viewer's and never UTC. */
function bucketLabel(bucket: string, grain: Overview['grain'], timeZone: string): string {
  const d = new Date(bucket);
  if (grain === 'hour') return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(d);
  if (grain === 'month') return new Intl.DateTimeFormat('en-GB', { timeZone, month: 'short', year: 'numeric' }).format(d);
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' }).format(d);
}

/** Change against the previous window as a fraction, or nothing: all time has no previous all time. */
const change = (now: number | null, prev: number | null) => (now === null || prev === null || prev === 0 ? null : now / prev - 1);

function Tiles({ m }: { m: OverviewMetrics }) {
  const shelf = m.knowledge.fromWork + m.knowledge.imported;
  const p = m.progressing;
  return (
    <div className="grid min-w-0 gap-(--stack-gap) md:grid-cols-3 lg:flex lg:flex-col">
      <MetricTile
        label="Initiatives progressing"
        icon={<Layers />}
        hint="Median completeness of the open initiatives that declare a flow: absent documents count 0, written a half, approved 1. Closed work is left out, or the figure climbs to 100% and stays there."
        value={p.value === null ? 'None measured' : p.value / 100}
        format={(n) => formatPercent(n, 0)}
        note={p.waiting ? `${p.waiting} waiting on a person${p.waitingOldestDays !== null ? `, oldest ${p.waitingOldestDays} d` : ''}` : `${p.scoreable} of ${p.active} active measured`}
      />
      <MetricTile
        label="Knowledge from work"
        icon={<BookOpen />}
        hint={`Share of the knowledge shelf written by initiatives rather than imported in bulk (more than ${m.knowledge.importThresholdPerHour} nodes from one source in an hour). Higher is better.`}
        value={m.knowledge.value === null ? 'Nothing yet' : m.knowledge.value / 100}
        format={(n) => formatPercent(n, 0)}
        delta={change(m.knowledge.value, m.knowledge.prev)}
        note={m.knowledge.prev === null ? `${formatCount(m.knowledge.fromWork)} of ${formatCount(shelf)} nodes` : undefined}
      />
      <MetricTile
        label="Context per run"
        icon={<Gauge />}
        hint={`Median tool output one skill run pulls into an agent's context. One context window is about ${m.context.contextWindowKb} KB at four bytes a token, a rule of thumb rather than a count. Lower is better.`}
        value={m.context.value ?? 'Not measured'}
        format={formatKb}
        intent="down"
        delta={change(m.context.value, m.context.prev)}
        note={m.context.prev === null ? (m.context.p90 === null ? 'No measured run' : `Top 10% at ${formatKb(m.context.p90)} or more`) : undefined}
      />
    </div>
  );
}

function Refusals({ r, rate }: { r: Overview['refusals']; rate: number | null }) {
  const [axis, setAxis] = useState<'tool' | 'message'>('tool');
  const items = axis === 'tool'
    ? r.byTool.map((x) => ({ key: x.tool, label: <span className="font-mono text-xs">{x.tool}</span>, value: x.n }))
    : r.byMessage.map((x) => ({ key: x.message, label: x.message, meta: x.tools > 1 ? `${x.tools} tools` : x.tool, value: x.n }));
  return (
    <Panel
      title="Refusals"
      description={r.total ? `${formatCount(r.total)} calls refused${rate === null ? '' : `, ${formatPercent(rate / 100)} of all calls`}` : 'Nothing refused a call in this period'}
      actions={r.total ? (
        <Segmented label="Group refusals by" value={axis} onChange={setAxis} options={[{ value: 'tool', label: 'Tool' }, { value: 'message', label: 'Message' }]} />
      ) : undefined}
    >
      {r.total ? <BarList label={`Refused calls by ${axis}`} limit={6} total={r.total} items={items} format={formatCount} /> : null}
    </Panel>
  );
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
  const { period } = usePeriod();
  const { mode } = useConsoleMode();
  const q = useConsole<Overview>(period === 'all' ? '/overview' : `/overview?period=${period}`);

  return (
    <ConsolePage
      title="Overview"
      description={mode === 'platform' ? 'Everything the platform records, across every team.' : 'Everything the platform records for your team.'}
      updatedAt={freshnessOf(q)}
    >
      <Query query={q} skeleton={<OverviewSkeleton />}>
        {(d) => {
          const dates = d.toolTrend.map((b) => b.bucket);
          const totals = d.toolTrend.map((b) => b.inside + b.outside + b.refused);
          const calls = totals.reduce((a, b) => a + b, 0);
          const refused = d.toolTrend.reduce((a, b) => a + b.refused, 0);
          const events = d.eventKinds.reduce((a, k) => a + k.n, 0);
          const stages = d.metrics.progressing.stages;
          const busiest = d.toolTrend.reduce((m, b, i) => (totals[i] > totals[m] ? i : m), 0);
          return (
            <Meridian dates={dates}>
              <Row split="2/3">
                <FeaturedMetric
                  kicker={<>Tool calls · {PERIOD_LABEL[period]}</>}
                  value={calls}
                  daily={totals}
                  format={formatCompact}
                  caption={calls
                    ? <>One point per {d.grain}. The busiest {d.grain === 'week' ? 'was the week of' : 'was'} {bucketLabel(dates[busiest], d.grain, d.timezone)}, with {formatCount(totals[busiest])} calls.</>
                    : 'No tool call was recorded in this period.'}
                >
                  <TrendChart
                    height="fill"
                    label={`Tool calls per ${d.grain}`}
                    dates={dates}
                    tick={(b) => bucketLabel(b, d.grain, d.timezone)}
                    series={[
                      { key: 'calls', label: 'All calls', values: totals, kind: 'area' },
                      { key: 'attributed', label: 'Attributed to a run', values: d.toolTrend.map((b) => b.inside), kind: 'line', color: 2 },
                      { key: 'refused', label: 'Refused', values: d.toolTrend.map((b) => b.refused), kind: 'line', color: 'neutral' },
                    ]}
                  />
                </FeaturedMetric>
                <Tiles m={d.metrics} />
              </Row>
              <Row split="1/2">
                <Panel title="Open work by stage" description={`${formatCount(d.metrics.progressing.active)} active initiatives`}>
                  <CompositionBar
                    label="Active initiatives by stage"
                    parts={[
                      { label: 'Not started', value: stages.noflow + stages.notstarted, color: 'neutral' },
                      { label: 'Drafting', value: stages.drafting, color: 'warning' },
                      { label: 'Agreed', value: stages.agreed, color: 'accent' },
                      { label: 'Settled', value: stages.gated + stages.closed, color: 'positive' },
                    ]}
                  />
                </Panel>
                <Refusals r={d.refusals} rate={refused && calls ? (refused / calls) * 100 : d.metrics.refusals.value} />
              </Row>
              <Row>
                <Panel title="Event kinds" description={`${formatCount(events)} events, ${formatCount(d.counts.unattributedEvents)} belonging to no team`}>
                  <BarList label="Events by kind" limit={10} total={events} format={formatCount} items={d.eventKinds.map((k) => ({ key: k.kind, label: <span className="font-mono text-xs">{k.kind}</span>, value: k.n }))} />
                </Panel>
              </Row>
            </Meridian>
          );
        }}
      </Query>
    </ConsolePage>
  );
}
