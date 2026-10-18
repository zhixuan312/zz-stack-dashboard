import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import type { AccessRead } from '@/views/access-context';
import { AccessAsOf, AccessSkeleton, AccessView } from '@/views/pages/access';
import { readAccess } from './read-access';

export function generateMetadata() { return gatedMetadata('access', { title: 'Access' }); }

/**
 * The page asks `access` before it renders; the rail hiding a destination is presentation, never this gate. The masthead
 * then stands outside the boundaries that wait for the read, and the one read, made on the console's server with the
 * caller's own cookie, is shared by the as-of line and the sections.
 */
export default async function AccessPage() {
  const denied = await gate('access');
  if (denied) return denied;
  const read = readAccess();
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.main.label}</>}
      title="Access"
      description="What lets you and your agents in: your tokens, the applications and browsers signed in as you, your passkeys and the team you act for."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
      width="form"
    >
      <Suspense fallback={<Busy name="access"><AccessSkeleton /></Busy>}>
        <Sections read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<AccessRead> }) {
  return <AccessAsOf read={await read} />;
}

async function Sections({ read }: { read: Promise<AccessRead> }) {
  return <AccessView served={await read} />;
}
