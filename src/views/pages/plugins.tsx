'use client';

import { Box, CircleOff, PackageCheck, Puzzle } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { AskAbout } from '@/components/patterns/ask-about';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { EvalCell, EvalVerdict, EvalWhen } from '@/console/eval-score';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { When } from '@/console/when';
import { freshnessOf, useConsole } from '@/lib/api';
import { plural } from '@/lib/format';
import type { PluginRow } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format-units';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { pluginsContext } from '@/views/plugins-context';

const COLUMNS: Column<PluginRow>[] = aligned([
  {
    key: 'plugin', header: 'Plugin', grow: true, mobile: 'title', sortValue: (p) => p.plugin,
    cell: (p) => (
      <span className="block min-w-0">
        <span className="block font-medium text-ink">{p.plugin}</span>
        <span className="t-caption block truncate" title={p.description ?? ''}>{[p.agentName, p.owner ?? 'zz', p.version ? `v${p.version}` : 'no version'].filter(Boolean).join(' · ')}</span>
      </span>
    ),
    mobileCell: (p) => p.plugin,
  },
  { key: 'required', header: 'Install', hideBelow: 'md', cell: (p) => (p.required ? <Badge tone="accent">Required</Badge> : <Badge tone="neutral">Optional</Badge>) },
  { key: 'reaches', header: 'Reaches', hideBelow: 'xl', cell: (p) => (p.servers.length ? <span className="font-mono text-xs">{p.servers.join(' · ')}</span> : <span className="text-ink-3">Skills only</span>) },
  // The team's own use, labelled so: the catalog and the scores beside it are the platform's.
  { key: 'calls', header: 'Your team\'s calls', numeric: true, mobile: 'fact', sortValue: (p) => p.yourTeam.calls, cell: (p) => formatCount(p.yourTeam.calls), mobileCell: (p) => `${formatCount(p.yourTeam.calls)} ${plural(p.yourTeam.calls, 'call')} by your team` },
  { key: 'last', header: 'Last run', hideBelow: 'md', sortValue: (p) => p.yourTeam.lastRun ?? '', cell: (p) => (p.yourTeam.lastRun ? <When at={p.yourTeam.lastRun} /> : <span className="text-ink-3">Never run</span>) },
  { key: 'score', header: 'Score', hideBelow: 'lg', sortValue: (p) => p.score?.value ?? -1, cell: (p) => <EvalCell of={p.score} /> },
  { key: 'status', header: 'Standing', hideBelow: 'xl', mobile: 'status', cell: (p) => <EvalVerdict of={p.score} /> },
  { key: 'evaluated', header: 'Scored', hideBelow: 'lg', cell: (p) => <EvalWhen of={p.score} /> },
]);

/** What a person installs: a package's skills plus the MCP servers those skills call, under one declared version. */
export function PluginsView() {
  useLive(['plugins']);
  const q = useConsole<{ plugins: PluginRow[] }>('/plugins');
  const arrival = useArrival(q);
  const context = q.data
    ? pluginsContext(q.data.plugins, arrival)
    : pendingContext({ view: 'plugins', title: 'Plugins', address: '/plugins', scope: 'every plugin in the catalog, and your active team\'s use of each' }, failureOf(q));
  const plugins = q.data?.plugins ?? [];
  const neverRun = plugins.reduce((a, p) => a + p.skills.filter((s) => !s.everRun).length, 0);

  return (
    <ConsolePage
      title="Plugins"
      description="What a person installs: a package's skills plus the MCP servers those skills call, under one declared version."
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      context={context}
    >
      <Row split="tiles">
        <MetricTile label="Plugins" icon={<Box />} value={q.data ? plugins.length : q.isPending ? '…' : '—'} note="In the catalog" />
        <MetricTile label="Skills" icon={<Puzzle />} value={q.data ? plugins.reduce((a, p) => a + p.skills.length, 0) : q.isPending ? '…' : '—'} note="Across every plugin" />
        <MetricTile label="Required" icon={<PackageCheck />} value={q.data ? plugins.filter((p) => p.required).length : q.isPending ? '…' : '—'} note="Every client installs these" />
        <MetricTile label="Never run" icon={<CircleOff />} value={q.data ? neverRun : q.isPending ? '…' : '—'} emphasis={neverRun > 0} note="Skills your team never called" />
      </Row>
      <DataTable
        caption="Plugins"
        noun="plugins"
        rows={plugins}
        columns={COLUMNS}
        rowKey={(p) => p.plugin}
        rowHref={(p) => `/plugins/${p.plugin}`}
        loading={q.isPending}
        error={failureOf(q)}
        onRetry={() => void q.refetch()}
        empty={{ title: 'No plugin in the catalog' }}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="t-card">Every plugin</h2>
              <p className="t-caption mt-1">Your team&rsquo;s most recently used first</p>
            </div>
            <AskAbout question="What are the plugins in view for, and which should we install?" />
          </div>
        }
      />
    </ConsolePage>
  );
}
