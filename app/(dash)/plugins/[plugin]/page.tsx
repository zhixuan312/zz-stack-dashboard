'use client';

import { use } from 'react';
import { Activity, CircleOff, Lock, Puzzle } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { KeyValue } from '@/components/ui/key-value';
import { Skeleton } from '@/components/ui/skeleton';
import { aligned } from '@/console/columns';
import { ConsolePage } from '@/console/page';
import { Panel } from '@/console/panel';
import { EvalLearning, EvalNotYet, EvalUsage } from '@/console/plugin-eval-evidence';
import { EvalAutomationTrust, EvalEvolution } from '@/console/plugin-eval-evolution';
import { EvalHeadline, EvalHealth, EvalQuality } from '@/console/plugin-eval-overview';
import { Query } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole } from '@/lib/api';
import type { PluginEval, PluginRow } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format';

type PluginSkill = PluginRow['skills'][number];

function skillColumns(plugin: string): Column<PluginSkill>[] {
  return aligned([
    {
      // The stage number prefixes the name: the front door is unnumbered, because it is not step zero, it is the plugin.
      key: 'skill', header: 'Skill', grow: true, mobile: 'title',
      cell: (s) => (
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="t-num w-4 shrink-0 text-right text-xs text-ink-3">{s.position ?? '—'}</span>
          <span className="font-medium text-ink">{s.name}</span>
          {s.isEntry ? <span className="t-caption">the front door</span> : null}
        </span>
      ),
      mobileCell: (s) => s.name,
    },
    // A skill's origin comes from a `source:` line in its own SKILL.md, so it varies the day a vendored skill ships.
    { key: 'whose', header: 'Whose', hideBelow: 'md', mobile: 'status', cell: (s) => (s.origin === 'theirs' ? <Badge tone="accent">The {plugin} team&rsquo;s</Badge> : <Badge tone="neutral">Ours</Badge>) },
    { key: 'versions', header: 'Versions', numeric: true, hideBelow: 'lg', cell: (s) => s.versions || '—' },
    { key: 'calls', header: 'Calls', numeric: true, mobile: 'fact', cell: (s) => (s.everRun ? formatCount(s.calls) : '—'), mobileCell: (s) => (s.everRun ? `${formatCount(s.calls)} calls` : 'Never run') },
    { key: 'last', header: 'Last run', numeric: true, hideBelow: 'md', cell: (s) => (s.lastRun ? <When at={s.lastRun} /> : <span className="text-ink-3">Never run</span>) },
  ]);
}

/** Nothing any evidence panel could draw: no completed run, no finding, no candidate. */
function notYet(e: PluginEval): boolean {
  const f = e.found ? e.findings : null;
  return !e.run && (f ? f.strengths.length + f.defects.length + f.unknowns.length : 0) === 0 && e.candidates.length === 0;
}

/**
 * One plugin: what it is, what it reaches, every skill it ships, and its whole evaluation story (score and protocol
 * first, then health, quality, usage, learning, evolution, automation and trust). The evaluation is its own read: a
 * third-party subject registered with plugin_register has no catalog entry at all, so it still shows its evaluation
 * with no manifest above it.
 */
export default function PluginPage({ params }: { params: Promise<{ plugin: string }> }) {
  const { plugin } = use(params);
  const q = useConsole<{ plugins: PluginRow[] }>('/plugins');
  const qEval = useConsole<PluginEval>(`/plugins/${plugin}/eval`);
  const p = q.data?.plugins.find((x) => x.plugin === plugin);
  // Stages first and in order, then everything else the plugin ships: alphabetical would put step 6 above step 2.
  const skills = p ? [...p.skills].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name)) : [];

  return (
    <ConsolePage
      title={plugin}
      crumbs={[{ label: 'Plugins', href: '/plugins' }]}
      description={p ? p.description ?? p.agentName ?? 'A plugin with no description of its own.' : q.isPending ? <Skeleton className="inline-block h-4 w-64 max-w-full align-middle" /> : undefined}
      showPeriod={false}
      updatedAt={freshnessOf(q, qEval)}
    >
      {/* Standing from the first paint, an ellipsis until the catalog arrives; gone only for a plugin it does not list. */}
      {p || q.isPending ? (
        <Row split="tiles">
          <MetricTile label="Skills" icon={<Puzzle />} value={p ? p.skills.length : '…'} note={!p ? 'Shipped by this plugin' : p.stages.length ? `${p.stages.length} of them stages, in order` : 'No declared method'} />
          <MetricTile label="Gates" icon={<Lock />} value={p ? p.gates : '…'} note={!p || p.gates ? 'A person must approve' : 'An assistant, not a method'} />
          <MetricTile label="Calls" icon={<Activity />} value={p ? p.calls : '…'} note={!p ? 'Across its skills' : p.failed ? `${formatCount(p.failed)} refused` : 'None refused'} />
          <MetricTile label="Never run" icon={<CircleOff />} value={p ? p.skills.filter((s) => !s.everRun).length : '…'} emphasis={!!p?.skills.some((s) => !s.everRun)} note={p ? `Of ${p.skills.length} skills` : 'Skills nobody called'} />
        </Row>
      ) : null}
      <Query query={qEval} what="The evaluation" skeleton={<Skeleton className="h-40 rounded-lg" />}>
        {(e) => !p && !e.found && !q.isPending ? (
          <EmptyState kind="filtered" title={`'${plugin}' is not a plugin the console lists`} className="py-16">It may have been renamed or removed. Plugins lists what is there.</EmptyState>
        ) : (
          <>
            <EvalHeadline pluginEval={e} />
            {p ? (
              <Row split="1/2">
                <Panel title="About this plugin">
                  <KeyValue
                    items={[
                      ...(p.owner ? [{ label: 'Owner', value: p.owner, mono: true }] : []),
                      // The version and the digest together or not at all: the number is a claim and the digest makes it true.
                      { label: 'Version', wrap: true, value: p.version ? <span className="font-mono text-xs">{p.version} <span className="text-ink-3">{p.release ? `+${p.release.digest}` : 'not released'}</span></span> : <span className="text-ink-3">Declares none</span> },
                      { label: 'Reaches', wrap: true, value: p.servers.length ? <span className="font-mono text-xs">{p.servers.join(' · ')}</span> : <span className="text-ink-3">No server, skills only</span> },
                      { label: 'Entry', value: p.entry ?? '—', mono: true },
                    ]}
                  />
                </Panel>
                <Panel title="The documents it governs" description={p.gates ? `${p.gates} gated` : 'None'}>
                  {p.documents.length ? (
                    <KeyValue items={p.documents.map((d) => ({ label: <span className="font-mono text-xs text-ink">{d.name}</span>, value: d.gate ? <Badge tone="accent" dot>A person approves</Badge> : <Badge tone="neutral">No approval needed</Badge> }))} />
                  ) : (
                    <p className="t-small text-ink-3">None. This plugin writes no document and gates nothing: an assistant, not a delivery method.</p>
                  )}
                </Panel>
              </Row>
            ) : (
              <Panel title="About this plugin"><p className="t-small text-ink-3">Registered through plugin_register as a third-party subject, with no manifest, skills or documents to show. Its evaluation is below.</p></Panel>
            )}
            {notYet(e) ? <EvalNotYet evaluationOnly={e.ownershipMode === 'evaluation_only'} /> : (
              <>
                <Row split="1/2">
                  <EvalHealth run={e.run} />
                  <EvalUsage run={e.run} />
                </Row>
                <EvalQuality run={e.run} />
                <EvalLearning findings={e.found ? e.findings : null} />
                <EvalEvolution pluginEval={e} />
              </>
            )}
            <EvalAutomationTrust pluginEval={e} />
            {p ? (
              <DataTable
                caption={`${plugin}'s skills`}
                noun="skills"
                rows={skills}
                columns={skillColumns(plugin)}
                rowKey={(s) => s.name}
                rowHref={(s) => `/plugins/${plugin}/${s.name}`}
                empty={{ title: 'This plugin ships no skill', body: 'It grants an MCP surface and nothing else.' }}
                toolbar={<div><h2 className="t-card">Its skills</h2><p className="t-caption mt-1">Open one to read it</p></div>}
              />
            ) : null}
          </>
        )}
      </Query>
    </ConsolePage>
  );
}
