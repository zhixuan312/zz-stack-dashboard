import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import { KnowledgeHealthAsOf, KnowledgeHealthSkeleton, PlatformKnowledgeView } from '@/views/pages/platform-knowledge';
import type { KnowledgeHealthRead } from '@/views/platform-knowledge-context';
import { readKnowledgeHealth } from './read-knowledge';

export function generateMetadata() { return gatedMetadata('knowledge-health', { title: 'Knowledge health' }); }

/**
 * The page asks `knowledge-health` before it renders; the rail hiding a destination is presentation, never this gate.
 * The masthead then stands outside the boundaries that wait for the read, and the one read, made on the console's
 * server with the caller's own cookie, is shared by the as-of line and the page.
 */
export default async function PlatformKnowledgePage() {
  const denied = await gate('knowledge-health');
  if (denied) return denied;
  const read = readKnowledgeHealth();
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.platform.label}</>}
      title="Knowledge health"
      description="What stands on each shelf, what was made week by week with the imports told apart, and how the searches went."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="knowledge health"><KnowledgeHealthSkeleton /></Busy>}>
        <KnowledgeBody read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<KnowledgeHealthRead> }) {
  return <KnowledgeHealthAsOf read={await read} />;
}

async function KnowledgeBody({ read }: { read: Promise<KnowledgeHealthRead> }) {
  return <PlatformKnowledgeView read={await read} />;
}
