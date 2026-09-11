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
 * People, their teams, their tokens' state, and their block connections.
 *
 * NEVER THE TOKENS. zz.pat stores a hash; this shows whether one is live and
 * when it was last used, which is what an administrator actually asks, and
 * nothing that could be replayed.
 */
export default function PeoplePage() {
  const q = useConsole<{ people: Person[] }>('/people');
  const people = q.data?.people ?? [];
  const connected = people.filter((p) => p.connections.length).length;
  // Flattened once: the table renders it and the empty state is decided by it.
  const rows = people.flatMap((p) => p.connections.map((c) => ({ p, c })));

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
              { label: 'Block connections', value: String(people.reduce((a, p) => a + p.connections.length, 0)),
                emphasis: true, sublabel: `held by ${connected} ${connected === 1 ? 'person' : 'people'}` },
              { label: 'Never connected', value: String(people.length - connected),
                sublabel: `of ${people.length}` },
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
                      <TableCell className="text-xs">
                        {p.connections.length
                          ? p.connections.map((c) => (
                              <Badge key={c.block} variant="sage" dot className="mr-1">{c.block}</Badge>
                            ))
                          : <span className="text-ink-faint">none</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{p.created}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>

            <Panel
              title="Delegated block connections"
              aside="OAuth 2.1 · per person, never per team"
              padded={false}
            >
              {/* A table with no rows rendered as four column headings above
                  nothing, which reads as a panel that failed to load. It has
                  not: `zz.block_token` is empty because no person has ever
                  authorised a block on their own behalf. Say that, and say what
                  IS carrying the access instead, so the zero is a fact about
                  the platform rather than a gap in the page. */}
              {rows.length === 0 ? (
                <div className="px-5 py-8">
                  <EmptyState
                    icon={<KeyRound className="size-5" strokeWidth={2} />}
                    title="No delegated connections"
                    description="Nobody has authorised a block on their own behalf yet. Every block call today goes through a team grant, which is the team's authority rather than a person's — a row appears here only when someone completes an OAuth flow against a block themselves."
                  />
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Block</TableHead>
                    <TableHead>Granted scope</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ p, c }) => (
                      <TableRow key={`${p.email}-${c.block}`}>
                        <TableCell className="font-mono text-xs">{p.email.split('@')[0]}</TableCell>
                        <TableCell><Badge variant="neutral">{c.block}</Badge></TableCell>
                        <TableCell className="max-w-[46ch] truncate font-mono text-[11px] text-ink-faint" title={c.scope}>
                          {c.scope}
                        </TableCell>
                        <TableCell><Time value={c.expires} /></TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </Panel>
          </div>
        )}
      </Query>
    </DashboardPage>
  );
}
