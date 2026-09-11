'use client';

import Link from 'next/link';
import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { formatCount } from '@/lib/format';
import { useConsole, type Block } from '@/lib/api';
import { blockKind } from '@/lib/block-labels';

/**
 * LAYER ONE: which blocks exist. One row each, nothing expanded.
 *
 * A block is something reached over MCP, and it carries two things worth counting
 * from here — the skills its team wrote and the tools it exposes. Both were only
 * visible after picking a block from a strip; the strip is a list now, and the
 * block's own page is where its detail lives.
 *
 * Stand-ins never reach this page: the endpoint drops them. There is nobody to
 * agree a change with on a mock.
 */
export default function BlocksPage() {
  const q = useConsole<{ blocks: Block[] }>('/blocks');
  const blocks = q.data?.blocks ?? [];
  const skills = blocks.reduce((a, b) => a + b.skills.length, 0);

  return (
    <DashboardPage
      title="Blocks"
      description="Everything the platform reaches over MCP, and ourselves — each one carrying its team's own skills and the tools it exposes."
      showPeriod={false}
      updatedAt={new Date()}
      scroll="inner"
      metrics={
        q.data
          ? [
              { label: 'Blocks', value: String(blocks.length), sublabel: 'ours and other teams’' },
              { label: 'Skills', value: String(skills),
                sublabel: `${blocks.reduce((a, b) => a + b.skills.filter((s) => s.origin === 'theirs').length, 0)} written by block teams` },
              { label: 'Tools', value: String(blocks.reduce((a, b) => a + b.tools, 0)), sublabel: 'named at least once' },
              { label: 'Refused', value: formatCount(blocks.reduce((a, b) => a + b.failed, 0)),
                sublabel: 'calls, across every block', emphasis: true },
            ]
          : undefined
      }
    >
      <Query query={q}>
        {(d) => (
          <Panel
            title="Every block"
            aside={`${d.blocks.length} — pick one to see its skills and tools`}
            padded={false}
            className="h-full min-h-0"
          >
            <div className="h-full overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Block</TableHead>
                    <TableHead>Whose</TableHead>
                    <TableHead className="text-right">Skills</TableHead>
                    <TableHead className="text-right">Tools</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Refused</TableHead>
                    <TableHead>Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.blocks.map((b) => {
                    const theirs = b.skills.filter((s) => s.origin === 'theirs').length;
                    return (
                      <TableRow key={b.block}>
                        <TableCell className="max-w-[34ch]">
                          <Link href={`/blocks/${b.block}`} className="block font-medium text-accent hover:underline">
                            {b.block}
                          </Link>
                          <span className="block truncate text-xs text-ink-faint">
                            {blockKind(b)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {b.origin === 'platform'
                            ? <Badge variant="accent" dot>ours</Badge>
                            : <Badge variant="neutral">a team’s</Badge>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.skills.length || '—'}
                          {theirs ? <span className="ml-2 text-xs text-ink-faint">{theirs} theirs</span> : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{b.tools || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCount(b.calls)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={b.failureRate > 5 ? 'text-[var(--rose-deep)]' : ''}>
                            {b.failureRate}%
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-ink-faint">
                          {b.firstSeen ? `${b.firstSeen} → ${b.lastSeen}` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                
                    {d.blocks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-ink-faint">
                          No building block has been called yet.
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
