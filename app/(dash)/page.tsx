'use client';

import { AlertTriangle, BookOpen, Gauge, Layers } from 'lucide-react';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { BarList } from '@/components/charts/BarList';
import { CompositionBar } from '@/components/charts/CompositionBar';
import { DotStrip } from '@/components/charts/DotStrip';
import { TrendChart } from '@/components/charts/TrendChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { formatCount } from '@/lib/format';
import { useConsole, useConsoleMode, type Overview, type OverviewMetrics } from '@/lib/api';
import type { MetricCardProps } from '@/components/ui';
import { usePeriod } from '@/components/PeriodProvider';
import { PERIOD_LABEL } from '@/lib/period';

/**
 * The landing page — the fleet's census, or one team's.
 *
 * EVERY LABEL ON IT USED TO SAY "every team", and until the gateway's `/overview` learned
 * a scope that was simply true: the route was `teamless`, so a member's first screen was
 * the whole platform's numbers. Now that it answers per scope, the words have to move with
 * it — a page that reads "across every team" over one team's totals is worse than the leak
 * was, because the number is right and the sentence is wrong.
 *
 * THE STATUS ROW ANSWERS FOUR QUESTIONS AND THEY DO NOT OVERLAP: is work progressing, is
 * what we write down worth reading, is the tool surface breaking, is the system straining.
 * It used to lead with `Teams`, `People` and `Documents` — org facts and a count that
 * unioned 838 knowledge nodes with the governed document chain — none of which is a
 * question somebody opening this page has.
 *
 * THE PERIOD IS THE URL. `?period=` is read here and sent straight to the gateway, which
 * applies the cutoff in SQL — the page never filters rows it already has, because it does
 * not have them: 43,000 events are counted server-side and only the totals travel. That is
 * also what makes the picker linkable and refreshable, which a React state would not be.
 *
 * WHAT THE WINDOW MEANS, PER TILE, because it does not mean the same thing for all of
 * them. Events, failures, the chart, the refusal table and the event kinds are FLOWS —
 * things that happened, and a window over them is the obvious reading. Documents and
 * Initiatives are windowed on `updated_at`, so under a period they answer "touched since",
 * and the sublabel says so rather than leaving a smaller number to be read as a smaller
 * total. People and Teams are STATE, not flow: a headcount has no window that means
 * anything, so they ignore the picker and their sublabels never claim otherwise.
 */
/**
 * One bucket's axis label, in the grain the gateway chose.
 *
 * AN HOUR IS RENDERED IN THE READER'S OWN ZONE and a date is not. Every bucket arrives as
 * a UTC instant; taking `15:00` off that instant and printing it is 23:00 to somebody in
 * Singapore — eight hours wrong on every label, which is the exact failure the gateway's
 * "times go out as an instant" rule exists to prevent. A day, a week and a month need no
 * zone (the gateway's own words: "a day needs no zone"), so those are sliced from the ISO
 * string rather than pushed through a local conversion that could roll them onto the wrong
 * side of midnight.
 */
function bucketLabel(bucket: string, grain: Overview['grain']): string {
  if (grain === 'hour') {
    return new Date(bucket).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  // `2026-09-09T00:00:00Z` → `2026-09` for a month, `09-09` for a day or the week it opens.
  return grain === 'month' ? bucket.slice(0, 7) : bucket.slice(5, 10);
}

/** One decimal only where it changes the reading: 2.3% is a finding, 2.26% is noise. */
const pctText = (v: number | null): string => (v === null ? '—' : `${v < 10 ? v.toFixed(1) : Math.round(v)}%`);
const kbText = (kb: number | null): string =>
  kb === null ? '—' : kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;

/**
 * Movement against the previous window, or nothing at all.
 *
 * NOTHING, NOT A DASH, when there is no comparable window. All time has no previous all
 * time, and with a young platform most windows have no populated predecessor either — a
 * row of four "—" arrows reads as a broken page rather than as an absent comparison.
 *
 * `goodWhen` is required and not derivable: refusals up is never good news, knowledge from
 * work up always is, and the two tiles sit next to each other in the same row.
 */
function delta(
  now: number | null, prev: number | null, goodWhen: 'up' | 'down', unit: 'pts' | 'pct',
): MetricCardProps['delta'] {
  if (now === null || prev === null || prev === 0) return undefined;
  const diff = unit === 'pts' ? now - prev : ((now - prev) / prev) * 100;
  if (Math.abs(diff) < 0.05) return { value: 'no change', direction: 'flat', sentiment: 'neutral' };
  const up = diff > 0;
  return {
    value: unit === 'pts' ? `${Math.abs(diff).toFixed(1)}pts` : `${Math.abs(Math.round(diff))}%`,
    direction: up ? 'up' : 'down',
    sentiment: (goodWhen === 'up') === up ? 'good' : 'bad',
  };
}

/**
 * The four tiles, built from figures alone.
 *
 * EVERY WORD HERE IS FIXED OR A TEMPLATE. No sentence is composed at render time and no
 * number is typed in — the console has to run without a model in the path, so the API sends
 * figures and this function owns the labels. The `help` strings are the one place a
 * definition, a caveat or a direction lives; the face carries the number.
 */
function buildMetrics(m: OverviewMetrics, basis: string): MetricCardProps[] {
  const shelf = m.knowledge.fromWork + m.knowledge.imported;
  return [
    {
      label: 'Initiatives progressing',
      value: pctText(m.progressing.value),
      icon: <Layers />,
      sublabel: m.progressing.scoreable
        ? `median of ${m.progressing.scoreable} scoreable · ${m.progressing.active} active`
        : 'nothing scoreable was active',
      mark: (
        <CompositionBar
          className="[&>ul]:hidden"
          slices={[
            { key: 'no flow', value: m.progressing.stages.noflow, tint: 'steel' },
            { key: 'not started', value: m.progressing.stages.notstarted, tint: 'steel' },
            { key: 'drafting', value: m.progressing.stages.drafting, tint: 'amber' },
            { key: 'agreed', value: m.progressing.stages.agreed, tint: 'accent' },
            { key: 'gated', value: m.progressing.stages.gated, tint: 'sage' },
            { key: 'closed', value: m.progressing.stages.closed, tint: 'sage' },
          ]}
          emptyLabel="Nothing active in this period"
        />
      ),
      help:
        'Is work advancing, or only accumulating? Higher is better. Every flow declares its own '
        + 'documents and marks which are gates, so an initiative is scored against its own flow\'s '
        + 'list — never against a document called spec.md — and a three-document flow and a '
        + 'seven-document flow are each measured out of their own total. Absent counts 0, written '
        + 'counts a half, approved counts 1. The bar puts every active initiative in exactly one '
        + 'stage: no flow, not started, drafting, agreed, gated, closed. Gated means every gate '
        + 'is approved and nobody has said what came of it yet; closed means an outcome was '
        + 'recorded. Initiatives with no flow have '
        + `no denominator and are shown apart rather than scored as zero. No arrow: ${m.progressing.noDeltaBecause}.`,
    },
    {
      label: 'Knowledge from work',
      value: pctText(m.knowledge.value),
      icon: <BookOpen />,
      delta: delta(m.knowledge.value, m.knowledge.prev, 'up', 'pct'),
      sublabel: `${formatCount(m.knowledge.fromWork)} of ${formatCount(shelf)} nodes · ${formatCount(m.knowledge.searches)} searches ${basis.startsWith('all') ? 'all time' : 'in this period'}`,
      mark: (
        <CompositionBar
          className="[&>ul]:hidden"
          slices={[
            { key: 'from work', value: m.knowledge.fromWork, tint: 'sage' },
            { key: 'bulk import', value: m.knowledge.imported, tint: 'steel' },
          ]}
          emptyLabel="Nothing on the shelf yet"
        />
      ),
      help:
        'Is the knowledge base worth reading? Higher is better. Before reuse can mean anything the '
        + 'shelf has to hold things worth reusing, and a bulk archive import is a library rather than '
        + `a lesson. An import is a behaviour, not a name: more than ${m.knowledge.importThresholdPerHour} `
        + 'nodes minted by one source in a single hour. Which NODES get read back is not measurable '
        + 'today — search_knowledge records that a search happened, how long it took and how many '
        + 'bytes came back, but never the ids it returned, so searches can be counted and their '
        + 'results cannot. The shelf is a stock, so it is counted as it stands and compared against '
        + 'the same stock one window earlier.',
    },
    {
      label: 'Refusal rate',
      value: pctText(m.refusals.value),
      icon: <AlertTriangle />,
      tone: m.refusals.value !== null && m.refusals.value >= 5 ? 'attention' : 'neutral',
      delta: delta(m.refusals.value, m.refusals.prev, 'down', 'pts'),
      sublabel: `${formatCount(m.refusals.refused)} of ${formatCount(m.refusals.calls)} calls refused`,
      help:
        'Is the tool surface getting in the way? Lower is better. A rate, not a count — a count '
        + 'rises whenever usage rises and so says nothing about whether the platform got worse. '
        + 'Tool calls, not events: most events on this platform carry no run and are bulk import or '
        + 'admin rather than somebody working. This is the only tile naming a defect somebody can '
        + 'fix today. It carries no mark because the trend below already draws refusals over time.',
    },
    {
      label: 'Context pulled per run',
      value: kbText(m.context.value),
      icon: <Gauge />,
      delta: delta(m.context.value, m.context.prev, 'down', 'pct'),
      sublabel: m.context.p90 === null
        ? 'no measured run in this period'
        : `text the agent carries on every later step — top 10% pull ${kbText(m.context.p90)}`
          + (m.context.unmeasured ? ` · ${m.context.unmeasured} run(s) not measured` : ''),
      mark: (
        <DotStrip
          dots={m.context.runs.map((r, i) => ({ key: `${r.skill}-${i}`, value: r.kb, label: r.skill }))}
          format={kbText}
          reference={{ value: m.context.contextWindowKb, label: 'about one context window' }}
          emptyLabel="No measured run in this period"
        />
      ),
      help:
        'Is the system straining? Lower is better. A run is one execution of one skill inside one '
        + 'initiative: the platform opens it when an agent invokes a skill, records every tool call '
        + 'it makes and closes it when the skill returns — one conversation can open many runs. '
        + 'Every byte a tool hands back lands in the agent\'s context and is re-read on every later '
        + 'step, which is why more is worse. Read the dots, not the median: the distribution is '
        + 'heavily skewed and a single number hides the tail. The red line marks roughly one '
        + `${m.context.contextWindowKb} KB context window at about 4 bytes per token — a rule of `
        + 'thumb, not a measurement, because nothing on this platform counts tokens. This is not a '
        + 'token count and no table records one; it counts what tools return, never the prompt, the '
        + 'reply or the conversation history. A run whose bytes were never measured is counted '
        + 'separately and left out of the median — it is not a run that moved nothing, and folding '
        + 'the two together is the conflation the nullable bytes_total column exists to prevent.',
    },
  ];
}

export default function OverviewPage() {
  const { period } = usePeriod();
  const q = useConsole<Overview>(period === 'all' ? '/overview' : `/overview?period=${period}`);
  const { mode } = useConsoleMode();
  const platform = mode === 'platform';
  const m = q.data?.metrics;
  const basis = period === 'all'
    ? 'all time — no earlier window to compare against'
    : `vs the previous ${PERIOD_LABEL[period].toLowerCase()}`;

  return (
    <DashboardPage
      title="Overview"
      description={
        platform
          ? 'Everything the platform records, across every team.'
          : 'Everything the platform records for your team.'
      }
      showPeriod
      updatedAt={new Date()}
      metrics={m ? buildMetrics(m, basis) : undefined}
    >
      <Query query={q}>
        {(d) => (
          <div className="flex flex-col gap-4">
            {/* The aside names the teamless remainder because the Teams page shows a
                per-team figure and the two will never add up: turns, tool calls made
                outside a team, and admin acts that belong to a person carry no team by
                design. A reader who tries the addition should find the answer here
                rather than assume a bug.

                NOT IN TEAM MODE, where the remainder is 0 by construction — the gateway
                reaches these events through `team_id`, so none of them can be teamless.
                "0 belong to no team" is a true sentence answering a question nobody in
                that view is asking. */}
            <Panel
              title={`Events per ${d.grain}`}
              aside={
                platform
                  ? `${formatCount(d.counts.events)} recorded · ${formatCount(d.counts.unattributedEvents)} belong to no team`
                  : `${formatCount(d.counts.events)} recorded`
              }
            >
              <TrendChart
                points={d.trend.map((x) => ({
                  date: x.bucket,
                  // AN HOUR IS RENDERED IN THE READER'S ZONE, a day is not. The gateway
                  // sends every bucket as a UTC instant; a bare `15:00` off that instant
                  // is 23:00 to somebody in Singapore, which is the exact failure the
                  // gateway's own "times go out as an instant" rule exists for. A day
                  // needs no zone, so it keeps the plain MM-DD the axis already used.
                  label: bucketLabel(x.bucket, d.grain),
                  events: x.events,
                  failures: x.failures,
                }))}
                series={[
                  { key: 'events', label: 'Events', shape: 'area' },
                  { key: 'failures', label: 'Refusals', shape: 'line', tint: 'rose' },
                ]}
              />
            </Panel>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Panel
                title="Most-refused calls"
                aside={`${formatCount(d.counts.failures)} failures`}
                padded={false}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tool</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead>Why it refused</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.refusals.map((r) => (
                      <TableRow key={`${r.block}-${r.tool}-${r.n}`}>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-ink">
                          {r.tool}
                          <span className="block text-[11px] text-ink-faint">{r.block}</span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{r.n}</TableCell>
                        <TableCell className="max-w-[36ch] truncate text-xs" title={r.refusal}>
                          {r.refusal}
                        </TableCell>
                      </TableRow>
                    ))}
                  
                    {d.refusals.length === 0 && (
                      <TableRow><TableCell colSpan={3} className="py-8 text-center text-ink-faint">No block has refused a call in this window.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Panel>

              <Panel title="Event kinds" aside={`${d.eventKinds.length} kinds`}>
                <BarList
                  limit={10}
                  rows={d.eventKinds.map((k) => ({
                    key: k.kind,
                    label: <span className="font-mono text-xs">{k.kind}</span>,
                    value: k.n,
                    caption: k.failed ? `${k.failed} refused` : undefined,
                    tint: k.failed ? 'rose' : undefined,
                  }))}
                />
              </Panel>
            </div>
          </div>
        )}
      </Query>
    </DashboardPage>
  );
}
