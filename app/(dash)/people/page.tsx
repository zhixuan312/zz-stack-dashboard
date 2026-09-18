'use client';

import { DashboardPage } from '@/components/DashboardPage';
import { Panel } from '@/components/Panel';
import { Query } from '@/components/Query';
import {
  Badge, PageControl, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Time, usePaged,
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
              { label: 'Live tokens', value: String(people.reduce((a, p) => a + p.tokens, 0)),
                sublabel: `held by ${people.filter((p) => p.tokens > 0).length} people` },
              { label: 'Never used a token', value: String(people.filter((p) => !p.last_used).length),
                muted: people.every((p) => p.last_used),
                sublabel: 'no platform call on record' },
              { label: 'Teams', value: String(new Set(people.flatMap((p) => p.teams)).size),
                sublabel: 'across every principal' },
            ]
          : undefined
      }
    >
      <Query query={q}>
        {(d) => (
          <Panel title="Principals" aside={`${d.people.length}`} padded={false}>
            <PeopleTable people={d.people} />
          </Panel>
        )}
      </Query>
    </DashboardPage>
  );
}

/** Its own component so it can hold the page state — a hook cannot run inside `Query`. */
function PeopleTable({ people }: { people: Person[] }) {
  const { page, controls } = usePaged(people);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Role</TableHead>
            <TableHead hideBelow="lg">Teams</TableHead>
            <TableHead hideBelow="md">Tokens</TableHead>
            <TableHead hideBelow="md">Last used</TableHead>
            <TableHead hideBelow="xl">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((p) => (
            <TableRow key={p.email}>
              <TableCell>
                <span className="break-all font-mono text-xs font-medium text-ink">{p.email}</span>
                {p.name ? <span className="block text-xs text-ink-faint">{p.name}</span> : null}
              </TableCell>
              <TableCell>
                <Badge variant={p.role === 'superadmin' ? 'accent' : 'neutral'} dot>{p.role}</Badge>
              </TableCell>
              <TableCell hideBelow="lg" className="max-w-[26ch] text-xs">
                {p.teams.length ? p.teams.join(', ') : <span className="text-ink-faint">none</span>}
              </TableCell>
              <TableCell hideBelow="md" className="tabular-nums">{p.tokens || '—'}</TableCell>
              <TableCell hideBelow="md" className="whitespace-nowrap font-mono text-xs">
                {p.last_used ? <Time value={p.last_used} /> : <span className="text-ink-faint">never</span>}
              </TableCell>
              <TableCell hideBelow="xl" className="whitespace-nowrap font-mono text-xs">{p.created}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PageControl {...controls} />
    </>
  );
}
