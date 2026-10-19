'use client';

import type { ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { FeaturedMetric } from '@/components/patterns/featured-metric';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CopyField } from '@/components/ui/copy-field';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { aligned } from '@/console/columns';
import { Day, Goes, SCORE_OUT_OF } from '@/console/eval-score';
import { Panel } from '@/console/panel';
import { EvalLearning, EvalNotYet, EvalUsage } from '@/console/plugin-eval-evidence';
import { EvalAutomationTrust, EvalEvolution } from '@/console/plugin-eval-evolution';
import { EvalHeadline, EvalHealth, EvalQuality } from '@/console/plugin-eval-overview';
import { failureOf } from '@/console/query';
import { count } from '@/console/words';
import type { Revised } from '@/data/gateway';
import { useDataClock } from '@/lib/api';
import type { PluginEval, PluginEvalFound, PluginRow } from '@/lib/api-shapes';
import type { PluginScore } from '@/lib/destination-shapes';
import { formatDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { comparedSaid, evalPath, pluginContext, type EvalRead, type PluginRead } from '@/views/plugin-context';
import { FROM_THE_FRONT, PLUGINS_PATH, protocolNamed, readTrouble, standingSaid, type Catalog, type PluginsRead } from '@/views/plugins-context';
import { useServed } from '@/views/use-served';

type PluginSkill = PluginRow['skills'][number];

/** The protagonist's name: the lead card, where the page's Ask sits. COUPLED: the README's `Protagonist:`. */
const LEAD_TITLE = 'Its public score';

function skillColumns(plugin: string): Column<PluginSkill>[] {
  return aligned([
    {
      // The stage number prefixes the name: the front door is unnumbered, because it is not step zero, it is the plugin.
      key: 'skill', header: 'Skill', grow: true, mobile: 'title', title: (s) => s.name,
      cell: (s) => (
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="t-num w-4 shrink-0 text-right text-xs text-ink-3">{s.position ?? '—'}</span>
          <span className="truncate font-medium text-ink" title={s.name}>{s.name}</span>
          {s.isEntry ? <span className="t-caption shrink-0">the front door</span> : null}
          <Goes className="self-center" />
        </span>
      ),
      mobileCell: (s) => <span className="[overflow-wrap:anywhere]">{s.name} <Goes /></span>,
    },
    // A skill's origin comes from a `source:` line in its own SKILL.md, so it varies the day a vendored skill ships. A
    // label down a column, so never the accent, which is kept for what a person presses.
    { key: 'whose', header: 'Whose', hideBelow: 'md', mobile: 'status', cell: (s) => (s.origin === 'theirs' ? <Badge tone="neutral" dot>The {plugin} team&apos;s</Badge> : <Badge tone="neutral">Ours</Badge>) },
    { key: 'versions', header: 'Versions', numeric: true, hideBelow: 'lg', cell: (s) => count(s.versions) },
    { key: 'calls', header: 'Your team\'s calls', numeric: true, mobile: 'fact', cell: (s) => (s.everRun ? formatCount(s.calls) : <span className="text-ink-3">—</span>), mobileCell: (s) => (s.everRun ? `${formatCount(s.calls)} by your team` : 'Never run by your team') },
    // Under 896px the last run gives way: a third-party skill's badge names its plugin, and the longest of those leaves the
    // four other columns no room at a 1024px window.
    { key: 'last', header: 'Your team\'s last run', numeric: true, hideBelow: 'lg', cell: (s) => <Day at={s.lastRun} /> },
  ]);
}

/** Nothing any evidence panel could draw: no scored run, no finding, no candidate. */
function notYet(e: PluginEvalFound): boolean {
  const f = e.findings;
  return !e.run && f.strengths.length + f.defects.length + f.unknowns.length === 0 && e.candidates.length === 0;
}

/**
 * One read the console's server made for the page, followed in the browser: no browser read while the server's answer
 * is the latest, one once the plugins collection changes or a Retry asks.
 */
function useFollowed<T>(path: string, served: PluginsRead | EvalRead) {
  const { q, error, retry, busy } = useServed<T>(path, true);
  return { q, error, retry, busy, at: q.data ? new Date(q.dataUpdatedAt) : served.state === 'ok' ? served.at : null };
}

/** The owning team's evaluation as the page holds it: answered, withheld from this reader, in trouble, or on its way. */
type Evaluation = { state: 'ok'; data: PluginEval } | { state: 'withheld' } | { state: 'trouble'; reason: string } | { state: 'pending' };

function useEvaluation(name: string, served: EvalRead) {
  const { q, error, retry, busy, at } = useFollowed<PluginEval>(evalPath(name), served);
  // A 403 is the gateway withholding the owning team's evaluation from this reader: its absence, never a failure.
  const withheld = error?.status === 403 || (!q.data && !error && served.state === 'withheld');
  const data = q.data ?? (served.state === 'ok' ? served.data : undefined);
  const failed = failureOf({ error });
  const evaluation: Evaluation = withheld ? { state: 'withheld' }
    : data ? { state: 'ok', data }
      : failed ? { state: 'trouble', reason: failed }
        : served.state === 'failed' || served.state === 'slow' ? { state: 'trouble', reason: readTrouble(served) }
          : { state: 'pending' };
  return { evaluation, retry, busy, at };
}

/**
 * One plugin, read on the console's server and handed here: what it is and how to install it, its public score with
 * the comparability statement the gateway answered, the owning team's evaluation where the gateway answered it, and
 * every skill it ships with the team's own use of it. A third-party subject registered for evaluation only has no
 * catalog row, so it shows its evaluation with no manifest above it. No control here starts an evaluation.
 */
export function PluginView({ name, served }: { name: string; served: Revised<PluginRead> }) {
  useLive(['plugins'], served.revisions);
  const catalog = useFollowed<Catalog>(PLUGINS_PATH, served.catalog);
  const { evaluation, retry: retryEvaluation, busy: evaluationBusy, at: evaluatedAt } = useEvaluation(name, served.evaluation);
  const now = useDataClock();
  const listed = catalog.q.data ?? (served.catalog.state === 'ok' ? served.catalog.data : undefined);
  const failed = failureOf(catalog);
  const trouble = listed ? null : failed ?? (served.catalog.state !== 'ok' ? readTrouble(served.catalog) : null);
  const p = listed?.plugins.find((x) => x.plugin === name);
  const settled = evaluation.state !== 'pending';
  // What the lead score compares with, by name, from its scores' series; the gateway's statement where they were not read.
  const compared = p ? comparedSaid(p.score, served.history) : null;
  const updatedAt = [catalog.at, evaluatedAt].filter((x): x is Date | string => x !== null).map((x) => new Date(x)).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  useShareView(listed && settled
    ? pluginContext(name, {
      plugin: p,
      evaluation: evaluation.state === 'ok' ? evaluation.data : null,
      unread: evaluation.state === 'trouble' ? evaluation.reason : undefined,
      compared,
      updatedAt,
      now,
    })
    : pendingContext({ view: 'plugin', title: name, address: `/plugins/${name}`, scope: 'one plugin' }, trouble));

  if (!listed && trouble) {
    return (
      <Card>
        <EmptyState kind="error" title="The plugin did not load" className="py-16" action={<Button variant="primary" icon={<RotateCw />} busy={catalog.busy} onClick={catalog.retry}>Retry</Button>}>
          {trouble}
        </EmptyState>
      </Card>
    );
  }
  // Not in the catalog, and the evaluation that would make it a third-party subject did not answer: which it is, is
  // not known yet, so nothing is said of it but that.
  if (!p && evaluation.state === 'trouble') {
    return (
      <Card>
        <EmptyState kind="error" title="The plugin did not load" className="py-16" action={<Button variant="primary" icon={<RotateCw />} busy={evaluationBusy} onClick={retryEvaluation}>Retry</Button>}>
          {evaluation.reason}
        </EmptyState>
      </Card>
    );
  }
  // Stages first and in order, then everything else the plugin ships: alphabetical would put step 6 above step 2.
  const skills = p ? [...p.skills].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name)) : [];
  return (
    <Stack>
      {p ? (
        <>
          {/* The one score a person acts on leads, with the command that installs the plugin, and everything else steps
              back below it: what the plugin is, then the owning team's evaluation, which says how it relates to this. */}
          <div data-protagonist={LEAD_TITLE} className="contents">
            <LeadScore
              of={p.score}
              comparability={compared ?? p.comparability}
              install={<CopyField value={p.install} label={`the command that installs ${p.plugin}`} className={`w-full ${FROM_THE_FRONT}`} />}
              ask={<AskAbout question={`How far can ${p.plugin}'s public score be trusted, should we install it, and is the version it declares released?`} />}
            />
          </div>
          <About p={p} />
        </>
      ) : (
        <div data-protagonist="About this plugin" className="contents">
          <Panel title="About this plugin" actions={<AskAbout question={`What does the evaluation of ${name} say, with no manifest of it to read?`} />}>
            <p className="t-small text-ink-2">Registered through plugin_register as a third-party subject, for evaluation only: the catalog has no manifest, skills or install command for it. Its evaluation is below.</p>
          </Panel>
        </div>
      )}
      <OwnersEvaluation evaluation={evaluation} lead={p?.score ?? null} busy={evaluationBusy} onRetry={retryEvaluation} />
      {p ? (
        <DataTable
          caption={`${name}'s skills`}
          noun="skills"
          title="Its skills"
          description="Stages first, in order. Calls and last runs are your team's alone."
          rows={skills}
          columns={skillColumns(name)}
          rowKey={(s) => s.name}
          rowHref={(s) => `/plugins/${name}/${s.name}`}
          pageSize={10}
          pageSizes={[10]}
          empty={{ title: 'This plugin ships no skill', body: 'It grants an MCP surface and nothing else.' }}
        />
      ) : null}
      {p?.documents.length ? (
        <Panel title="The documents it governs" description={p.gates ? `A person approves ${formatCount(p.gates)} of the ${formatCount(p.documents.length)}` : 'None needs an approval'}>
          {/* Labels, not actions: the accent is kept for what a person presses, so a gate reads in ink and no gate quieter. */}
          <KeyValue items={p.documents.map((d) => ({ label: <span className="font-mono text-xs text-ink">{d.name}</span>, value: d.gate ? <Badge tone="neutral" dot>A person approves</Badge> : <span className="text-xs text-ink-3">No approval needed</span> }))} />
        </Panel>
      ) : null}
    </Stack>
  );
}

/**
 * A plugin's page leads with this: the one score a person acts on, its public score on the scores' scale, with the command that
 * installs the plugin in the same card. The protocol it was scored against heads it, because a score belongs to its
 * protocol's version; under the figure its standing, its range and its day, and the gateway's comparability statement
 * verbatim. The owning team's own evaluation, where it is drawn, steps back below and says how it relates to this.
 */
function LeadScore({ of, comparability, install, ask }: { of: PluginScore | null; comparability: string; install?: ReactNode; ask?: ReactNode }) {
  const shown = of && of.standing !== 'not_established' ? of.value : null;
  return (
    <FeaturedMetric
      kicker={of ? `Its public score out of ${SCORE_OUT_OF} · ${protocolNamed(of)}` : `Its public score out of ${SCORE_OUT_OF}`}
      value={shown}
      missing={!of ? 'Never scored' : 'Not established'}
      format={(n) => n.toFixed(1)}
      caption={of ? (
        <>
          {`${standingSaid(of.standing)}${of.lower !== null && of.upper !== null ? `, between ${of.lower.toFixed(1)} and ${of.upper.toFixed(1)}` : ''}, scored on `}
          <Day at={of.scoredAt} />
          {'. The same for everybody; nobody starts an evaluation from the console.'}
        </>
      ) : 'The platform has scored no run of it. Nobody starts an evaluation from the console.'}
      // Which of its scores this one compares with and which it does not, as the platform's series group them, or the
      // gateway's own sentence where the series were not read: whether scores compare is decided where the protocols are.
      finding={{ text: comparability }}
      actions={ask}
      foot={install ? <dl className="w-full"><div className="w-full"><dt>Install</dt><dd>{install}</dd></div></dl> : undefined}
    />
  );
}

/** What the plugin is: the facts of its catalog row. Its install command is the lead card's, beside its score. */
function About({ p }: { p: PluginRow }) {
  return (
    <Panel title="About this plugin" description={p.description ?? p.agentName ?? undefined}>
      <KeyValue
        items={[
          { label: 'Required', value: p.required ? <Badge tone="neutral" dot>Required: every client installs it</Badge> : <span className="text-ink-2">Optional: a person&apos;s choice</span> },
          // The version and the digest together or not at all: the number is a claim and the digest makes it true.
          { label: 'Version', wrap: true, value: p.version ? <span className="font-mono text-xs">{p.version} <span className="text-ink-3">{p.release ? `+${p.release.digest}` : 'not released'}</span></span> : <span className="text-ink-3">Declares none</span> },
          ...(p.owner ? [{ label: 'Owner', value: p.owner, mono: true }] : []),
          { label: 'Reaches', wrap: true, value: p.servers.length ? <span className="font-mono text-xs">{p.servers.join(' · ')}</span> : <span className="text-ink-3">No server, skills only</span> },
          { label: 'Method', wrap: true, value: p.stages.length ? `${p.stages.length} stages${p.entry ? `, entered through ${p.entry}` : ''}` : <span className="text-ink-3">No declared method</span> },
          { label: 'Your team', wrap: true, value: p.yourTeam.calls ? `${formatCount(p.yourTeam.calls)} calls, ${p.yourTeam.failed ? `${formatCount(p.yourTeam.failed)} refused` : 'none refused'}${p.yourTeam.lastRun ? `, last on ${formatDate(p.yourTeam.lastRun)}` : ''}` : <span className="text-ink-3">Never run by your team</span> },
        ]}
      />
    </Panel>
  );
}

/**
 * The owning team's evaluation, drawn only where the gateway answered it. Withheld from this reader, it is not there at
 * all: no heading, no empty state and no sentence about who may read it.
 */
function OwnersEvaluation({ evaluation, lead, busy, onRetry }: { evaluation: Evaluation; lead: PluginScore | null; busy: boolean; onRetry: () => void }) {
  if (evaluation.state === 'withheld' || evaluation.state === 'pending') return null;
  if (evaluation.state === 'trouble') {
    return (
      <Panel title="Its evaluation">
        <EmptyState kind="error" title="The evaluation did not load" className="py-10" action={<Button size="sm" icon={<RotateCw />} busy={busy} onClick={onRetry}>Retry</Button>}>
          {evaluation.reason}
        </EmptyState>
      </Panel>
    );
  }
  const e = evaluation.data;
  const scored = e.found && !notYet(e);
  return (
    <section aria-label="Its evaluation" className="flex flex-col gap-(--stack-gap)">
      {/* Usage says what the score's evidence covers, so it sits beside the score, two cards of one line of figures
          each. Beside Health it was stretched to a table's height, half of it empty. */}
      {scored ? (
        <Row split="2/3">
          <EvalHeadline pluginEval={e} lead={lead} />
          <EvalUsage run={e.run} />
        </Row>
      ) : <EvalHeadline pluginEval={e} lead={lead} />}
      {!e.found ? null : !scored ? <EvalNotYet evaluationOnly={e.ownershipMode === 'evaluation_only'} /> : (
        <>
          <EvalHealth run={e.run} />
          <EvalQuality run={e.run} />
          <EvalLearning findings={e.findings} />
          <EvalEvolution pluginEval={e} />
        </>
      )}
      <EvalAutomationTrust pluginEval={e} />
    </section>
  );
}
