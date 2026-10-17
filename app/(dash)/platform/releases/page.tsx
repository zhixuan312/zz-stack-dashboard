import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame, Row } from '@/components/base/shell';
import { Busy, ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import { PlatformReleasesView, ReleasesAsOf } from '@/views/pages/platform-releases';
import { filtersOf, type ReleasesRead } from '@/views/platform-releases-context';
import { readReleases } from './read-releases';

export function generateMetadata() { return gatedMetadata('releases', { title: 'Releases' }); }

/**
 * The page asks `releases` before it renders; the rail hiding a destination is presentation, never this gate. The
 * masthead then stands outside the boundaries that wait for the read, and the one read of the address's page of
 * releases, made on the console's server as the person, is shared by the as-of line and the page.
 */
export default async function PlatformReleasesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('releases');
  if (denied) return denied;
  const read = searchParams.then((params) => readReleases(filtersOf(params)));
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.platform.label}</>}
      title="Releases"
      description="Every recorded release, with what was observed in the 72 hours either side of it."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="releases"><TilesSkeleton count={4} /><Row split="1/2"><ChartSkeleton height="h-72" /><ChartSkeleton height="h-72" /></Row><TableSkeleton rows={6} filters={false} /></Busy>}>
        <Releases read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<ReleasesRead> }) {
  return <ReleasesAsOf served={await read} />;
}

async function Releases({ read }: { read: Promise<ReleasesRead> }) {
  return <PlatformReleasesView served={await read} />;
}
