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
import { formatDate, formatDateTime } from '@/lib/format-date';
import { plural } from '@/lib/format';
import { formatCount } from '@/lib/format-units';
import type { Evaluation } from '@/lib/platform-shapes';
import { waited } from '@/views/platform-bugs-context';
import {
  ASK, DECISIONS, GUARDRAILS, TILES, asOfLine, evaluationContext, evaluationTrouble, isAdmin, kindOf, ownerOf,
  protocolOf, rangeOf, runText, scoreIn, seriesRows, standingOf, waitingOf, type EvaluationRead, type PluginScoreRow,
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
        value={tiles.daysScored} format="count" note={e.meta.coverageFrom ? `Since ${formatDate(e.meta.coverageFrom)}` : undefined}
      />
    </Row>
  );
}

const GUARDRAIL_TONE = { pass: 'positive', fail: 'critical', not_established: 'neutral' } as const;
const mono = 'font-mono text-xs whitespace-normal [overflow-wrap:anywhere]';

/** A score out of ten with its range under it; a scoring with no score says so in words, never as 0. */
function ScoreCell({ r }: { r: PluginScoreRow }) {
  if (r.score.value === null) return <span className="text-xs text-ink-3">No score</span>;
  const range = rangeOf(r.lower, r.upper);
  return (
    <span className="inline-flex flex-col" title={range ? `${scoreIn(r.score.value)} / 10, ${range}` : `${scoreIn(r.score.value)} / 10`}>
      <span className="text-sm font-semibold tabular-nums text-ink">{scoreIn(r.score.value)}<span className="text-xs font-regular text-ink-3"> / 10</span></span>
      {range ? <span className="t-caption tabular-nums">{range}</span> : null}
    </span>
  );
}

const PLUGIN_COLUMNS: Column<PluginScoreRow>[] = aligned([
  // Under 896px the protocol gives way, and the plugin's title names it, as the series below do.
  { key: 'plugin', header: 'Plugin', grow: true, mobile: 'title', title: (r) => `${r.plugin}, ${protocolOf(r.protocol)}`, cell: (r) => <span className={`${mono} font-medium text-ink`}>{r.plugin}</span> },
  { key: 'score', header: 'Score', mobile: 'fact', cell: (r) => <ScoreCell r={r} />, mobileCell: (r) => (r.score.value === null ? 'No score' : `${scoreIn(r.score.value)} / 10`) },
  { key: 'standing', header: 'Standing', align: 'left', mobile: 'status', cell: (r) => <Badge tone={STANDING_TONE[r.standing]}>{standingOf(r.standing)}</Badge> },
  { key: 'guardrails', header: 'Guardrails', align: 'left', mobile: 'fact', cell: (r) => <Badge tone={GUARDRAIL_TONE[r.guardrails]}>{GUARDRAILS[r.guardrails]}</Badge>, mobileCell: (r) => `Guardrails ${GUARDRAILS[r.guardrails].toLowerCase()}` },
  { key: 'protocol', header: 'Protocol', align: 'left', hideBelow: 'lg', title: (r) => protocolOf(r.protocol), cell: (r) => <span className={mono}>{protocolOf(r.protocol)}</span> },
  { key: 'scored', header: 'Scored', numeric: true, mobile: 'fact', cell: (r) => <time dateTime={r.scoredAt} title={formatDateTime(r.scoredAt)}>{formatDate(r.scoredAt)}</time>, mobileCell: (r) => `Scored ${formatDate(r.scoredAt)}` },
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
      error={part.state === 'ok' ? undefined : `Each plugin's latest score could not be read (${part.reason}). The rest of the page stands.`}
      onRetry={() => router.refresh()}
      empty={{ title: 'No plugin scored yet', body: 'A plugin is listed here once an evaluation of it has been scored.' }}
    />
  );
}

/** A series' scores, oldest first: each with its range and standing, or its standing alone. */
function RunsCell({ r }: { r: SeriesRow }) {
  return (
    <ol className="flex flex-col gap-0.5" title={r.series.runs.map(runText).join('; ')}>
      {r.series.runs.map((run) => (
        <li key={run.scoredAt} className="whitespace-normal text-xs text-ink-2">
          <span className="font-semibold tabular-nums text-ink">{run.score === null ? 'No score' : scoreIn(run.score)}</span>
          {run.score !== null && rangeOf(run.lower, run.upper) ? <span className="text-ink-3"> ({rangeOf(run.lower, run.upper)})</span> : null}
          <span className="text-ink-3"> · {standingOf(run.standing).toLowerCase()} · {formatDate(run.scoredAt)}</span>
        </li>
      ))}
    </ol>
  );
}

/** The change within one series, and its shape: drawn only over the series' own scores, never across two series. */
function TrendCell({ r }: { r: SeriesRow }) {
  if (!r.trend) return <span className="text-xs text-ink-3">{r.series.runs.length === 1 ? 'One scoring' : 'Under two scores'}</span>;
  return (
    <span data-trend className="inline-flex items-center gap-2">
      <Sparkline values={r.trend.points} color="neutral" height={28} className="w-20" />
      <Delta value={r.trend.change} intent="neutral" format={(n) => `${scoreIn(Math.abs(n))} pts`} />
    </span>
  );
}

const SERIES_COLUMNS: Column<SeriesRow>[] = aligned([
  {
    key: 'plugin', header: 'Plugin', grow: true, mobile: 'title', title: (r) => `${r.plugin}: ${r.statement}`,
    cell: (r) => (
      <span className="block min-w-0">
        <span className={`${mono} block font-medium text-ink`}>{r.plugin}</span>
        <span data-statement className="t-caption block whitespace-normal [overflow-wrap:anywhere]">{r.statement}</span>
      </span>
    ),
    mobileCell: (r) => `${r.plugin}: ${r.statement}`,
  },
  { key: 'protocol', header: 'Protocol', align: 'left', mobile: 'fact', title: (r) => protocolOf(r.series.protocol), cell: (r) => <span className={mono}>{protocolOf(r.series.protocol)}</span> },
  { key: 'population', header: 'Population', align: 'left', hideBelow: 'md', title: (r) => r.series.population ?? 'Not recorded', cell: (r) => <span className="block whitespace-normal text-xs [overflow-wrap:anywhere]">{r.series.population ?? <span className="text-ink-3">Not recorded</span>}</span> },
  { key: 'scores', header: 'Scores', align: 'left', mobile: 'fact', cell: (r) => <RunsCell r={r} />, mobileCell: (r) => `${formatCount(r.series.runs.length)} ${plural(r.series.runs.length, 'scoring')}` },
  { key: 'trend', header: 'Within the series', align: 'left', mobile: 'status', cell: (r) => <TrendCell r={r} /> },
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

/** A waiting finding: its fixed summary, and for the superadmin the pattern the evaluation recorded under it. */
function FindingCell({ f }: { f: WaitingFinding }) {
  return (
    <span className="block min-w-0">
      <span className="block whitespace-normal font-medium text-ink [overflow-wrap:anywhere]">{f.summary}</span>
      {f.pattern ? <span data-pattern className="t-caption block whitespace-normal [overflow-wrap:anywhere]">{f.pattern}</span> : null}
    </span>
  );
}

const waitingColumns = (asOf: string, admin: boolean): Column<WaitingFinding>[] => aligned([
  { key: 'finding', header: 'Finding', grow: true, mobile: 'title', title: (f) => (f.pattern ? `${f.summary}: ${f.pattern}` : f.summary), cell: (f) => <FindingCell f={f} />, mobileCell: (f) => f.summary },
  { key: 'plugin', header: 'Plugin', align: 'left', mobile: 'fact', title: (f) => f.plugin, cell: (f) => <span className={mono}>{f.plugin}</span> },
  { key: 'kind', header: 'Kind', align: 'left', mobile: 'status', cell: (f) => <Badge tone={f.kind === 'defect' ? 'warning' : 'neutral'}>{kindOf(f.kind)}</Badge> },
  { key: 'owner', header: 'Owner', align: 'left', hideBelow: 'md', cell: (f) => ownerOf(f.owner) },
  ...(admin ? [{ key: 'measure', header: 'Measure', align: 'left' as const, hideBelow: 'lg' as const, title: (f: WaitingFinding) => f.measure ?? 'None recorded', cell: (f: WaitingFinding) => (f.measure ? <span className={mono}>{f.measure}</span> : <span className="text-ink-3">None recorded</span>) }] : []),
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
      description={admin ? 'Defects and unknowns with no decision yet, oldest first, each with the pattern its evaluation recorded' : 'Defects and unknowns with no decision yet, oldest first, each by its plugin and owner category; their own words are the owning team\'s'}
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
