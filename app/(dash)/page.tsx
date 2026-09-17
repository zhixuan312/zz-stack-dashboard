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
import { useConsole, useConsoleMode, type Overview, type OverviewMetrics } from '@/lib/api';
import { Row, type MetricCardProps } from '@/components/ui';
import { usePeriod } from '@/components/PeriodProvider';

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
/**
 * A bucket's label, on the DEPLOYMENT'S calendar — `timezone` off the payload, never the
 * viewer's and never UTC.
 *
 * Both of the old spellings were wrong in the same direction. The hour passed `undefined`
 * as the locale, which formats in whatever zone the laptop is in; the day and month SLICED
 * the ISO string, which is UTC, so a bucket cut at midnight in Singapore was labelled with
 * the date it had eight hours earlier in London — the bar and its own label describing
 * different days, with nothing on screen to show it.
 */
function bucketLabel(bucket: string, grain: Overview['grain'], timeZone: string): string {
  const d = new Date(bucket);
  // `en-CA` for its ISO-shaped output: `09-16`, not `16/09` or `Sep 16`.
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
 * NOTHING, NOT A DASH, when there is no comparable window. All time has no previous all
 * time, and with a young platform most windows have no populated predecessor either — a
 * row of four "—" arrows reads as a broken page rather than as an absent comparison.
 *
 * `goodWhen` is required and not derivable: refusals up is never good news, knowledge from
 * work up always is, and the two tiles sit next to each other in the same row.
 */
function delta(
  now: number | null, prev: number | null, goodWhen: 'up' | 'down', unit: 'pts' | 'pct',
  fmt: (v: number | null) => string,
): MetricCardProps['delta'] {
  if (now === null || prev === null || prev === 0) return undefined;
  // The previous figure rides on the pill, not on a line of its own: a comparison row that
  // appears in some tiles and not others is what put the row out of alignment, and the
  // period it compares against is already chosen at the top of the page.
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
 * The four tiles, built from figures alone.
 *
 * EVERY WORD HERE IS FIXED OR A TEMPLATE. No sentence is composed at render time and no
 * number is typed in — the console has to run without a model in the path, so the API sends
 * figures and this function owns the labels. The `help` strings are the one place a
 * definition, a caveat or a direction lives; the face carries the number.
 */
/**
 * Measured runs grouped into size decades — the mark under "Context pulled per run".
 *
 * DECADES, BECAUSE THE DISTRIBUTION SPANS THEM. Equal-width bands over a range whose
 * median is 1 KB and whose maximum is past a megabyte put every run but a handful in
 * the first band, which says nothing. An empty band is dropped rather than drawn at the
 * 2% minimum width: a band nothing fell into is not a small category, it is absent.
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

function buildMetrics(m: OverviewMetrics): MetricCardProps[] {
  const shelf = m.knowledge.fromWork + m.knowledge.imported;
  return [
    {
      label: 'Initiatives progressing',
      value: pctText(m.progressing.value),
      icon: <Layers />,
      tint: 'accent',
      description: 'median completeness of open work',
      /* "OPEN", because the word is the whole correction. The median used to be taken over
       * every scoreable initiative including the CLOSED ones — 13 permanent 100s against 3
       * real numbers, on the day this was found — so the tile read 100% and could not read
       * anything else. The sublabel says which population the median is over, so a reader
       * can see that 3 is the number it rests on. */
      /* THE WAITING COUNT SHARES THIS FACE because it answers the question the number
         above it raises: if work is not advancing, what is holding it? It is the only
         figure on this page naming something a PERSON can unblock — everything else here
         is a rate or a volume. Stated plainly and not in amber: three documents awaiting
         approval is the ordinary shape of work in progress, and a tile that dresses
         ordinary state as a warning is the same mistake as a banner that fires on an
         empty table. The reader can see 3.9 days and judge. */
      sublabel: [
        m.progressing.scoreable
          ? `${m.progressing.scoreable} open · ${m.progressing.active} active`
          : 'none open',
        m.progressing.waiting
          ? `${m.progressing.waiting} awaiting`
            + (m.progressing.waitingOldestDays !== null ? ` (${m.progressing.waitingOldestDays}d)` : '')
          : null,
      ].filter(Boolean).join(' · '),
      /* FOUR BANDS, BECAUSE THE BAR DRAWS FOUR. The six stages were listed six times under
       * a bar that could only ever show four colours: `no flow` and `not started` are both
       * steel, `gated` and `closed` are both sage, and two adjacent slices in one colour
       * are one slice to the eye. So the legend named distinctions the chart above it did
       * not draw, wrapped onto a second line doing it, and made the whole row taller.
       *
       * Pairs are merged where they already shared a colour, and nowhere else — the split
       * that is still visible is still named. `help` carries all six. */
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
      help:
        'Is work advancing, or only accumulating? Higher is better. The median is over OPEN '
        + 'initiatives only: a closed one is 100% complete by definition and never moves again, '
        + 'so including them makes this tile climb to 100% and stay there no matter what the '
        + 'unfinished work is doing. Every flow declares its own '
        + 'documents and marks which are gates, so an initiative is scored against its own flow\'s '
        + 'list — never against a document called spec.md — and a three-document flow and a '
        + 'seven-document flow are each measured out of their own total. Absent counts 0, written '
        + 'counts a half, approved counts 1. The bar counts all six stages including closed, '
        + 'because where the active set IS is a different question from how far the unfinished '
        + 'work has got. It puts every active initiative in exactly one '
        + 'stage: no flow, not started, drafting, agreed, gated, closed. Gated means every gate '
        + 'is approved and nobody has said what came of it yet; closed means an outcome was '
        + 'recorded. Initiatives with no flow have '
        + 'no denominator and are shown apart rather than scored as zero. "Waiting on a person" '
        + 'counts GATE documents that are written and unapproved, in open initiatives only. Both '
        + 'halves matter: a gate nobody has drafted is waiting on the agent, not a human, and an '
        + 'ungated document never needed an approver at all — counting every document with no '
        + 'approver reports 18 things blocked here when 3 are, and puts the 15 that are not at '
        + 'the top. A closed initiative is excluded: nobody goes back to approve a gate on work '
        + `that already recorded an outcome. No arrow: ${m.progressing.noDeltaBecause}.`,
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
      // The one tile whose identity hue carries meaning: refusals are bad, and rose means
      // bad everywhere in this system. The hue says what the tile is ABOUT; whether it
      // needs somebody today is what the delta pill and the number say.
      tint: 'rose',
      description: 'share of tool calls refused',
      delta: delta(m.refusals.value, m.refusals.prev, 'down', 'pts', pctText),
      sublabel: `${formatCount(m.refusals.refused)} of ${formatCount(m.refusals.calls)} calls refused`,
      /* WHICH DOOR IS REFUSING. Rule 6 is satisfied because this is not the rate drawn
       * twice: the number says how much, the mark says where, and neither is derivable
       * from the other. Same predicate, grouped rather than counted, so the slices sum to
       * the count in the sublabel exactly.
       *
       * THE DOOR, NOT THE BLOCK — and the difference is the whole mark. 0.40.0 grouped by
       * `event.block`, which is null on every tool call this platform has ever recorded,
       * so the bar was one full-width slice drawing the number a second time: the exact
       * decoration Rule 6 forbids, shipped under a comment claiming it was not. */
      mark: (
        <CompositionBar
          legend="none"
          format={formatCount}
          slices={m.refusals.byDoor.map((d) => ({ key: d.door, value: d.n }))}
          emptyLabel="No refused call in this period"
        />
      ),
      help:
        'Is the tool surface getting in the way? Lower is better. A rate, not a count — a count '
        + 'rises whenever usage rises and so says nothing about whether the platform got worse. '
        + 'Tool calls, not events: most events on this platform carry no run and are bulk import or '
        + 'admin rather than somebody working. This is the only tile naming a defect somebody can '
        + 'fix today. The mark splits the same refused calls by the DOOR that refused them — '
        + 'core, eval or manage, read off the tool name — so it sums to the count beside it and '
        + 'says where to go. Not by `block`: nothing has ever written one onto a tool call, so '
        + 'that split was one bar drawing the number twice.',
    },
    {
      label: 'Context pulled per run',
      value: kbText(m.context.value),
      icon: <Gauge />,
      // Amber, and it is the hue doing its job rather than decoration: this tile's own
      // question is "is the system straining?", and its dot strip draws a reference line
      // at roughly one context window. Warn is what it is about.
      tint: 'amber',
      description: 'median tool output per run',
      delta: delta(m.context.value, m.context.prev, 'down', 'pct', kbText),
      /* THE SUBLABEL IS FIGURES. It opened with "text the agent carries on every later
       * step", which is the tile's DEFINITION — `description` already carries that, one
       * line above — and the repetition pushed the line into a second row that made this
       * the tallest tile in the row. Rule 2 puts the meaning on the face once. */
      sublabel: m.context.p90 === null
        ? 'no measured run'
        : `top 10% ≥ ${kbText(m.context.p90)}`
          + (m.context.unmeasured ? ` · ${formatCount(m.context.unmeasured)} unmeasured` : ''),
      /* SIZE BANDS, NOT A DOT PER RUN. This was a strip that drew every measured run as
       * its own dot on a log axis, and at the volume this platform now records it was a
       * wall of dots — a different species of object from the three composition bars
       * beside it, and the untidiest thing in the row. What the strip existed to show is
       * the TAIL, and a band states the tail better than a cloud does: "n runs over
       * 100 KB" is the fact, in words, on the same bar the other three tiles use.
       *
       * Log-spaced, because the thing being shown spans orders of magnitude — the bands
       * are decades, not equal widths. `runs` holds only MEASURED runs; the unmeasured
       * ones are counted in the sublabel and never folded in as zero. */
      mark: (
        <CompositionBar
          legend="none"
          format={formatCount}
          slices={contextBands(m.context.runs)}
          emptyLabel="No measured run in this period"
        />
      ),
      help:
        'Is the system straining? Lower is better. A run is one execution of one skill inside one '
        + 'initiative: the platform opens it when an agent invokes a skill, records every tool call '
        + 'it makes and closes it when the skill returns — one conversation can open many runs. '
        + 'Every byte a tool hands back lands in the agent\'s context and is re-read on every later '
        + 'step, which is why more is worse. Read the bands, not the median: the distribution is '
        + 'heavily skewed and a single number hides the tail, so the runs are grouped by size in '
        + `decades and the last band is the tail. One context window is about ${m.context.contextWindowKb} `
        + 'KB at roughly 4 bytes per token — a rule of thumb, not a measurement, because nothing on '
        + 'this platform counts tokens. This is not a '
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
      metrics={m ? buildMetrics(m) : undefined}
    >
      <Query query={q}>
        {(d) => {
          /* SUMMED FROM THE BARS, not counted separately. The header states the total of
             the chart beneath it, so reading it off anything else invites the two to
             disagree — and a header that contradicts its own chart is worse than none. */
          const toolCalls = d.toolTrend.reduce((n, b) => n + b.inside + b.outside + b.refused, 0);
          const events = d.eventKinds.reduce((n, k) => n + k.n, 0);
          return (
          <>
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
              title="Tool calls over time"
              aside={`${formatCount(toolCalls)} calls · one bar per ${d.grain}`}
            >
              <TrendChart
                points={d.toolTrend.map((x) => ({
                  date: x.bucket,
                  // AN HOUR IS RENDERED IN THE READER'S ZONE, a day is not. The gateway
                  // sends every bucket as a UTC instant; a bare `15:00` off that instant
                  // is 23:00 to somebody in Singapore, which is the exact failure the
                  // gateway's own "times go out as an instant" rule exists for. A day
                  // needs no zone, so it keeps the plain MM-DD the axis already used.
                  label: bucketLabel(x.bucket, d.grain, d.timezone),
                  inside: x.inside,
                  outside: x.outside,
                  refused: x.refused,
                }))}
                /* STACKED, AND THE THREE ARE DISJOINT — a call is refused, or it ran
                   inside a run, or it ran outside one, and never two of those. That is
                   what lets the column height be read as the number of calls in the hour.
                   Refused sits on top, where a stack is easiest to compare across
                   columns, because it is the part somebody is looking for. */
                series={[
                  { key: 'inside', label: 'inside a run', shape: 'stack', tint: 'accent' },
                  { key: 'outside', label: 'outside a run', shape: 'stack', tint: 'blue' },
                  { key: 'refused', label: 'refused', shape: 'stack', tint: 'rose' },
                ]}
              />
            </Panel>

            <Row split="1/2">
              {/* THE TOTAL, not the number of kinds: the rows are shares of it, and "5 kinds"
                  gave the percentages nothing to be a share of. */}
              <Panel title="Event kinds" aside={`${formatCount(events)} events`}>
                <BarList
                  limit={10}
                  /* EVERY kind is in this array — `limit` caps what is drawn, not what was
                     counted — so summing it is the real denominator rather than a sample's. */
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
