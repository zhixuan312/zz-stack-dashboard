import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import { filtersOf, type ApprovalsRead } from '@/views/approvals-context';
import { ApprovalsAsOf, ApprovalsSkeleton, ApprovalsView } from '@/views/pages/approvals';
import { readApprovals } from './read-approvals';

export function generateMetadata() { return gatedMetadata('approvals', { title: 'Approvals' }); }

/**
 * The page asks `approvals` before it renders; the rail hiding a destination is presentation, never this gate. The
 * masthead then stands outside the boundaries that wait for the read, and the one read of the address's tab and page,
 * made on the console's server as the person, is shared by the as-of line and the page.
 */
export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('approvals');
  if (denied) return denied;
  const read = searchParams.then((params) => readApprovals(filtersOf(params)));
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.main.label}</>}
      title="Approvals"
      description="What waits on your team for a decision, and every approval recorded in your name, with what the record holds of each."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="approvals"><ApprovalsSkeleton /></Busy>}>
        <Body read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<ApprovalsRead> }) {
  return <ApprovalsAsOf served={await read} />;
}

async function Body({ read }: { read: Promise<ApprovalsRead> }) {
  return <ApprovalsView served={await read} />;
}
