'use client';

import Link from 'next/link';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, PageControl, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time, usePaged,
} from '@/components/ui';
import { EvalCell, EvalVerdict, EvalWhen } from '@/components/EvalScore';
import { formatCount } from '@/lib/format';
import { freshnessOf, useConsole } from '@/lib/api';
import { type PluginRow } from '@/lib/api-shapes';

/**
 * LAYER ONE: which plugins exist. One row each, nothing expanded.
 *
 * THIS WAS TWO PAGES. Flows listed agent methods and Blocks listed MCP surfaces, and a reader
 * who wanted to know what `sdlc` IS had to visit both and do the join in their head. A plugin
 * is the join: a package's skills plus the servers those skills call, installed together under
 * one version.
 *
 * Stand-ins never reach this page: the endpoint drops them. There is nobody on the other end
 * of a mock to agree a change with.
 */
export default function PluginsPage() {
  const q = useConsole<{ plugins: PluginRow[] }>('/plugins');
  const plugins = q.data?.plugins ?? [];
  const skills = plugins.reduce((a, p) => a + p.skills.length, 0);

  return (
    <DashboardPage
      title="Plugins"
      description="What a person installs: a package's skills plus the MCP servers those skills call, under one declared version."
      showPeriod={false}
      updatedAt={freshnessOf(q)}
      metrics={
        q.data
          ? [
              // NO "SOMEBODY ELSE'S" COUNT. `origin` is hardcoded `platform` on every row
              // the catalog emits and third-party blocks were dropped, so this tile read
              // "0 somebody else's" and could read nothing else. A comparison with a
              // constant is not a comparison.
              { label: 'Plugins', value: String(plugins.length),
                sublabel: 'in the catalog' },
              { label: 'Skills', value: String(skills), sublabel: 'across every plugin' },
              // A DECLARED VERSION IS A CLAIM and the digest is what makes it true, so what
              // is worth counting is how many of them anything has vouched for. The rows come
              // from release, so a platform that has not released since they began being
              // recorded reads 0 here — the honest number, not a hole.
              { label: 'Released', value: String(plugins.filter((p) => p.release).length),
                sublabel: `of ${plugins.filter((p) => p.version).length} declaring a version` },
              { label: 'Never run', value: String(plugins.reduce((a, p) => a + p.skills.filter((s) => !s.everRun).length, 0)),
                sublabel: 'skills shipped, never called', emphasis: true },
            ]
          : undefined
      }
    >
      <Query query={q}>
        {(d) => (
          <Panel title="Every plugin" aside={`${d.plugins.length} — most recently used first`} padded={false}>
            <PluginTable rows={d.plugins} />
          </Panel>
        )}
      </Query>
    </DashboardPage>
  );
}

/** The list, ten rows at a time — its own component because a hook cannot run inside the
 *  `Query` render prop. */
function PluginTable({ rows }: { rows: PluginRow[] }) {
  const { page, controls } = usePaged(rows);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plugin</TableHead>
            <TableHead hideBelow="lg">Reaches</TableHead>
            <TableHead>Calls</TableHead>
            <TableHead hideBelow="md">Last run</TableHead>
            {/* WHAT THE LAST ROUND CONCLUDED, and the way back to the report that explains it.
                A plugin's score is the one fact this page was missing: it listed how often
                each was CALLED and never whether any of it was any good. */}
            <TableHead hideBelow="lg">Eval score</TableHead>
            <TableHead hideBelow="xl">Room to improve</TableHead>
            <TableHead hideBelow="lg">Evaluated</TableHead>
            <TableHead hideBelow="xl">Gates</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((p) => (
            <TableRow key={p.plugin}>
              <TableCell className="max-w-[36ch]">
                <Link href={`/plugins/${p.plugin}`} className="block break-words font-medium text-accent hover:underline">
                  {p.plugin}
                </Link>
                <span className="block truncate text-xs text-ink-faint" title={p.description ?? ''}>
                  {/* Every plugin here is a catalog package: it has an owner and a declared
                      version. The registered-block fallback that stood beside this read a
                      `kind` the catalog never sends, behind a `p.version` that is never
                      null — two dead branches guarding each other. */}
                  {`${p.agentName ? `${p.agentName} · ` : ''}${p.owner ?? 'zz'} · v${p.version}`}
                </span>
              </TableCell>
              <TableCell hideBelow="lg">
                <span className="inline-flex flex-wrap gap-1">
                  {p.servers.length
                    ? p.servers.map((s) => (
                        <Badge key={s} variant={s === 'zz-core' ? 'accent' : 'neutral'}>{s}</Badge>
                      ))
                    : <span className="text-xs text-ink-faint">no server — skills only</span>}
                </span>
              </TableCell>
              <TableCell className="tabular-nums">{formatCount(p.calls)}</TableCell>
              <TableCell hideBelow="md" className="text-xs">
                {p.lastRun
                  ? <Time value={p.lastRun} />
                  : <Badge variant="neutral">never run</Badge>}
              </TableCell>
              <TableCell hideBelow="lg"><EvalCell of={p.latestEval} /></TableCell>
              <TableCell hideBelow="xl"><EvalVerdict of={p.latestEval} /></TableCell>
              <TableCell hideBelow="lg" className="whitespace-nowrap text-xs"><EvalWhen of={p.latestEval} /></TableCell>
              <TableCell hideBelow="xl" className="break-words text-xs">
                {/* A plugin with no gates is an assistant, and saying "0" alone reads
                    as a delivery method that forgot its approvals. */}
                {p.gates
                  ? <span className="text-ink">{p.gates} · {p.documents.filter((x) => x.gate).map((x) => x.name).join(', ')}</span>
                  : <span className="text-ink-faint">none — an assistant</span>}
              </TableCell>
            </TableRow>
          ))}

          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-ink-faint">
                No plugin is installed.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
