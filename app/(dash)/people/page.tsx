'use client';

import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import { KeyRound } from 'lucide-react';
import {
  Badge, EmptyState, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time,
} from '@/components/ui';
import { useConsole, type Person } from '@/lib/api';

/**
 * People, their teams, and their tokens' state.
 *
 * NEVER THE TOKENS. zz.pat stores a hash; this shows whether one is live and
 * when it was last used, which is what an administrator actually asks, and
 * nothing that could be replayed.
 */
export default function PeoplePage() {
  const q = useConsole<{ people: Person[] }>('/people');
  const people = q.data?.people ?? [];

  return (
    <DashboardPage
      title="People"
      description="Everyone the platform knows, and what they can reach."
      showPeriod={false}
      updatedAt={new Date()}
      metrics={
        q.data
          ? [
              { label: 'Principals', value: String(people.length),
                sublabel: `${people.filter((p) => p.role === 'superadmin').length} superadmin` },
              { label: 'Live tokens', value: String(people.reduce((a, p) => a + p.tokens, 0)) },
              { label: 'Teams', value: String(new Set(people.flatMap((p) => p.teams)).size),
                sublabel: 'across every principal' },
            ]
          : undefined
      }
    >
      <Query query={q}>
        {(d) => (
          <div className="flex flex-col gap-4">
            <Panel title="Principals" aside={`${d.people.length}`} padded={false}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Teams</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Blocks connected</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.people.map((p) => (
                    <TableRow key={p.email}>
                      <TableCell>
                        <span className="font-mono text-xs font-medium text-ink">{p.email}</span>
                        {p.name ? <span className="block text-xs text-ink-faint">{p.name}</span> : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.role === 'superadmin' ? 'accent' : 'neutral'} dot>{p.role}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[26ch] text-xs">
                        {p.teams.length ? p.teams.join(', ') : <span className="text-ink-faint">none</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.tokens || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {p.last_used ? <Time value={p.last_used} /> : <span className="text-ink-faint">never</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{p.created}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>

          </div>
        )}
      </Query>
    </DashboardPage>
  );
}
