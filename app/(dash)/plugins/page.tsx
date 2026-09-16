'use client';

import Link from 'next/link';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time } from '@/components/ui';
import { formatCount } from '@/lib/format';
import { useConsole, type PluginRow } from '@/lib/api';
import { pluginKind } from '@/lib/plugin-labels';

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
      updatedAt={new Date()}
      // ONE child fills the column and owns the scrolling inside it. Left as the
      // default `outer`, the panel sized to its rows and floated in the top third
      // of an empty page — a list is the page here, so it should be its height.
      scroll="inner"
      metrics={
        q.data
          ? [
              { label: 'Plugins', value: String(plugins.length),
                sublabel: `${plugins.filter((p) => p.origin === 'third_party').length} somebody else’s` },
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
          <Panel
            title="Every plugin"
            aside={`${d.plugins.length} — most recently used first`}
            padded={false}
            className="h-full min-h-0"
          >
            <div className="h-full overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plugin</TableHead>
                    <TableHead>Reaches</TableHead>
                    <TableHead className="text-right">Skills</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead>Gates</TableHead>
                    <TableHead>Evaluated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.plugins.map((p) => (
                    <TableRow key={p.plugin}>
                      <TableCell className="max-w-[36ch]">
                        <Link href={`/plugins/${p.plugin}`} className="block font-medium text-accent hover:underline">
                          {p.plugin}
                        </Link>
                        <span className="block truncate text-xs text-ink-faint" title={p.description ?? ''}>
                          {/* WHAT IT IS, in whichever form its own source records. A catalog
                              package has an owner and a declared version; a registered block
                              has neither and carries a kind from zz.block instead. */}
                          {p.version
                            ? `${p.agentName ? `${p.agentName} · ` : ''}${p.owner ?? 'zz'} · v${p.version}`
                            : pluginKind(p)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          {p.servers.length
                            ? p.servers.map((s) => (
                                <Badge key={s} variant={s === 'zz-core' ? 'accent' : 'neutral'}>{s}</Badge>
                              ))
                            : <span className="text-xs text-ink-faint">no server — skills only</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.skills.length || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(p.calls)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {p.lastRun
                          ? <Time value={p.lastRun} />
                          : <Badge variant="neutral">never run</Badge>}
                        {p.lastRun && p.skills.some((s) => !s.everRun) ? (
                          <span className="ml-2 text-ink-faint">
                            {p.skills.filter((s) => !s.everRun).length} of {p.skills.length} skills never
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        {/* A plugin with no gates is an assistant, and saying "0" alone reads
                            as a delivery method that forgot its approvals. */}
                        {p.gates
                          ? <span className="text-ink">{p.gates} · {p.documents.filter((x) => x.gate).map((x) => x.name).join(', ')}</span>
                          : <span className="text-ink-faint">none — an assistant</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {/* THE DELTA, NOT A SCORE. `claude plugin eval` runs each case twice,
                            with the plugin and without, so what it reports is whether the
                            plugin helped — the one question a score cannot answer. Nothing has
                            recorded one yet on any deployment, and "not measured" is a fact
                            worth printing rather than a blank. */}
                        {p.eval
                          ? <span className="flex items-baseline gap-2 text-ink">
                              {p.eval.meanDelta === null ? '—' : `Δ ${p.eval.meanDelta.toFixed(2)}`}
                              <span className="text-ink-faint">{p.eval.cases} cases</span>
                              <Time value={p.eval.ranAt} className="text-ink-faint" />
                            </span>
                          : <span className="text-ink-faint">not measured</span>}
                      </TableCell>
                    </TableRow>
                  ))}

                  {d.plugins.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-ink-faint">
                        No plugin is installed.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Panel>
        )}
      </Query>
    </DashboardPage>
  );
}
