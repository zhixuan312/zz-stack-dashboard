import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import { PlatformUsageView, UsageAsOf, UsageSkeleton } from '@/views/pages/platform-usage';
import type { UsageRead } from '@/views/platform-usage-context';
import { readUsage } from './read-usage';

export function generateMetadata() { return gatedMetadata('usage', { title: 'Usage' }); }

/**
 * The page asks `usage` before it renders; the rail hiding a destination is presentation, never this gate. The
 * masthead then stands outside the boundaries that wait for the read, and the one read, made on the console's server
 * with the caller's own cookie, is shared by the as-of line and the page.
 */
export default async function PlatformUsagePage() {
  const denied = await gate('usage');
  if (denied) return denied;
  const read = readUsage();
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.platform.label}</>}
      title="Usage"
      description="How real work called the platform's tools, week by week: how much, how fast, what was refused, and when."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="usage"><UsageSkeleton /></Busy>}>
        <UsageBody read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<UsageRead> }) {
  return <UsageAsOf read={await read} />;
}

async function UsageBody({ read }: { read: Promise<UsageRead> }) {
  return <PlatformUsageView read={await read} />;
}
