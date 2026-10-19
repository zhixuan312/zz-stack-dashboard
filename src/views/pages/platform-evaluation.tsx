'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { CalendarDays, Clock, Inbox, RotateCw, ShieldCheck } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { BarList } from '@/components/charts/bar-list';
import { CompositionBar } from '@/components/charts/composition-bar';
import { Sparkline } from '@/components/charts/sparkline';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Delta } from '@/components/ui/delta';
import { EmptyState } from '@/components/ui/empty-state';
import { aligned } from '@/console/columns';
import { STANDING_TONE } from '@/console/eval-score';
import { Panel } from '@/console/panel';
import { formatDate, formatDateTime, formatDay } from '@/lib/format-date';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import type { Evaluation } from '@/lib/platform-shapes';
import { waited } from '@/views/platform-bugs-context';
import {
  ASK, DECISIONS, GUARDRAILS, TILES, asOfLine, evaluationContext, evaluationTrouble, isAdmin, kindOf, nameOf, namesNoPlugin, ownerOf,
  protocolOf, rangeOf, runText, scoreIn, seriesName, seriesRows, standingOf, waitingOf, type EvaluationRead, type PluginScoreRow,
  type SeriesRow, type WaitingFinding,
} from '@/views/platform-evaluation-context';

/** The protagonist's title: the card the page's Ask sits on. COUPLED: the README's `Protagonist:`. */
const PLUGINS_TITLE = 'Each plugin\'s latest score';

/**
 * Each plugin's evaluation, read on the console's server and handed here whole: the four tiles, each plugin's latest
 * score, every score by series with whether a plugin's series compare, the findings by decision and by owner, and the
 * findings waiting, in the form the caller may read. A part the gateway could not work out draws its own state and the
 * rest stands; a read that failed or took longer than its bound is the error state with Retry, which asks the server
 * again. The page reads only: nothing on it starts an evaluation or decides a finding.
 */
export function PlatformEvaluationView({ read }: { read: EvaluationRead }) {
  useShareView(evaluationContext(read));
  if (read.state !== 'ok') return <EvaluationTrouble read={read} />;
  const e = read.evaluation;
  return (
    <Stack>
      <Tiles evaluation={e} />
      <div data-protagonist={PLUGINS_TITLE} className="contents">
        <Plugins part={e.plugins} />
      </div>
      <History part={e.history} />
      <Row split="1/2">
        <ByDecision part={e.byDecision} />
        <ByOwner part={e.byOwner} />
      </Row>
      <Waiting evaluation={e} />
    </Stack>
  );
}

/** The masthead's as-of line, the read's own cutoff: nothing when there is no read to date. */
export function EvaluationAsOf({ read }: { read: EvaluationRead }) {
  if (read.state !== 'ok') return null;
  return <span className="t-small text-ink-3">{asOfLine(read.evaluation)}</span>;
}

/**
 * Evaluation on its way, in the shape of the page. COUPLED: `app/(dash)/platform/evaluation/loading.tsx`, the same
 * blocks before the gate has answered.
 */
export function EvaluationSkeleton() {
  return (
    <>
      <TilesSkeleton count={4} />
      <TableSkeleton rows={3} filters={false} />
      <TableSkeleton rows={4} filters={false} />
      <Row split="1/2"><ChartSkeleton height="h-40" /><ChartSkeleton height="h-40" /></Row>
      <TableSkeleton rows={2} filters={false} />
    </>
  );
}

/** A part the read could not work out, said in its own card, so the parts beside it stand. */
function Unavailable({ title, reason }: { title: string; reason: string }) {
  return (
    <Panel title={title}>
      <EmptyState layout="inline" title={`${title}: unavailable`}>It could not be read ({reason}). The rest of the page stands.</EmptyState>
    </Panel>
  );
}

/** The four tiles: what waits, the scores established, when a plugin was last scored, and on how many days. */
function Tiles({ evaluation: e }: { evaluation: Evaluation }) {
  const { tiles } = e;
  const oldest = waitingOf(e)[0];
  const scored = e.plugins.state === 'ok' ? e.plugins.data.length : null;
  return (
    <Row split="tiles" data-figures="read">
      <MetricTile
        label={TILES.waiting.label} hint={TILES.waiting.definition} icon={<Inbox />} value={tiles.waiting} format="count"
        emphasis={tiles.waiting > 0} note={oldest ? `Oldest waiting ${waited(oldest.waitingSince, e.meta.asOf)}` : 'Nothing waits for a decision'}
      />
      <MetricTile
        label={TILES.established.label} hint={TILES.established.definition} icon={<ShieldCheck />} value={tiles.established} format="count"
        note={scored === null ? undefined : `Of ${formatCount(scored)} ${plural(scored, 'plugin')} scored`}
      />
      <MetricTile
        label={TILES.lastScored.label} hint={TILES.lastScored.definition} icon={<Clock />}
        value={tiles.lastScored ? formatDate(tiles.lastScored) : 'Never'} note={tiles.lastScored ? formatDateTime(tiles.lastScored) : 'No scoring recorded'}
      />
      <MetricTile
        label={TILES.daysScored.label} hint={TILES.daysScored.definition.replace('the reporting time zone', e.meta.timezone)} icon={<CalendarDays />}
        value={tiles.daysScored} format="count" note={e.meta.coverageFrom ? `Since ${formatDay(e.meta.coverageFrom)}` : undefined}
      />
    </Row>
  );
}

const GUARDRAIL_TONE = { pass: 'positive', fail: 'critical', not_established: 'neutral' } as const;
/** The guardrails as the phone card's sentence says them. */
const GUARDRAILS_SAID = { pass: 'guardrails held', fail: 'a guardrail failed', not_established: 'guardrails not established' } as const;
/**
 * An identifier, kept whole on one line: a key broken mid-word ("reliab / ility") is not the key. Every column but the
 * lead holds its content whole, so it takes the width its longest value needs and the lead column keeps only the slack
 * left; an identifier too long for a column of its own is a caption under the lead instead. Each table's columns are
 * held under its own width where `hideBelow` lets them show: the managed lead keeps 256px from 672px.
 */
const ident = 'font-mono text-xs whitespace-nowrap';

/** A score out of ten with its range under it; a scoring with no score says so in words, never as 0. */
function ScoreCell({ r }: { r: PluginScoreRow }) {
  if (r.score.value === null) return <span className="whitespace-nowrap text-xs text-ink-3">No score</span>;
  const range = rangeOf(r.lower, r.upper);
  return (
    <span className="inline-flex flex-col whitespace-nowrap" title={range ? `${scoreIn(r.score.value)} / 10, ${range}` : `${scoreIn(r.score.value)} / 10`}>
      <span className="text-sm font-semibold tabular-nums text-ink">{scoreIn(r.score.value)}<span className="text-xs font-regular text-ink-3"> / 10</span></span>
      {range ? <span className="t-caption tabular-nums">{range}</span> : null}
    </span>
  );
}

const PLUGIN_COLUMNS: Column<PluginScoreRow>[] = aligned([
  // The protocol is the plugin's caption, at every width: as a column of its own it squeezed the figures beside it.
  {
    key: 'plugin', header: 'Plugin', grow: true, mobile: 'title', title: (r) => `${r.plugin}, ${protocolOf(r.protocol)}`,
    cell: (r) => (
      <span className="block min-w-0">
        <span className={`${ident} block font-medium text-ink`}>{r.plugin}</span>
        <span data-protocol className={`${ident} t-caption block`}>{protocolOf(r.protocol)}</span>
      </span>
    ),
  },
  // A phone card's one fact is a sentence that wraps as words: three facts wrapped whole, and the managed table's dot
  // before the one that moved down opened a line of its own ("· Scored 13 Oct 2026").
  {
    key: 'score', header: 'Score', mobile: 'fact', cell: (r) => <ScoreCell r={r} />,
    mobileCell: (r) => `${r.score.value === null ? 'No score' : `${scoreIn(r.score.value)} / 10`}, ${GUARDRAILS_SAID[r.guardrails]}, scored ${formatDay(r.scoredAt)}`,
  },
  { key: 'standing', header: 'Standing', align: 'left', mobile: 'status', cell: (r) => <Badge tone={STANDING_TONE[r.standing]}>{standingOf(r.standing)}</Badge> },
  { key: 'guardrails', header: 'Guardrails', align: 'left', hideBelow: 'lg', cell: (r) => <Badge tone={GUARDRAIL_TONE[r.guardrails]}>{GUARDRAILS[r.guardrails]}</Badge> },
  { key: 'scored', header: 'Scored', numeric: true, cell: (r) => <time dateTime={r.scoredAt} title={formatDateTime(r.scoredAt)}>{formatDate(r.scoredAt)}</time> },
]);

/** Each plugin's latest scoring, the page's protagonist, with the Ask in its head. */
function Plugins({ part }: { part: Evaluation['plugins'] }) {
  const router = useRouter();
  return (
    <DataTable
      title={PLUGINS_TITLE}
      description="Each plugin's latest scoring: its score out of ten with its range, how far it can be trusted, whether the guardrails held, and the protocol it was scored against"
      actions={<AskAbout question={ASK} />}
      caption="Each plugin's latest score"
      noun="plugins"
      rows={part.state === 'ok' ? part.data : []}
      columns={PLUGIN_COLUMNS}
      rowKey={(r) => r.plugin}
      pageSize={10}
      pageSizes={[10]}
      error={part.state === 'ok' ? undefined : `Each plugin's latest score could not be read (${part.reason}). The rest of the page stands.`}
      onRetry={() => router.refresh()}
      empty={{ title: 'No plugin scored yet', body: 'A plugin is listed here once an evaluation of it has been scored.' }}
    />
  );
}

/** A series' scores, oldest first: each its score with its range on one line, its standing and day on the next. */
function RunsCell({ r }: { r: SeriesRow }) {
  return (
    <ol className="flex flex-col gap-1.5" title={r.series.runs.map(runText).join('; ')}>
      {r.series.runs.map((run) => (
        <li key={run.scoredAt} className="flex flex-col whitespace-nowrap text-xs text-ink-2">
          <span>
            <span className="font-semibold tabular-nums text-ink">{run.score === null ? 'No score' : scoreIn(run.score)}</span>
            {run.score !== null && rangeOf(run.lower, run.upper) ? <span className="text-ink-3"> ({rangeOf(run.lower, run.upper)})</span> : null}
          </span>
          <span className="text-ink-3">{standingOf(run.standing)} · {formatDate(run.scoredAt)}</span>
        </li>
      ))}
    </ol>
  );
}

/** The change within one series, and its shape: drawn only over the series' own scores, never across two series. */
function TrendCell({ r }: { r: SeriesRow }) {
  if (!r.trend) return <span className="whitespace-nowrap text-xs text-ink-3">{r.series.runs.length === 1 ? 'One scoring' : 'Under two scores'}</span>;
  return (
    <span data-trend className="inline-flex items-center gap-2 whitespace-nowrap">
      <Sparkline values={r.trend.points} color="neutral" height={28} className="w-20" />
      <Delta value={r.trend.change} intent="neutral" format={(n) => `${scoreIn(Math.abs(n))} pts`} />
    </span>
  );
}

/**
 * A row a series: the plugin leads, with the read's statement of whether its series compare said once, on its first
 * row; the series is named by its protocol and the population under it, each on one line, so the column is as wide as
 * the longer of the two and the lead keeps only the slack.
 */
const SERIES_COLUMNS: Column<SeriesRow>[] = aligned([
  {
    key: 'plugin', header: 'Plugin', grow: true, mobile: 'title', title: (r) => `${r.plugin}, ${r.statement}`,
    cell: (r) => (
      <span className="block min-w-0">
        <span className={`${ident} block font-medium text-ink`}>{r.plugin}</span>
        {r.first ? <span data-statement className="t-caption block">{r.statement}</span> : null}
      </span>
    ),
    mobileCell: (r) => r.plugin,
  },
  {
    key: 'series', header: 'Series', align: 'left', mobile: 'fact', title: (r) => seriesName(r.series),
    cell: (r) => (
      <span className="block">
        <span className={`${ident} block text-ink`}>{protocolOf(r.series.protocol)}</span>
        <span data-population className="t-caption block whitespace-nowrap">{r.series.population ?? 'Population not recorded'}</span>
      </span>
    ),
    mobileCell: (r) => protocolOf(r.series.protocol),
  },
  { key: 'scores', header: 'Scores', align: 'left', mobile: 'fact', cell: (r) => <RunsCell r={r} />, mobileCell: (r) => `${formatCount(r.series.runs.length)} ${plural(r.series.runs.length, 'scoring')}` },
  { key: 'trend', header: 'Within the series', align: 'left', hideBelow: 'lg', mobile: 'status', cell: (r) => <TrendCell r={r} /> },
]);

/** Every score, one row a series: a plugin's statement says whether its series compare, and a trend stays inside its row. */
function History({ part }: { part: Evaluation['history'] }) {
  const router = useRouter();
  return (
    <DataTable
      title="Every score, by series"
      description="A series is one protocol version and one population: a change is drawn within a series and never across two"
      caption="Every score, by series"
      noun="series"
      rows={part.state === 'ok' ? seriesRows(part.data) : []}
      columns={SERIES_COLUMNS}
      rowKey={(r) => r.key}
      pageSize={10}
      pageSizes={[10]}
      error={part.state === 'ok' ? undefined : `Every score by series could not be read (${part.reason}). The rest of the page stands.`}
      onRetry={() => router.refresh()}
      empty={{ title: 'No score recorded yet', body: 'A series starts with a plugin\'s first scoring.' }}
    />
  );
}

/** Every finding recorded by its decision, the deferred ones being those still waiting. */
function ByDecision({ part }: { part: Evaluation['byDecision'] }) {
  const title = 'Findings by decision';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const total = DECISIONS.reduce((n, d) => n + part.data[d.key], 0);
  return (
    <Panel title={title} description="Every defect and unknown recorded, each counted once; strengths have no decision">
      {total
        ? <CompositionBar label={title} format={formatCount} parts={DECISIONS.map((d) => ({ label: d.label, value: part.data[d.key], color: d.color }))} />
        : <EmptyState layout="inline" title="No finding recorded yet">A finding is counted here once an evaluation records one.</EmptyState>}
    </Panel>
  );
}

/** The same findings by the owner category each blames, most first. */
function ByOwner({ part }: { part: Evaluation['byOwner'] }) {
  const title = 'Findings by owner';
  if (part.state !== 'ok') return <Unavailable title={title} reason={part.reason} />;
  const items = Object.entries(part.data).map(([o, n]) => ({ key: o, label: ownerOf(o), value: n }));
  return (
    <Panel title={title} description="The same findings by the owner category each blames">
      {items.length
        ? <BarList label={title} format={formatCount} total={items.reduce((n, i) => n + i.value, 0)} items={items} />
        : <EmptyState layout="inline" title="No finding recorded yet">A finding is counted here once an evaluation records one.</EmptyState>}
    </Panel>
  );
}

/**
 * A waiting finding, named by what it found as far as its reader may read it: for the superadmin the pattern the
 * evaluation recorded, with the measure it was recorded on under it; for a member the gateway's fixed name, its kind,
 * plugin and owner category, since the pattern and the measure are the owning team's words. A finding whose owner
 * category is not known is named by the spec's own sentence, which leaves its plugin unsaid, so the plugin goes under it.
 */
function FindingCell({ f }: { f: WaitingFinding }) {
  return (
    <span className="block min-w-0">
      <span data-finding-name className="block whitespace-normal font-medium text-ink [overflow-wrap:anywhere]">{nameOf(f)}</span>
      {f.measure ? <span data-measure className="t-caption block">Measure <span className={ident}>{f.measure}</span></span> : null}
      {namesNoPlugin(f) ? <span data-plugin className="t-caption block">Plugin <span className={ident}>{f.plugin}</span></span> : null}
    </span>
  );
}

/** A finding as a phone card's title and a cell's title say it: its name, and its plugin where the name leaves it out. */
const findingText = (f: WaitingFinding): string => (namesNoPlugin(f) ? `${nameOf(f)}, in ${f.plugin}` : nameOf(f));

/**
 * The superadmin's rows say the plugin, the kind and the owner category in columns of their own, beside the pattern; a
 * member's name already says all three, or carries the plugin under it, so their row is the name, its kind's badge and
 * how long it has waited.
 */
const waitingColumns = (asOf: string, admin: boolean): Column<WaitingFinding>[] => aligned([
  { key: 'finding', header: 'Finding', grow: true, mobile: 'title', title: (f) => [findingText(f), f.measure && `measure ${f.measure}`].filter(Boolean).join('; '), cell: (f) => <FindingCell f={f} />, mobileCell: findingText },
  ...(admin ? [{ key: 'plugin', header: 'Plugin', align: 'left', mobile: 'fact', title: (f) => f.plugin, cell: (f) => <span className={ident}>{f.plugin}</span> }] satisfies Column<WaitingFinding>[] : []),
  { key: 'kind', header: 'Kind', align: 'left', mobile: 'status', cell: (f) => <Badge tone={f.kind === 'defect' ? 'warning' : 'neutral'}>{kindOf(f.kind)}</Badge> },
  ...(admin ? [{ key: 'owner', header: 'Owner', align: 'left', hideBelow: 'lg', cell: (f) => <span className="whitespace-nowrap">{ownerOf(f.owner)}</span> }] satisfies Column<WaitingFinding>[] : []),
  {
    key: 'since', header: 'Waiting', numeric: true, mobile: 'fact', title: (f) => formatDateTime(f.waitingSince),
    cell: (f) => (
      <span className="block whitespace-nowrap">
        {waited(f.waitingSince, asOf)}
        <time dateTime={f.waitingSince} className="t-caption block">Since {formatDate(f.waitingSince)}</time>
      </span>
    ),
    mobileCell: (f) => `Waiting ${waited(f.waitingSince, asOf)}`,
  },
]);

/** The findings still waiting for a decision, oldest first, each in the form the caller may read. */
function Waiting({ evaluation: e }: { evaluation: Evaluation }) {
  const router = useRouter();
  const part = e.waiting;
  const admin = isAdmin(e);
  return (
    <DataTable
      title="Findings waiting for a decision"
      description={admin ? 'Defects and unknowns with no decision yet, oldest first, each by the pattern its evaluation recorded and the measure it was recorded on' : 'Defects and unknowns with no decision yet, oldest first, each by its kind, its plugin and its owner category; their own words are the owning team\'s'}
      caption="Findings waiting for a decision, oldest first"
      noun="findings"
      rows={waitingOf(e)}
      columns={waitingColumns(e.meta.asOf, admin)}
      rowKey={(f) => f.id}
      pageSize={10}
      pageSizes={[10]}
      error={part.state === 'ok' ? undefined : `The findings waiting could not be read (${part.reason}). The rest of the page stands.`}
      onRetry={() => router.refresh()}
      empty={{ title: 'Nothing waits for a decision', body: 'A finding is listed here while it has no decision.' }}
    />
  );
}

function EvaluationTrouble({ read }: { read: Exclude<EvaluationRead, { state: 'ok' }> }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const { title, detail } = evaluationTrouble(read);
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
