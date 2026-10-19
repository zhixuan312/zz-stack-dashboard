import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { gate, gatedMetadata } from '@/data/access';
import type { InitiativesRead } from '@/views/initiatives-context';
import { filtersOf } from '@/views/initiatives-filter';
import { InitiativesAsOf, InitiativesBusy, InitiativesView } from '@/views/pages/initiatives';
import { handed, readInitiatives } from './read-initiatives';

export function generateMetadata() { return gatedMetadata('initiatives', { title: 'Initiatives' }); }

/**
 * The page asks `initiatives` before it renders; the rail hiding a destination is presentation, never this gate. The
 * masthead then stands outside the boundaries that wait for the read, and the one read of the address's page of the
 * team's work, made on the console's server as the person, is shared by the as-of line and the records, handed to them
 * as the page draws it.
 */
export default async function InitiativesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('initiatives');
  if (denied) return denied;
  const read = searchParams.then((params) => readInitiatives(filtersOf(params))).then(handed);
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.main.label}</>}
      title="Initiatives"
      description="Every piece of work your active team has open or closed, and where each goes next."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
    >
      <Suspense fallback={<InitiativesBusy />}>
        <Initiatives read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<InitiativesRead> }) {
  return <InitiativesAsOf served={await read} />;
}

async function Initiatives({ read }: { read: Promise<InitiativesRead> }) {
  return <InitiativesView served={await read} />;
}
