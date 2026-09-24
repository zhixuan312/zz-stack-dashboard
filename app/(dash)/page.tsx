'use client';

import { AlertTriangle, BookOpen, Gauge, Layers } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { RefusalsPanel } from '@/components/RefusalsPanel';
import { Query } from '@/components/Query';
import { BarList } from '@/components/charts/BarList';
import { CompositionBar } from '@/components/charts/CompositionBar';
import { TrendChart } from '@/components/charts/TrendChart';
import { formatCount } from '@/lib/format';
import type { Tint } from '@/lib/tints';
import { freshnessOf, useConsole, useConsoleMode } from '@/lib/api';
import { type Overview, type OverviewMetrics } from '@/lib/api-shapes';
import { Row, type MetricCardProps } from '@/components/ui';
import { usePeriod } from '@/components/PeriodProvider';

/**
 * The landing page — the fleet's census, or one team's, by console mode.
 *
 * The status row answers four questions that do not overlap: is work progressing, is what we
 * write down worth reading, is the tool surface breaking, is the system straining.
 *
 * The period is the URL. `?period=` is read here and sent straight to the gateway, which
 * applies the cutoff in SQL — the page never filters rows it already has, because only the
 * totals travel. That is also what makes the picker linkable and refreshable.
 *
 * What the window means differs per tile. Events, failures, the chart, the refusal table and
 * the event kinds are flows. Documents and initiatives are windowed on `updated_at`, so under
 * a period they answer "touched since", and the sublabel says so. People and teams are state,
 * so they ignore the picker.
 */
/**
 * A bucket's label, on the deployment's calendar — `timezone` off the payload, never the
 * viewer's and never UTC. Every bucket arrives as a UTC instant, so formatting it in the
 * laptop's zone, or slicing the ISO string, labels a bar with a different day than it was
 * cut on.
 */
function bucketLabel(bucket: string, grain: Overview['grain'], timeZone: string): string {
  const d = new Date(bucket);
  // `en-CA` below for its ISO-shaped output: `09-16`, not `16/09` or `Sep 16`.
  if (grain === 'hour') {
    return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' }).format(d);
  }
  if (grain === 'month') {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).format(d);
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone, month: '2-digit', day: '2-digit' }).format(d);
}

/** One decimal only where it changes the reading: 2.3% is a finding, 2.26% is noise. */
const pctText = (v: number | null): string => (v === null ? '—' : `${v < 10 ? v.toFixed(1) : Math.round(v)}%`);
const kbText = (kb: number | null): string =>
  kb === null ? '—' : kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;

/**
 * Movement against the previous window, or nothing at all.
 *
 * Undefined, not a dash, when there is no comparable window: all time has no previous all
 * time, and a row of "—" arrows reads as a broken page rather than as an absent comparison.
 *
 * `goodWhen` is required and not derivable: refusals up is never good news, knowledge from
 * work up always is, and the two tiles sit next to each other in the same row.
 */
function delta(
  now: number | null, prev: number | null, goodWhen: 'up' | 'down', unit: 'pts' | 'pct',
  fmt: (v: number | null) => string,
): MetricCardProps['delta'] {
  if (now === null || prev === null || prev === 0) return undefined;
  // The previous figure rides on the pill, not on a line of its own, so a tile without a
  // delta is the same height as one with it.
  const was = `was ${fmt(prev)}`;
  const diff = unit === 'pts' ? now - prev : ((now - prev) / prev) * 100;
  if (Math.abs(diff) < 0.05) return { value: 'no change', direction: 'flat', sentiment: 'neutral', was };
  const up = diff > 0;
  return {
    value: unit === 'pts' ? `${Math.abs(diff).toFixed(1)}pts` : `${Math.abs(Math.round(diff))}%`,
    direction: up ? 'up' : 'down',
    sentiment: (goodWhen === 'up') === up ? 'good' : 'bad',
    was,
  };
}

/**
 * Measured runs grouped into size decades — the mark under "Context pulled per run".
 *
 * Decades, because the distribution spans them: equal-width bands over a range whose median
 * is 1 KB and whose maximum is past a megabyte put every run but a handful in the first band.
 * An empty band is dropped rather than drawn at the minimum width.
 */
function contextBands(runs: { kb: number }[]): { key: string; value: number; tint: Tint }[] {
  const BANDS: { key: string; max: number; tint: Tint }[] = [
    { key: 'under 1 KB', max: 1, tint: 'sage' },
    { key: '1–10 KB', max: 10, tint: 'accent' },
    { key: '10–100 KB', max: 100, tint: 'amber' },
    { key: 'over 100 KB', max: Infinity, tint: 'rose' },
  ];
  return BANDS.map((b, i) => ({
    key: b.key,
    tint: b.tint,
    value: runs.filter((r) => r.kb <= b.max && (i === 0 || r.kb > BANDS[i - 1].max)).length,
  })).filter((b) => b.value > 0);
}

/**
 * The four tiles, built from figures alone. Every word is a fixed label or a template: no
 * sentence is composed at render time and no number is typed in. The `help` strings are the
 * one place a definition, a caveat or a direction lives; the face carries the number.
 */
function buildMetrics(m: OverviewMetrics): MetricCardProps[] {
  const shelf = m.knowledge.fromWork + m.knowledge.imported;
  return [
    {
      label: 'Initiatives progressing',
      value: pctText(m.progressing.value),
      icon: <Layers />,
      tint: 'accent',
      description: 'median completeness of open work',
      /* The waiting count shares this face because it answers the question the number above
         it raises: if work is not advancing, what is holding it. Stated plainly and not in
         amber — documents awaiting approval are the ordinary shape of work in progress. */
      sublabel: [
        // What the median is taken over: `scoreable` is the open initiatives that declare a
        // flow, which is the only population a completeness median can be computed over.
        m.progressing.scoreable
          ? `${m.progressing.scoreable} of ${m.progressing.active} active`
          : 'none measured',
        m.progressing.waiting
          ? `${m.progressing.waiting} awaiting`
            + (m.progressing.waitingOldestDays !== null ? ` (${m.progressing.waitingOldestDays}d)` : '')
          : null,
      ].filter(Boolean).join(' · '),
      /* Four slices, because the bar can draw four colours: `no flow` and `not started` are
       * both steel, `gated` and `closed` are both sage, and two adjacent slices in one colour
       * are one slice to the eye. Pairs are merged only where they already shared a colour;
       * `help` carries all six stages. */
      mark: (
        <CompositionBar
          legend="none"
          slices={[
            { key: 'not started', value: m.progressing.stages.noflow + m.progressing.stages.notstarted, tint: 'steel' },
            { key: 'drafting', value: m.progressing.stages.drafting, tint: 'amber' },
            { key: 'agreed', value: m.progressing.stages.agreed, tint: 'accent' },
            { key: 'settled', value: m.progressing.stages.gated + m.progressing.stages.closed, tint: 'sage' },
          ]}
          emptyLabel="Nothing active in this period"
        />
      ),
      help: [
        'Is work advancing, or only accumulating? Higher is better.',
        'The median is over OPEN initiatives only: a closed one is 100% complete by definition '
        + 'and never moves again, so including them makes this tile climb to 100% and stay there '
        + 'no matter what the unfinished work is doing.',
        'Every flow declares its own documents and marks which are gates, so an initiative is '
        + 'scored against its own flow\'s list — never against a document called spec.md — and a '
        + 'three-document flow and a seven-document flow are each measured out of their own '
        + 'total. Absent counts 0, written counts a half, approved counts 1. Initiatives with no '
        + 'flow have no denominator and are shown apart rather than scored as zero.',
        'The bar counts all six stages including closed, because where the active set IS is a '
        + 'different question from how far the unfinished work has got. It puts every active '
        + 'initiative in exactly one stage: no flow, not started, drafting, agreed, gated, '
        + 'closed. Gated means every gate is approved and nobody has said what came of it yet; '
        + 'closed means an outcome was recorded.',
        '"Waiting on a person" counts GATE documents that are written and unapproved, in open '
        + 'initiatives only. Both halves matter: a gate nobody has drafted is waiting on the '
        + 'agent, not a human, and an ungated document never needed an approver at all — counting '
        + 'every document with no approver reports 18 things blocked here when 3 are, and puts '
        + 'the 15 that are not at the top. A closed initiative is excluded: nobody goes back to '
        + 'approve a gate on work that already recorded an outcome.',
        `No arrow: ${m.progressing.noDeltaBecause}.`,
      ],
    },
    {
      label: 'Knowledge from work',
      value: pctText(m.knowledge.value),
      icon: <BookOpen />,
      tint: 'blue',
      description: 'share of nodes learned from work',
      delta: delta(m.knowledge.value, m.knowledge.prev, 'up', 'pct', pctText),
      sublabel: `${formatCount(m.knowledge.fromWork)} of ${formatCount(shelf)} nodes · ${formatCount(m.knowledge.searches)} searches`,
      mark: (
        <CompositionBar
          legend="none"
          slices={[
            { key: 'from work', value: m.knowledge.fromWork, tint: 'sage' },
            { key: 'bulk import', value: m.knowledge.imported, tint: 'steel' },
          ]}
          emptyLabel="Nothing on the shelf yet"
        />
      ),
      help: [
        'Is the knowledge base worth reading? Higher is better.',
        'Before reuse can mean anything the shelf has to hold things worth reusing, and a bulk '
        + 'archive import is a library rather than a lesson. An import is a behaviour, not a '
        + `name: more than ${m.knowledge.importThresholdPerHour} nodes minted by one source in a `
        + 'single hour.',
        'Which NODES get read back is not measurable today — search_knowledge records that a '
        + 'search happened, how long it took and how many bytes came back, but never the ids it '
        + 'returned, so searches can be counted and their results cannot.',
        'The shelf is a stock, so it is counted as it stands and compared against the same stock '
        + 'one window earlier.',
      ],
    },
    {
      label: 'Refusal rate',
      value: pctText(m.refusals.value),
      icon: <AlertTriangle />,
      // The one tile whose identity hue carries meaning: rose means bad everywhere in this
      // system, and the hue says what the tile is about, not whether it needs somebody today.
      tint: 'rose',
      description: 'share of tool calls refused',
      delta: delta(m.refusals.value, m.refusals.prev, 'down', 'pts', pctText),
      sublabel: `${formatCount(m.refusals.refused)} of ${formatCount(m.refusals.calls)} calls refused`,
      /* Which door is refusing: the number says how much, the mark says where, and neither is
       * derivable from the other. Same predicate, grouped rather than counted, so the slices
       * sum to the count in the sublabel exactly. */
      mark: (
        <CompositionBar
          legend="none"
          format={formatCount}
          slices={m.refusals.byDoor.map((d) => ({ key: d.door, value: d.n }))}
          emptyLabel="No refused call in this period"
        />
      ),
      help: [
        'Is the tool surface getting in the way? Lower is better.',
        'A rate, not a count — a count rises whenever usage rises and so says nothing about '
        + 'whether the platform got worse. Tool calls, not events: most events on this platform '
        + 'carry no run and are bulk import or admin rather than somebody working. This is the '
        + 'only tile naming a defect somebody can fix today.',
        'The mark splits the same refused calls by the DOOR that refused them — core, eval or '
        + 'manage, read off the tool name — so it sums to the count beside it and says where to '
        + 'go.',
      ],
    },
    {
      label: 'Context pulled per run',
      value: kbText(m.context.value),
      icon: <Gauge />,
      // Amber because this tile's question is "is the system straining?" — warn is what it
      // is about.
      tint: 'amber',
      description: 'median tool output per run',
      delta: delta(m.context.value, m.context.prev, 'down', 'pct', kbText),
      /* Figures only: the tile's definition is on `description`, one line above. */
      sublabel: m.context.p90 === null
        ? 'no measured run'
        : `top 10% ≥ ${kbText(m.context.p90)}`
          + (m.context.unmeasured ? ` · ${formatCount(m.context.unmeasured)} unmeasured` : '')
          // Past the gateway's row cap the previous-window figure is a median over a
          // truncated tail, so the delta is qualified rather than dropped.
          + (m.context.capped ? ' · capped' : ''),
      /* Size bands rather than a dot per run, because what matters here is the tail and a
       * band states it in words. `runs` holds only measured runs; the unmeasured ones are
       * counted in the sublabel and never folded in as zero. */
      mark: (
        <CompositionBar
          legend="none"
          format={formatCount}
          slices={contextBands(m.context.runs)}
          emptyLabel="No measured run in this period"
        />
      ),
      help: [
        'Is the system straining? Lower is better.',
        'A run is one execution of one skill inside one initiative: the platform opens it when an '
        + 'agent invokes a skill, records every tool call it makes and closes it when the skill '
        + 'returns — one conversation can open many runs. Every byte a tool hands back lands in '
        + 'the agent\'s context and is re-read on every later step, which is why more is worse.',
        'Read the bands, not the median: the distribution is heavily skewed and a single number '
        + 'hides the tail, so the runs are grouped by size in decades and the last band is the '
        + `tail. One context window is about ${m.context.contextWindowKb} KB at roughly 4 bytes `
        + 'per token — a rule of thumb, not a measurement, because nothing on this platform '
        + 'counts tokens.',
        'This is not a token count and no table records one; it counts what tools return, never '
        + 'the prompt, the reply or the conversation history.',
        'A run whose bytes were never measured is counted separately and left out of the median '
        + '— it is not a run that moved nothing, and folding the two together is the conflation '
        + 'the nullable bytes_total column exists to prevent.',
      ],
    },
  ];
}

export default function OverviewPage() {
  const { period } = usePeriod();
  const q = useConsole<Overview>(period === 'all' ? '/overview' : `/overview?period=${period}`);
  const { mode } = useConsoleMode();
  const platform = mode === 'platform';
  const m = q.data?.metrics;

  return (
    <DashboardPage
      title="Overview"
      description={
        platform
          ? 'Everything the platform records, across every team.'
          : 'Everything the platform records for your team.'
      }
      showPeriod
      updatedAt={freshnessOf(q)}
      metrics={m ? buildMetrics(m) : undefined}
    >
      <Query query={q}>
        {(d) => {
          /* Summed from the bars, not counted separately: the header states the total of the
             chart beneath it, so reading it off anything else lets the two disagree. */
          const toolCalls = d.toolTrend.reduce((n, b) => n + b.inside + b.outside + b.refused, 0);
          const events = d.eventKinds.reduce((n, k) => n + k.n, 0);
          return (
          <>
            {/* The aside names the teamless remainder, because the Teams page shows a
                per-team figure and the two never add up: turns, tool calls made outside a
                team, and admin acts belonging to a person carry no team. */}
            <Panel
              title="Tool calls over time"
              aside={`${formatCount(toolCalls)} calls · one bar per ${d.grain}`}
            >
              <TrendChart
                points={d.toolTrend.map((x) => ({
                  date: x.bucket,
                  label: bucketLabel(x.bucket, d.grain, d.timezone),
                  inside: x.inside,
                  outside: x.outside,
                  refused: x.refused,
                }))}
                /* Stacked, and the three are disjoint — a call is refused, or attributed to a
                   run, or not yet attributed, never two of those — so the column height is
                   the number of calls in the bucket. Refused sits on top, where a stack is
                   easiest to compare across columns. */
                series={[
                  // "Attributed", not "inside a run": `run_id` is written by the reconciler,
                  // which sweeps every five minutes, so the current bucket always draws as
                  // 100% unattributed and flips once the timer fires.
                  { key: 'inside', label: 'attributed to a run', shape: 'stack', tint: 'accent' },
                  { key: 'outside', label: 'not yet attributed', shape: 'stack', tint: 'blue' },
                  { key: 'refused', label: 'refused', shape: 'stack', tint: 'rose' },
                ]}
              />
            </Panel>

            <Row split="1/2">
              {/* The total, not the number of kinds: the rows are drawn as shares of it. */}
              <Panel title="Event kinds" aside={`${formatCount(events)} events`}>
                <BarList
                  limit={10}
                  /* Every kind is in this array — `limit` caps what is drawn, not what was
                     counted — so the sum is the real denominator. */
                  total={events}
                  rows={d.eventKinds.map((k) => ({
                    key: k.kind,
                    label: <span className="font-mono text-xs">{k.kind}</span>,
                    value: k.n,
                  }))}
                />
              </Panel>

              {/* Refusals on the right: they are a part of the events on the left, and
                  the refused count is not repeated there because this panel states it. */}
              <RefusalsPanel refusals={d.refusals} />
            </Row>
          </>
          );
        }}
      </Query>
    </DashboardPage>
  );
}
