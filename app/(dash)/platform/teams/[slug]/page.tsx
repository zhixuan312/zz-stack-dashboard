import Link from 'next/link';
import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy, ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import { PlatformTeamView } from '@/views/pages/platform-team';
import { readTeam } from '../read-teams';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params) {
  return gatedMetadata('teams', { title: (await params).slug });
}

/**
 * The page asks `teams` before it renders, and before its address is read. The masthead is the slug and a sentence, so
 * it stands outside the boundary that waits for the team's one read, made on the console's server as the person.
 */
export default async function PlatformTeamPage({ params }: Params) {
  const denied = await gate('teams');
  if (denied) return denied;
  const { slug } = await params;
  return (
    <PageFrame
      kicker={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{app.name} · {workspaces.platform.label}</span>
          <span aria-hidden className="text-ink-3">/</span>
          <Link href="/platform/teams" className="hit rounded-xs hover:text-ink">Teams</Link>
        </span>
      }
      title={slug}
      description="One team: its people, its open work and lessons, and its real-work calls week by week."
    >
      <Suspense fallback={<Busy name="team"><TilesSkeleton count={4} /><ChartSkeleton height="h-56" /><TableSkeleton rows={4} filters={false} /></Busy>}>
        <Team slug={slug} />
      </Suspense>
    </PageFrame>
  );
}

async function Team({ slug }: { slug: string }) {
  return <PlatformTeamView slug={slug} served={await readTeam(slug)} />;
}
