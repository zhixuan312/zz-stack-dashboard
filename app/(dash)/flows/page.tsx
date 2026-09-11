'use client';

import Link from 'next/link';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { useConsole, type FlowRow } from '@/lib/api';

/**
 * LAYER ONE: which flows exist. One row each, nothing expanded.
 *
 * This page used to render every flow whole — description, blocks, gates and a
 * full step table apiece — so four flows filled several screens and the reader
 * had to scroll past three of them to reach the fourth. A list answers the
 * question this page is for ("what is there, and which do I want?") and the
 * flow's own page answers the next one.
 */
export default function FlowsPage() {
  const q = useConsole<{ flows: FlowRow[] }>('/flows');
  const flows = q.data?.flows ?? [];
  const teams = new Set(flows.flatMap((f) => f.installs.map((i) => i.team)));

  return (
    <DashboardPage
      title="Flows"
      description="An agent method: a set of skills that runs against blocks. Every flow uses the platform block; most use others."
      showPeriod={false}
      updatedAt={new Date()}
      // ONE child fills the column and owns the scrolling inside it. Left as the
      // default `outer`, the panel sized to its rows and floated in the top third
      // of an empty page — three flows in a card with a screen of nothing under
      // it. A list is the page here, so it should be the height of the page.
      scroll="inner"
      metrics={
        q.data
          ? [
              { label: 'Flows', value: String(flows.length), sublabel: 'in the catalog' },
              { label: 'Installed', value: String(flows.filter((f) => f.installs.length).length),
                sublabel: `on ${teams.size} team${teams.size === 1 ? '' : 's'}` },
              { label: 'Steps', value: String(flows.reduce((a, f) => a + f.steps.length, 0)),
                sublabel: 'skills across every flow' },
              { label: 'Never run', value: String(flows.reduce((a, f) => a + f.steps.filter((s) => !s.everRun).length, 0)),
                sublabel: 'declared, never called', emphasis: true },
            ]
          : undefined
      }
    >
      <Query query={q}>
        {(d) => (
          <Panel
            title="Every flow"
            aside={`${d.flows.length} — most recently used first`}
            padded={false}
            className="h-full min-h-0"
          >
            <div className="h-full overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flow</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead className="text-right">Steps</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Gates</TableHead>
                  <TableHead>Installed on</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.flows.map((f) => (
                  <TableRow key={`${f.owner}/${f.flow}`}>
                    <TableCell className="max-w-[38ch]">
                      <Link href={`/flows/${f.flow}`} className="block font-medium text-accent hover:underline">
                        {f.flow}
                      </Link>
                      <span className="block truncate text-xs text-ink-faint" title={f.description ?? ''}>
                        {f.agentName ? `${f.agentName} · ` : ''}{f.owner} · v{f.version ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {f.blocks.map((b) => (
                          <Badge key={b} variant={b === 'platform' ? 'accent' : 'neutral'}>{b}</Badge>
                        ))}
                      </span>
                    </TableCell>
                    {/* JUST THE COUNT. This read "1  1 never run" in one cell — two
                        different facts sharing a column heading that names one of
                        them, so the number beside the number looked like arithmetic. */}
                    <TableCell className="text-right tabular-nums">{f.steps.length}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {f.lastRun
                        ? <span className="font-mono text-ink">{f.lastRun}</span>
                        : <Badge variant="neutral">never run</Badge>}
                      {f.lastRun && f.steps.some((s) => !s.everRun) ? (
                        <span className="ml-2 text-ink-faint">
                          {f.steps.filter((s) => !s.everRun).length} of {f.steps.length} steps never
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      {/* A flow with no gates is an assistant, and saying "0" alone
                          reads as a delivery flow that forgot its approvals. */}
                      {f.gates
                        ? <span className="text-ink">{f.gates} · {f.documents.filter((x) => x.gate).map((x) => x.name).join(', ')}</span>
                        : <span className="text-ink-faint">none — an assistant</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {f.installs.length
                        ? f.installs.map((i) => i.team).join(', ')
                        : <span className="text-ink-faint">nobody</span>}
                    </TableCell>
                  </TableRow>
                ))}
              
                    {d.flows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-ink-faint">
                          No flow is installed.
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
