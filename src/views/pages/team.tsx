'use client';

import { use } from 'react';
import { BookOpen, ListTree, Signature, Users } from 'lucide-react';
import { Row } from '@/components/base/shell';
import { MetricTile } from '@/components/patterns/metric-tile';
import { DataTable, type Column } from '@/components/patterns/data-table';
import { AskAbout } from '@/components/patterns/ask-about';
import { Badge } from '@/components/ui/badge';
import { aligned } from '@/console/columns';
import { ConsolePage, useArrival } from '@/console/page';
import { failureOf } from '@/console/query';
import { freshnessOf, useConsole } from '@/lib/api';
import { plural } from '@/lib/format';
import type { TeamDetail } from '@/lib/fleet-shapes';
import { formatDate } from '@/lib/format-date';
import { useLive } from '@/lib/live';
import { pendingContext } from '@/views/context';
import { teamContext } from '@/views/team-context';

type Member = TeamDetail['members'][number];

const MEMBERS: Column<Member>[] = aligned([
  {
    key: 'person', header: 'Person', grow: true, truncate: true, mobile: 'title', sortValue: (m) => m.name || m.email,
    cell: (m) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium text-ink" title={m.name || m.email}>{m.name || m.email}</span>
        {m.name ? <span className="t-caption block truncate" title={m.email}>{m.email}</span> : null}
      </span>
    ),
    mobileCell: (m) => m.name || m.email,
  },
  { key: 'role', header: 'Role', mobile: 'status', sortValue: (m) => m.role, cell: (m) => <Badge tone={m.role === 'admin' ? 'accent' : 'neutral'}>{m.role === 'admin' ? 'Admin' : 'Member'}</Badge> },
  { key: 'joined', header: 'Joined', numeric: true, mobile: 'fact', sortValue: (m) => m.joined, cell: (m) => formatDate(m.joined), mobileCell: (m) => `Joined ${formatDate(m.joined)}` },
]);

/**
 * One team: what it holds, how much of its work is open and waiting, and who is in it. Its counts are the team's own
 * read, the same functions as its row in the list. Its initiatives are not listed: Work answers the active team's work
 * alone, so another team's is read nowhere in the console.
 */
export function TeamView({ params }: { params: Promise<{ slug: string }> }) {
  useLive(['teams']);
  const { slug } = use(params);
  const team = useConsole<TeamDetail>(`/teams/${slug}`);
  const held = team.data?.counts;
  const tiles = team.data?.tiles;
  const members = team.data?.members ?? [];
  const missing = team.error?.status === 404;
  const arrival = useArrival(team);
  const context = team.data
    ? teamContext(slug, { team: team.data, ...arrival })
    : pendingContext({ view: 'team', title: `Team ${slug}`, address: `/teams/${slug}`, scope: 'one team' }, missing ? 'No team by this name exists on the platform.' : failureOf(team));
  const pending = team.isPending ? '…' : '—';

  return (
    <ConsolePage
      title={slug}
      crumbs={[{ label: 'Teams', href: '/teams' }, { label: slug }]}
      // The name only when it says something the slug does not.
      // Always a line, so the masthead does not grow under the reader when the team arrives.
      // A sentence first, always: this is the page's largest text block, and a masthead whose only
      // line is the team's own name paints at hydration (measured 2.32s) where a sentence in the
      // HTML paints at 0.61s. The same trade `/initiatives/[team]/[slug]` makes with its badge.
      description={<span className="inline-flex flex-wrap items-center gap-2">{missing ? 'No team by this name exists on the platform.' : <>What this team holds: its people, its work, and what it has settled.{team.data ? ` Created ${formatDate(team.data.team.created)}${team.data.team.name !== slug ? ` from ${team.data.team.name}` : ''}.` : null}</>}</span>}
      showPeriod={false}
      updatedAt={freshnessOf(team)}
      context={context}
    >
      {missing ? null : (
        <>
          <Row split="tiles">
            <MetricTile label="Initiatives" icon={<ListTree />} value={held ? held.initiatives : pending} note={tiles ? `${tiles.openWork} still open` : undefined} />
            <MetricTile label="Revisions waiting" icon={<Signature />} value={tiles ? tiles.waiting : pending} emphasis={(tiles?.waiting ?? 0) > 0} note={tiles?.waiting ? 'Presented and not yet approved' : 'Nothing waits on a decision'} />
            <MetricTile label="Members" icon={<Users />} value={team.data ? members.length : pending} note={`${members.filter((m) => m.role === 'admin').length} ${plural(members.filter((m) => m.role === 'admin').length, 'admin')}`} />
            <MetricTile label="Knowledge nodes" icon={<BookOpen />} value={held ? held.knowledge : pending} note={held ? `${held.documents} ${plural(held.documents, 'document')}, ${held.sources} ${plural(held.sources, 'source')}` : undefined} />
          </Row>
          <DataTable
            caption={`${slug}'s members`}
            noun="members"
            rows={members}
            columns={MEMBERS}
            toolbar={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="t-card min-w-0">Members</h2>
                <AskAbout question={`Who is in ${slug}, who administers it, and who joined most recently?`} />
              </div>
            }
            rowKey={(m) => m.email}
            loading={team.isPending}
            error={failureOf(team)}
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
