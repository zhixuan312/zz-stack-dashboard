import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import { RunsActions, RunsAsOf, RunsSkeleton, RunsView } from '@/views/pages/runs';
import { filtersOf, type RunsRead } from '@/views/runs-context';
import { readRuns } from './read-runs';

export function generateMetadata() { return gatedMetadata('runs', { title: 'Runs' }); }

/**
 * The page asks `runs` before it renders; the rail hiding a destination is presentation, never this gate. The masthead
 * then stands outside the boundaries that wait for the read, the skill control usable before it answers, and the one
 * read of the address's skill and page of recent runs, made on the console's server as the person, is shared by the
 * as-of line, the skill control and the body.
 */
export default async function RunsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('runs');
  if (denied) return denied;
  const read = searchParams.then((params) => readRuns(filtersOf(params)));
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.main.label}</>}
      title="Runs"
      description="Every run your team recorded, by the skill that drove it, and the latest of them."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
      actions={<Suspense fallback={<RunsActions served={null} />}><Actions read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="runs"><RunsSkeleton /></Busy>}>
        <Body read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<RunsRead> }) {
  return <RunsAsOf served={await read} />;
}

async function Actions({ read }: { read: Promise<RunsRead> }) {
  return <RunsActions served={await read} />;
}

async function Body({ read }: { read: Promise<RunsRead> }) {
  return <RunsView served={await read} />;
}
