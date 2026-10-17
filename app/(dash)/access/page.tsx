import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata, may } from '@/data/access';
import { FLEET } from '@/data/features';
import type { AccessRead } from '@/views/access-context';
import { AccessAsOf, AccessSkeleton, AccessView } from '@/views/pages/access';
import { readAccess } from './read-access';

export function generateMetadata() { return gatedMetadata('access', { title: 'Access' }); }

/**
 * The page asks `access` before it renders; the rail hiding a destination is presentation, never this gate. The masthead
 * then stands outside the boundaries that wait for the read, and the one read, made on the console's server with the
 * caller's own cookie, is shared by the as-of line and the sections. Whether the caller is a superadmin, the one role
 * with a console scope to choose, is the server's answer too, so that section is in the first paint or nowhere.
 */
export default async function AccessPage() {
  const denied = await gate('access');
  if (denied) return denied;
  const read = readAccess();
  // The fleet grant is the superadmin's alone (`src/data/roles.ts`), and the gate has already placed the person.
  const superadmin = await may(FLEET);
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.main.label}</>}
      title="Access"
      description="What lets you and your agents in: your tokens, the applications and browsers signed in as you, your passkeys and the team you act for."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
      width="form"
    >
      <Suspense fallback={<Busy name="access"><AccessSkeleton /></Busy>}>
        <Sections read={read} superadmin={superadmin} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<AccessRead> }) {
  return <AccessAsOf read={await read} />;
}

async function Sections({ read, superadmin }: { read: Promise<AccessRead>; superadmin: boolean }) {
  return <AccessView served={await read} superadmin={superadmin} />;
}
