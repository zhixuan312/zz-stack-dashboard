import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import { PlatformStatusAsOf, PlatformStatusView, StatusSkeleton } from '@/views/pages/platform-status';
import type { StatusRead } from '@/views/platform-status-context';
import { readStatus } from './read-status';

export function generateMetadata() { return gatedMetadata('platform-status', { title: 'Status' }); }

/**
 * The page asks `platform-status` before it renders; the rail hiding a destination is presentation, never this gate.
 * The masthead then stands outside the boundaries that wait for the read, and the one read, made on the console's
 * server with the caller's own cookie, is shared by the as-of line and the page.
 */
export default async function PlatformStatusPage() {
  const denied = await gate('platform-status');
  if (denied) return denied;
  const read = readStatus();
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.platform.label}</>}
      title="Status"
      description="What needs attention, how real work called the platform's tools week by week, each door's days and what is running."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="status"><StatusSkeleton /></Busy>}>
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
