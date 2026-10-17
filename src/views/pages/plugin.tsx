'use client';

import { RotateCw } from 'lucide-react';
import { Row, Stack } from '@/components/base/shell';
import { useShareView } from '@/components/base/use-share-view';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CopyField } from '@/components/ui/copy-field';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { aligned } from '@/console/columns';
import { Day, PublicScore } from '@/console/eval-score';
import { Panel } from '@/console/panel';
import { EvalLearning, EvalNotYet, EvalUsage } from '@/console/plugin-eval-evidence';
import { EvalAutomationTrust, EvalEvolution } from '@/console/plugin-eval-evolution';
import { EvalHeadline, EvalHealth, EvalQuality } from '@/console/plugin-eval-overview';
import { failureOf } from '@/console/query';
import { count } from '@/console/words';
import { useDataClock } from '@/lib/api';
import type { PluginEval, PluginEvalFound, PluginRow } from '@/lib/api-shapes';
import { formatDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { evalPath, pluginContext, type EvalRead, type PluginRead } from '@/views/plugin-context';
import { PLUGINS_PATH, readTrouble, type Catalog, type PluginsRead } from '@/views/plugins-context';
import { useServed } from '@/views/use-served';

type PluginSkill = PluginRow['skills'][number];

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
        </span>
      ),
      mobileCell: (s) => <span className="[overflow-wrap:anywhere]">{s.name}</span>,
    },
    // A skill's origin comes from a `source:` line in its own SKILL.md, so it varies the day a vendored skill ships.
    { key: 'whose', header: 'Whose', hideBelow: 'md', mobile: 'status', cell: (s) => (s.origin === 'theirs' ? <Badge tone="accent">The {plugin} team&apos;s</Badge> : <Badge tone="neutral">Ours</Badge>) },
    { key: 'versions', header: 'Versions', numeric: true, hideBelow: 'lg', cell: (s) => count(s.versions) },
    { key: 'calls', header: 'Your team\'s calls', numeric: true, mobile: 'fact', cell: (s) => (s.everRun ? formatCount(s.calls) : <span className="text-ink-3">—</span>), mobileCell: (s) => (s.everRun ? `${formatCount(s.calls)} by your team` : 'Never run by your team') },
    { key: 'last', header: 'Your team\'s last run', numeric: true, hideBelow: 'md', cell: (s) => <Day at={s.lastRun} /> },
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
  const { q, follow } = useServed<T>(path, true);
  const retry = () => (q.data !== undefined || q.error ? void q.refetch() : follow());
  return { q, retry, at: q.data ? new Date(q.dataUpdatedAt) : served.state === 'ok' ? served.at : null };
}

/** The owning team's evaluation as the page holds it: answered, withheld from this reader, in trouble, or on its way. */
type Evaluation = { state: 'ok'; data: PluginEval } | { state: 'withheld' } | { state: 'trouble'; reason: string } | { state: 'pending' };

function useEvaluation(name: string, served: EvalRead) {
  const { q, retry, at } = useFollowed<PluginEval>(evalPath(name), served);
  // A 403 is the gateway withholding the owning team's evaluation from this reader: its absence, never a failure.
  const withheld = q.error?.status === 403 || (!q.data && !q.error && served.state === 'withheld');
  const data = q.data ?? (served.state === 'ok' ? served.data : undefined);
  const failed = failureOf(q);
  const evaluation: Evaluation = withheld ? { state: 'withheld' }
    : data ? { state: 'ok', data }
      : failed ? { state: 'trouble', reason: failed }
        : (served.state === 'failed' || served.state === 'slow') && !q.isFetching ? { state: 'trouble', reason: readTrouble(served) }
          : { state: 'pending' };
  return { evaluation, retry, at };
}

/**
 * One plugin, read on the console's server and handed here: what it is and how to install it, its public score with
 * the comparability statement the gateway answered, the owning team's evaluation where the gateway answered it, and
 * every skill it ships with the team's own use of it. A third-party subject registered for evaluation only has no
 * catalog row, so it shows its evaluation with no manifest above it. No control here starts an evaluation.
 */
export function PluginView({ name, served }: { name: string; served: PluginRead }) {
  useLive(['plugins']);
  const catalog = useFollowed<Catalog>(PLUGINS_PATH, served.catalog);
  const { evaluation, retry: retryEvaluation, at: evaluatedAt } = useEvaluation(name, served.evaluation);
  const now = useDataClock();
  const listed = catalog.q.data ?? (served.catalog.state === 'ok' ? served.catalog.data : undefined);
  const failed = failureOf(catalog.q);
  const trouble = listed ? null : failed ?? (served.catalog.state !== 'ok' && !catalog.q.isFetching ? readTrouble(served.catalog) : null);
  const p = listed?.plugins.find((x) => x.plugin === name);
  const settled = evaluation.state !== 'pending';
  const updatedAt = [catalog.at, evaluatedAt].filter((x): x is Date | string => x !== null).map((x) => new Date(x)).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  useShareView(listed && settled
    ? pluginContext(name, {
      plugin: p,
      evaluation: evaluation.state === 'ok' ? evaluation.data : null,
      unread: evaluation.state === 'trouble' ? evaluation.reason : undefined,
      updatedAt,
      now,
    })
    : pendingContext({ view: 'plugin', title: name, address: `/plugins/${name}`, scope: 'one plugin' }, trouble));

  if (!listed && trouble) {
    return (
      <Card>
        <EmptyState kind="error" title="The plugin did not load" className="py-16" action={<Button variant="primary" icon={<RotateCw />} onClick={catalog.retry}>Retry</Button>}>
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
        <EmptyState kind="error" title="The plugin did not load" className="py-16" action={<Button variant="primary" icon={<RotateCw />} onClick={retryEvaluation}>Retry</Button>}>
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
        <Row split="1/2">
          <div data-protagonist="About this plugin" className="contents">
            <About p={p} />
          </div>
          <PublicScore of={p.score} comparability={p.comparability} />
        </Row>
      ) : (
        <div data-protagonist="About this plugin" className="contents">
          <Panel title="About this plugin" actions={<AskAbout question={`What does the evaluation of ${name} say, with no manifest of it to read?`} />}>
            <p className="t-small text-ink-2">Registered through plugin_register as a third-party subject, for evaluation only: the catalog has no manifest, skills or install command for it. Its evaluation is below.</p>
          </Panel>
        </div>
      )}
      <OwnersEvaluation evaluation={evaluation} onRetry={retryEvaluation} />
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
          empty={{ title: 'This plugin ships no skill', body: 'It grants an MCP surface and nothing else.' }}
        />
      ) : null}
      {p?.documents.length ? (
        <Panel title="The documents it governs" description={p.gates ? `${formatCount(p.gates)} a person approves` : 'None needs an approval'}>
          <KeyValue items={p.documents.map((d) => ({ label: <span className="font-mono text-xs text-ink">{d.name}</span>, value: d.gate ? <Badge tone="accent" dot>A person approves</Badge> : <Badge tone="neutral">No approval needed</Badge> }))} />
        </Panel>
      ) : null}
    </Stack>
  );
}

/** What the plugin is and how to install it: the facts of its catalog row, and the command with its Copy control. */
function About({ p }: { p: PluginRow }) {
  return (
    <Panel title="About this plugin" description={p.description ?? p.agentName ?? undefined} actions={<AskAbout question={`What does ${p.plugin} ship and reach, should we install it, and is the version it declares released?`} />}>
      <KeyValue
        items={[
          { label: 'Install', wrap: true, value: <CopyField value={p.install} label={`the command that installs ${p.plugin}`} /> },
          { label: 'Required', value: p.required ? <Badge tone="accent">Required: every client installs it</Badge> : <Badge tone="neutral">Optional: a person&apos;s choice</Badge> },
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
function OwnersEvaluation({ evaluation, onRetry }: { evaluation: Evaluation; onRetry: () => void }) {
  if (evaluation.state === 'withheld' || evaluation.state === 'pending') return null;
  if (evaluation.state === 'trouble') {
    return (
      <Panel title="Its evaluation">
        <EmptyState kind="error" title="The evaluation did not load" className="py-10" action={<Button size="sm" icon={<RotateCw />} onClick={onRetry}>Retry</Button>}>
          {evaluation.reason}
        </EmptyState>
      </Panel>
    );
  }
  const e = evaluation.data;
  return (
    <section aria-label="Its evaluation" className="flex flex-col gap-(--stack-gap)">
      <EvalHeadline pluginEval={e} />
      {!e.found ? null : notYet(e) ? <EvalNotYet evaluationOnly={e.ownershipMode === 'evaluation_only'} /> : (
        <>
          <Row split="1/2">
            <EvalHealth run={e.run} />
            <EvalUsage run={e.run} />
          </Row>
          <EvalQuality run={e.run} />
          <EvalLearning findings={e.findings} />
          <EvalEvolution pluginEval={e} />
        </>
      )}
      <EvalAutomationTrust pluginEval={e} />
    </section>
  );
}
