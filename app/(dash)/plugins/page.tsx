'use client';

import { Box, CircleOff, PackageCheck, Puzzle } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { MetricTile } from '@/components/patterns/metric-tile';
import { aligned } from '@/console/columns';
import { EvalCell, EvalVerdict, EvalWhen } from '@/console/eval-score';
import { ConsolePage } from '@/console/page';
import { When } from '@/console/when';
import { freshnessOf, useConsole } from '@/lib/api';
import type { PluginRow } from '@/lib/api-shapes';
import { formatCount } from '@/lib/format';

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
  { key: 'reaches', header: 'Reaches', hideBelow: 'xl', cell: (p) => (p.servers.length ? <span className="font-mono text-xs">{p.servers.join(' · ')}</span> : <span className="text-ink-3">Skills only</span>) },
  { key: 'calls', header: 'Calls', numeric: true, mobile: 'fact', sortValue: (p) => p.calls, cell: (p) => formatCount(p.calls), mobileCell: (p) => `${formatCount(p.calls)} calls` },
  { key: 'last', header: 'Last run', hideBelow: 'md', sortValue: (p) => p.lastRun ?? '', cell: (p) => (p.lastRun ? <When at={p.lastRun} /> : <span className="text-ink-3">Never run</span>) },
  { key: 'score', header: 'Eval score', hideBelow: 'lg', sortValue: (p) => p.latestEval?.overallScore ?? -1, cell: (p) => <EvalCell of={p.latestEval} /> },
  { key: 'status', header: 'Status', hideBelow: 'xl', mobile: 'status', cell: (p) => <EvalVerdict of={p.latestEval} /> },
  { key: 'evaluated', header: 'Evaluated', hideBelow: 'lg', cell: (p) => <EvalWhen of={p.latestEval} /> },
]);

/** What a person installs: a package's skills plus the MCP servers those skills call, under one declared version. */
export default function PluginsPage() {
  const q = useConsole<{ plugins: PluginRow[] }>('/plugins');
  const plugins = q.data?.plugins ?? [];
  const neverRun = plugins.reduce((a, p) => a + p.skills.filter((s) => !s.everRun).length, 0);

  return (
    <ConsolePage
      title="Plugins"
      description="What a person installs: a package's skills plus the MCP servers those skills call, under one declared version."
      showPeriod={false}
      updatedAt={freshnessOf(q)}
    >
      <Row split="tiles">
        <MetricTile label="Plugins" icon={<Box />} value={q.data ? plugins.length : '…'} note="In the catalog" />
        <MetricTile label="Skills" icon={<Puzzle />} value={q.data ? plugins.reduce((a, p) => a + p.skills.length, 0) : '…'} note="Across every plugin" />
        <MetricTile label="Released" icon={<PackageCheck />} value={q.data ? plugins.filter((p) => p.release).length : '…'} note={`Of ${plugins.filter((p) => p.version).length} declaring a version`} />
        <MetricTile label="Never run" icon={<CircleOff />} value={q.data ? neverRun : '…'} emphasis={neverRun > 0} note="Skills shipped, never called" />
      </Row>
      <DataTable
        caption="Plugins"
        noun="plugins"
        rows={plugins}
        columns={COLUMNS}
        rowKey={(p) => p.plugin}
        rowHref={(p) => `/plugins/${p.plugin}`}
        loading={q.isPending}
        error={q.error?.message}
        onRetry={() => void q.refetch()}
        empty={{ title: 'No plugin in the catalog' }}
        toolbar={<div><h2 className="t-card">Every plugin</h2><p className="t-caption mt-1">Most recently used first</p></div>}
      />
    </ConsolePage>
  );
}
