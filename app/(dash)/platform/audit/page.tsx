import { Suspense } from 'react';
import { app, workspaces } from '@/app.config';
import { PageFrame } from '@/components/base/shell';
import { Busy } from '@/components/patterns/page-loading';
import { gate, gatedMetadata } from '@/data/access';
import { AuditAsOf, PlatformAuditView } from '@/views/pages/platform-audit';
import { filtersOf, type AuditRead } from '@/views/platform-audit-context';
import { AuditSkeleton } from './audit-skeleton';
import { readAudit } from './read-audit';

export function generateMetadata() { return gatedMetadata('audit', { title: 'Audit' }); }

/**
 * The page asks `audit` before it renders, so a member is answered by the refused page and nothing here is read; the
 * rail hiding a destination is presentation, never this gate. The masthead then stands outside the boundaries that wait
 * for the read, and the one read of the address's tab, filters and page, made on the console's server as the person, is
 * shared by the as-of line and the page.
 */
export default async function PlatformAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const denied = await gate('audit');
  if (denied) return denied;
  const read = searchParams.then((params) => readAudit(filtersOf(params)));
  return (
    <PageFrame
      kicker={<>{app.name} · {workspaces.platform.label}</>}
      title="Audit"
      description="Who changed who may do what on the platform, each act said in one sentence, and every recorded event behind it."
      meta={<Suspense fallback={null}><AsOf read={read} /></Suspense>}
    >
      <Suspense fallback={<Busy name="audit"><AuditSkeleton /></Busy>}>
        <AuditBody read={read} />
      </Suspense>
    </PageFrame>
  );
}

async function AsOf({ read }: { read: Promise<AuditRead> }) {
  return <AuditAsOf served={await read} />;
}

async function AuditBody({ read }: { read: Promise<AuditRead> }) {
  return <PlatformAuditView served={await read} />;
}
