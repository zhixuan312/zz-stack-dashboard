import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';
import { gate, gatedMetadata } from '@/data/access';
import { CreateTeam, PlatformTeamsView, TeamsAsOf } from '@/views/pages/platform-teams';
import type { TeamsRead } from '@/views/teams-context';
import { filtersOf } from '@/views/teams-filter';
import { readTeams } from './read-teams';

export function generateMetadata() { return gatedMetadata('teams', { title: 'Teams' }); }

/**
 * The page asks `teams` before it renders; the rail hiding a destination is presentation, never this gate. The masthead
 * then stands outside the boundaries that wait for the read, and the one read of the address's page of teams, made on
 * the console's server as the person, is shared by the as-of line and the records.
 */
export default async function PlatformTeamsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('teams');
  if (denied) return denied;
  const read = searchParams.then((params) => readTeams(filtersOf(params)));
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.platform.label}</>}
      title="Teams"
      description="Every team on the platform, each against its own past weeks."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
      actions={<CreateTeam />}
    >
      <Suspense fallback={<Busy name="teams"><RecordsSkeleton tiles={4} rows={6} /></Busy>}>
        <Teams read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<TeamsRead> }) {
  return <TeamsAsOf served={await read} />;
}

async function Teams({ read }: { read: Promise<TeamsRead> }) {
  return <PlatformTeamsView served={await read} />;
}
