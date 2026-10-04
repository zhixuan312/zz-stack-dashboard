'use client';

import { use } from 'react';
import { BookOpen, ListTree, Signature, Users } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { MetricTile } from '@/components/patterns/metric-tile';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { initiativeColumns, waitingOnYou } from '@/console/initiative';
import { ConsolePage } from '@/console/page';
import { freshnessOf, useConsole } from '@/lib/api';
import type { Initiative, Team, TeamDetail } from '@/lib/api-shapes';
import { formatDate } from '@/lib/format-date';

type Member = TeamDetail['members'][number];

const INITIATIVES = initiativeColumns();
const MEMBERS: Column<Member>[] = aligned([
  {
    key: 'person', header: 'Person', grow: true, truncate: true, mobile: 'title', sortValue: (m) => m.name || m.email,
    cell: (m) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium text-ink">{m.name || m.email}</span>
        {m.name ? <span className="t-caption block truncate">{m.email}</span> : null}
      </span>
    ),
    mobileCell: (m) => m.name || m.email,
  },
  { key: 'role', header: 'Role', mobile: 'status', sortValue: (m) => m.role, cell: (m) => <Badge tone={m.role === 'admin' ? 'accent' : 'neutral'}>{m.role === 'admin' ? 'Admin' : 'Member'}</Badge> },
  { key: 'joined', header: 'Joined', numeric: true, mobile: 'fact', sortValue: (m) => m.joined, cell: (m) => formatDate(m.joined), mobileCell: (m) => `Joined ${formatDate(m.joined)}` },
]);

/** One team: what it is working on, what it holds, and who is in it. */
export default function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const team = useConsole<TeamDetail>(`/teams/${slug}`);
  const inits = useConsole<{ initiatives: Initiative[] }>(`/initiatives?team=${slug}`);
  // The counts come from the teams list: that endpoint is the one definition of what a team holds.
  const teams = useConsole<{ teams: Team[] }>('/teams');
  const held = teams.data?.teams.find((t) => t.slug === slug);
  const list = inits.data?.initiatives ?? [];
  const members = team.data?.members ?? [];
  const waiting = list.filter(waitingOnYou).length;
  const missing = team.error?.status === 404;

  return (
    <ConsolePage
      title={slug}
      crumbs={[{ label: 'Teams', href: '/teams' }, { label: slug }]}
      // The name only when it says something the slug does not.
      description={missing ? 'No team by this name exists on the platform.' : team.data && team.data.team.name !== slug ? team.data.team.name : undefined}
      showPeriod={false}
      updatedAt={freshnessOf(team, inits)}
    >
      {missing ? null : (
        <>
          <Row split="tiles">
            <MetricTile label="Initiatives" icon={<ListTree />} value={inits.data ? list.length : '…'} note={`${list.filter((i) => !i.closed).length} still open`} />
            <MetricTile label="Waiting on you" icon={<Signature />} value={inits.data ? waiting : '…'} emphasis={waiting > 0} note={waiting ? 'A gate needs a signature' : 'Nothing to sign'} />
            <MetricTile label="Members" icon={<Users />} value={team.data ? members.length : '…'} note={`${members.filter((m) => m.role === 'admin').length} admin`} />
            <MetricTile label="Knowledge nodes" icon={<BookOpen />} value={held ? held.knowledge : '…'} note={held ? `${held.documents} documents, ${held.sources} sources` : undefined} />
          </Row>
          <DataTable
            caption={`${slug}'s initiatives`}
            noun="initiatives"
            rows={list}
            columns={INITIATIVES}
            toolbar={<h2 className="t-card">Initiatives</h2>}
            rowKey={(i) => i.slug}
            rowHref={(i) => `/initiatives/${i.team}/${i.slug}`}
            loading={inits.isPending}
            error={inits.error?.message}
            onRetry={() => void inits.refetch()}
            pageSize={10}
            pageSizes={[10, 20, 50]}
            empty={{ title: 'No initiative yet', body: `${slug} is set up, and nobody has started a piece of work in it.` }}
          />
          <DataTable
            caption={`${slug}'s members`}
            noun="members"
            rows={members}
            columns={MEMBERS}
            toolbar={<h2 className="t-card">Members</h2>}
            rowKey={(m) => m.email}
            loading={team.isPending}
            error={team.error?.message}
            onRetry={() => void team.refetch()}
            pageSize={10}
            pageSizes={[10, 20, 50]}
            empty={{ title: 'Nobody is in this team' }}
          />
        </>
      )}
    </ConsolePage>
  );
}
