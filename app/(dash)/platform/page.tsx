import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy, TilesSkeleton } from '@/components/patterns/page-loading';
import { gate } from '@/data/access';
import { PlatformStatusAsOf, PlatformStatusView } from '@/views/pages/platform-status';
import type { StatusRead } from '@/views/platform-status-context';
import { readStatus } from './read-status';

export const metadata = { title: 'Status' };

/**
 * The page asks `platform-status` before it renders; the rail hiding a destination is presentation, never this gate.
 * The masthead then stands outside the boundaries that wait for the read, and the one read is shared by the as-of line
 * and the tile.
 */
export default async function PlatformStatusPage() {
  const denied = await gate('platform-status');
  if (denied) return denied;
  const read = readStatus();
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.platform.label}</>}
      title="Status"
      description="Malformed tool calls in real work, in the last whole week."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="status"><TilesSkeleton count={1} /></Busy>}>
        <Status read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<StatusRead> }) {
  return <PlatformStatusAsOf read={await read} />;
}

async function Status({ read }: { read: Promise<StatusRead> }) {
  return <PlatformStatusView read={await read} />;
}
