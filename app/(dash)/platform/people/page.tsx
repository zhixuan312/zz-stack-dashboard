import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { gate, gatedMetadata } from '@/data/access';
import { AddPerson, PeopleAsOf, PeopleBusy, PlatformPeopleView } from '@/views/pages/platform-people';
import type { PeopleRead } from '@/views/people-context';
import { filtersOf } from '@/views/people-filter';
import { handed, readPeople } from './read-people';

export function generateMetadata() { return gatedMetadata('people', { title: 'People' }); }

/**
 * The page asks `people` before it renders; the rail hiding a destination is presentation, never this gate. The
 * masthead then stands outside the boundaries that wait for the read, and the one read of the address's page of people,
 * made on the console's server as the person, is shared by the as-of line and the records, handed to them as the page
 * draws it.
 */
export default async function PlatformPeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('people');
  if (denied) return denied;
  const read = searchParams.then((params) => readPeople(filtersOf(params))).then(handed);
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.platform.label}</>}
      title="People"
      description="Everybody the platform knows: their role, their teams, their passkeys and when they last signed in."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
      actions={<AddPerson />}
    >
      <Suspense fallback={<PeopleBusy />}>
        <PeopleList read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<PeopleRead> }) {
  return <PeopleAsOf served={await read} />;
}

async function PeopleList({ read }: { read: Promise<PeopleRead> }) {
  return <PlatformPeopleView served={await read} />;
}
