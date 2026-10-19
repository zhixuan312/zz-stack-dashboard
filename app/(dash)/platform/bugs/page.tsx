import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame, Row } from '@/components/base/shell';
import { Busy, ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import { BugsAsOf, PlatformBugsView } from '@/views/pages/platform-bugs';
import { filtersOf, type BugsRead } from '@/views/platform-bugs-context';
import { readBugs } from './read-bugs';

export function generateMetadata() { return gatedMetadata('bugs', { title: 'Bugs' }); }

/**
 * The page asks `bugs` before it renders; the rail hiding a destination is presentation, never this gate. The masthead
 * then stands outside the boundaries that wait for the read, and the one read of the address's filters and page of the
 * queue, made on the console's server as the person, is shared by the as-of line and the page.
 */
export default async function PlatformBugsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('bugs');
  if (denied) return denied;
  const read = searchParams.then((params) => readBugs(filtersOf(params)));
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.platform.label}</>}
      title="Bugs"
      description="Every real bug report: what is open, how long it has waited, and how each was resolved."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="bugs"><TilesSkeleton count={4} /><TableSkeleton rows={6} /><Row split="1/2"><ChartSkeleton height="h-72" /><ChartSkeleton height="h-72" /></Row></Busy>}>
        <BugsQueue read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<BugsRead> }) {
  return <BugsAsOf served={await read} />;
}

async function BugsQueue({ read }: { read: Promise<BugsRead> }) {
  return <PlatformBugsView served={await read} />;
}
